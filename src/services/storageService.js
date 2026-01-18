// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Use lazy evaluation for all paths to ensure FileSystem.documentDirectory is available
// These are evaluated at runtime, not module load time, to avoid null/undefined issues
const getAppRootDir = () => `${FileSystem.documentDirectory}AgriCapture/`;
const getImagesDir = () => `${getAppRootDir()}images/`;
const getDataDir = () => `${getAppRootDir()}data/`;
const getConfigDir = () => `${getAppRootDir()}config/`;
const getCacheDir = () => `${getAppRootDir()}cache/`;
const getExportsDir = () => `${getAppRootDir()}exports/`;
const CONFIG_PREFIX = '@agricapture_config_';

const isWeb = Platform.OS === 'web';

// Required directories for the app (evaluated lazily)
const getRequiredDirectories = () => [
  getAppRootDir(),
  getImagesDir(),
  getDataDir(),
  getConfigDir(),
  getCacheDir(),
  getExportsDir(),
];

/**
 * Generic retry wrapper for async operations
 */
const withRetry = async (operation, maxRetries = 3, delay = 200) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, delay * attempt));
    }
  }
};

/**
 * Ensure directory exists (native only)
 */
const ensureDir = async (dir) => {
  if (isWeb) return true;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return true;
  } catch (error) {
    console.error('Directory error:', dir, error);
    return false;
  }
};

/**
 * Initialize storage directories
 */
export const initStorage = async () => {
  if (isWeb) return;
  await ensureDir(getAppRootDir());
  await ensureDir(getImagesDir());
  await ensureDir(getDataDir());
  await ensureDir(getConfigDir());
  await ensureDir(getCacheDir());
  await ensureDir(getExportsDir());
};

/**
 * Check and create all required directories on app startup
 * Returns status of each directory
 */
export const initializeAppDirectories = async () => {
  if (isWeb) {
    return { success: true, platform: 'web', directories: [] };
  }

  const results = {
    success: true,
    platform: Platform.OS,
    directories: [],
    errors: [],
  };

  for (const dir of getRequiredDirectories()) {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        results.directories.push({ path: dir, status: 'created' });
      } else {
        results.directories.push({ path: dir, status: 'exists' });
      }
    } catch (error) {
      results.success = false;
      results.errors.push({ path: dir, error: error.message });
      results.directories.push({ path: dir, status: 'error', error: error.message });
    }
  }

  return results;
};

/**
 * Verify all required directories exist
 */
export const verifyDirectoryStructure = async () => {
  if (isWeb) return { valid: true, platform: 'web' };

  const status = {
    valid: true,
    missing: [],
    existing: [],
  };

  for (const dir of getRequiredDirectories()) {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        status.existing.push(dir);
      } else {
        status.valid = false;
        status.missing.push(dir);
      }
    } catch {
      status.valid = false;
      status.missing.push(dir);
    }
  }

  return status;
};

/**
 * Get date-based path for organizing images
 */
