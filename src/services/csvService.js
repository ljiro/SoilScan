// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppRootDir, ensureDir } from './storageService';

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
 * Creates the directory structure and CSV file with headers if not exists
 * @returns {Promise<{success: boolean, error?: string, created?: boolean}>}
 */
export const initCSV = async () => {
  console.log('[CSVService] Initializing CSV storage...');

  try {
    // Step 1: Ensure the root AgriCapture directory exists
    const rootDir = getAppRootDir();
    const rootCreated = await ensureDir(rootDir);
    if (!rootCreated) {
      throw new Error('Failed to create root AgriCapture directory');
    }

    // Step 2: Ensure the data directory exists
    const dataCreated = await ensureDir(getCSVDir());
    if (!dataCreated) {
      throw new Error('Failed to create data directory');
    }
    console.log('[CSVService] Data directory ready:', getCSVDir());

    // Step 3: Check if CSV file exists
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());

    if (!fileInfo.exists) {
      // Create new CSV file with headers
      console.log('[CSVService] Creating new CSV file with headers...');
      await withRetry(async () => {
        await FileSystem.writeAsStringAsync(getCSVFilePath(), CSV_HEADERS.join(',') + '\n');
      });

      // Verify the file was created
      const verifyInfo = await FileSystem.getInfoAsync(getCSVFilePath());
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
    // Ensure CSV is initialized first
    const csvInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (!csvInfo.exists) {
      console.log('[CSVService] CSV file not found, initializing...');
      const initResult = await initCSV();
      if (!initResult.success) {
        throw new Error(`CSV initialization failed: ${initResult.error}`);
      }
    }

    // Build the CSV row
    const row = CSV_HEADERS.map(header => {
      let value = data[header];

      // Handle null/undefined
      if (value === null || value === undefined) return '';

      // Convert to string
      value = String(value);

      // Remove any carriage returns and normalize newlines
      value = value.replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ');

      // Escape values containing commas or quotes
      if (value.includes(',') || value.includes('"')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }

      return value;
    }).join(',');

    // Read existing content, add new row, and write back
    // (append mode in expo-file-system/legacy doesn't work reliably)
    await withRetry(async () => {
      let existingContent = '';
      try {
        existingContent = await FileSystem.readAsStringAsync(getCSVFilePath());
      } catch (readErr) {
        console.warn('[CSVService] Could not read existing CSV, starting fresh:', readErr.message);
        existingContent = CSV_HEADERS.join(',') + '\n';
      }

      // Ensure existing content ends with newline
      if (existingContent && !existingContent.endsWith('\n')) {
        existingContent += '\n';
      }

      // Write the combined content
      const newContent = existingContent + row + '\n';
      await FileSystem.writeAsStringAsync(getCSVFilePath(), newContent);
      console.log('[CSVService] CSV written, previous size:', existingContent.length, 'new size:', newContent.length);
    });

    // Verify the append succeeded by checking file size increased
    const afterInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    console.log('[CSVService] CSV append successful, new size:', afterInfo.size);

    return { success: true };
  } catch (error) {
    console.error('[CSVService] Failed to append to CSV:', error.message);
    throw new Error(`CSV append failed: ${error.message}`);
  }
};

/**
 * Read the entire CSV file contents
 * @returns {Promise<string>} CSV content string
 */
export const readCSV = async () => {
  try {
    // Check if file exists first
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (!fileInfo.exists) {
      console.log('[CSVService] CSV file does not exist, returning headers only');
      return CSV_HEADERS.join(',') + '\n';
    }

    const content = await FileSystem.readAsStringAsync(getCSVFilePath());
    console.log('[CSVService] Read CSV file, size:', content.length);
    return content;
  } catch (error) {
    // Don't silently swallow errors - throw so caller can handle and show to user
    console.error('[CSVService] Error reading CSV:', error.message);
    throw new Error(`Failed to read CSV file: ${error.message}`);
  }
};

