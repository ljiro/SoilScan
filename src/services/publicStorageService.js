/**
 * Public Storage Service using Storage Access Framework (SAF)
 *
 * This service provides reliable public folder storage on Android 11+.
 * Files saved here are visible in file managers and accessible via USB.
 *
 * Architecture:
 * - On first launch, user selects a folder (e.g., Documents)
 * - App automatically creates AgriCapture folder structure
 * - All data saved to: [Selected]/AgriCapture/municipalities/[name]/
 * - Permission persists across app restarts
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SAF = FileSystem.StorageAccessFramework;

// Storage keys for persisting SAF state
const STORAGE_KEYS = {
  SAF_ROOT_URI: '@agricapture_saf_root_uri',
  SAF_AGRICAPTURE_URI: '@agricapture_saf_agricapture_uri',
  SAF_INITIALIZED: '@agricapture_saf_initialized',
  SAF_MUNICIPALITY_URIS: '@agricapture_saf_municipality_uris',
  MEDIA_LIBRARY_ENABLED: '@agricapture_media_library_enabled',
};

/**
 * Sanitize folder name for safe filesystem use
 */
const sanitizeFolderName = (name) => {
  if (!name) return 'Unknown';
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .trim()
    .substring(0, 50) || 'Unknown';
};

/**
 * Check if SAF is supported (Android only)
 */
export const isSAFSupported = () => {
  return Platform.OS === 'android';
};

/**
 * Check if SAF has been initialized with a root folder
 */
export const isSAFInitialized = async () => {
  if (!isSAFSupported()) return false;

  try {
    const initialized = await AsyncStorage.getItem(STORAGE_KEYS.SAF_INITIALIZED);
    const agricaptureUri = await AsyncStorage.getItem(STORAGE_KEYS.SAF_AGRICAPTURE_URI);
    return initialized === 'true' && !!agricaptureUri;
  } catch (error) {
    console.error('[PublicStorage] Error checking SAF initialization:', error);
    return false;
  }
};

/**
 * Get the AgriCapture folder URI
 */
export const getAgriCaptureFolderUri = async () => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.SAF_AGRICAPTURE_URI);
  } catch {
    return null;
  }
};

/**
 * Initialize SAF - Request folder permission and create AgriCapture structure
 * This should be called once during onboarding
 *
 * @returns {Promise<{success: boolean, error?: string, folderUri?: string}>}
 */
