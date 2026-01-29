// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Use lazy evaluation for all paths to ensure FileSystem.documentDirectory is available
// These are evaluated at runtime, not module load time, to avoid null/undefined issues

// Cache for base storage dir to avoid repeated auto-detection
let baseStorageDirCache = null;
let baseStorageDirPromise = null;

/**
 * Get the base storage directory (can be external storage on Android)
 * On Android, tries to use external storage accessible via file managers
 * Falls back to documentDirectory if external storage is not available
 */
const getBaseStorageDir = async () => {
  // Return cached result if available
  if (baseStorageDirCache) {
    return baseStorageDirCache;
  }

  // If detection is in progress, wait for it
  if (baseStorageDirPromise) {
    return await baseStorageDirPromise;
  }

  // Start detection
  baseStorageDirPromise = (async () => {
    if (Platform.OS === 'android') {
      // Check if external storage path is configured
      const storageConfig = await loadConfig('storage_location');
      if (storageConfig?.externalPath) {
        // Use external if explicitly configured and still accessible
        try {
          const info = await FileSystem.getInfoAsync(storageConfig.externalPath);
          if (info.exists && info.isDirectory) {
            const path = storageConfig.externalPath.endsWith('/') ? storageConfig.externalPath : `${storageConfig.externalPath}/`;
            console.log('[StorageService] Using configured external storage:', path);
            baseStorageDirCache = path;
            return path;
          }
        } catch (error) {
          console.warn('[StorageService] External storage path not accessible, trying auto-detect:', error.message);
        }
      }
      // Try phone Documents / Download / etc. so CSV and images are visible in file manager
      console.log('[StorageService] Trying external storage (Documents, Download, etc.)...');
      const autoDetectResult = await autoDetectExternalStorage();
      if (autoDetectResult.success) {
        const raw = autoDetectResult.path;
        const path = raw.endsWith('/') ? raw : `${raw}/`;
        console.log('[StorageService] ✓ Using external storage:', path);
        baseStorageDirCache = path;
        return path;
      }
      console.log('[StorageService] External not available, using app documentDirectory');
    }
    
    // Default to documentDirectory (app sandbox - not accessible via file managers)
    const path = `${FileSystem.documentDirectory}AgriCapture/`;
    console.log('[StorageService] Using documentDirectory (internal storage):', path);
    baseStorageDirCache = path;
    return path;
  })();

  const result = await baseStorageDirPromise;
  baseStorageDirPromise = null;
  return result;
};

// For synchronous access, use documentDirectory as default
// External storage will be used when getBaseStorageDir() is called
const getAppRootDir = () => `${FileSystem.documentDirectory}AgriCapture/`;
const getImagesDir = () => `${getAppRootDir()}images/`;
const getDataDir = () => `${getAppRootDir()}data/`;
const getConfigDir = () => `${getAppRootDir()}config/`;
const getCacheDir = () => `${getAppRootDir()}cache/`;
const getExportsDir = () => `${getAppRootDir()}exports/`;

// Async versions that support external storage
const getAppRootDirAsync = async () => await getBaseStorageDir();
const getImagesDirAsync = async () => `${await getBaseStorageDir()}images/`;
const getDataDirAsync = async () => `${await getBaseStorageDir()}data/`;
const getConfigDirAsync = async () => `${await getBaseStorageDir()}config/`;

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
 * With retry logic for APK builds
 */
const ensureDir = async (dir, retries = 3) => {
  if (isWeb) return true;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        console.log(`[StorageService] Creating directory (attempt ${attempt}/${retries}):`, dir);
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        
        // Verify it was created
        const verifyInfo = await FileSystem.getInfoAsync(dir);
        if (verifyInfo.exists && verifyInfo.isDirectory) {
          console.log(`[StorageService] ✓ Directory created successfully:`, dir);
          return true;
        } else {
          throw new Error('Directory creation verification failed');
        }
      } else {
        console.log(`[StorageService] ✓ Directory already exists:`, dir);
        return true;
      }
    } catch (error) {
      console.error(`[StorageService] Directory creation error (attempt ${attempt}/${retries}):`, dir, error.message);
      if (attempt === retries) {
        console.error('[StorageService] ✗ Failed to create directory after', retries, 'attempts:', dir);
        return false;
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 200 * attempt));
    }
  }
  return false;
};

