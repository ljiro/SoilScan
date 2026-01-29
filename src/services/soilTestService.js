// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getDataDir, ensureDir, loadConfig } from './storageService';
import { generateUUID } from '../utils/uuid';

const isWeb = Platform.OS === 'web';

// Use lazy evaluation for paths
const getSoilTestDir = () => `${getDataDir()}soil_tests/`;
const getSoilTestFilePath = () => `${getSoilTestDir()}soil_test_results.csv`;

// CSV headers for soil test results
const SOIL_TEST_HEADERS = [
  'sample_id',
  'test_date',
  'municipality',
  'barangay',
  'farm_name',
  'crop',
  'sample_number',
  'nitrogen_n',
  'phosphorus_p',
  'potassium_k',
  'ph',
  'notes',
  'device_id',
  'created_at',
];

/**
 * Initialize soil test CSV file
 */
export const initSoilTestCSV = async () => {
  if (isWeb) {
    return { success: true, message: 'Web platform - CSV not supported' };
  }

  try {
    await ensureDir(getSoilTestDir());
    const fileInfo = await FileSystem.getInfoAsync(getSoilTestFilePath());

    if (!fileInfo.exists) {
      await FileSystem.writeAsStringAsync(
        getSoilTestFilePath(),
        SOIL_TEST_HEADERS.join(',') + '\n'
      );
      return { success: true, created: true };
    }

    return { success: true, created: false };
  } catch (error) {
    console.error('[SoilTestService] Init error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate sample ID using same convention as images
 * Can use provided values or fallback to config
 */
export const generateSampleId = async (sampleNumber = null, municipalityLabel = null, barangayLabel = null, farmName = null) => {
  try {
    const config = await loadConfig('user_config');
    
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toISOString().slice(11, 19).replace(/:/g, '');

    // Use provided values or fallback to config
    const municipality = (municipalityLabel || config?.municipalityLabel || 'unknown').toLowerCase().replace(/\s+/g, '');
    const barangay = (barangayLabel || config?.barangayLabel || 'unknown').toLowerCase().replace(/\s+/g, '');
    const farm = (farmName || config?.farmName || '').toLowerCase().replace(/\s+/g, '');

    const uuid = generateUUID().substring(0, 8);

    const parts = [municipality, barangay];
    if (farm) {
      parts.push(farm);
    }
    if (sampleNumber) {
      // Sanitize sample number (remove spaces, special chars)
      const cleanSampleNum = sampleNumber.toString().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      parts.push(`sample${cleanSampleNum}`);
    }
    parts.push(date, time, uuid);

    return parts.join('_');
  } catch (error) {
    console.error('[SoilTestService] Error generating sample ID:', error);
    // Fallback to simple UUID-based ID
    const uuid = generateUUID().substring(0, 8);
    return `sample_${Date.now()}_${uuid}`;
  }
};

/**
 * Save soil test result
 */
export const saveSoilTestResult = async (testData) => {
  if (isWeb) {
    return { success: false, error: 'Not supported on web' };
  }

  try {
    await ensureDir(getSoilTestDir());
    
    const config = await loadConfig('user_config');
    const now = new Date();

    // Prepare CSV row values - use provided values or fallback to config
    const rowValues = [
      testData.sampleId || '',
      testData.testDate || now.toISOString().slice(0, 10),
      testData.municipality || config?.municipalityLabel || '',
      testData.barangay || config?.barangayLabel || '',
      testData.farmName || config?.farmName || '',
      testData.crop || '',
      testData.spotNumber || testData.sampleNumber || '',
      testData.nitrogen !== undefined && testData.nitrogen !== null ? testData.nitrogen : 'NaN',
      testData.phosphorus !== undefined && testData.phosphorus !== null ? testData.phosphorus : 'NaN',
      testData.potassium !== undefined && testData.potassium !== null ? testData.potassium : 'NaN',
      testData.ph !== undefined && testData.ph !== null ? testData.ph : 'NaN',
      (testData.notes || '').replace(/\n/g, ' '), // Sanitize notes (keep commas, just remove newlines)
      config?.deviceId || '',
      now.toISOString(),
    ];

    // Escape CSV values (quote if contains comma, quote, or newline)
    const escapeCSVValue = (value) => {
      const str = String(value || '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const row = rowValues.map(escapeCSVValue).join(',');

    // Check if file exists, create if not
    const fileInfo = await FileSystem.getInfoAsync(getSoilTestFilePath());
    if (!fileInfo.exists) {
      console.log('[SoilTestService] Creating new CSV file');
      await FileSystem.writeAsStringAsync(
        getSoilTestFilePath(),
        SOIL_TEST_HEADERS.join(',') + '\n'
      );
    } else {
      // Check if headers need migration
      const existingContent = await FileSystem.readAsStringAsync(getSoilTestFilePath());
      const existingLines = existingContent.trim().split('\n');
      if (existingLines.length > 0) {
        const existingHeaders = parseCSVLine(existingLines[0]).map(h => h.trim());
        if (existingHeaders.length !== SOIL_TEST_HEADERS.length || 
            !existingHeaders.includes('crop') || 
            !existingHeaders.includes('sample_number')) {
          console.log('[SoilTestService] Migrating CSV file headers');
          // Update header line
          const updatedLines = [SOIL_TEST_HEADERS.join(',')];
          for (let i = 1; i < existingLines.length; i++) {
            updatedLines.push(existingLines[i]);
          }
          await FileSystem.writeAsStringAsync(getSoilTestFilePath(), updatedLines.join('\n') + '\n');
          console.log('[SoilTestService] CSV headers migrated');
        }
      }
    }

    // Append row to CSV
    const existingContent = await FileSystem.readAsStringAsync(getSoilTestFilePath());
    const newContent = existingContent + row + '\n';
    console.log('[SoilTestService] Appending row to CSV, new content length:', newContent.length);
    await FileSystem.writeAsStringAsync(getSoilTestFilePath(), newContent);

    return { success: true };
  } catch (error) {
    console.error('[SoilTestService] Save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Parse CSV line properly handling quoted fields
 */
const parseCSVLine = (line) => {
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
 * Read all soil test results
 */
export const readSoilTestResults = async () => {
  if (isWeb) {
    return { success: false, results: [], error: 'Not supported on web' };
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(getSoilTestFilePath());
    if (!fileInfo.exists) {
      console.log('[SoilTestService] CSV file does not exist');
      return { success: true, results: [] };
    }

    const content = await FileSystem.readAsStringAsync(getSoilTestFilePath());
    console.log('[SoilTestService] CSV file content length:', content.length);
    
    if (!content || content.trim().length === 0) {
      console.log('[SoilTestService] CSV file is empty');
      return { success: true, results: [] };
    }

    const lines = content.trim().split('\n');
    console.log('[SoilTestService] CSV has', lines.length, 'lines');
    
    if (lines.length < 2) {
      console.log('[SoilTestService] CSV has only header, no data rows');
      return { success: true, results: [] };
    }

    // Parse header from file
    const fileHeaders = parseCSVLine(lines[0]).map(h => h.trim());
    console.log('[SoilTestService] CSV file headers:', fileHeaders);
    
    // Check if migration is needed
    const needsMigration = !fileHeaders.includes('crop') || !fileHeaders.includes('sample_number');
    
    const results = [];

    // Parse data rows - always map to SOIL_TEST_HEADERS format
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      const values = parseCSVLine(line);
      console.log(`[SoilTestService] Row ${i}:`, values.length, 'values, file headers:', fileHeaders.length);
      
      // Always create result using SOIL_TEST_HEADERS
      const result = {};
      SOIL_TEST_HEADERS.forEach((header, index) => {
        if (needsMigration) {
          // Map from old format
          if (header === 'crop') {
            // Crop is new field, check if it's in values at expected position
            result[header] = (index < values.length && values[index]?.trim()) || '';
          } else if (header === 'sample_number') {
            // sample_number replaces spot_number
            const spotIndex = fileHeaders.indexOf('spot_number');
            if (spotIndex >= 0 && spotIndex < values.length) {
              result[header] = values[spotIndex]?.trim() || '';
            } else if (index < values.length) {
              result[header] = values[index]?.trim() || '';
            } else {
              result[header] = '';
            }
          } else {
            // Find in old headers
            const oldIndex = fileHeaders.indexOf(header);
            if (oldIndex >= 0 && oldIndex < values.length) {
              result[header] = values[oldIndex]?.trim() || '';
            } else if (index < values.length) {
              // Fallback to position-based mapping
              result[header] = values[index]?.trim() || '';
            } else {
              result[header] = '';
            }
          }
        } else {
          // New format - direct mapping
          result[header] = (index < values.length) ? (values[index]?.trim() || '') : '';
        }
      });
      results.push(result);
    }
    
    // Migrate file if needed
    if (needsMigration && results.length > 0) {
      console.log('[SoilTestService] Migrating CSV file to new format');
      const escapeCSVValue = (value) => {
        const str = String(value || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      const updatedLines = [SOIL_TEST_HEADERS.join(',')];
      results.forEach(result => {
        const row = SOIL_TEST_HEADERS.map(header => escapeCSVValue(result[header] || ''));
        updatedLines.push(row.join(','));
      });
      
      await FileSystem.writeAsStringAsync(getSoilTestFilePath(), updatedLines.join('\n') + '\n');
      console.log('[SoilTestService] CSV file migrated successfully');
    }

    console.log('[SoilTestService] Parsed', results.length, 'results');
    return { success: true, results };
  } catch (error) {
    console.error('[SoilTestService] Read error:', error);
    return { success: false, results: [], error: error.message };
  }
};

/**
 * Update an existing soil test result by sample_id
 */
export const updateSoilTestResult = async (sampleId, testData) => {
  if (isWeb) {
    return { success: false, error: 'Not supported on web' };
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(getSoilTestFilePath());
    if (!fileInfo.exists) {
      return { success: false, error: 'File does not exist' };
    }

    const content = await FileSystem.readAsStringAsync(getSoilTestFilePath());
    const lines = content.trim().split('\n');
    
    if (lines.length < 2) {
      return { success: false, error: 'No data to update' };
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    const sampleIdIndex = headers.findIndex(h => h === 'sample_id');
    
    if (sampleIdIndex === -1) {
      return { success: false, error: 'sample_id column not found' };
    }

    const config = await loadConfig('user_config');
    const now = new Date();

    // Prepare updated CSV row values
    const rowValues = [
      testData.sampleId || sampleId,
      testData.testDate || now.toISOString().slice(0, 10),
      testData.municipality || config?.municipalityLabel || '',
      testData.barangay || config?.barangayLabel || '',
      testData.farmName || config?.farmName || '',
      testData.crop || '',
      testData.spotNumber || testData.sampleNumber || '',
      testData.nitrogen !== undefined && testData.nitrogen !== null ? testData.nitrogen : 'NaN',
      testData.phosphorus !== undefined && testData.phosphorus !== null ? testData.phosphorus : 'NaN',
      testData.potassium !== undefined && testData.potassium !== null ? testData.potassium : 'NaN',
      testData.ph !== undefined && testData.ph !== null ? testData.ph : 'NaN',
      (testData.notes || '').replace(/\n/g, ' '), // Sanitize notes (keep commas, just remove newlines)
      config?.deviceId || '',
      testData.created_at || now.toISOString(), // Preserve original created_at
    ];

    // Escape CSV values (quote if contains comma, quote, or newline)
    const escapeCSVValue = (value) => {
      const str = String(value || '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const row = rowValues.map(escapeCSVValue).join(',');

    // Find and replace the row with matching sample_id
    let found = false;
    const updatedLines = lines.map((line, index) => {
      if (index === 0) return line; // Keep header
      
      const values = parseCSVLine(line);
      if (values.length > sampleIdIndex && values[sampleIdIndex]?.trim() === sampleId) {
        found = true;
        return row;
      }
      return line;
    });

    if (!found) {
      return { success: false, error: 'Entry not found' };
    }

    // Write updated content
    await FileSystem.writeAsStringAsync(getSoilTestFilePath(), updatedLines.join('\n') + '\n');

    return { success: true };
  } catch (error) {
    console.error('[SoilTestService] Update error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a soil test result by sample_id
 */
export const deleteSoilTestResult = async (sampleId) => {
  if (isWeb) {
    return { success: false, error: 'Not supported on web' };
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(getSoilTestFilePath());
    if (!fileInfo.exists) {
      return { success: false, error: 'File does not exist' };
    }

    const content = await FileSystem.readAsStringAsync(getSoilTestFilePath());
    const lines = content.trim().split('\n');
    
    if (lines.length < 2) {
      return { success: false, error: 'No data to delete' };
    }

    const headers = lines[0].split(',');
    const sampleIdIndex = headers.findIndex(h => h.trim() === 'sample_id');
    
    if (sampleIdIndex === -1) {
      return { success: false, error: 'sample_id column not found' };
    }

    // Filter out the row with matching sample_id
    const filteredLines = lines.filter((line, index) => {
      if (index === 0) return true; // Keep header
      
      const values = parseCSVLine(line);
      return !(values.length > sampleIdIndex && values[sampleIdIndex]?.trim() === sampleId);
    });

    // Write updated content
    await FileSystem.writeAsStringAsync(getSoilTestFilePath(), filteredLines.join('\n') + '\n');

    return { success: true };
  } catch (error) {
    console.error('[SoilTestService] Delete error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get soil test file path
 */
export const getSoilTestPath = () => getSoilTestFilePath();