export const initializeSAF = async () => {
  if (!isSAFSupported()) {
    return { success: false, error: 'SAF is only supported on Android' };
  }

  console.log('[PublicStorage] === Initializing SAF Storage ===');

  try {
    // Step 1: Request directory permission from user
    console.log('[PublicStorage] Step 1: Requesting directory permission...');
    const permissionResult = await SAF.requestDirectoryPermissionsAsync();

    if (!permissionResult.granted || !permissionResult.directoryUri) {
      console.log('[PublicStorage] Permission denied or no URI');
      return { success: false, error: 'Permission denied. Please select a folder to continue.' };
    }

    const rootUri = permissionResult.directoryUri;
    console.log('[PublicStorage] Root folder selected:', rootUri);

    // Save the root URI
    await AsyncStorage.setItem(STORAGE_KEYS.SAF_ROOT_URI, rootUri);

    // Step 2: Create AgriCapture folder structure
    console.log('[PublicStorage] Step 2: Creating AgriCapture folder structure...');
    const agricaptureUri = await createAgriCaptureFolderStructure(rootUri);

    if (!agricaptureUri) {
      return { success: false, error: 'Failed to create AgriCapture folder' };
    }

    // Step 3: Save the AgriCapture URI and mark as initialized
    await AsyncStorage.setItem(STORAGE_KEYS.SAF_AGRICAPTURE_URI, agricaptureUri);
    await AsyncStorage.setItem(STORAGE_KEYS.SAF_INITIALIZED, 'true');

    console.log('[PublicStorage] === SAF Initialization Complete ===');
    console.log('[PublicStorage] AgriCapture folder URI:', agricaptureUri);

    return { success: true, folderUri: agricaptureUri };
  } catch (error) {
    console.error('[PublicStorage] SAF initialization error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create the AgriCapture folder structure in the selected directory
 */
const createAgriCaptureFolderStructure = async (rootUri) => {
  try {
    // Check if the selected folder itself is already named "AgriCapture"
    const decodedRoot = decodeURIComponent(rootUri).toLowerCase();
    const isAlreadyAgriCapture = decodedRoot.endsWith('/agricapture') ||
      decodedRoot.endsWith('%2fagricapture') ||
      decodedRoot.includes('/agricapture%') ||
      decodedRoot.match(/agricapture$/i);

    let agricaptureUri;

    if (isAlreadyAgriCapture) {
      // User selected a folder already named AgriCapture - use it directly
      console.log('[PublicStorage] Selected folder is already AgriCapture, using directly');
      agricaptureUri = rootUri;
    } else {
      // Check if AgriCapture folder already exists inside selected folder
      const rootContents = await SAF.readDirectoryAsync(rootUri);
      agricaptureUri = rootContents.find(uri =>
        decodeURIComponent(uri).toLowerCase().endsWith('/agricapture') ||
        decodeURIComponent(uri).toLowerCase().includes('/agricapture%')
      );

      if (!agricaptureUri) {
        // Create AgriCapture folder
        console.log('[PublicStorage] Creating AgriCapture folder...');
        agricaptureUri = await SAF.makeDirectoryAsync(rootUri, 'AgriCapture');
        console.log('[PublicStorage] Created AgriCapture folder:', agricaptureUri);
      } else {
        console.log('[PublicStorage] AgriCapture folder already exists:', agricaptureUri);
      }
    }

    // Create subfolders
    const subfolders = ['municipalities', 'exports'];
    const agricaptureContents = await SAF.readDirectoryAsync(agricaptureUri);

    for (const subfolder of subfolders) {
      const exists = agricaptureContents.some(uri =>
        decodeURIComponent(uri).toLowerCase().includes(subfolder)
      );

      if (!exists) {
        console.log(`[PublicStorage] Creating ${subfolder} folder...`);
        await SAF.makeDirectoryAsync(agricaptureUri, subfolder);
        console.log(`[PublicStorage] Created ${subfolder} folder`);
      }
    }

    return agricaptureUri;
  } catch (error) {
    console.error('[PublicStorage] Error creating folder structure:', error);
    return null;
  }
};

/**
 * Get or create a municipality folder
 * Path: AgriCapture/municipalities/[MunicipalityName]/
 *
 * @param {string} municipality - Municipality name
 * @returns {Promise<{success: boolean, uri?: string, error?: string}>}
 */
export const getMunicipalityFolder = async (municipality) => {
  const agricaptureUri = await getAgriCaptureFolderUri();
  if (!agricaptureUri) {
    return { success: false, error: 'SAF not initialized' };
  }

  const safeName = sanitizeFolderName(municipality);

  try {
    // Try to get cached URI first
    const cachedUris = await AsyncStorage.getItem(STORAGE_KEYS.SAF_MUNICIPALITY_URIS);
    const urisMap = cachedUris ? JSON.parse(cachedUris) : {};

    if (urisMap[safeName]) {
      // Verify the cached URI still exists
      try {
        await SAF.readDirectoryAsync(urisMap[safeName]);
        return { success: true, uri: urisMap[safeName] };
      } catch {
        // Cached URI invalid, will recreate
        delete urisMap[safeName];
      }
    }

    // Find municipalities folder
    const agricaptureContents = await SAF.readDirectoryAsync(agricaptureUri);
    let municipalitiesUri = agricaptureContents.find(uri =>
      decodeURIComponent(uri).toLowerCase().includes('municipalities')
    );

    if (!municipalitiesUri) {
      municipalitiesUri = await SAF.makeDirectoryAsync(agricaptureUri, 'municipalities');
    }

    // Find or create specific municipality folder
    const municipalitiesContents = await SAF.readDirectoryAsync(municipalitiesUri);
    let municipalityUri = municipalitiesContents.find(uri =>
      decodeURIComponent(uri).toLowerCase().includes(safeName.toLowerCase())
    );

    if (!municipalityUri) {
      console.log(`[PublicStorage] Creating municipality folder: ${safeName}`);
      municipalityUri = await SAF.makeDirectoryAsync(municipalitiesUri, safeName);

      // Create images subfolder
      await SAF.makeDirectoryAsync(municipalityUri, 'images');
      console.log(`[PublicStorage] Created municipality folder: ${municipalityUri}`);
    }

    // Cache the URI
    urisMap[safeName] = municipalityUri;
    await AsyncStorage.setItem(STORAGE_KEYS.SAF_MUNICIPALITY_URIS, JSON.stringify(urisMap));

    return { success: true, uri: municipalityUri };
  } catch (error) {
    console.error('[PublicStorage] Error getting municipality folder:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Save image to public SAF storage
 * Saves to: AgriCapture/municipalities/[Municipality]/images/YYYY/MM/DD/[filename]
 *
 * @param {string} sourceUri - Source image file URI
 * @param {string} filename - Target filename
 * @param {string} municipality - Municipality name
 * @returns {Promise<{success: boolean, uri?: string, relativePath?: string, error?: string}>}
 */
export const saveImageToPublicStorage = async (sourceUri, filename, municipality) => {
  console.log('[PublicStorage] === Saving Image to Public Storage ===');
  console.log('[PublicStorage] Source:', sourceUri);
  console.log('[PublicStorage] Filename:', filename);
  console.log('[PublicStorage] Municipality:', municipality);

  const municipalityResult = await getMunicipalityFolder(municipality);
  if (!municipalityResult.success) {
    return { success: false, error: municipalityResult.error };
  }

  try {
    const municipalityUri = municipalityResult.uri;

    // Find or create images folder
    let imagesUri;
    const municipalityContents = await SAF.readDirectoryAsync(municipalityUri);
    imagesUri = municipalityContents.find(uri =>
      decodeURIComponent(uri).toLowerCase().includes('images')
    );

    if (!imagesUri) {
      imagesUri = await SAF.makeDirectoryAsync(municipalityUri, 'images');
    }

    // Create date-based folder structure (YYYY/MM/DD)
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    // Create year/month/day folders
    let currentUri = imagesUri;
    for (const folder of [year, month, day]) {
      const contents = await SAF.readDirectoryAsync(currentUri);
      let folderUri = contents.find(uri => decodeURIComponent(uri).endsWith(`/${folder}`));

      if (!folderUri) {
        folderUri = await SAF.makeDirectoryAsync(currentUri, folder);
      }
      currentUri = folderUri;
    }

    // Read image as base64
    const imageBase64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create file in SAF (remove extension as SAF adds it based on mime type)
    const fileNameWithoutExt = filename.replace(/\.(jpg|jpeg)$/i, '');
    const fileUri = await SAF.createFileAsync(currentUri, fileNameWithoutExt, 'image/jpeg');

    // Write image data using SAF API
    await SAF.writeAsStringAsync(fileUri, imageBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const relativePath = `images/${year}/${month}/${day}/${filename}`;

    console.log('[PublicStorage] Image saved successfully');
    console.log('[PublicStorage] File URI:', fileUri);
    console.log('[PublicStorage] Relative path:', relativePath);

    return {
      success: true,
      uri: fileUri,
      relativePath,
    };
  } catch (error) {
    console.error('[PublicStorage] Error saving image:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Save CSV to public SAF storage (exports folder)
 * Saves to: AgriCapture/exports/[filename]
 *
 * @param {string} csvContent - CSV content to save
 * @param {string} filename - Target filename (without extension)
 * @returns {Promise<{success: boolean, uri?: string, error?: string}>}
 */
export const saveCSVToPublicStorage = async (csvContent, filename) => {
  console.log('[PublicStorage] Saving CSV to exports folder:', filename);

  const agricaptureUri = await getAgriCaptureFolderUri();
  if (!agricaptureUri) {
    return { success: false, error: 'SAF not initialized' };
  }

  try {
    // Find exports folder
    const agricaptureContents = await SAF.readDirectoryAsync(agricaptureUri);
    let exportsUri = agricaptureContents.find(uri =>
      decodeURIComponent(uri).toLowerCase().includes('exports')
    );

    if (!exportsUri) {
      exportsUri = await SAF.makeDirectoryAsync(agricaptureUri, 'exports');
    }

    // Remove .csv extension if present (SAF adds it based on mime type)
    const fileNameWithoutExt = filename.replace(/\.csv$/i, '');

    // Create new file
    const csvUri = await SAF.createFileAsync(exportsUri, fileNameWithoutExt, 'text/csv');
    await SAF.writeAsStringAsync(csvUri, csvContent);

    console.log('[PublicStorage] CSV saved:', csvUri);
    return { success: true, uri: csvUri };
  } catch (error) {
    console.error('[PublicStorage] Error saving CSV:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Save CSV to public SAF storage for a specific municipality
 * Saves to: AgriCapture/municipalities/[Municipality]/agricapture_data.csv
 *
 * @param {string} municipality - Municipality name
 * @param {string} csvContent - CSV content to save
 * @returns {Promise<{success: boolean, uri?: string, error?: string}>}
 */
export const saveMunicipalityCSVToPublicStorage = async (municipality, csvContent) => {
  console.log('[PublicStorage] Saving CSV for municipality:', municipality);

  const municipalityResult = await getMunicipalityFolder(municipality);
  if (!municipalityResult.success) {
    return { success: false, error: municipalityResult.error };
  }

  try {
    const municipalityUri = municipalityResult.uri;
    const contents = await SAF.readDirectoryAsync(municipalityUri);

    // Find existing CSV or create new
    let csvUri = contents.find(uri =>
      decodeURIComponent(uri).toLowerCase().includes('agricapture_data')
    );

    if (csvUri) {
      // Overwrite existing
      await SAF.writeAsStringAsync(csvUri, csvContent);
    } else {
      // Create new file
      csvUri = await SAF.createFileAsync(municipalityUri, 'agricapture_data', 'text/csv');
      await SAF.writeAsStringAsync(csvUri, csvContent);
    }

    console.log('[PublicStorage] CSV saved:', csvUri);
    return { success: true, uri: csvUri };
  } catch (error) {
    console.error('[PublicStorage] Error saving CSV:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Read CSV from public SAF storage
 *
 * @param {string} municipality - Municipality name
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
export const readCSVFromPublicStorage = async (municipality) => {
  const municipalityResult = await getMunicipalityFolder(municipality);
  if (!municipalityResult.success) {
    return { success: false, error: municipalityResult.error };
  }

  try {
    const contents = await SAF.readDirectoryAsync(municipalityResult.uri);
    const csvUri = contents.find(uri =>
      decodeURIComponent(uri).toLowerCase().includes('agricapture_data')
    );

    if (!csvUri) {
      return { success: false, error: 'CSV file not found' };
    }

    const content = await FileSystem.readAsStringAsync(csvUri);
    return { success: true, content };
  } catch (error) {
    console.error('[PublicStorage] Error reading CSV:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get list of all municipalities with data
 *
 * @returns {Promise<Array<{name: string, sanitizedName: string, uri: string}>>}
 */
export const getPublicMunicipalities = async () => {
  const agricaptureUri = await getAgriCaptureFolderUri();
  if (!agricaptureUri) return [];

  try {
    const agricaptureContents = await SAF.readDirectoryAsync(agricaptureUri);
    const municipalitiesUri = agricaptureContents.find(uri =>
      decodeURIComponent(uri).toLowerCase().includes('municipalities')
    );

    if (!municipalitiesUri) return [];

    const municipalityFolders = await SAF.readDirectoryAsync(municipalitiesUri);
    const municipalities = [];

    for (const folderUri of municipalityFolders) {
      const decodedName = decodeURIComponent(folderUri).split('/').pop() || '';
      const displayName = decodedName.replace(/_/g, ' ');

      // Check if it has a CSV file
      try {
        const folderContents = await SAF.readDirectoryAsync(folderUri);
        const hasCsv = folderContents.some(uri =>
          decodeURIComponent(uri).toLowerCase().includes('.csv')
        );

        if (hasCsv) {
          municipalities.push({
            name: displayName,
            sanitizedName: decodedName,
            uri: folderUri,
          });
        }
      } catch {
        // Skip folders we can't read
      }
    }

    return municipalities;
  } catch (error) {
    console.error('[PublicStorage] Error getting municipalities:', error);
    return [];
  }
};

/**
 * Reset SAF - Clear all stored URIs and settings
 * Use this if user wants to change the storage location
 */
export const resetSAF = async () => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.SAF_ROOT_URI,
      STORAGE_KEYS.SAF_AGRICAPTURE_URI,
      STORAGE_KEYS.SAF_INITIALIZED,
      STORAGE_KEYS.SAF_MUNICIPALITY_URIS,
    ]);
    console.log('[PublicStorage] SAF settings reset');
    return { success: true };
  } catch (error) {
    console.error('[PublicStorage] Error resetting SAF:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Clear SAF permission - Remove SAF configuration
 * Alias for resetSAF for API consistency
 */
export const clearSAFPermission = async () => {
  return resetSAF();
};

/**
 * Get storage location info for display
 */
export const getStorageLocationInfo = async () => {
  const initialized = await isSAFInitialized();
  const agricaptureUri = await getAgriCaptureFolderUri();

  if (!initialized || !agricaptureUri) {
    return {
      initialized: false,
      path: null,
      displayPath: 'Not configured',
    };
  }

  // Try to extract a readable path from the URI
  let displayPath = 'Documents/AgriCapture';
  try {
    const decoded = decodeURIComponent(agricaptureUri);
    // Extract meaningful path parts
    const match = decoded.match(/primary[:%](.+)/);
    if (match) {
      displayPath = match[1].replace(/%2F/g, '/').replace(/:/g, '/');
    }
  } catch {
    // Use default
  }

  return {
    initialized: true,
    path: agricaptureUri,
    displayPath,
  };
};

// ============================================================================
// MEDIA LIBRARY - For Gallery visibility (images only)
// ============================================================================

/**
 * Check if media library is enabled
 */
export const isMediaLibraryEnabled = async () => {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.MEDIA_LIBRARY_ENABLED);
    return enabled === 'true';
  } catch {
    return false;
  }
};

/**
 * Enable media library storage (save images to Gallery/DCIM)
 */
export const enableMediaLibrary = async () => {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      return { success: false, error: 'Media library permission denied' };
    }

    await AsyncStorage.setItem(STORAGE_KEYS.MEDIA_LIBRARY_ENABLED, 'true');
    console.log('[PublicStorage] Media library enabled');
    return { success: true };
  } catch (error) {
    console.error('[PublicStorage] Error enabling media library:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Save image to Gallery (DCIM/AgriCapture)
 * This makes images visible in the phone's Gallery app
 *
 * @param {string} sourceUri - Source image file path
 * @returns {Promise<{success: boolean, assetUri?: string, error?: string}>}
 */
export const saveImageToGallery = async (sourceUri) => {
  if (Platform.OS !== 'android') {
    return { success: true }; // iOS handles this differently
  }

  try {
    const enabled = await isMediaLibraryEnabled();
    if (!enabled) {
      // Check if we have permission anyway
      const { status } = await MediaLibrary.getPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, error: 'Media library not enabled' };
      }
    }

    // Create asset from the file
    const asset = await MediaLibrary.createAssetAsync(sourceUri);

    // Get or create AgriCapture album
    const albumName = 'AgriCapture';
    let album = await MediaLibrary.getAlbumAsync(albumName);

    if (!album) {
      album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }

    console.log('[PublicStorage] Image saved to Gallery:', asset.uri);
    return {
      success: true,
      assetUri: asset.uri,
      albumId: album?.id,
    };
  } catch (error) {
    console.error('[PublicStorage] Error saving to Gallery:', error);
    return { success: false, error: error.message };
  }
};

// Export sanitize function for use by other modules
export { sanitizeFolderName };