/**
 * Initialize storage directories
 * Enhanced for APK builds with better error handling
 * Uses external storage on Android if available
 */
export const initStorage = async () => {
  if (isWeb) {
    console.log('[StorageService] Web platform - skipping directory initialization');
    return;
  }

  console.log('[StorageService] === Initializing Storage Directories ===');
  console.log('[StorageService] documentDirectory:', FileSystem.documentDirectory);
  
  if (!FileSystem.documentDirectory) {
    console.error('[StorageService] CRITICAL: documentDirectory is null/undefined');
    throw new Error('FileSystem.documentDirectory is not available');
  }

  // On Android, try Documents/Download so files are visible in file manager
  if (Platform.OS === 'android') {
    const storageConfig = await loadConfig('storage_location');
    if (!storageConfig?.externalPath) {
      console.log('[StorageService] Trying external storage (Documents/Download)...');
      const autoDetectResult = await autoDetectExternalStorage();
      if (autoDetectResult.success) {
        console.log('[StorageService] ✓ Using external storage:', autoDetectResult.path);
      }
    }
  }

  const directories = [
    { name: 'App Root', getPath: () => getAppRootDirAsync() },
    { name: 'Images', getPath: () => getImagesDirAsync() },
    { name: 'Data', getPath: () => getDataDirAsync() },
    { name: 'Config', getPath: () => getConfigDirAsync() },
    { name: 'Cache', getPath: () => getAppRootDirAsync().then(p => `${p}cache/`) },
    { name: 'Exports', getPath: () => getAppRootDirAsync().then(p => `${p}exports/`) },
  ];

  const results = {
    success: true,
    created: [],
    existing: [],
    failed: [],
    storageLocation: 'internal',
  };

  // Get storage location info
  const storageInfo = await getStorageLocationInfo();
  results.storageLocation = storageInfo.type;
  results.storagePath = storageInfo.fullPath;
  console.log('[StorageService] Using storage location:', storageInfo.type, '-', storageInfo.fullPath);

  for (const { name, getPath } of directories) {
    try {
      const path = await getPath();
      const created = await ensureDir(path, 3);
      if (created) {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
          results.existing.push({ name, path });
          console.log('[StorageService] ✓', name, 'directory exists:', path);
        } else {
          results.created.push({ name, path });
          console.log('[StorageService] ✓', name, 'directory created:', path);
        }
      } else {
        results.success = false;
        results.failed.push({ name, path });
        console.error('[StorageService] ✗ Failed to create', name, 'directory:', path);
      }
    } catch (error) {
      results.success = false;
      const path = await getPath().catch(() => 'unknown');
      results.failed.push({ name, path, error: error.message });
      console.error('[StorageService] ✗ Error creating', name, 'directory:', error.message);
    }
  }

  console.log('[StorageService] === Directory Initialization Complete ===');
  console.log('[StorageService] Storage location:', results.storageLocation);
  console.log('[StorageService] Storage path:', results.storagePath);
  console.log('[StorageService] Created:', results.created.length);
  console.log('[StorageService] Existing:', results.existing.length);
  console.log('[StorageService] Failed:', results.failed.length);
  
  if (results.failed.length > 0) {
    console.error('[StorageService] Failed directories:', results.failed);
  }

  return results;
};

/**
 * Check and create all required directories on app startup
 * Uses async paths to support external storage on Android
 * Returns status of each directory
 */