export const getCSVPath = () => getCSVFilePath();

export const getCSVHeaders = () => CSV_HEADERS;

/**
 * Verify CSV storage is working and return diagnostic info
 * @returns {Promise<Object>} Diagnostic information about CSV storage
 */
export const verifyCSVStorage = async () => {
  console.log('[CSVService] === Verifying CSV Storage ===');

  const diagnostics = {
    success: true,
    documentDirectory: FileSystem.documentDirectory,
    csvDir: getCSVDir(),
    csvPath: getCSVFilePath(),
    dirExists: false,
    fileExists: false,
    fileSize: 0,
    rowCount: 0,
    canWrite: false,
    canRead: false,
    errors: [],
  };

  try {
    // Check if documentDirectory is available
    if (!FileSystem.documentDirectory) {
      diagnostics.success = false;
      diagnostics.errors.push('FileSystem.documentDirectory is null/undefined');
      console.error('[CSVService] CRITICAL: documentDirectory is not available');
      return diagnostics;
    }
    console.log('[CSVService] documentDirectory:', FileSystem.documentDirectory);

    // Check if CSV directory exists
    const dirInfo = await FileSystem.getInfoAsync(getCSVDir());
    diagnostics.dirExists = dirInfo.exists;
    console.log('[CSVService] CSV directory exists:', dirInfo.exists);

    if (!dirInfo.exists) {
      console.log('[CSVService] Creating CSV directory...');
      await FileSystem.makeDirectoryAsync(getCSVDir(), { intermediates: true });
      const verifyDir = await FileSystem.getInfoAsync(getCSVDir());
      diagnostics.dirExists = verifyDir.exists;
      if (!verifyDir.exists) {
        diagnostics.success = false;
        diagnostics.errors.push('Failed to create CSV directory');
      }
    }

    // Check if CSV file exists
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    diagnostics.fileExists = fileInfo.exists;
    diagnostics.fileSize = fileInfo.size || 0;
    console.log('[CSVService] CSV file exists:', fileInfo.exists, 'size:', fileInfo.size);

    // Test write capability
    console.log('[CSVService] Testing write capability...');
    try {
      const testPath = `${getCSVDir()}.csv_test`;
      await FileSystem.writeAsStringAsync(testPath, 'test');
      const readBack = await FileSystem.readAsStringAsync(testPath);
      await FileSystem.deleteAsync(testPath, { idempotent: true });
      diagnostics.canWrite = readBack === 'test';
      diagnostics.canRead = readBack === 'test';
      console.log('[CSVService] Write test:', diagnostics.canWrite ? 'PASSED' : 'FAILED');
    } catch (writeError) {
      diagnostics.canWrite = false;
      diagnostics.canRead = false;
      diagnostics.errors.push(`Write test failed: ${writeError.message}`);
      console.error('[CSVService] Write test failed:', writeError.message);
    }

    // If file exists, try to read and count rows
    if (diagnostics.fileExists) {
      try {
        const content = await FileSystem.readAsStringAsync(getCSVFilePath());
        const rows = parseCSVContent(content);
        diagnostics.rowCount = Math.max(0, rows.length - 1); // Exclude header
        console.log('[CSVService] CSV has', diagnostics.rowCount, 'data rows');
      } catch (readError) {
        diagnostics.errors.push(`Read test failed: ${readError.message}`);
        console.error('[CSVService] Read test failed:', readError.message);
      }
    }

  } catch (error) {
    diagnostics.success = false;
    diagnostics.errors.push(`Verification error: ${error.message}`);
    console.error('[CSVService] Verification error:', error.message);
  }

  console.log('[CSVService] === CSV Verification Complete ===');
  console.log('[CSVService] Diagnostics:', JSON.stringify(diagnostics, null, 2));

  return diagnostics;
};

