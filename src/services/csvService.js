// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppRootDir, ensureDir } from './storageService';
import { isSAFInitialized, saveMunicipalityCSVToPublicStorage, readCSVFromPublicStorage } from './publicStorageService';

const BACKUP_KEY_PREFIX = '@agricapture_backup_';

const CSV_HEADERS = [
  'uuid',
  'spot_number',
  'shot_number',
  'shots_in_spot',
  'image_filename',
  'image_width',
  'image_height',
  'image_quality',
  'capture_datetime',
  'latitude',
  'longitude',
  'altitude_m',
  'altitude_accuracy_m',
  'gps_accuracy_m',
  'gps_reading_count',
  'camera_pitch',
  'camera_roll',
  'camera_heading',
  'municipality',
  'barangay',
  'farm_name',
  'crops',
  'temperature_c',
  'humidity_percent',
  'notes',
  'device_id',
  'capture_mode'  // 'field' or 'controlled'
];

// Use lazy evaluation for paths to ensure FileSystem.documentDirectory is available
// This is evaluated at runtime, not module load time
const getCSVDir = () => `${FileSystem.documentDirectory}AgriCapture/data/`;
const getCSVFilePath = () => `${getCSVDir()}agricapture_collections.csv`;

// Async version that supports external storage
const getCSVDirAsync = async () => {
  const { getDataDirAsync } = await import('./storageService');
  return await getDataDirAsync();
};

const getCSVFilePathAsync = async () => {
  const dir = await getCSVDirAsync();
  return `${dir}agricapture_collections.csv`;
};

// In-memory cache to avoid re-reading and re-parsing the CSV on every operation.
// Invalidated on any write (append, delete, update, reset, init).
let csvCache = null;

/** Clear CSV cache. Call after any write to the CSV file. */
export const invalidateCSVCache = () => {
  csvCache = null;
};

/**
 * Retry wrapper for async operations
 */