export const getDatePath = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}/`;
};

/**
 * Save image to storage
 * @param {string} uri - Source image URI (from camera or ImageManipulator)
 * @param {string} filename - Target filename
 * @returns {Promise<string>} Relative path for CSV storage, or throws error
 */
export const saveImage = async (uri, filename) => {
  if (isWeb) {
    console.warn('[StorageService] Image saving not supported on web');
    return uri;
  }

  // Validate inputs
  if (!uri) {
    throw new Error('No image URI provided');
  }
  if (!filename) {
    throw new Error('No filename provided');
  }

  // Normalize the URI - handle different schemes
  let normalizedUri = uri;
  // If URI starts with content:// or doesn't have a scheme, handle it
  if (!uri.startsWith('file://') && !uri.startsWith('/')) {
    console.log('[StorageService] URI needs normalization:', uri.substring(0, 50));
    // Try to use as-is, FileSystem should handle it
  }

  const datePath = getDatePath();
  const fullDir = `${getImagesDir()}${datePath}`;
  const destPath = `${fullDir}${filename}`;
  const relativePath = `images/${datePath}${filename}`;

  console.log('[StorageService] === Starting Image Save ===');
  console.log('[StorageService] Source URI:', uri);
  console.log('[StorageService] Target directory:', fullDir);
  console.log('[StorageService] Target path:', destPath);

  try {
    // Step 1: Ensure the app root directory exists first
    console.log('[StorageService] Step 1: Creating app root directory...');
    const rootCreated = await ensureDir(getAppRootDir());
    if (!rootCreated) {
      throw new Error('Failed to create app root directory. Check storage permissions.');
    }
    console.log('[StorageService] App root directory ready');

    // Step 2: Ensure the images base directory exists
    console.log('[StorageService] Step 2: Creating images directory...');
    const baseCreated = await ensureDir(getImagesDir());
    if (!baseCreated) {
      throw new Error('Failed to create base images directory. Check storage permissions.');
    }
    console.log('[StorageService] Images base directory ready');

    // Step 3: Create the date-based subdirectory
    console.log('[StorageService] Step 3: Creating date subdirectory...');
    const dirCreated = await ensureDir(fullDir);
    if (!dirCreated) {
      throw new Error(`Failed to create date directory: ${fullDir}. Check storage permissions.`);
    }
    console.log('[StorageService] Date subdirectory ready');

    // Step 4: Verify source file exists and has content
    console.log('[StorageService] Step 4: Verifying source image...');
    console.log('[StorageService] Checking URI:', uri);
    let sourceInfo;
    try {
      sourceInfo = await FileSystem.getInfoAsync(uri);
      console.log('[StorageService] Source info:', JSON.stringify(sourceInfo));
    } catch (infoError) {
      console.error('[StorageService] Error getting source info:', infoError.message);
      // Try to continue anyway - some URIs might not be checkable but still copyable
      sourceInfo = { exists: true, size: 1 }; // Assume it exists
    }

    if (!sourceInfo.exists) {
      console.error('[StorageService] Source does not exist at:', uri);
      throw new Error(`Source image does not exist at: ${uri.substring(0, 80)}...`);
    }
    if (sourceInfo.size === 0) {
      throw new Error('Source image is empty (0 bytes)');
    }
    console.log('[StorageService] Source file verified, size:', sourceInfo.size, 'bytes');

    // Step 5: Copy the file with retry logic
    console.log('[StorageService] Step 5: Copying image to app storage...');
    console.log('[StorageService] Copy from:', uri);
    console.log('[StorageService] Copy to:', destPath);

    let copySuccess = false;
    await withRetry(async () => {
      await FileSystem.copyAsync({ from: uri, to: destPath });
      copySuccess = true;
    }, 3, 300);

    if (!copySuccess) {
      throw new Error('File copy failed after multiple retries');
    }
    console.log('[StorageService] File copy completed');

    // Step 6: Verify the file was saved successfully
    console.log('[StorageService] Step 6: Verifying saved image...');
    const destInfo = await FileSystem.getInfoAsync(destPath);
    console.log('[StorageService] Destination file info:', JSON.stringify(destInfo));

    if (!destInfo.exists) {
      throw new Error('Verification failed - saved file does not exist. Possible write permission issue.');
    }

    if (destInfo.size === 0) {
      // Clean up empty file
      await FileSystem.deleteAsync(destPath, { idempotent: true });
      throw new Error('Verification failed - saved file is empty. Storage may be full.');
    }

    // Verify size matches (with some tolerance for compression differences)
    const sizeDiff = Math.abs(sourceInfo.size - destInfo.size);
    const sizeTolerance = sourceInfo.size * 0.1; // 10% tolerance
    if (sizeDiff > sizeTolerance && destInfo.size < sourceInfo.size * 0.5) {
      console.warn('[StorageService] Warning: Saved file size differs significantly from source');
      console.warn('[StorageService] Source size:', sourceInfo.size, 'Dest size:', destInfo.size);
    }

    console.log('[StorageService] === Image Save Complete ===');
    console.log('[StorageService] Relative path (for CSV):', relativePath);
    console.log('[StorageService] Full path:', destPath);
    console.log('[StorageService] Saved size:', destInfo.size, 'bytes');

    return relativePath;
  } catch (error) {
    console.error('[StorageService] === Image Save Failed ===');
    console.error('[StorageService] Error:', error.message);
    console.error('[StorageService] Stack:', error.stack);
    throw new Error(`Image save failed: ${error.message}`);
  }
};

/**
 * Save configuration
 */
export const saveConfig = async (key, value) => {
  try {
    if (isWeb) {
      await withRetry(async () => {
        await AsyncStorage.setItem(`${CONFIG_PREFIX}${key}`, JSON.stringify(value));
      });
    } else {
      await withRetry(async () => {
        await ensureDir(getConfigDir());
        await FileSystem.writeAsStringAsync(
          `${getConfigDir()}${key}.json`,
          JSON.stringify(value)
        );
      });
    }

    // Verify save
    const saved = await loadConfig(key);
    if (!saved) {
      return { success: false, error: 'Verification failed' };
    }

    return { success: true };
  } catch (error) {
    console.error('Save config error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Load configuration
 */
export const loadConfig = async (key) => {
  try {
    if (isWeb) {
      const content = await AsyncStorage.getItem(`${CONFIG_PREFIX}${key}`);
      return content ? JSON.parse(content) : null;
    } else {
      const path = `${getConfigDir()}${key}.json`;
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;

      const content = await FileSystem.readAsStringAsync(path);
      return content ? JSON.parse(content) : null;
    }
  } catch (error) {
    console.error('Load config error:', error);
    return null;
  }
};

/**
 * Delete configuration
 */
export const deleteConfig = async (key) => {
  try {
    if (isWeb) {
      await AsyncStorage.removeItem(`${CONFIG_PREFIX}${key}`);
    } else {
      await FileSystem.deleteAsync(`${getConfigDir()}${key}.json`, { idempotent: true });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Check if config exists
 */
export const configExists = async (key) => {
  try {
    if (isWeb) {
      return (await AsyncStorage.getItem(`${CONFIG_PREFIX}${key}`)) !== null;
    }
    const info = await FileSystem.getInfoAsync(`${getConfigDir()}${key}.json`);
    return info.exists;
  } catch {
    return false;
  }
};

// Export the lazy-evaluated path functions
export { getImagesDir, getDataDir, getConfigDir, getCacheDir, getExportsDir, getAppRootDir };
export const isWebPlatform = () => isWeb;

/**
 * Exported ensureDir for use by other services (e.g., csvService)
 */
export { ensureDir };

/**
 * Get storage usage statistics for the app
 */
export const getStorageStats = async () => {
  if (isWeb) {
    return {
      platform: 'web',
      totalSize: 0,
      breakdown: {},
      message: 'Storage stats not available on web platform',
    };
  }

  const stats = {
    platform: Platform.OS,
    totalSize: 0,
    breakdown: {
      images: { size: 0, count: 0 },
      config: { size: 0, count: 0 },
      cache: { size: 0, count: 0 },
      exports: { size: 0, count: 0 },
    },
  };

  const calculateDirSize = async (dirPath, category) => {
    try {
      const info = await FileSystem.getInfoAsync(dirPath);
      if (!info.exists) return;

      const contents = await FileSystem.readDirectoryAsync(dirPath);
      for (const item of contents) {
        const itemPath = `${dirPath}${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);

        if (itemInfo.isDirectory) {
          await calculateDirSize(`${itemPath}/`, category);
        } else if (itemInfo.size) {
          stats.breakdown[category].size += itemInfo.size;
          stats.breakdown[category].count += 1;
          stats.totalSize += itemInfo.size;
        }
      }
    } catch (error) {
      console.error(`Error calculating size for ${dirPath}:`, error);
    }
  };

  await Promise.all([
    calculateDirSize(getImagesDir(), 'images'),
    calculateDirSize(getConfigDir(), 'config'),
    calculateDirSize(getCacheDir(), 'cache'),
    calculateDirSize(getExportsDir(), 'exports'),
  ]);

  // Format sizes for display
  stats.formattedTotal = formatBytes(stats.totalSize);
  stats.breakdown.images.formattedSize = formatBytes(stats.breakdown.images.size);
  stats.breakdown.config.formattedSize = formatBytes(stats.breakdown.config.size);
  stats.breakdown.cache.formattedSize = formatBytes(stats.breakdown.cache.size);
  stats.breakdown.exports.formattedSize = formatBytes(stats.breakdown.exports.size);

  return stats;
};

