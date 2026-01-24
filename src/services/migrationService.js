/**
 * Migration Service - Migrates existing internal storage data to SAF public storage
 *
 * This service handles one-time migration of data from the app's internal storage
 * to the public Documents folder via SAF (Storage Access Framework).
 *
 * Migration is needed for users who have existing captured data before the SAF
 * feature was added, so their files become visible in the device's file manager.
 */

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  getImagesDir,
  hasSAFPermission,
  shouldUseSAF,
  saveImageToSAF,
  getSAFMunicipalityDir,
} from './storageService';
import { readCSV, parseCSVContent } from './csvService';

const SAF = FileSystem.StorageAccessFramework;
const MIGRATION_KEY = '@agricapture_migration_complete';
const MIGRATION_VERSION = 1; // Increment if migration logic changes

/**
 * Check if migration is needed
 * @returns {Promise<{needed: boolean, reason?: string}>}
 */
export const isMigrationNeeded = async () => {
  // Only relevant on Android with SAF
  if (Platform.OS !== 'android' || !shouldUseSAF()) {
    return { needed: false, reason: 'Not Android or SAF not applicable' };
  }

  // Check if SAF permission is granted
  const hasSAF = await hasSAFPermission();
  if (!hasSAF) {
    return { needed: false, reason: 'SAF permission not granted' };
  }

  // Check if migration already completed
  try {
    const migrationStatus = await AsyncStorage.getItem(MIGRATION_KEY);
    if (migrationStatus) {
      const status = JSON.parse(migrationStatus);
      if (status.version >= MIGRATION_VERSION && status.complete) {
        return { needed: false, reason: 'Migration already completed' };
      }
    }
  } catch (e) {
    console.log('[Migration] Error checking migration status:', e.message);
  }

  // Check if there's internal data to migrate
  try {
    const csvContent = await readCSV();
    const rows = parseCSVContent(csvContent);
    const recordCount = rows.length - 1; // Exclude header

    if (recordCount <= 0) {
      return { needed: false, reason: 'No data to migrate' };
    }

    console.log('[Migration] Found', recordCount, 'records to potentially migrate');
    return { needed: true, recordCount };
  } catch (e) {
    console.log('[Migration] Error checking internal data:', e.message);
    return { needed: false, reason: 'Error checking data: ' + e.message };
  }
};

/**
 * Get migration statistics without performing migration
 * @returns {Promise<{records: number, images: number, municipalities: string[]}>}
 */
export const getMigrationStats = async () => {
  try {
    const csvContent = await readCSV();
    const rows = parseCSVContent(csvContent);

    if (rows.length <= 1) {
      return { records: 0, images: 0, municipalities: [] };
    }

    const headers = rows[0];
    const municipalityIndex = headers.indexOf('municipality');
    const imageFilenameIndex = headers.indexOf('image_filename');

    const municipalities = new Set();
    let imageCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      municipalities.add(row[municipalityIndex] || 'Unknown');
      if (row[imageFilenameIndex]) {
        imageCount++;
      }
    }

    return {
      records: rows.length - 1,
      images: imageCount,
      municipalities: Array.from(municipalities),
    };
  } catch (e) {
    console.error('[Migration] Error getting stats:', e.message);
    return { records: 0, images: 0, municipalities: [] };
  }
};

/**
 * Perform migration of existing data to SAF public storage
 * @param {function} onProgress - Callback for progress updates (0-100)
 * @returns {Promise<{success: boolean, migrated: {records: number, images: number}, errors: string[]}>}
 */