const withRetry = async (operation, maxRetries = 3, delay = 200) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`[CSVService] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, delay * attempt));
    }
  }
};

/**
 * Initialize the CSV file and required directories
 * Uses async paths so CSV is stored in external storage when configured (same as images/exports)
 * @returns {Promise<{success: boolean, error?: string, created?: boolean}>}
 */
export const initCSV = async () => {
  console.log('[CSVService] Initializing CSV storage...');

  try {
    const dataDir = await getCSVDirAsync();
    const dataCreated = await ensureDir(dataDir);
    if (!dataCreated) {
      throw new Error('Failed to create data directory');
    }
    console.log('[CSVService] Data directory ready:', dataDir);

    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await FileSystem.getInfoAsync(csvPath);

    if (!fileInfo.exists) {
      console.log('[CSVService] Creating new CSV file with headers...');
      await withRetry(async () => {
        await FileSystem.writeAsStringAsync(csvPath, CSV_HEADERS.join(',') + '\n');
      });
      invalidateCSVCache();

      const verifyInfo = await FileSystem.getInfoAsync(csvPath);
      if (!verifyInfo.exists) {
        throw new Error('CSV file creation verification failed');
      }

      console.log('[CSVService] CSV file created successfully');
      return { success: true, created: true };
    }

    console.log('[CSVService] CSV file already exists, size:', fileInfo.size);
    return { success: true, created: false };
  } catch (error) {
    console.error('[CSVService] Failed to initialize CSV:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Append a data row to the CSV file
 * @param {Object} data - Object with keys matching CSV_HEADERS
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const appendToCSV = async (data) => {
  console.log('[CSVService] Appending data to CSV, uuid:', data.uuid);

  try {
    const csvPath = await getCSVFilePathAsync();
    const csvInfo = await FileSystem.getInfoAsync(csvPath);
    if (!csvInfo.exists) {
      console.log('[CSVService] CSV file not found, initializing...');
      const initResult = await initCSV();
      if (!initResult.success) {
        throw new Error(`CSV initialization failed: ${initResult.error}`);
      }
    }

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

    await withRetry(async () => {
      let existingContent = '';
      try {
        existingContent = await readCSV();
      } catch (readErr) {
        console.warn('[CSVService] Could not read existing CSV, starting fresh:', readErr.message);
        existingContent = CSV_HEADERS.join(',') + '\n';
      }
      if (existingContent && !existingContent.endsWith('\n')) {
        existingContent += '\n';
      }
      const newContent = existingContent + row + '\n';
      await FileSystem.writeAsStringAsync(csvPath, newContent);
      invalidateCSVCache();
      console.log('[CSVService] CSV written, previous size:', existingContent.length, 'new size:', newContent.length);
    });

    const afterInfo = await FileSystem.getInfoAsync(csvPath);
    console.log('[CSVService] CSV append successful, new size:', afterInfo.size);
    return { success: true };
  } catch (error) {
    console.error('[CSVService] Failed to append to CSV:', error.message);
    throw new Error(`CSV append failed: ${error.message}`);
  }
};

/**
 * Read the entire CSV file contents. Uses in-memory cache when valid to avoid
 * repeated disk reads and parsing as data grows.
 * @returns {Promise<string>} CSV content string
 */
export const readCSV = async () => {
  try {
    const csvPath = await getCSVFilePathAsync();
    if (csvCache && csvCache.path === csvPath && csvCache.content != null) {
      return csvCache.content;
    }
    const fileInfo = await FileSystem.getInfoAsync(csvPath);
    if (!fileInfo.exists) {
      console.log('[CSVService] CSV file does not exist, returning headers only');
      const headersOnly = CSV_HEADERS.join(',') + '\n';
      csvCache = { content: headersOnly, parsed: [CSV_HEADERS.slice()], path: csvPath };
      return headersOnly;
    }
    const content = await FileSystem.readAsStringAsync(csvPath);
    console.log('[CSVService] Read CSV file, size:', content.length);
    const parsed = parseCSVContent(content);
    csvCache = { content, parsed, path: csvPath };
    return content;
  } catch (error) {
    console.error('[CSVService] Error reading CSV:', error.message);
    throw new Error(`Failed to read CSV file: ${error.message}`);
  }
};

/** Sync path (internal only). For sharing/export use getCSVPathAsync() so path matches actual storage (external when configured). */
export const getCSVPath = () => getCSVFilePath();

/** Async path - use for sharing/export so CSV is read from same location as app (external storage when configured). */
export const getCSVPathAsync = () => getCSVFilePathAsync();

export const getCSVHeaders = () => CSV_HEADERS;

/**
 * Verify CSV storage is working and return diagnostic info
 * @returns {Promise<Object>} Diagnostic information about CSV storage
 */
export const verifyCSVStorage = async () => {
  console.log('[CSVService] === Verifying CSV Storage ===');

  const csvDir = await getCSVDirAsync();
  const csvPath = await getCSVFilePathAsync();
  const diagnostics = {
    success: true,
    documentDirectory: FileSystem.documentDirectory,
    csvDir,
    csvPath,
    dirExists: false,
    fileExists: false,
    fileSize: 0,
    rowCount: 0,
    canWrite: false,
    canRead: false,
    errors: [],
  };

  try {
    if (!FileSystem.documentDirectory) {
      diagnostics.success = false;
      diagnostics.errors.push('FileSystem.documentDirectory is null/undefined');
      return diagnostics;
    }

    const dirInfo = await FileSystem.getInfoAsync(csvDir);
    diagnostics.dirExists = dirInfo.exists;

    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(csvDir, { intermediates: true });
      const verifyDir = await FileSystem.getInfoAsync(csvDir);
      diagnostics.dirExists = verifyDir.exists;
      if (!verifyDir.exists) {
        diagnostics.success = false;
        diagnostics.errors.push('Failed to create CSV directory');
      }
    }

    const fileInfo = await FileSystem.getInfoAsync(csvPath);
    diagnostics.fileExists = fileInfo.exists;
    diagnostics.fileSize = fileInfo.size || 0;

    try {
      const testPath = `${csvDir}.csv_test`;
      await FileSystem.writeAsStringAsync(testPath, 'test');
      const readBack = await FileSystem.readAsStringAsync(testPath);
      await FileSystem.deleteAsync(testPath, { idempotent: true });
      diagnostics.canWrite = readBack === 'test';
      diagnostics.canRead = readBack === 'test';
    } catch (writeError) {
      diagnostics.canWrite = false;
      diagnostics.canRead = false;
      diagnostics.errors.push(`Write test failed: ${writeError.message}`);
    }

    if (diagnostics.fileExists) {
      try {
        const content = await FileSystem.readAsStringAsync(csvPath);
        const rows = parseCSVContent(content);
        diagnostics.rowCount = Math.max(0, rows.length - 1);
      } catch (readError) {
        diagnostics.errors.push(`Read test failed: ${readError.message}`);
      }
    }
  } catch (error) {
    diagnostics.success = false;
    diagnostics.errors.push(`Verification error: ${error.message}`);
  }

  return diagnostics;
};

/**
 * Reset the CSV file (clear all data, keep headers)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const resetCSV = async () => {
  console.log('[CSVService] Resetting CSV file...');
  try {
    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await FileSystem.getInfoAsync(csvPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(csvPath, { idempotent: true });
    }
    await FileSystem.writeAsStringAsync(csvPath, CSV_HEADERS.join(',') + '\n');
    invalidateCSVCache();
    const verifyInfo = await FileSystem.getInfoAsync(csvPath);
    if (!verifyInfo.exists) {
      throw new Error('Failed to create new CSV file');
    }
    return { success: true };
  } catch (error) {
    console.error('[CSVService] Failed to reset CSV:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get total record count (fast, without full parsing)
 * Counts lines in CSV excluding header and empty lines.
 * @returns {Promise<number>} Total number of data records (excluding header)
 */
export const getRecordCount = async () => {
  try {
    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await FileSystem.getInfoAsync(csvPath);
    if (!fileInfo.exists) {
      console.log('[CSVService] CSV file does not exist, returning count 0');
      return 0;
    }

    const content = await FileSystem.readAsStringAsync(csvPath);
    if (!content || content.trim().length === 0) {
      return 0;
    }

    // Fast line counting: split by newlines and count non-empty lines
    // Normalize line endings first
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n').filter(line => line.trim().length > 0);

    // Subtract 1 for header row
    const count = Math.max(0, lines.length - 1);
    console.log('[CSVService] Fast record count:', count);
    return count;
  } catch (error) {
    console.error('[CSVService] Error getting record count:', error.message);
    return 0;
  }
};

/**
 * Get paginated records from CSV
 * @param {number} page - Zero-indexed page number
 * @param {number} pageSize - Number of records per page (default 50)
 * @returns {Promise<{records: Array, page: number, pageSize: number, totalRecords: number, totalPages: number, hasNextPage: boolean, hasPrevPage: boolean}>}
 */
export const getRecordsPaginated = async (page = 0, pageSize = 50) => {
  const emptyResult = {
    records: [],
    page: 0,
    pageSize,
    totalRecords: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  try {
    // Validate inputs
    if (page < 0) page = 0;
    if (pageSize < 1) pageSize = 50;

    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await FileSystem.getInfoAsync(csvPath);
    if (!fileInfo.exists) {
      console.log('[CSVService] CSV file does not exist for pagination');
      return emptyResult;
    }

    const content = await FileSystem.readAsStringAsync(csvPath);
    if (!content || content.trim().length === 0) {
      return emptyResult;
    }

    // Parse CSV content properly (handles quoted fields with newlines)
    const rows = parseCSVContent(content);

    if (rows.length === 0) {
      return emptyResult;
    }

    // First row is header
    const headers = rows[0].map(h => h.trim());
    const totalRecords = Math.max(0, rows.length - 1);
    const totalPages = Math.ceil(totalRecords / pageSize);

    // Handle page beyond total pages
    if (page >= totalPages && totalPages > 0) {
      page = totalPages - 1;
    }

    // Calculate start and end indices (1-based to skip header)
    const startIndex = page * pageSize + 1; // +1 to skip header row
    const endIndex = Math.min(startIndex + pageSize, rows.length);

    // Extract records for this page
    const records = [];
    for (let i = startIndex; i < endIndex; i++) {
      const row = rows[i];
      const record = {
        _rowIndex: i, // 1-based line number in parsed rows (header is index 0)
      };

      headers.forEach((header, colIndex) => {
        record[header] = row[colIndex] !== undefined ? row[colIndex] : '';
      });

      records.push(record);
    }

    const result = {
      records,
      page,
      pageSize,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages - 1,
      hasPrevPage: page > 0,
    };

    console.log(`[CSVService] Paginated: page ${page + 1}/${totalPages}, records ${records.length}/${totalRecords}`);
    return result;
  } catch (error) {
    console.error('[CSVService] Error getting paginated records:', error.message);
    return emptyResult;
  }
};

/**
 * Delete a row from CSV by UUID and return the deleted row data
 * @param {string} uuid - UUID of the row to delete
 * @returns {Promise<Object|null>} Deleted row data or null if not found
 */
export const deleteFromCSV = async (uuid) => {
  console.log('[CSVService] Deleting row with uuid:', uuid);

  try {
    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await FileSystem.getInfoAsync(csvPath);
    if (!fileInfo.exists) {
      console.warn('[CSVService] CSV file does not exist, nothing to delete');
      return null;
    }

    const content = await FileSystem.readAsStringAsync(csvPath);
    const rows = parseCSVContent(content);

    if (rows.length <= 1) {
      console.log('[CSVService] CSV has no data rows, nothing to delete');
      return null;
    }

    const uuidIndex = CSV_HEADERS.indexOf('uuid');
    let deletedRow = null;

    const remainingRows = rows.filter((row, index) => {
      if (index === 0) return true; // Keep header

      if (row[uuidIndex] === uuid) {
        deletedRow = {};
        CSV_HEADERS.forEach((h, i) => {
          deletedRow[h] = row[i] || '';
        });
        return false; // Remove this row
      }
      return true;
    });

    if (deletedRow) {
      // Rebuild CSV content from rows
      const csvLines = remainingRows.map(row => {
        return row.map(val => {
          const strVal = String(val || '');
          if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
            return `"${strVal.replace(/"/g, '""')}"`;
          }
          return strVal;
        }).join(',');
      });

      await withRetry(async () => {
        await FileSystem.writeAsStringAsync(csvPath, csvLines.join('\n') + '\n');
      });
      console.log('[CSVService] Row deleted successfully, remaining rows:', remainingRows.length - 1);
    } else {
      console.log('[CSVService] UUID not found in CSV:', uuid);
    }

    return deletedRow;
  } catch (error) {
    console.error('[CSVService] Error deleting from CSV:', error.message);
    return null;
  }
};

