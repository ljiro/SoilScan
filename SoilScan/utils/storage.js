import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

// Storage keys
const STORAGE_KEYS = {
  CONSENT_ACCEPTED: 'soilscan_consent_accepted',
  CONSENT_DATE: 'soilscan_consent_date',
  SCAN_LOGS: 'soilscan_scan_logs',
  USER_PREFERENCES: 'soilscan_user_preferences',
  USER_PROFILE: 'soilscan_user_profile',
  SAVED_GUIDES: 'soilscan_saved_guides',
};

// Directory for app-private photo storage
const PHOTOS_DIRECTORY = `${FileSystem.documentDirectory}soilscan_photos/`;

// ============================================
// CONSENT MANAGEMENT
// ============================================

/**
 * Check if user has accepted the storage consent
 */
export const hasAcceptedConsent = async () => {
  try {
    const accepted = await AsyncStorage.getItem(STORAGE_KEYS.CONSENT_ACCEPTED);
    return accepted === 'true';
  } catch (error) {
    console.error('Error checking consent status:', error);
    return false;
  }
};

/**
 * Save user's consent acceptance
 */
export const acceptConsent = async () => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.CONSENT_ACCEPTED, 'true');
    await AsyncStorage.setItem(STORAGE_KEYS.CONSENT_DATE, new Date().toISOString());
    await ensurePhotosDirectoryExists();
    return true;
  } catch (error) {
    console.error('Error saving consent:', error);
    return false;
  }
};

/**
 * Get the date when consent was accepted
 */
export const getConsentDate = async () => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.CONSENT_DATE);
  } catch (error) {
    console.error('Error getting consent date:', error);
    return null;
  }
};

/**
 * Revoke consent and clear all stored data
 */
export const revokeConsent = async () => {
  try {
    await clearAllData();
    await AsyncStorage.removeItem(STORAGE_KEYS.CONSENT_ACCEPTED);
    await AsyncStorage.removeItem(STORAGE_KEYS.CONSENT_DATE);
    return true;
  } catch (error) {
    console.error('Error revoking consent:', error);
    return false;
  }
};

// ============================================
// PHOTO STORAGE
// ============================================

/**
 * Ensure the photos directory exists
 */
export const ensurePhotosDirectoryExists = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIRECTORY);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTOS_DIRECTORY, { intermediates: true });
    }
    return true;
  } catch (error) {
    console.error('Error creating photos directory:', error);
    return false;
  }
};

/**
 * Save a photo to app-private storage
 * @param {string} sourceUri - The source URI of the photo to save
 * @param {string} filename - Optional custom filename (defaults to timestamp)
 * @returns {string|null} - The saved photo URI or null if failed
 */