export const migrateToPublicStorage = async (onProgress = () => {}) => {
  const result = {
    success: false,
    migrated: { records: 0, images: 0 },
    errors: [],
  };

  console.log('[Migration] Starting migration to public storage...');
  onProgress(0);

  try {
    // Read existing CSV data
    const csvContent = await readCSV();
    const rows = parseCSVContent(csvContent);

    if (rows.length <= 1) {
      result.success = true;
      await markMigrationComplete();
      return result;
    }

    const headers = rows[0];
    const municipalityIndex = headers.indexOf('municipality');
    const imageFilenameIndex = headers.indexOf('image_filename');
    const uuidIndex = headers.indexOf('uuid');

    const totalRecords = rows.length - 1;
    console.log('[Migration] Processing', totalRecords, 'records');

    // Group records by municipality
    const recordsByMunicipality = {};
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const municipality = row[municipalityIndex] || 'Unknown';
      if (!recordsByMunicipality[municipality]) {
        recordsByMunicipality[municipality] = [];
      }
      recordsByMunicipality[municipality].push({ row, headers, index: i });
    }

    const municipalities = Object.keys(recordsByMunicipality);
    console.log('[Migration] Found', municipalities.length, 'municipalities');

    // Process each municipality
    let processedRecords = 0;
    for (const municipality of municipalities) {
      const records = recordsByMunicipality[municipality];
      console.log('[Migration] Processing municipality:', municipality, '(', records.length, 'records)');

      // Ensure municipality folder exists in SAF
      try {
        await getSAFMunicipalityDir(municipality);
      } catch (e) {
        console.error('[Migration] Error creating municipality folder:', e.message);
        result.errors.push(`Failed to create folder for ${municipality}: ${e.message}`);
        continue;
      }

      // Process each record
      for (const { row, headers } of records) {
        const imageFilename = row[imageFilenameIndex];
        const uuid = row[uuidIndex];

        // Build data object from row
        const data = {};
        headers.forEach((header, index) => {
          data[header] = row[index] || '';
        });

        // Copy image to SAF if exists
        if (imageFilename) {
          try {
            // Try to find the image file
            let sourcePath = imageFilename;

            // Check if it's a relative path
            if (!imageFilename.startsWith('/') && !imageFilename.startsWith('file://')) {
              sourcePath = `${getImagesDir()}${imageFilename}`;
            }

            const fileInfo = await FileSystem.getInfoAsync(sourcePath);
            if (fileInfo.exists) {
              const filename = sourcePath.split('/').pop();
              const safResult = await saveImageToSAF(sourcePath, filename, municipality);

              if (safResult.success) {
                result.migrated.images++;
              } else {
                result.errors.push(`Failed to migrate image ${filename}: ${safResult.error}`);
              }
            } else {
              console.log('[Migration] Image not found:', sourcePath);
            }
          } catch (e) {
            console.error('[Migration] Error copying image:', e.message);
            result.errors.push(`Error copying image for ${uuid}: ${e.message}`);
          }
        }

        // Append record to municipality CSV in SAF
        // Note: This adds to the SAF CSV but the main CSV already has the record
        try {
          // We only need to write to SAF CSV, not the main CSV (which already has the record)
          // So we use a direct SAF write instead of appendToMunicipalityCSV
          await appendRecordToSAFCSV(municipality, data);
          result.migrated.records++;
        } catch (e) {
          console.error('[Migration] Error appending CSV record:', e.message);
          result.errors.push(`Error migrating record ${uuid}: ${e.message}`);
        }

        // Update progress
        processedRecords++;
        const progress = Math.round((processedRecords / totalRecords) * 100);
        onProgress(progress);
      }
    }

    // Mark migration as complete
    await markMigrationComplete();
    result.success = true;

    console.log('[Migration] Migration complete:', result.migrated);
    if (result.errors.length > 0) {
      console.log('[Migration] Errors:', result.errors.length);
    }

    return result;
  } catch (e) {
    console.error('[Migration] Migration failed:', e.message);
    result.errors.push('Migration failed: ' + e.message);
    return result;
  }
};

/**
 * Append a single record to the SAF municipality CSV
 * @param {string} municipality - Municipality name
 * @param {Object} data - Record data object
 */
const appendRecordToSAFCSV = async (municipality, data) => {
  const CSV_HEADERS = [
    'uuid', 'spot_number', 'shot_number', 'shots_in_spot', 'image_filename',
    'image_width', 'image_height', 'image_quality', 'capture_datetime',
    'latitude', 'longitude', 'altitude_m', 'altitude_accuracy_m', 'gps_accuracy_m',
    'gps_reading_count', 'camera_pitch', 'camera_roll', 'camera_heading',
    'municipality', 'barangay', 'farm_name', 'crops', 'temperature_c',
    'humidity_percent', 'notes', 'device_id', 'capture_mode',
  ];

  const row = CSV_HEADERS.map(header => {
    let value = data[header];
    if (value === null || value === undefined) return '';
    value = String(value);
    value = value.replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ');
    if (value.includes(',') || value.includes('"')) {
      value = `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }).join(',');

  const municipalityResult = await getSAFMunicipalityDir(municipality);
  if (!municipalityResult.success) {
    throw new Error(municipalityResult.error || 'Failed to get municipality directory');
  }

  const municipalityUri = municipalityResult.uri;
  const contents = await SAF.readDirectoryAsync(municipalityUri);

  let csvUri = contents.find(uri =>
    decodeURIComponent(uri).toLowerCase().includes('agricapture_data.csv')
  );

  if (csvUri) {
    // Append to existing CSV
    let existingContent = await FileSystem.readAsStringAsync(csvUri);
    if (existingContent && !existingContent.endsWith('\n')) {
      existingContent += '\n';
    }
    await FileSystem.writeAsStringAsync(csvUri, existingContent + row + '\n');
  } else {
    // Create new CSV with headers
    csvUri = await SAF.createFileAsync(municipalityUri, 'agricapture_data', 'text/csv');
    const newContent = CSV_HEADERS.join(',') + '\n' + row + '\n';
    await FileSystem.writeAsStringAsync(csvUri, newContent);
  }
};

/**
 * Mark migration as complete
 */
const markMigrationComplete = async () => {
  try {
    await AsyncStorage.setItem(MIGRATION_KEY, JSON.stringify({
      version: MIGRATION_VERSION,
      complete: true,
      timestamp: new Date().toISOString(),
    }));
    console.log('[Migration] Marked as complete');
  } catch (e) {
    console.error('[Migration] Error saving migration status:', e.message);
  }
};

/**
 * Reset migration status (for testing or re-migration)
 */
export const resetMigration = async () => {
  try {
    await AsyncStorage.removeItem(MIGRATION_KEY);
    console.log('[Migration] Reset migration status');
  } catch (e) {
    console.error('[Migration] Error resetting migration:', e.message);
  }
};