/**
 * Get the highest spot number from the CSV for a specific location
 * @param {string} municipality - Municipality name to filter by (optional, if not provided returns global max)
 * @param {string} barangay - Barangay name to filter by (optional, if not provided returns global max)
 * @returns {Promise<number>} Highest spot number or 0 if no data
 */
export const getLastSpotNumber = async (municipality = null, barangay = null) => {
  try {
    await readCSV();
    if (!csvCache || !csvCache.parsed || csvCache.parsed.length <= 1) {
      return 0;
    }
    const rows = csvCache.parsed;
    const spotIndex = CSV_HEADERS.indexOf('spot_number');
    const municipalityIndex = CSV_HEADERS.indexOf('municipality');
    const barangayIndex = CSV_HEADERS.indexOf('barangay');
    let maxSpot = 0;
    for (let i = 1; i < rows.length; i++) {
      // Filter by location if provided
      if (municipality && rows[i][municipalityIndex] !== municipality) continue;
      if (barangay && rows[i][barangayIndex] !== barangay) continue;

      const spotNum = parseInt(rows[i][spotIndex], 10);
      if (!isNaN(spotNum) && spotNum > maxSpot) {
        maxSpot = spotNum;
      }
    }

    console.log(`[CSVService] Last spot number for ${municipality || 'all'}/${barangay || 'all'}:`, maxSpot);
    return maxSpot;
  } catch (error) {
    console.error('[CSVService] Error getting last spot number:', error.message);
    return 0;
  }
};