export const savePhoto = async (sourceUri, filename = null) => {
  try {
    await ensurePhotosDirectoryExists();

    const photoFilename = filename || `soil_scan_${Date.now()}.jpg`;
    const destinationUri = `${PHOTOS_DIRECTORY}${photoFilename}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    return destinationUri;
  } catch (error) {
    console.error('Error saving photo:', error);
    return null;
  }
};

/**
 * Get all saved photos
 * @returns {Array} - Array of photo URIs
 */
export const getSavedPhotos = async () => {
  try {
    await ensurePhotosDirectoryExists();
    const files = await FileSystem.readDirectoryAsync(PHOTOS_DIRECTORY);
    return files.map(file => `${PHOTOS_DIRECTORY}${file}`);
  } catch (error) {
    console.error('Error getting saved photos:', error);
    return [];
  }
};

/**
 * Delete a specific photo
 * @param {string} photoUri - The URI of the photo to delete
 */
export const deletePhoto = async (photoUri) => {
  try {
    await FileSystem.deleteAsync(photoUri, { idempotent: true });
    return true;
  } catch (error) {
    console.error('Error deleting photo:', error);
    return false;
  }
};

/**
 * Delete all saved photos
 */
export const deleteAllPhotos = async () => {
  try {
    await FileSystem.deleteAsync(PHOTOS_DIRECTORY, { idempotent: true });
    await ensurePhotosDirectoryExists();
    return true;
  } catch (error) {
    console.error('Error deleting all photos:', error);
    return false;
  }
};

// ============================================
// SCAN LOGS
// ============================================

/**
 * Add a new scan log entry
 * @param {Object} scanData - The scan data to log
 */
export const addScanLog = async (scanData) => {
  try {
    const logs = await getScanLogs();
    const newLog = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...scanData,
    };
    logs.unshift(newLog); // Add to beginning (most recent first)

    // Keep only the last 100 logs
    const trimmedLogs = logs.slice(0, 100);

    await AsyncStorage.setItem(STORAGE_KEYS.SCAN_LOGS, JSON.stringify(trimmedLogs));
    return newLog;
  } catch (error) {
    console.error('Error adding scan log:', error);
    return null;
  }
};

/**
 * Get all scan logs
 * @returns {Array} - Array of scan log objects
 */
export const getScanLogs = async () => {
  try {
    const logsJson = await AsyncStorage.getItem(STORAGE_KEYS.SCAN_LOGS);
    return logsJson ? JSON.parse(logsJson) : [];
  } catch (error) {
    console.error('Error getting scan logs:', error);
    return [];
  }
};

/**
 * Get scan statistics
 * @returns {Object} - Statistics about scans
 */
export const getScanStats = async () => {
  try {
    const logs = await getScanLogs();

    const soilTypes = new Set();
    const locations = new Set();

    logs.forEach(log => {
      if (log.soilType) soilTypes.add(log.soilType);
      if (log.location) locations.add(JSON.stringify(log.location));
    });

    return {
      totalScans: logs.length,
      uniqueSoilTypes: soilTypes.size,
      uniqueLocations: locations.size,
      recentScans: logs.slice(0, 5),
    };
  } catch (error) {
    console.error('Error getting scan stats:', error);
    return {
      totalScans: 0,
      uniqueSoilTypes: 0,
      uniqueLocations: 0,
      recentScans: [],
    };
  }
};

/**
 * Clear all scan logs
 */
export const clearScanLogs = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.SCAN_LOGS);
    return true;
  } catch (error) {
    console.error('Error clearing scan logs:', error);
    return false;
  }
};

// ============================================
// USER PREFERENCES
// ============================================

/**
 * Save user preferences
 * @param {Object} preferences - The preferences to save
 */
export const savePreferences = async (preferences) => {
  try {
    const existing = await getPreferences();
    const merged = { ...existing, ...preferences };
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(merged));
    return true;
  } catch (error) {
    console.error('Error saving preferences:', error);
    return false;
  }
};

/**
 * Get user preferences
 * @returns {Object} - User preferences
 */
export const getPreferences = async () => {
  try {
    const prefsJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    return prefsJson ? JSON.parse(prefsJson) : {};
  } catch (error) {
    console.error('Error getting preferences:', error);
    return {};
  }
};

// ============================================
// DATA MANAGEMENT
// ============================================

/**
 * Clear all app data (photos, logs, preferences)
 */
export const clearAllData = async () => {
  try {
    await deleteAllPhotos();
    await clearScanLogs();
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
    return true;
  } catch (error) {
    console.error('Error clearing all data:', error);
    return false;
  }
};

/**
 * Get storage usage information
 * @returns {Object} - Storage usage stats
 */
export const getStorageInfo = async () => {
  try {
    const photos = await getSavedPhotos();
    let totalPhotoSize = 0;

    for (const photoUri of photos) {
      const info = await FileSystem.getInfoAsync(photoUri, { size: true });
      if (info.exists && info.size) {
        totalPhotoSize += info.size;
      }
    }

    const logs = await getScanLogs();
    const logsSize = JSON.stringify(logs).length;

    return {
      photoCount: photos.length,
      photoSizeBytes: totalPhotoSize,
      photoSizeMB: (totalPhotoSize / (1024 * 1024)).toFixed(2),
      logCount: logs.length,
      logSizeBytes: logsSize,
    };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return {
      photoCount: 0,
      photoSizeBytes: 0,
      photoSizeMB: '0.00',
      logCount: 0,
      logSizeBytes: 0,
    };
  }
};

// ============================================
// USER PROFILE
// ============================================

/**
 * Save user profile data
 * @param {Object} profile - The profile data to save
 */
export const saveUserProfile = async (profile) => {
  try {
    const existing = await getUserProfile();
    const merged = { ...existing, ...profile };
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(merged));
    return true;
  } catch (error) {
    console.error('Error saving user profile:', error);
    return false;
  }
};

/**
 * Get user profile data
 * @returns {Object} - User profile
 */
export const getUserProfile = async () => {
  try {
    const profileJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return profileJson ? JSON.parse(profileJson) : {
      name: 'SoilScan User',
      email: '',
      avatarUri: null,
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return { name: 'SoilScan User', email: '', avatarUri: null };
  }
};

/**
 * Save user avatar image
 * @param {string} sourceUri - The source URI of the avatar image
 * @returns {string|null} - The saved avatar URI or null if failed
 */
export const saveUserAvatar = async (sourceUri) => {
  try {
    await ensurePhotosDirectoryExists();
    const avatarFilename = 'user_avatar.jpg';
    const destinationUri = `${PHOTOS_DIRECTORY}${avatarFilename}`;

    // Delete existing avatar if it exists
    await FileSystem.deleteAsync(destinationUri, { idempotent: true });

    // Copy new avatar
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    // Update profile with new avatar URI
    await saveUserProfile({ avatarUri: destinationUri });

    return destinationUri;
  } catch (error) {
    console.error('Error saving user avatar:', error);
    return null;
  }
};

// ============================================
// SAVED GUIDES / BOOKMARKS
// ============================================

/**
 * Save a guide to bookmarks
 * @param {Object} guide - The guide to save
 */
export const saveGuide = async (guide) => {
  try {
    const guides = await getSavedGuides();

    // Check if already saved
    const existingIndex = guides.findIndex(g => g.id === guide.id);
    if (existingIndex >= 0) {
      return guides; // Already saved
    }

    const savedGuide = {
      ...guide,
      savedAt: new Date().toISOString(),
    };
    guides.unshift(savedGuide);

    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_GUIDES, JSON.stringify(guides));
    return guides;
  } catch (error) {
    console.error('Error saving guide:', error);
    return [];
  }
};

/**
 * Remove a guide from bookmarks
 * @param {string} guideId - The ID of the guide to remove
 */
export const removeGuide = async (guideId) => {
  try {
    const guides = await getSavedGuides();
    const filtered = guides.filter(g => g.id !== guideId);
    await AsyncStorage.setItem(STORAGE_KEYS.SAVED_GUIDES, JSON.stringify(filtered));
    return filtered;
  } catch (error) {
    console.error('Error removing guide:', error);
    return [];
  }
};

/**
 * Get all saved guides
 * @returns {Array} - Array of saved guides
 */
export const getSavedGuides = async () => {
  try {
    const guidesJson = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_GUIDES);
    return guidesJson ? JSON.parse(guidesJson) : [];
  } catch (error) {
    console.error('Error getting saved guides:', error);
    return [];
  }
};

/**
 * Check if a guide is saved
 * @param {string} guideId - The ID of the guide to check
 * @returns {boolean} - Whether the guide is saved
 */
export const isGuideSaved = async (guideId) => {
  try {
    const guides = await getSavedGuides();
    return guides.some(g => g.id === guideId);
  } catch (error) {
    return false;
  }
};

/**
 * Clear all saved guides
 */
export const clearSavedGuides = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_GUIDES);
    return true;
  } catch (error) {
    console.error('Error clearing saved guides:', error);
    return false;
  }
};

export default {
  // Consent
  hasAcceptedConsent,
  acceptConsent,
  getConsentDate,
  revokeConsent,
  // Photos
  savePhoto,
  getSavedPhotos,
  deletePhoto,
  deleteAllPhotos,
  // Logs
  addScanLog,
  getScanLogs,
  getScanStats,
  clearScanLogs,
  // Preferences
  savePreferences,
  getPreferences,
  // User Profile
  saveUserProfile,
  getUserProfile,
  saveUserAvatar,
  // Saved Guides
  saveGuide,
  removeGuide,
  getSavedGuides,
  isGuideSaved,
  clearSavedGuides,
  // Data management
  clearAllData,
  getStorageInfo,
};