/**
 * Reset the CSV file (clear all data, keep headers)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const resetCSV = async () => {
  console.log('[CSVService] Resetting CSV file...');
  try {
    // Delete existing file if it exists
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(getCSVFilePath(), { idempotent: true });
      console.log('[CSVService] Old CSV file deleted');
    }

    // Create new CSV with headers only
    await FileSystem.writeAsStringAsync(getCSVFilePath(), CSV_HEADERS.join(',') + '\n');

    // Verify
    const verifyInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (!verifyInfo.exists) {
      throw new Error('Failed to create new CSV file');
    }

    console.log('[CSVService] CSV file reset successfully');
    return { success: true };
  } catch (error) {
    console.error('[CSVService] Failed to reset CSV:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get record count from CSV
 * @returns {Promise<number>} Number of data rows (excluding header)
 */
export const getRecordCount = async () => {
  try {
    const content = await readCSV();
    const rows = parseCSVContent(content);
    return Math.max(0, rows.length - 1); // Subtract 1 for header row
  } catch (error) {
    console.error('[CSVService] Error getting record count:', error.message);
    return 0;
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
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (!fileInfo.exists) {
      console.warn('[CSVService] CSV file does not exist, nothing to delete');
      return null;
    }

    const content = await FileSystem.readAsStringAsync(getCSVFilePath());
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
        await FileSystem.writeAsStringAsync(getCSVFilePath(), csvLines.join('\n') + '\n');
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
 * Get the highest spot number from the CSV
 * @returns {Promise<number>} Highest spot number or 0 if no data
 */
export const getLastSpotNumber = async () => {
  try {
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (!fileInfo.exists) {
      console.log('[CSVService] CSV file does not exist, returning spot 0');
      return 0;
    }

    const content = await FileSystem.readAsStringAsync(getCSVFilePath());
    const rows = parseCSVContent(content);

    if (rows.length <= 1) {
      console.log('[CSVService] CSV has no data rows, returning spot 0');
      return 0;
    }

    const spotIndex = CSV_HEADERS.indexOf('spot_number');
    let maxSpot = 0;

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const spotNum = parseInt(rows[i][spotIndex], 10);
      if (!isNaN(spotNum) && spotNum > maxSpot) {
        maxSpot = spotNum;
      }
    }

    console.log('[CSVService] Last spot number:', maxSpot);
    return maxSpot;
  } catch (error) {
    console.error('[CSVService] Error getting last spot number:', error.message);
    return 0;
  }
};

/**
 * Get shots count for a specific spot number
 * @param {number} spotNumber - The spot number to count shots for
 * @returns {Promise<number>} Number of shots for the spot
 */
export const getShotsForSpot = async (spotNumber) => {
  try {
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (!fileInfo.exists) {
      return 0;
    }

    const content = await FileSystem.readAsStringAsync(getCSVFilePath());
    const rows = parseCSVContent(content);

    if (rows.length <= 1) return 0;

    const spotIndex = CSV_HEADERS.indexOf('spot_number');
    let count = 0;

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const spotNum = parseInt(rows[i][spotIndex], 10);
      if (spotNum === spotNumber) {
        count++;
      }
    }

    console.log(`[CSVService] Shots for spot ${spotNumber}:`, count);
    return count;
  } catch (error) {
    console.error('[CSVService] Error getting shots for spot:', error.message);
    return 0;
  }
};

/**
 * Get all existing shot numbers for a specific spot
 * @param {number} spotNumber - The spot number to check
 * @returns {Promise<number[]>} Array of existing shot numbers
 */