/**
 * Get shots count for a specific spot number at a specific location
 * @param {number} spotNumber - The spot number to count shots for
 * @param {string} municipality - Municipality name to filter by (optional)
 * @param {string} barangay - Barangay name to filter by (optional)
 * @returns {Promise<number>} Number of shots for the spot
 */
export const getShotsForSpot = async (spotNumber, municipality = null, barangay = null) => {
  try {
    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await FileSystem.getInfoAsync(csvPath);
    if (!fileInfo.exists) {
      return 0;
    }

    const content = await FileSystem.readAsStringAsync(csvPath);
    const rows = parseCSVContent(content);

    if (rows.length <= 1) return 0;

    const spotIndex = CSV_HEADERS.indexOf('spot_number');
    const municipalityIndex = CSV_HEADERS.indexOf('municipality');
    const barangayIndex = CSV_HEADERS.indexOf('barangay');
    let count = 0;

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      // Filter by location if provided
      if (municipality && rows[i][municipalityIndex] !== municipality) continue;
      if (barangay && rows[i][barangayIndex] !== barangay) continue;

      const spotNum = parseInt(rows[i][spotIndex], 10);
      if (spotNum === spotNumber) {
        count++;
      }
    }

    console.log(`[CSVService] Shots for spot ${spotNumber} at ${municipality || 'all'}/${barangay || 'all'}:`, count);
    return count;
  } catch (error) {
    console.error('[CSVService] Error getting shots for spot:', error.message);
    return 0;
  }
};

