// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAppRootDir,
  ensureDir,
  getInfoStorage,
  readFileStorage,
  writeFileStorage,
  deleteFileStorage,
} from './storageService';

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
    const fileInfo = await getInfoStorage(csvPath);

    if (!fileInfo.exists) {
      console.log('[CSVService] Creating new CSV file with headers...');
      await withRetry(async () => {
        await writeFileStorage(csvPath, CSV_HEADERS.join(',') + '\n');
      });
      invalidateCSVCache();

      const verifyInfo = await getInfoStorage(csvPath);
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
    const csvInfo = await getInfoStorage(csvPath);
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
      await writeFileStorage(csvPath, newContent);
      invalidateCSVCache();
      console.log('[CSVService] CSV written, previous size:', existingContent.length, 'new size:', newContent.length);
    });

    const afterInfo = await getInfoStorage(csvPath);
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
    const fileInfo = await getInfoStorage(csvPath);
    if (!fileInfo.exists) {
      console.log('[CSVService] CSV file does not exist, returning headers only');
      const headersOnly = CSV_HEADERS.join(',') + '\n';
      csvCache = { content: headersOnly, parsed: [CSV_HEADERS.slice()], path: csvPath };
      return headersOnly;
    }
    const content = await readFileStorage(csvPath);
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

    const dirInfo = await getInfoStorage(csvDir);
    diagnostics.dirExists = dirInfo.exists;

    if (!dirInfo.exists) {
      await ensureDir(csvDir);
      const verifyDir = await getInfoStorage(csvDir);
      diagnostics.dirExists = verifyDir.exists;
      if (!verifyDir.exists) {
        diagnostics.success = false;
        diagnostics.errors.push('Failed to create CSV directory');
      }
    }

    const fileInfo = await getInfoStorage(csvPath);
    diagnostics.fileExists = fileInfo.exists;
    diagnostics.fileSize = fileInfo.size || 0;

    try {
      const testPath = `${csvDir}.csv_test`;
      await FileSystem.writeAsStringAsync(testPath, 'test');
      const readBack = await FileSystem.readAsStringAsync(testPath);
      await deleteFileStorage(testPath);
      diagnostics.canWrite = readBack === 'test';
      diagnostics.canRead = readBack === 'test';
    } catch (writeError) {
      diagnostics.canWrite = false;
      diagnostics.canRead = false;
      diagnostics.errors.push(`Write test failed: ${writeError.message}`);
    }

    if (diagnostics.fileExists) {
      try {
        const content = await readFileStorage(csvPath);
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
    const fileInfo = await getInfoStorage(csvPath);
    if (fileInfo.exists) {
      await deleteFileStorage(csvPath);
    }
    await writeFileStorage(csvPath, CSV_HEADERS.join(',') + '\n');
    invalidateCSVCache();
    const verifyInfo = await getInfoStorage(csvPath);
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
 * Get record count from CSV (uses cache when available)
 * @returns {Promise<number>} Number of data rows (excluding header)
 */
export const getRecordCount = async () => {
  try {
    await readCSV();
    if (csvCache && csvCache.parsed) {
      return Math.max(0, csvCache.parsed.length - 1);
    }
    return 0;
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
    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await getInfoStorage(csvPath);
    if (!fileInfo.exists) {
      console.warn('[CSVService] CSV file does not exist, nothing to delete');
      return null;
    }

    const content = await readFileStorage(csvPath);
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
        await writeFileStorage(csvPath, csvLines.join('\n') + '\n');
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
 * Get the highest spot number from the CSV (uses cache when available)
 * @returns {Promise<number>} Highest spot number or 0 if no data
 */
export const getLastSpotNumber = async () => {
  try {
    await readCSV();
    if (!csvCache || !csvCache.parsed || csvCache.parsed.length <= 1) {
      return 0;
    }
    const rows = csvCache.parsed;
    const spotIndex = CSV_HEADERS.indexOf('spot_number');
    let maxSpot = 0;
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
    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await getInfoStorage(csvPath);
    if (!fileInfo.exists) {
      return 0;
    }

    const content = await readFileStorage(csvPath);
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
 * Get all existing shot numbers for a specific spot (uses cache when available)
 * @param {number} spotNumber - The spot number to check
 * @returns {Promise<number[]>} Array of existing shot numbers
 */
export const getExistingShotsForSpot = async (spotNumber) => {
  try {
    await readCSV();
    if (!csvCache || !csvCache.parsed || csvCache.parsed.length <= 1) return [];
    const rows = csvCache.parsed;
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
 * Get the maximum shot number for a specific spot (uses cache when available)
 * @param {number} spotNumber - The spot number to check
 * @returns {Promise<number>} Maximum shot number for the spot (0 if no shots)
 */
export const getMaxShotForSpot = async (spotNumber) => {
  try {
    await readCSV();
    if (!csvCache || !csvCache.parsed || csvCache.parsed.length <= 1) return 0;
    const rows = csvCache.parsed;
    const spotIndex = CSV_HEADERS.indexOf('spot_number');
    const shotIndex = CSV_HEADERS.indexOf('shot_number');
    let maxShot = 0;
    for (let i = 1; i < rows.length; i++) {
      const spotNum = parseInt(rows[i][spotIndex], 10);
      if (spotNum === spotNumber) {
        const shotNum = parseInt(rows[i][shotIndex], 10) || 0;
        if (shotNum > maxShot) maxShot = shotNum;
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
    const csvPath = await getCSVFilePathAsync();
    const fileInfo = await getInfoStorage(csvPath);
    if (!fileInfo.exists) {
      console.warn('[CSVService] CSV file does not exist, cannot update');
      return false;
    }

    const content = await readFileStorage(csvPath);
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
        await writeFileStorage(csvPath, csvLines.join('\n') + '\n');
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
    const fileInfo = await getInfoStorage(csvPath);
    if (!fileInfo.exists) {
      console.warn('[CSVService] CSV file does not exist, cannot update');
      return { success: false, error: 'CSV file not found' };
    }

    const content = await readFileStorage(csvPath);
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
      await writeFileStorage(csvPath, csvLines.join('\n') + '\n');
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