/**
 * Format bytes to human readable string
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Save data to cache with optional expiry
 */
export const saveToCache = async (key, data, expiryMinutes = 60) => {
  if (isWeb) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + (expiryMinutes * 60 * 1000),
      };
      await AsyncStorage.setItem(`@agricapture_cache_${key}`, JSON.stringify(cacheData));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  try {
    await ensureDir(getCacheDir());
    const cacheData = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + (expiryMinutes * 60 * 1000),
    };
    await FileSystem.writeAsStringAsync(
      `${getCacheDir()}${key}.json`,
      JSON.stringify(cacheData)
    );
    return { success: true };
  } catch (error) {
    console.error('Cache save error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Load data from cache, returns null if expired or not found
 */
export const loadFromCache = async (key) => {
  try {
    let cacheContent;

    if (isWeb) {
      cacheContent = await AsyncStorage.getItem(`@agricapture_cache_${key}`);
    } else {
      const path = `${getCacheDir()}${key}.json`;
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;
      cacheContent = await FileSystem.readAsStringAsync(path);
    }

    if (!cacheContent) return null;

    const cacheData = JSON.parse(cacheContent);

    // Check if cache has expired
    if (cacheData.expiry && Date.now() > cacheData.expiry) {
      await deleteFromCache(key);
      return null;
    }

    return cacheData.data;
  } catch (error) {
    console.error('Cache load error:', error);
    return null;
  }
};

/**
 * Delete specific cache item
 */
export const deleteFromCache = async (key) => {
  try {
    if (isWeb) {
      await AsyncStorage.removeItem(`@agricapture_cache_${key}`);
    } else {
      await FileSystem.deleteAsync(`${getCacheDir()}${key}.json`, { idempotent: true });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Clear all cache data
 */
export const clearCache = async () => {
  if (isWeb) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith('@agricapture_cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
      return { success: true, clearedCount: cacheKeys.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  try {
    const info = await FileSystem.getInfoAsync(getCacheDir());
    if (!info.exists) {
      return { success: true, clearedCount: 0 };
    }

    const contents = await FileSystem.readDirectoryAsync(getCacheDir());
    let clearedCount = 0;

    for (const item of contents) {
      await FileSystem.deleteAsync(`${getCacheDir()}${item}`, { idempotent: true });
      clearedCount++;
    }

    return { success: true, clearedCount };
  } catch (error) {
    console.error('Clear cache error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Clear expired cache items only
 */
export const clearExpiredCache = async () => {
  if (isWeb) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith('@agricapture_cache_'));
      let clearedCount = 0;

      for (const key of cacheKeys) {
        const content = await AsyncStorage.getItem(key);
        if (content) {
          const cacheData = JSON.parse(content);
          if (cacheData.expiry && Date.now() > cacheData.expiry) {
            await AsyncStorage.removeItem(key);
            clearedCount++;
          }
        }
      }

      return { success: true, clearedCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  try {
    const info = await FileSystem.getInfoAsync(getCacheDir());
    if (!info.exists) {
      return { success: true, clearedCount: 0 };
    }

    const contents = await FileSystem.readDirectoryAsync(getCacheDir());
    let clearedCount = 0;

    for (const item of contents) {
      try {
        const content = await FileSystem.readAsStringAsync(`${getCacheDir()}${item}`);
        const cacheData = JSON.parse(content);

        if (cacheData.expiry && Date.now() > cacheData.expiry) {
          await FileSystem.deleteAsync(`${getCacheDir()}${item}`, { idempotent: true });
          clearedCount++;
        }
      } catch {
        // If we can't parse it, delete it
        await FileSystem.deleteAsync(`${getCacheDir()}${item}`, { idempotent: true });
        clearedCount++;
      }
    }

    return { success: true, clearedCount };
  } catch (error) {
    console.error('Clear expired cache error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get cache statistics
 */
/**
 * Verify storage is working and re-initialize if needed
 * Call this AFTER permissions are granted to ensure directories exist
 * @returns {Object} Status of storage verification
 */
export const verifyAndInitializeStorage = async () => {
  console.log('[StorageService] === Verifying and Initializing Storage ===');

  if (isWeb) {
    return { success: true, platform: 'web', message: 'Web platform - no verification needed' };
  }

  const results = {
    success: true,
    verified: [],
    created: [],
    errors: [],
  };

  // Step 1: Verify documentDirectory is available
  console.log('[StorageService] Step 1: Checking documentDirectory...');
  if (!FileSystem.documentDirectory) {
    results.success = false;
    results.errors.push('FileSystem.documentDirectory is not available');
    console.error('[StorageService] CRITICAL: documentDirectory is null/undefined');
    return results;
  }
  console.log('[StorageService] documentDirectory:', FileSystem.documentDirectory);

  // Step 2: Create/verify each required directory
  console.log('[StorageService] Step 2: Creating/verifying directories...');
  for (const dir of getRequiredDirectories()) {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        console.log('[StorageService] Creating directory:', dir);
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

        // Verify creation
        const verifyInfo = await FileSystem.getInfoAsync(dir);
        if (verifyInfo.exists) {
          results.created.push(dir);
          console.log('[StorageService] Successfully created:', dir);
        } else {
          throw new Error('Directory creation verification failed');
        }
      } else {
        results.verified.push(dir);
        console.log('[StorageService] Directory exists:', dir);
      }
    } catch (error) {
      results.success = false;
      results.errors.push({ path: dir, error: error.message });
      console.error('[StorageService] Failed to create/verify:', dir, error.message);
    }
  }

  // Step 3: Test write capability
  console.log('[StorageService] Step 3: Testing write capability...');
  try {
    const testFile = `${getAppRootDir()}.storage_test`;
    const testContent = `test_${Date.now()}`;
    await FileSystem.writeAsStringAsync(testFile, testContent);
    const readBack = await FileSystem.readAsStringAsync(testFile);
    await FileSystem.deleteAsync(testFile, { idempotent: true });

    if (readBack === testContent) {
      results.writeTest = 'passed';
      console.log('[StorageService] Write test PASSED');
    } else {
      results.writeTest = 'failed - content mismatch';
      results.success = false;
      console.error('[StorageService] Write test FAILED - content mismatch');
    }
  } catch (error) {
    results.writeTest = `failed - ${error.message}`;
    results.success = false;
    console.error('[StorageService] Write test FAILED:', error.message);
  }

  console.log('[StorageService] === Storage Verification Complete ===');
  console.log('[StorageService] Success:', results.success);
  console.log('[StorageService] Verified:', results.verified.length, 'directories');
  console.log('[StorageService] Created:', results.created.length, 'directories');
  console.log('[StorageService] Errors:', results.errors.length);

  return results;
};

export const getCacheStats = async () => {
  if (isWeb) {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith('@agricapture_cache_'));
      let expiredCount = 0;
      let validCount = 0;

      for (const key of cacheKeys) {
        const content = await AsyncStorage.getItem(key);
        if (content) {
          const cacheData = JSON.parse(content);
          if (cacheData.expiry && Date.now() > cacheData.expiry) {
            expiredCount++;
          } else {
            validCount++;
          }
        }
      }

      return {
        platform: 'web',
        totalItems: cacheKeys.length,
        validItems: validCount,
        expiredItems: expiredCount,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  try {
    const info = await FileSystem.getInfoAsync(getCacheDir());
    if (!info.exists) {
      return {
        platform: Platform.OS,
        totalItems: 0,
        validItems: 0,
        expiredItems: 0,
        totalSize: 0,
        formattedSize: '0 Bytes',
      };
    }

    const contents = await FileSystem.readDirectoryAsync(getCacheDir());
    let expiredCount = 0;
    let validCount = 0;
    let totalSize = 0;

    for (const item of contents) {
      try {
        const itemPath = `${getCacheDir()}${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);
        totalSize += itemInfo.size || 0;

        const content = await FileSystem.readAsStringAsync(itemPath);
        const cacheData = JSON.parse(content);

        if (cacheData.expiry && Date.now() > cacheData.expiry) {
          expiredCount++;
        } else {
          validCount++;
        }
      } catch {
        expiredCount++;
      }
    }

    return {
      platform: Platform.OS,
      totalItems: contents.length,
      validItems: validCount,
      expiredItems: expiredCount,
      totalSize,
      formattedSize: formatBytes(totalSize),
    };
  } catch (error) {
    console.error('Get cache stats error:', error);
    return { error: error.message };
  }
};