/**
 * Get all existing shot numbers for a specific spot at a specific location
 * @param {number} spotNumber - The spot number to check
 * @param {string} municipality - Municipality name to filter by (optional)
 * @param {string} barangay - Barangay name to filter by (optional)
 * @returns {Promise<number[]>} Array of existing shot numbers
 */
export const getExistingShotsForSpot = async (spotNumber, municipality = null, barangay = null) => {
  try {
    await readCSV();
    if (!csvCache || !csvCache.parsed || csvCache.parsed.length <= 1) return [];
    const rows = csvCache.parsed;
    const spotIndex = CSV_HEADERS.indexOf('spot_number');
    const shotIndex = CSV_HEADERS.indexOf('shot_number');
    const municipalityIndex = CSV_HEADERS.indexOf('municipality');
    const barangayIndex = CSV_HEADERS.indexOf('barangay');
    const shots = [];
    for (let i = 1; i < rows.length; i++) {
      // Filter by location if provided
      if (municipality && rows[i][municipalityIndex] !== municipality) continue;
      if (barangay && rows[i][barangayIndex] !== barangay) continue;

      const spotNum = parseInt(rows[i][spotIndex], 10);
      if (spotNum === spotNumber) {
        const shotNum = parseInt(rows[i][shotIndex], 10) || 0;
        shots.push(shotNum);
      }
    }

    console.log(`[CSVService] Existing shots for spot ${spotNumber} at ${municipality || 'all'}/${barangay || 'all'}:`, shots.sort((a, b) => a - b));
    return shots.sort((a, b) => a - b);
  } catch (error) {
    console.error('[CSVService] Error getting existing shots:', error.message);
    return [];
  }
};