export const getExistingShotsForSpot = async (spotNumber) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (!fileInfo.exists) {
      return [];
    }

    const content = await FileSystem.readAsStringAsync(getCSVFilePath());
    const rows = parseCSVContent(content);

    if (rows.length <= 1) return [];

    const spotIndex = CSV_HEADERS.indexOf('spot_number');
    const shotIndex = CSV_HEADERS.indexOf('shot_number');
    const shots = [];

    for (let i = 1; i < rows.length; i++) {
      const spotNum = parseInt(rows[i][spotIndex], 10);
      if (spotNum === spotNumber) {
        const shotNum = parseInt(rows[i][shotIndex], 10) || 0;
        shots.push(shotNum);
      }
    }

    console.log(`[CSVService] Existing shots for spot ${spotNumber}:`, shots.sort((a, b) => a - b));
    return shots.sort((a, b) => a - b);
  } catch (error) {
    console.error('[CSVService] Error getting existing shots:', error.message);
    return [];
  }
};

/**
 * Get the next available shot number for a spot (fills gaps first)
 * @param {number} spotNumber - The spot number to check
 * @param {number} shotsPerSpot - Maximum shots allowed per spot
 * @returns {Promise<{nextShot: number, existingCount: number, isComplete: boolean}>}
 */
export const getNextAvailableShot = async (spotNumber, shotsPerSpot = 5) => {
  try {
    const existingShots = await getExistingShotsForSpot(spotNumber);
    const existingCount = existingShots.length;

    // If spot is complete, return info
    if (existingCount >= shotsPerSpot) {
      return { nextShot: shotsPerSpot + 1, existingCount, isComplete: true };
    }

    // Find the first missing shot number (gap)
    for (let i = 1; i <= shotsPerSpot; i++) {
      if (!existingShots.includes(i)) {
        console.log(`[CSVService] Next available shot for spot ${spotNumber}: ${i} (filling gap)`);
        return { nextShot: i, existingCount, isComplete: false };
      }
    }

    // No gaps, return next number
    const nextShot = existingShots.length > 0 ? Math.max(...existingShots) + 1 : 1;
    console.log(`[CSVService] Next available shot for spot ${spotNumber}: ${nextShot}`);
    return { nextShot, existingCount, isComplete: nextShot > shotsPerSpot };
  } catch (error) {
    console.error('[CSVService] Error getting next available shot:', error.message);
    return { nextShot: 1, existingCount: 0, isComplete: false };
  }
};

/**
 * Get the maximum shot number for a specific spot
 * This is used to determine the next shot number after deletions
 * @param {number} spotNumber - The spot number to check
 * @returns {Promise<number>} Maximum shot number for the spot (0 if no shots)
 */
export const getMaxShotForSpot = async (spotNumber) => {
  try {
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (!fileInfo.exists) {
      return 0;
    }

    const content = await FileSystem.readAsStringAsync(getCSVFilePath());
    const rows = parseCSVContent(content);

    if (rows.length <= 1) return 0;

    const spotIndex = CSV_HEADERS.indexOf('spot_number');
    const shotIndex = CSV_HEADERS.indexOf('shot_number');
    let maxShot = 0;

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const spotNum = parseInt(rows[i][spotIndex], 10);
      if (spotNum === spotNumber) {
        const shotNum = parseInt(rows[i][shotIndex], 10) || 0;
        if (shotNum > maxShot) {
          maxShot = shotNum;
        }
      }
    }

    console.log(`[CSVService] Max shot for spot ${spotNumber}:`, maxShot);
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
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (!fileInfo.exists) {
      console.warn('[CSVService] CSV file does not exist, cannot update');
      return false;
    }

    const content = await FileSystem.readAsStringAsync(getCSVFilePath());
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
        await FileSystem.writeAsStringAsync(getCSVFilePath(), csvLines.join('\n') + '\n');
      });
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
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(getCSVFilePath());
    if (!fileInfo.exists) {
      console.warn('[CSVService] CSV file does not exist, cannot update');
      return { success: false, error: 'CSV file not found' };
    }

    const content = await FileSystem.readAsStringAsync(getCSVFilePath());
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
      await FileSystem.writeAsStringAsync(getCSVFilePath(), csvLines.join('\n') + '\n');
    });

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
