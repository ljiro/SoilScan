/**
 * Simple Storage Service - AsyncStorage-only fallback
 *
 * This service provides a simple alternative to file-based storage
 * using only AsyncStorage. It's designed as a fallback when file
 * system operations fail.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORD_PREFIX = '@record_';
const RECORD_INDEX_KEY = '@record_index';

/**
 * Generate a simple UUID
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Get the index of all record UUIDs
 */
const getRecordIndex = async () => {
  try {
    const indexJson = await AsyncStorage.getItem(RECORD_INDEX_KEY);
    if (indexJson) {
      return JSON.parse(indexJson);
    }
    return [];
  } catch (error) {
    console.error('[SimpleStorage] Error getting record index:', error);
    return [];
  }
};

/**
 * Update the index of record UUIDs
 */
const updateRecordIndex = async (index) => {
  try {
    await AsyncStorage.setItem(RECORD_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.error('[SimpleStorage] Error updating record index:', error);
    throw error;
  }
};

/**
 * Save a record to AsyncStorage
 * @param {Object} record - The record to save
 * @returns {Object} The saved record with UUID
 */
export const saveRecord = async (record) => {
  try {
    // Ensure record has a UUID
    const uuid = record.uuid || generateUUID();
    const recordWithUUID = {
      ...record,
      uuid,
      savedAt: new Date().toISOString(),
    };

    // Save the record
    const key = `${RECORD_PREFIX}${uuid}`;
    await AsyncStorage.setItem(key, JSON.stringify(recordWithUUID));

    // Update the index
    const index = await getRecordIndex();
    if (!index.includes(uuid)) {
      index.push(uuid);
      await updateRecordIndex(index);
    }

    console.log('[SimpleStorage] Record saved successfully:', uuid);
    return recordWithUUID;
  } catch (error) {
    console.error('[SimpleStorage] Error saving record:', error);
    throw error;
  }
};

/**
 * Get all records from AsyncStorage
 * @returns {Array} Array of all records
 */
export const getAllRecords = async () => {
  try {
    const index = await getRecordIndex();

    if (index.length === 0) {
      console.log('[SimpleStorage] No records found');
      return [];
    }

    const records = [];

    for (const uuid of index) {
      try {
        const key = `${RECORD_PREFIX}${uuid}`;
        const recordJson = await AsyncStorage.getItem(key);

        if (recordJson) {
          const record = JSON.parse(recordJson);
          records.push(record);
        }
      } catch (parseError) {
        console.warn('[SimpleStorage] Error parsing record:', uuid, parseError);
        // Continue with other records
      }
    }

    // Sort by savedAt date (newest first)
    records.sort((a, b) => {
      const dateA = new Date(a.savedAt || a.timestamp || 0);
      const dateB = new Date(b.savedAt || b.timestamp || 0);
      return dateB - dateA;
    });

    console.log('[SimpleStorage] Retrieved', records.length, 'records');
    return records;
  } catch (error) {
    console.error('[SimpleStorage] Error getting all records:', error);
    return [];
  }
};

/**
 * Delete a record from AsyncStorage
 * @param {string} uuid - The UUID of the record to delete
 * @returns {boolean} True if deletion was successful
 */
export const deleteRecord = async (uuid) => {
  try {
    // Remove the record
    const key = `${RECORD_PREFIX}${uuid}`;
    await AsyncStorage.removeItem(key);

    // Update the index
    const index = await getRecordIndex();
    const newIndex = index.filter(id => id !== uuid);
    await updateRecordIndex(newIndex);

    console.log('[SimpleStorage] Record deleted successfully:', uuid);
    return true;
  } catch (error) {
    console.error('[SimpleStorage] Error deleting record:', error);
    return false;
  }
};

/**
 * Get the count of records
 * @returns {number} The number of records
 */
export const getRecordCount = async () => {
  try {
    const index = await getRecordIndex();
    return index.length;
  } catch (error) {
    console.error('[SimpleStorage] Error getting record count:', error);
    return 0;
  }
};

/**
 * Clear all records (use with caution!)
 * @returns {boolean} True if clearing was successful
 */
export const clearAllRecords = async () => {
  try {
    const index = await getRecordIndex();

    // Remove all record entries
    for (const uuid of index) {
      const key = `${RECORD_PREFIX}${uuid}`;
      await AsyncStorage.removeItem(key);
    }

    // Clear the index
    await AsyncStorage.removeItem(RECORD_INDEX_KEY);

    console.log('[SimpleStorage] All records cleared');
    return true;
  } catch (error) {
    console.error('[SimpleStorage] Error clearing all records:', error);
    return false;
  }
};

/**
 * Check if simple storage is available and working
 * @returns {boolean} True if storage is available
 */
export const isAvailable = async () => {
  try {
    const testKey = '@simple_storage_test';
    await AsyncStorage.setItem(testKey, 'test');
    await AsyncStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.error('[SimpleStorage] Storage not available:', error);
    return false;
  }
};

export default {
  saveRecord,
  getAllRecords,
  deleteRecord,
  getRecordCount,
  clearAllRecords,
  isAvailable,
};