/**
 * Get the next available shot number for a spot (fills gaps first) at a specific location
 * @param {number} spotNumber - The spot number to check
 * @param {number} shotsPerSpot - Maximum shots allowed per spot
 * @param {string} municipality - Municipality name to filter by (optional)
 * @param {string} barangay - Barangay name to filter by (optional)
 * @returns {Promise<{nextShot: number, existingCount: number, isComplete: boolean}>}
 */
export const getNextAvailableShot = async (spotNumber, shotsPerSpot = 5, municipality = null, barangay = null) => {
  try {
    const existingShots = await getExistingShotsForSpot(spotNumber, municipality, barangay);
    const existingCount = existingShots.length;

    // If spot is complete, return info
    if (existingCount >= shotsPerSpot) {
      return { nextShot: shotsPerSpot + 1, existingCount, isComplete: true };
    }

    // Find the first missing shot number (gap)
    for (let i = 1; i <= shotsPerSpot; i++) {
      if (!existingShots.includes(i)) {
        console.log(`[CSVService] Next available shot for spot ${spotNumber} at ${municipality || 'all'}/${barangay || 'all'}: ${i} (filling gap)`);
        return { nextShot: i, existingCount, isComplete: false };
      }
    }

    // No gaps, return next number
    const nextShot = existingShots.length > 0 ? Math.max(...existingShots) + 1 : 1;
    console.log(`[CSVService] Next available shot for spot ${spotNumber} at ${municipality || 'all'}/${barangay || 'all'}: ${nextShot}`);
    return { nextShot, existingCount, isComplete: nextShot > shotsPerSpot };
  } catch (error) {
    console.error('[CSVService] Error getting next available shot:', error.message);
    return { nextShot: 1, existingCount: 0, isComplete: false };
  }
};

/**
 * Get the maximum shot number for a specific spot at a specific location
 * This is used to determine the next shot number after deletions
 * @param {number} spotNumber - The spot number to check
 * @param {string} municipality - Municipality name to filter by (optional)
 * @param {string} barangay - Barangay name to filter by (optional)
 * @returns {Promise<number>} Maximum shot number for the spot (0 if no shots)
 */
export const getMaxShotForSpot = async (spotNumber, municipality = null, barangay = null) => {
  try {
    await readCSV();
    if (!csvCache || !csvCache.parsed || csvCache.parsed.length <= 1) return 0;
    const rows = csvCache.parsed;
    const spotIndex = CSV_HEADERS.indexOf('spot_number');
    const shotIndex = CSV_HEADERS.indexOf('shot_number');
    const municipalityIndex = CSV_HEADERS.indexOf('municipality');
    const barangayIndex = CSV_HEADERS.indexOf('barangay');
    let maxShot = 0;
    for (let i = 1; i < rows.length; i++) {
      // Filter by location if provided
      if (municipality && rows[i][municipalityIndex] !== municipality) continue;
      if (barangay && rows[i][barangayIndex] !== barangay) continue;

      const spotNum = parseInt(rows[i][spotIndex], 10);
      if (spotNum === spotNumber) {
        const shotNum = parseInt(rows[i][shotIndex], 10) || 0;
        if (shotNum > maxShot) maxShot = shotNum;
      }
    }

    console.log(`[CSVService] Max shot for spot ${spotNumber} at ${municipality || 'all'}/${barangay || 'all'}:`, maxShot);
    return maxShot;
  } catch (error) {
    console.error('[CSVService] Error getting max shot for spot:', error.message);
    return 0;
  }
};

/**
 * Update a specific field in a CSV row by UUID
 * @param {string} uuid - UUID of the row to update
 * @param {string} fieldName - Name of the field to update
 * @param {*} newValue - New value for the field
 * @returns {Promise<boolean>} True if update succeeded
 */