export const initializeAppDirectories = async () => {
  if (isWeb) {
    return { success: true, platform: 'web', directories: [] };
  }

  // Clear base storage cache so we use current config (external vs internal)
  baseStorageDirCache = null;
  baseStorageDirPromise = null;

  console.log('[StorageService] === initializeAppDirectories ===');
  console.log('[StorageService] Platform:', Platform.OS);
  console.log('[StorageService] documentDirectory:', FileSystem.documentDirectory);

  if (!FileSystem.documentDirectory) {
    console.error('[StorageService] CRITICAL: documentDirectory is null/undefined');
    return {
      success: false,
      platform: Platform.OS,
      directories: [],
      errors: ['FileSystem.documentDirectory is not available'],
    };
  }

  // Use documentDirectory by default (no auto-detect of external storage)
  const results = {
    success: true,
    platform: Platform.OS,
    directories: [],
    errors: [],
    storageLocation: 'internal',
  };

  // Use async paths to support external storage
  const directories = [
    { name: 'App Root', getPath: () => getAppRootDirAsync() },
    { name: 'Images', getPath: () => getImagesDirAsync() },
    { name: 'Data', getPath: () => getDataDirAsync() },
    { name: 'Config', getPath: () => getConfigDirAsync() },
    { name: 'Cache', getPath: () => getAppRootDirAsync().then(p => `${p}cache/`) },
    { name: 'Exports', getPath: () => getAppRootDirAsync().then(p => `${p}exports/`) },
  ];

  // Get storage location info
  const storageInfo = await getStorageLocationInfo();
  results.storageLocation = storageInfo.type;
  results.storagePath = storageInfo.fullPath;
  console.log('[StorageService] Using storage location:', storageInfo.type, '-', storageInfo.fullPath);

  for (const { name, getPath } of directories) {
    try {
      const dir = await getPath();
      const created = await ensureDir(dir, 3);
      if (created) {
        const info = await FileSystem.getInfoAsync(dir);
        if (info.exists) {
          results.directories.push({ path: dir, status: 'exists', name });
          console.log('[StorageService] ✓', name, 'directory exists:', dir);
        } else {
          results.directories.push({ path: dir, status: 'created', name });
          console.log('[StorageService] ✓', name, 'directory created:', dir);
        }
      } else {
        throw new Error('Directory creation failed after retries');
      }
    } catch (error) {
      results.success = false;
      results.errors.push({ path: name, error: error.message });
      results.directories.push({ path: name, status: 'error', error: error.message });
      console.error('[StorageService] ✗ Failed to create', name, 'directory:', error.message);
    }
  }

  console.log('[StorageService] Directory initialization result:', {
    success: results.success,
    storageLocation: results.storageLocation,
    total: results.directories.length,
    errors: results.errors.length,
  });

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
 * Get date-based path for organizing images (legacy - kept for backward compatibility)
 */
export const getDatePath = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}/`;
};

/**
 * Sanitize a string for use as a directory name
 */
const sanitizeDirName = (name) => {
  if (!name) return 'unknown';
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')      // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, '') // Remove special chars except underscores
    .slice(0, 50);              // Max 50 chars
};

/**
 * Get label-based path for organizing images based on user config
 * Format: municipality/barangay/farm/crop/
 */
export const getLabelBasedPath = async (cropLabel = null) => {
  try {
    const config = await loadConfig('user_config');
    if (!config) {
      // Fallback to date-based if no config
      return getDatePath();
    }

    const municipality = sanitizeDirName(config.municipalityLabel || 'unknown');
    const barangay = sanitizeDirName(config.barangayLabel || 'unknown');
    const farm = config.farmName ? sanitizeDirName(config.farmName) : 'no_farm';
    const crop = cropLabel ? sanitizeDirName(cropLabel) : 'mixed_crops';

    return `${municipality}/${barangay}/${farm}/${crop}/`;
  } catch (error) {
    console.error('[StorageService] Error getting label-based path:', error);
    // Fallback to date-based
    return getDatePath();
  }
};

/**
 * Set external storage location (Android only)
 * @param {string} externalPath - Path to external storage directory (e.g., /storage/emulated/0/AgriCapture)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const setExternalStorageLocation = async (externalPath) => {
  if (Platform.OS !== 'android') {
    return { success: false, error: 'External storage is only available on Android' };
  }

  if (!externalPath) {
    // Clear external storage config, use documentDirectory
    await deleteConfig('storage_location');
    baseStorageDirCache = null;
    baseStorageDirPromise = null;
    return { success: true, message: 'Using app documentDirectory' };
  }

  try {
    // Verify the path exists and is writable
    const info = await FileSystem.getInfoAsync(externalPath);
    if (!info.exists) {
      // Try to create the directory
      await FileSystem.makeDirectoryAsync(externalPath, { intermediates: true });
    }

    // Test write capability
    const testFile = `${externalPath}/.storage_test`;
    const testContent = `test_${Date.now()}`;
    await FileSystem.writeAsStringAsync(testFile, testContent);
    const readBack = await FileSystem.readAsStringAsync(testFile);
    await FileSystem.deleteAsync(testFile, { idempotent: true });

    if (readBack === testContent) {
      // Save the external path
      await saveConfig('storage_location', { externalPath, setAt: new Date().toISOString() });
      // Clear cache so next getBaseStorageDir() uses the new path
      baseStorageDirCache = null;
      baseStorageDirPromise = null;
      // Create subdirs so external storage has full structure
      const subdirs = ['images', 'data', 'config', 'cache', 'exports'];
      const base = externalPath.endsWith('/') ? externalPath : `${externalPath}/`;
      for (const d of subdirs) {
        try {
          await FileSystem.makeDirectoryAsync(`${base}${d}`, { intermediates: true });
        } catch (_) {}
      }
      return { success: true, message: 'External storage location set successfully' };
    } else {
      return { success: false, error: 'Storage location is not writable' };
    }
  } catch (error) {
    console.error('[StorageService] Error setting external storage:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get current storage location info
 * @returns {Promise<{location: string, type: 'external' | 'internal', path: string}>}
 */
export const getStorageLocationInfo = async () => {
  const storageConfig = await loadConfig('storage_location');
  
  if (storageConfig?.externalPath && Platform.OS === 'android') {
    const base = storageConfig.externalPath.endsWith('/') ? storageConfig.externalPath : `${storageConfig.externalPath}/`;
    return {
      location: 'external',
      type: 'external',
      path: storageConfig.externalPath,
      fullPath: base,
    };
  }

  return {
    location: 'internal',
    type: 'internal',
    path: FileSystem.documentDirectory || 'unknown',
    fullPath: `${FileSystem.documentDirectory}AgriCapture/`,
  };
};

/**
 * Create directories based on user config labels
 * This is called when setup is saved to ensure directories exist
 */
export const createLabelBasedDirectories = async () => {
  if (isWeb) return { success: true, message: 'Web platform - no directories needed' };

  try {
    const config = await loadConfig('user_config');
    if (!config) {
      return { success: false, error: 'No user config found' };
    }

    const municipality = sanitizeDirName(config.municipalityLabel || 'unknown');
    const barangay = sanitizeDirName(config.barangayLabel || 'unknown');
    const farm = config.farmName ? sanitizeDirName(config.farmName) : 'no_farm';

    // Create base structure: municipality/barangay/farm/
    // Use async version to support external storage
    const imagesDir = await getImagesDirAsync();
    const basePath = `${imagesDir}${municipality}/${barangay}/${farm}/`;
    await ensureDir(basePath);

    // Create directories for each selected crop
    const crops = config.selectedCropLabels || [];
    const createdDirs = [basePath];

    for (const cropLabel of crops) {
      const crop = sanitizeDirName(cropLabel);
      const cropPath = `${basePath}${crop}/`;
      const created = await ensureDir(cropPath, 3);
      if (created) {
        createdDirs.push(cropPath);
      } else {
        console.error('[StorageService] Failed to create crop directory:', cropPath);
      }
    }

    // Also create a "mixed_crops" directory for images without specific crop
    const mixedPath = `${basePath}mixed_crops/`;
    const mixedCreated = await ensureDir(mixedPath, 3);
    if (mixedCreated) {
      createdDirs.push(mixedPath);
    } else {
      console.error('[StorageService] Failed to create mixed_crops directory:', mixedPath);
    }

    console.log('[StorageService] Created label-based directories:', createdDirs);
    return { success: true, directories: createdDirs };
  } catch (error) {
    console.error('[StorageService] Error creating label-based directories:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Save image to persistent storage (documentDirectory, NOT cache)
 * Images are stored on disk in organized directories - not in RAM or cache
 * This ensures images persist and don't consume memory
 * @param {string} uri - Source image URI (from camera or ImageManipulator)
 * @param {string} filename - Target filename
 * @param {string} cropLabel - Optional crop label to organize into specific crop directory
 * @returns {Promise<string>} Relative path for CSV storage, or throws error
 */
export const saveImage = async (uri, filename, cropLabel = null) => {
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

  // Get label-based path (will fallback to date-based if no config)
  const labelPath = await getLabelBasedPath(cropLabel);
  // Use async version to support external storage
  const imagesDir = await getImagesDirAsync();
  const fullDir = `${imagesDir}${labelPath}`;
  const destPath = `${fullDir}${filename}`;
  const relativePath = `images/${labelPath}${filename}`;

  console.log('[StorageService] === Starting Image Save ===');
  console.log('[StorageService] Source URI:', uri);
  console.log('[StorageService] Target directory:', fullDir);
  console.log('[StorageService] Target path:', destPath);

  try {
    // Step 1: Ensure the app root directory exists first
    console.log('[StorageService] Step 1: Creating app root directory...');
    const appRootDir = await getAppRootDirAsync();
    const rootCreated = await ensureDir(appRootDir, 3);
    if (!rootCreated) {
      console.error('[StorageService] Failed to create app root directory after retries');
      throw new Error('Failed to create app root directory. Check storage permissions.');
    }
    console.log('[StorageService] App root directory ready:', appRootDir);

    // Step 2: Ensure the images base directory exists
    console.log('[StorageService] Step 2: Creating images directory...');
    const imagesBaseDir = await getImagesDirAsync();
    const baseCreated = await ensureDir(imagesBaseDir, 3);
    if (!baseCreated) {
      console.error('[StorageService] Failed to create base images directory after retries');
      throw new Error('Failed to create base images directory. Check storage permissions.');
    }
    console.log('[StorageService] Images base directory ready:', imagesBaseDir);

    // Step 3: Create the label-based subdirectory
    console.log('[StorageService] Step 3: Creating label-based subdirectory...');
    const dirCreated = await ensureDir(fullDir, 3);
    if (!dirCreated) {
      console.error('[StorageService] Failed to create label directory after retries:', fullDir);
      throw new Error(`Failed to create label directory: ${fullDir}. Check storage permissions.`);
    }
    console.log('[StorageService] Label subdirectory ready:', fullDir);

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

/**
 * Get common Android external storage paths to try
 * @returns {string[]} Array of potential external storage paths
 */
export const getAndroidExternalStoragePaths = () => {
  if (Platform.OS !== 'android') {
    return [];
  }

  // Phone's Documents folder first (visible in file manager under Documents)
  // Then Download, then root - requires storage permission / "Manage all files" on Android 11+
  const paths = [
    '/storage/emulated/0/Documents/AgriCapture',  // Documents – visible in file manager
    '/storage/emulated/0/Download/AgriCapture',   // Download folder
    '/storage/emulated/0/AgriCapture',
    '/sdcard/Documents/AgriCapture',
    '/sdcard/Download/AgriCapture',
    '/sdcard/AgriCapture',
    '/storage/sdcard0/AgriCapture',
  ];

  return paths;
};

/**
 * Try to detect and set external storage automatically (Android only)
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export const autoDetectExternalStorage = async () => {
  if (Platform.OS !== 'android') {
    return { success: false, error: 'Auto-detection only available on Android' };
  }

  console.log('[StorageService] === Auto-detecting External Storage ===');
  const paths = getAndroidExternalStoragePaths();
  
  for (const path of paths) {
    try {
      console.log('[StorageService] Trying path:', path);
      const info = await FileSystem.getInfoAsync(path);
      
      // If directory doesn't exist, try to create it
      if (!info.exists) {
        console.log('[StorageService] Path does not exist, attempting to create:', path);
        try {
          await FileSystem.makeDirectoryAsync(path, { intermediates: true });
          const verifyInfo = await FileSystem.getInfoAsync(path);
          if (!verifyInfo.exists) {
            console.log('[StorageService] Failed to create path:', path);
            continue;
          }
        } catch (createError) {
          console.log('[StorageService] Cannot create path (may need permissions):', path, createError.message);
          continue;
        }
      }
      
      // Try to write to verify it's writable
      const testFile = `${path}/.storage_test_${Date.now()}`;
      try {
        await FileSystem.writeAsStringAsync(testFile, 'test');
        const readBack = await FileSystem.readAsStringAsync(testFile);
        await FileSystem.deleteAsync(testFile, { idempotent: true });
        
        if (readBack === 'test') {
          // This path works!
          console.log('[StorageService] ✓ Found writable external storage:', path);
          const result = await setExternalStorageLocation(path);
          if (result.success) {
            console.log('[StorageService] ✓ External storage configured successfully');
            return { success: true, path };
          }
        }
      } catch (writeError) {
        console.log('[StorageService] Path not writable:', path, writeError.message);
        continue;
      }
    } catch (error) {
      console.log('[StorageService] Error checking path:', path, error.message);
      // Try next path
      continue;
    }
  }

  console.log('[StorageService] No accessible external storage found, will use documentDirectory');
  return { success: false, error: 'No accessible external storage found' };
};

// Export the lazy-evaluated path functions
export { getImagesDir, getImagesDirAsync, getDataDir, getDataDirAsync, getConfigDir, getCacheDir, getExportsDir, getAppRootDir, getAppRootDirAsync };
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

  // Clear base storage cache so we use current config (external vs internal)
  baseStorageDirCache = null;
  baseStorageDirPromise = null;

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

  // Step 2: On Android, try Documents/Download so CSV and images are visible in file manager
  if (Platform.OS === 'android') {
    const storageConfig = await loadConfig('storage_location');
    if (!storageConfig?.externalPath) {
      console.log('[StorageService] Trying external storage (Documents/Download)...');
      const autoDetectResult = await autoDetectExternalStorage();
      if (autoDetectResult.success) {
        console.log('[StorageService] ✓ Using external storage:', autoDetectResult.path);
      }
    }
  }

  // Step 3: Create/verify each required directory
  console.log('[StorageService] Step 3: Creating/verifying directories...');
  const directories = [
    { name: 'App Root', getPath: () => getAppRootDirAsync() },
    { name: 'Images', getPath: () => getImagesDirAsync() },
    { name: 'Data', getPath: () => getDataDirAsync() },
    { name: 'Config', getPath: () => getConfigDirAsync() },
    { name: 'Cache', getPath: () => getAppRootDirAsync().then(p => `${p}cache/`) },
    { name: 'Exports', getPath: () => getAppRootDirAsync().then(p => `${p}exports/`) },
  ];

  for (const { name, getPath } of directories) {
    try {
      const dir = await getPath();
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        console.log('[StorageService] Creating directory:', name, '-', dir);
        const created = await ensureDir(dir, 3);
        if (created) {
          // Verify creation
          const verifyInfo = await FileSystem.getInfoAsync(dir);
          if (verifyInfo.exists) {
            results.created.push(dir);
            console.log('[StorageService] ✓ Successfully created:', name, '-', dir);
          } else {
            throw new Error('Directory creation verification failed');
          }
        } else {
          throw new Error('Directory creation failed after retries');
        }
      } else {
        results.verified.push(dir);
        console.log('[StorageService] ✓ Directory exists:', name, '-', dir);
      }
    } catch (error) {
      results.success = false;
      const dir = await getPath().catch(() => 'unknown');
      results.errors.push({ path: dir, error: error.message });
      console.error('[StorageService] ✗ Failed to create/verify:', name, '-', dir, error.message);
    }
  }

  // Get storage location info
  const storageInfo = await getStorageLocationInfo();
  results.storageLocation = storageInfo.type;
  results.storagePath = storageInfo.fullPath;
  console.log('[StorageService] Storage location:', storageInfo.type, '-', storageInfo.fullPath);

  // Step 4: Verify all directories exist and are accessible (use async paths = external when configured)
  console.log('[StorageService] Step 4: Verifying all directories are accessible...');
  const verifyDirs = [
    () => getAppRootDirAsync(),
    () => getImagesDirAsync(),
    () => getDataDirAsync(),
    () => getConfigDirAsync(),
    () => getAppRootDirAsync().then(p => `${p}cache/`),
    () => getAppRootDirAsync().then(p => `${p}exports/`),
  ];
  for (const getDir of verifyDirs) {
    try {
      const dir = await getDir();
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists || !info.isDirectory) {
        console.error('[StorageService] Directory verification failed:', dir);
        results.errors.push({ path: dir, error: 'Directory does not exist or is not accessible' });
        results.success = false;
      } else {
        console.log('[StorageService] ✓ Verified directory:', dir);
      }
    } catch (error) {
      const dir = await getDir().catch(() => 'unknown');
      console.error('[StorageService] Error verifying directory:', dir, error.message);
      results.errors.push({ path: dir, error: error.message });
      results.success = false;
    }
  }

  // Step 5: Test write capability (use async path so we test external storage when configured)
  console.log('[StorageService] Step 5: Testing write capability...');
  try {
    const appRoot = await getAppRootDirAsync();
    const testFile = `${appRoot}.storage_test`;
    const testContent = `test_${Date.now()}`;
    await FileSystem.writeAsStringAsync(testFile, testContent);
    const readBack = await FileSystem.readAsStringAsync(testFile);
    await FileSystem.deleteAsync(testFile, { idempotent: true });

    if (readBack === testContent) {
      results.writeTest = 'passed';
      console.log('[StorageService] Write test PASSED at', appRoot);
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
