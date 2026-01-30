// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { Platform, Alert } from 'react-native';
import { PermissionsAndroid } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

// Note: MediaLibrary is NOT needed - expo-file-system documentDirectory
// is accessible without any permissions. Storage is always available.

const PERMISSION_DIR = `${FileSystem.documentDirectory}permissions/`;

/**
 * Initialize the permissions directory
 */
export const initPermissionStorage = async () => {
  const info = await FileSystem.getInfoAsync(PERMISSION_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PERMISSION_DIR, { intermediates: true });
  }
};

/**
 * Save a permission status to local storage
 * @param {string} key - Permission key (camera, location, storage, etc.)
 * @param {any} value - Permission status value
 */
export const savePermissionStatus = async (key, value) => {
  await initPermissionStorage();
  const path = `${PERMISSION_DIR}${key}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify({ value, updatedAt: new Date().toISOString() }));
};

/**
 * Load a permission status from local storage
 * @param {string} key - Permission key
 * @returns {any} - Permission status value or null
 */
export const loadPermissionStatus = async (key) => {
  await initPermissionStorage();
  const path = `${PERMISSION_DIR}${key}.json`;
  try {
    const content = await FileSystem.readAsStringAsync(path);
    const data = JSON.parse(content);
    return data.value;
  } catch {
    return null;
  }
};

/**
 * Check if onboarding has been completed
 * @returns {boolean}
 */
export const isOnboardingComplete = async () => {
  const status = await loadPermissionStatus('onboarding_completed');
  return status === true;
};

/**
 * Mark onboarding as complete
 */
export const markOnboardingComplete = async () => {
  await savePermissionStatus('onboarding_completed', true);
};

/**
 * Reset onboarding (for testing/debugging)
 */
export const resetOnboarding = async () => {
  await savePermissionStatus('onboarding_completed', false);
};

/**
 * Check if storage permission is granted (Android only)
 * @returns {Promise<{granted: boolean, canAskAgain: boolean}>}
 */
export const checkStoragePermission = async () => {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true };
  }
  try {
    const writeGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );
    const readGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
    );
    return { granted: writeGranted && readGranted, canAskAgain: true };
  } catch {
    return { granted: false, canAskAgain: true };
  }
};

/**
 * Check if app has usable storage (documentDirectory is always writable; avoid probing
 * /storage/emulated/0 which can throw or be restricted on Android 11+).
 * Export and app data use documentDirectory, so we consider storage "granted" when
 * we can write there.
 * @returns {Promise<{granted: boolean, canAskAgain: boolean}>}
 */
export const checkFileManagerAccess = async () => {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true };
  }
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir) return { granted: false, canAskAgain: true };
    const testFile = `${dir}.storage_check_${Date.now()}`;
    await FileSystem.writeAsStringAsync(testFile, '1');
    const read = await FileSystem.readAsStringAsync(testFile);
    await FileSystem.deleteAsync(testFile, { idempotent: true });
    return { granted: read === '1', canAskAgain: true };
  } catch {
    return { granted: false, canAskAgain: true };
  }
};

/**
 * Request file manager access (Android 11+). Opens the "Manage all files" permission
 * screen for this app so the user can enable "Allow access to manage all files".
 * @returns {Promise<{granted: boolean, canAskAgain: boolean}>}
 */
export const requestFileManagerAccess = async () => {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true };
  }
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;
  if (apiLevel >= 30) {
    return new Promise((resolve) => {
      Alert.alert(
        'File Manager Access',
        'To save images and data to device storage (e.g. AgriCapture folder), enable "Allow access to manage all files" in the next screen.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve({ granted: false, canAskAgain: true }) },
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                const packageName = Application.applicationId || 'com.agricapture.app';
                await IntentLauncher.startActivityAsync(
                  IntentLauncher.ActivityAction.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                  { data: `package:${packageName}` }
                );
              } catch (e) {
                console.warn('[Permission] Could not open file manager settings:', e?.message);
              }
              resolve({ granted: false, canAskAgain: true });
            },
          },
        ]
      );
    });
  }
  return { granted: true, canAskAgain: true };
};

/**
 * Request storage permission (Android only)
 * @returns {Promise<{granted: boolean, canAskAgain: boolean}>}
 */
export const requestStoragePermission = async () => {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true };
  }
  try {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    ]);
    const writeGranted = results[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;
    const readGranted = results[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;
    const granted = writeGranted && readGranted;
    const canAskAgain =
      results[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN &&
      results[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
    return { granted, canAskAgain };
  } catch {
    return { granted: false, canAskAgain: true };
  }
};

/**
 * Create external storage directory (e.g. /storage/emulated/0/AgriCapture) and subdirs
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export const createExternalStorageDirectory = async () => {
  if (Platform.OS !== 'android') {
    return { success: true, path: FileSystem.documentDirectory };
  }
  const basePaths = [
    '/storage/emulated/0/AgriCapture',
    '/storage/emulated/0/Download/AgriCapture',
    '/sdcard/AgriCapture',
  ];
  for (const basePath of basePaths) {
    try {
      const info = await FileSystem.getInfoAsync(basePath);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(basePath, { intermediates: true });
      }
      const verify = await FileSystem.getInfoAsync(basePath);
      if (!verify.exists) continue;
      const testFile = `${basePath}/.storage_test_${Date.now()}`;
      await FileSystem.writeAsStringAsync(testFile, 'test');
      const read = await FileSystem.readAsStringAsync(testFile);
      await FileSystem.deleteAsync(testFile, { idempotent: true });
      if (read !== 'test') continue;
      const subdirs = ['images', 'data', 'config', 'cache', 'exports'];
      for (const d of subdirs) {
        try {
          await FileSystem.makeDirectoryAsync(`${basePath}/${d}`, { intermediates: true });
        } catch (_) {}
      }
      return { success: true, path: basePath };
    } catch (_) {
      continue;
    }
  }
  return { success: false, error: 'Could not create external storage directory' };
};

/**
 * Get the current status of all permissions from the system
 * @returns {Object} - Object with permission statuses
 */
export const getCurrentPermissions = async () => {
  const locationStatus = await Location.getForegroundPermissionsAsync();
  const savedCamera = await loadPermissionStatus('camera');
  let storageGranted = true;
  if (Platform.OS === 'android') {
    const storageStatus = await checkStoragePermission();
    const fileManagerStatus = await checkFileManagerAccess();
    storageGranted = storageStatus.granted || fileManagerStatus.granted;
  }
  return {
    camera: savedCamera || false,
    location: locationStatus.status === 'granted',
    storage: storageGranted,
  };
};

/**
 * Get saved permission summary from onboarding
 * @returns {Object|null}
 */
export const getPermissionSummary = async () => {
  return await loadPermissionStatus('permissions_summary');
};

/**
 * Check if a specific permission is granted
 * @param {string} permissionType - 'camera', 'location', or 'storage'
 * @returns {boolean}
 */
export const checkPermission = async (permissionType) => {
  switch (permissionType) {
    case 'camera': {
      const cameraStatus = await Camera.getCameraPermissionsAsync();
      return cameraStatus.status === 'granted';
    }
    case 'location': {
      const locationStatus = await Location.getForegroundPermissionsAsync();
      return locationStatus.status === 'granted';
    }
    case 'storage': {
      if (Platform.OS === 'android') {
        const s = await checkStoragePermission();
        const f = await checkFileManagerAccess();
        return s.granted || f.granted;
      }
      return true;
    }
    default:
      return false;
  }
};

/**
 * Request a specific permission
 * @param {string} permissionType - 'camera', 'location', or 'storage'
 * @returns {boolean} - Whether permission was granted
 */
export const requestPermission = async (permissionType) => {
  switch (permissionType) {
    case 'camera': {
      console.log('[Permission] Requesting camera permission...');
      const cameraResult = await Camera.requestCameraPermissionsAsync();
      console.log('[Permission] Camera result:', cameraResult.status);
      return cameraResult.status === 'granted';
    }
    case 'location': {
      console.log('[Permission] Requesting location permission...');
      const locationResult = await Location.requestForegroundPermissionsAsync();
      console.log('[Permission] Location result:', locationResult.status);
      return locationResult.status === 'granted';
    }
    case 'storage': {
      if (Platform.OS === 'android') {
        await requestFileManagerAccess();
        const result = await requestStoragePermission();
        if (result.granted) {
          const dir = await createExternalStorageDirectory();
          if (dir.success) {
            const { setExternalStorageLocation } = await import('./storageService').catch(() => ({}));
            if (setExternalStorageLocation) await setExternalStorageLocation(dir.path);
          }
        }
        return result.granted;
      }
      return true;
    }
    default:
      return false;
  }
};

/**
 * Request all necessary permissions at once
 * @returns {Object} - Object with permission results
 */
export const requestAllPermissions = async () => {
  console.log('[Permission] === Requesting All Permissions ===');
  console.log('[Permission] Platform:', Platform.OS);

  const results = { camera: false, location: false, storage: false };

  try {
    const cameraResult = await Camera.requestCameraPermissionsAsync();
    results.camera = cameraResult.status === 'granted';
    if (!results.camera && cameraResult.canAskAgain === false) {
      console.warn('[Permission] Camera permanently denied');
    }

    const locationResult = await Location.requestForegroundPermissionsAsync();
    results.location = locationResult.status === 'granted';
    if (!results.location && locationResult.canAskAgain === false) {
      console.warn('[Permission] Location permanently denied');
    }

    if (Platform.OS === 'android') {
      await requestFileManagerAccess();
      const storageResult = await requestStoragePermission();
      results.storage = storageResult.granted;
      if (results.storage) {
        const dir = await createExternalStorageDirectory();
        if (dir.success) {
          const { setExternalStorageLocation } = await import('./storageService').catch(() => ({}));
          if (setExternalStorageLocation) await setExternalStorageLocation(dir.path);
        }
      } else if (!storageResult.canAskAgain) {
        console.warn('[Permission] Storage permanently denied');
      }
    } else {
      results.storage = true;
    }

    console.log('[Permission] === Permission Request Complete ===', results);
    return results;
  } catch (error) {
    console.error('[Permission] === Permission Request Failed ===');
    console.error('[Permission] Error:', error.message);
    console.error('[Permission] Stack:', error.stack);
    return results;
  }
};

/**
 * Get all permission statuses (both system and saved)
 * @returns {Object}
 */
export const getAllPermissionData = async () => {
  const current = await getCurrentPermissions();
  const saved = await getPermissionSummary();
  const onboardingComplete = await isOnboardingComplete();

  return {
    current,
    saved,
    onboardingComplete,
  };
};