export const updateCSVField = async (uuid, fieldName, newValue) => {
  console.log(`[CSVService] Updating field ${fieldName} for uuid:`, uuid);

  try {
    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await FileSystem.getInfoAsync(csvPath);
    if (!fileInfo.exists) {
      console.warn('[CSVService] CSV file does not exist, cannot update');
      return false;
    }

    const content = await FileSystem.readAsStringAsync(csvPath);
    const rows = parseCSVContent(content);

    if (rows.length <= 1) {
      console.warn('[CSVService] CSV has no data rows, cannot update');
      return false;
    }

    const uuidIndex = CSV_HEADERS.indexOf('uuid');
    const fieldIndex = CSV_HEADERS.indexOf(fieldName);

    if (fieldIndex === -1) {
      console.error('[CSVService] Invalid field name:', fieldName);
      return false;
    }

    let updated = false;

    // Update the matching row
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][uuidIndex] === uuid) {
        rows[i][fieldIndex] = String(newValue);
        updated = true;
        break;
      }
    }

    if (updated) {
      // Rebuild CSV content from rows
      const csvLines = rows.map(row => {
        return row.map(val => {
          const strVal = String(val || '');
          if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
            return `"${strVal.replace(/"/g, '""')}"`;
          }
          return strVal;
        }).join(',');
      });

      await withRetry(async () => {
        await FileSystem.writeAsStringAsync(csvPath, csvLines.join('\n') + '\n');
      });
      invalidateCSVCache();
      console.log('[CSVService] Field updated successfully');
    } else {
      console.log('[CSVService] UUID not found for update:', uuid);
    }

    return updated;
  } catch (error) {
    console.error('[CSVService] Error updating CSV field:', error.message);
    return false;
  }
};

/**
 * Update an entire CSV row by UUID (for retake functionality)
 * @param {string} uuid - UUID of the row to update
 * @param {Object} newData - Object with field names and values to update
 * @returns {Promise<{success: boolean, oldData?: Object, error?: string}>}
 */
export const updateCSVRow = async (uuid, newData) => {
  console.log('[CSVService] Updating row for uuid:', uuid);

  try {
    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await FileSystem.getInfoAsync(csvPath);
    if (!fileInfo.exists) {
      console.warn('[CSVService] CSV file does not exist, cannot update');
      return { success: false, error: 'CSV file not found' };
    }

    const content = await FileSystem.readAsStringAsync(csvPath);
    const rows = parseCSVContent(content);

    if (rows.length <= 1) {
      console.warn('[CSVService] CSV has no data rows, cannot update');
      return { success: false, error: 'No data rows in CSV' };
    }

    const uuidIndex = CSV_HEADERS.indexOf('uuid');
    let oldData = null;
    let rowIndex = -1;

    // Find the row to update
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][uuidIndex] === uuid) {
        rowIndex = i;
        // Save old data
        oldData = {};
        CSV_HEADERS.forEach((h, idx) => {
          oldData[h] = rows[i][idx] || '';
        });
        break;
      }
    }

    if (rowIndex === -1) {
      console.log('[CSVService] UUID not found for update:', uuid);
      return { success: false, error: 'UUID not found' };
    }

    // Update the row with new data
    Object.keys(newData).forEach(fieldName => {
      const fieldIndex = CSV_HEADERS.indexOf(fieldName);
      if (fieldIndex !== -1) {
        let value = newData[fieldName];
        // Handle null/undefined
        if (value === null || value === undefined) value = '';
        // Convert to string and clean
        value = String(value);
        value = value.replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ');
        rows[rowIndex][fieldIndex] = value;
      }
    });

    // Rebuild CSV content from rows
    const csvLines = rows.map(row => {
      return row.map(val => {
        const strVal = String(val || '');
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(',');
    });

    await withRetry(async () => {
      await FileSystem.writeAsStringAsync(csvPath, csvLines.join('\n') + '\n');
    });
    invalidateCSVCache();

    console.log('[CSVService] Row updated successfully');
    return { success: true, oldData };
  } catch (error) {
    console.error('[CSVService] Error updating CSV row:', error.message);
    return { success: false, error: error.message };
  }
};

// Internal CSV line parser (for single lines without embedded newlines)
const parseCSVLineInternal = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote "" -> single "
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

/**
 * Parse entire CSV content properly, handling newlines inside quoted fields.
 * This is the CORRECT way to parse CSV - don't split by \n first!
 * @param {string} csvContent - Raw CSV content
 * @returns {Array<Array<string>>} Array of rows, each row is array of values
 */
export const parseCSVContent = (csvContent) => {
  if (!csvContent || csvContent.trim().length === 0) {
    return [];
  }

  // Normalize line endings: convert \r\n and \r to \n
  const normalized = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote "" -> single "
        currentValue += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentValue);
      currentValue = '';
    } else if (char === '\n' && !inQuotes) {
      // End of row (only if not inside quotes)
      currentRow.push(currentValue);
      if (currentRow.length > 0 && currentRow.some(v => v.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = '';
    } else {
      // Regular character (including newlines inside quotes)
      currentValue += char;
    }
  }

  // Don't forget the last value/row
  if (currentValue !== '' || currentRow.length > 0) {
    currentRow.push(currentValue);
    if (currentRow.length > 0 && currentRow.some(v => v.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  console.log('[CSVService] parseCSVContent: parsed', rows.length, 'rows');
  return rows;
};

/**
 * Parse CSV and return as array of objects with header keys.
 * @param {string} csvContent - Raw CSV content
 * @returns {Array<Object>} Array of record objects
 */
export const parseCSVToRecords = (csvContent) => {
  const rows = parseCSVContent(csvContent);

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(h => h.trim());
  const records = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() || '';
    });

    records.push(record);
  }

  console.log('[CSVService] parseCSVToRecords: converted', records.length, 'records');
  return records;
};

/**
 * Append a data row to both the main CSV and municipality-specific public storage
 * This is the main function to use when saving captured data.
 *
 * @param {Object} data - Object with keys matching CSV_HEADERS
 * @param {string} municipality - Municipality name for organizing in public storage
 * @returns {Promise<{success: boolean, safSuccess?: boolean, error?: string}>}
 */
export const appendToMunicipalityCSV = async (data, municipality) => {
  console.log('[CSVService] appendToMunicipalityCSV called for:', municipality);

  const result = {
    success: false,
    safSuccess: false,
    error: null,
  };

  try {
    // Step 1: Always append to main internal CSV first (reliable, fast)
    await appendToCSV(data);
    result.success = true;
    console.log('[CSVService] Internal CSV append successful');

    // Step 2: Also save to public SAF storage if enabled
    try {
      const safEnabled = await isSAFInitialized();
      if (safEnabled && municipality) {
        // Read current municipality CSV content (if any)
        const existingResult = await readCSVFromPublicStorage(municipality);
        let csvContent;

        if (existingResult.success && existingResult.content) {
          // Append to existing content
          const existingContent = existingResult.content.trim();

          // Build the new row
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

          csvContent = existingContent + '\n' + row + '\n';
        } else {
          // Create new CSV with headers and this row
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

          csvContent = CSV_HEADERS.join(',') + '\n' + row + '\n';
        }

        // Save to public storage
        const safResult = await saveMunicipalityCSVToPublicStorage(municipality, csvContent);
        result.safSuccess = safResult.success;

        if (safResult.success) {
          console.log('[CSVService] SAF CSV save successful');
        } else {
          console.warn('[CSVService] SAF CSV save failed:', safResult.error);
        }
      }
    } catch (safError) {
      console.warn('[CSVService] SAF storage error (non-fatal):', safError.message);
      // Don't fail the whole operation - internal save succeeded
    }

    return result;
  } catch (error) {
    console.error('[CSVService] appendToMunicipalityCSV failed:', error.message);
    result.error = error.message;
    throw error; // Re-throw so caller knows it failed
  }
};
