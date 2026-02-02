// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { Platform, Alert, Linking } from 'react-native';
import { PermissionsAndroid } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import { getExternalStoragePathAsync } from './storageService';

// Optional SAF (Storage Access Framework) - only in dev/build, not Expo Go
let safX = null;
if (Platform.OS === 'android') {
  try {
    safX = require('react-native-saf-x');
  } catch {
    safX = null;
  }
}

// App name for external folder (same as app display name)
const EXTERNAL_FOLDER_NAME = 'AgriCapture';

const PERMISSION_DIR = `${FileSystem.documentDirectory}permissions/`;

const FILE_MANAGER_SETTINGS_OPENED_KEY = 'file_manager_settings_opened_at';
const OPTIMISTIC_GRANT_WINDOW_MS = 300000; // 5 min: if user returns within this, treat as granted

/** First/base path for external storage (used when we optimistically grant). */
const getExternalStorageBasePath = () => {
  if (Platform.OS !== 'android') return null;
  return `/storage/emulated/0/Documents/${EXTERNAL_FOLDER_NAME}/`;
};

/** Candidate base paths to try (device-dependent). */
const getExternalStorageCandidatePaths = () => {
  if (Platform.OS !== 'android') return [];
  const name = EXTERNAL_FOLDER_NAME;
  return [
    `/storage/emulated/0/Documents/${name}`,
    `/storage/emulated/0/Download/${name}`,
    `/storage/emulated/0/${name}`,
    `/sdcard/Documents/${name}`,
    `/sdcard/Download/${name}`,
    `/sdcard/${name}`,
  ];
};

/**
 * Whether the app is running inside Expo Go (external storage / file manager not available).
 */
export const isExpoGo = () => {
  if (Platform.OS === 'web') return false;
  try {
    const Constants = require('expo-constants').default;
    return Constants.appOwnership === 'expo';
  } catch {
    return false;
  }
};

/** Probe write to a single external path. Returns path if successful. */
const probeExternalPath = async (basePath) => {
  const normalized = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const probePath = `${normalized}.probe_${Date.now()}`;
  try {
    await FileSystem.makeDirectoryAsync(normalized, { intermediates: true });
    await FileSystem.writeAsStringAsync(probePath, '1');
    await FileSystem.deleteAsync(probePath, { idempotent: true });
    return normalized;
  } catch {
    return null;
  }
};

/**
 * Check if Android "all files" / file manager access is granted.
 * Tries PermissionsAndroid, then probe, then optimistic (just returned from settings).
 */
export const checkFileManagerAccess = async () => {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true, path: null };
  }
  try {
    const granted = await PermissionsAndroid.check(
      'android.permission.MANAGE_EXTERNAL_STORAGE'
    );
    if (granted) {
      const path = getExternalStorageBasePath();
      console.log('[Permission] File manager access: granted (PermissionsAndroid)', path);
      return { granted: true, canAskAgain: true, path };
    }
  } catch (_) {}
  const candidates = getExternalStorageCandidatePaths();
  for (const basePath of candidates) {
    const worked = await probeExternalPath(basePath);
    if (worked) {
      console.log('[Permission] File manager access: granted (probe succeeded)', worked);
      return { granted: true, canAskAgain: true, path: worked };
    }
  }
  const openedAt = await loadPermissionStatus(FILE_MANAGER_SETTINGS_OPENED_KEY);
  const ts = openedAt != null ? Number(openedAt) : NaN;
  if (!Number.isNaN(ts) && Date.now() - ts < OPTIMISTIC_GRANT_WINDOW_MS) {
    await savePermissionStatus(FILE_MANAGER_SETTINGS_OPENED_KEY, null);
    const path = getExternalStorageBasePath();
    console.log('[Permission] File manager access: granted (optimistic – returned from settings)', path);
    return { granted: true, canAskAgain: true, path };
  }
  console.log('[Permission] File manager access: denied');
  return { granted: false, canAskAgain: true };
};

/** Record that we opened settings for file manager (so we can optimistically grant when they return). */
export const recordFileManagerSettingsOpened = async () => {
  if (Platform.OS !== 'android') return;
  await savePermissionStatus(FILE_MANAGER_SETTINGS_OPENED_KEY, Date.now());
};

/** Whether SAF (folder picker) is available on this build (Android dev/build only, not Expo Go). */
export const isSafAvailable = () => Platform.OS === 'android' && safX != null;

/**
 * Check if SAF folder access is granted (we have a stored content URI with permission).
 * @returns {Promise<{granted: boolean, path?: string}>}
 */
export const checkSafStorageAccess = async () => {
  if (Platform.OS !== 'android' || !safX) return { granted: false };
  try {
    const stored = await getExternalStoragePathAsync();
    if (!stored || !stored.startsWith('content://')) return { granted: false };
    const uri = stored.endsWith('/') ? stored.slice(0, -1) : stored;
    const has = await safX.hasPermission(uri);
    if (has) return { granted: true, path: stored.endsWith('/') ? stored : `${stored}/` };
    return { granted: false };
  } catch {
    return { granted: false };
  }
};

/**
 * Open the system folder picker (SAF). User selects a folder; we create AgriCapture inside.
 * @returns {Promise<{uri: string, name?: string}|null>}
 */
export const requestSafFolderAccess = async () => {
  if (Platform.OS !== 'android' || !safX) return null;
  try {
    const doc = await safX.openDocumentTree(true);
    if (doc && doc.uri) return { uri: doc.uri, name: doc.name };
    return null;
  } catch (error) {
    console.warn('[Permission] SAF folder picker error:', error?.message);
    return null;
  }
};

/**
 * Create AgriCapture subfolder under the SAF-selected folder and return the app base path.
 * @param {{uri: string}} doc - Result from requestSafFolderAccess()
 * @returns {Promise<string|null>}
 */
export const createSafAppFolderAndReturnPath = async (doc) => {
  if (Platform.OS !== 'android' || !safX || !doc?.uri) return null;
  try {
    const baseUri = doc.uri.endsWith('/') ? doc.uri.slice(0, -1) : doc.uri;
    await safX.mkdir(baseUri + '/AgriCapture');
    return baseUri + '/AgriCapture/';
  } catch (error) {
    console.warn('[Permission] SAF mkdir AgriCapture failed:', error?.message);
    return null;
  }
};

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
 * Check storage permission (Android)
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
 * Request file manager access (Android 11+). Records timestamp when called (and when Open Settings is tapped)
 * so when user returns, checkFileManagerAccess() can optimistically grant if within 5 min.
 */
export const requestFileManagerAccess = async () => {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true };
  }
  // Record immediately so we have a timestamp when user returns from settings
  await recordFileManagerSettingsOpened();
  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;
  if (apiLevel >= 30) {
    return new Promise((resolve) => {
      Alert.alert(
        'File Manager Access',
        `To save images and CSV to an "${EXTERNAL_FOLDER_NAME}" folder in your device storage (Documents or Download), turn ON "Allow access to manage all files" in the next screen, then return to the app.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve({ granted: false, canAskAgain: true }) },
          {
            text: 'Open Settings',
            onPress: async () => {
              try {
                await recordFileManagerSettingsOpened();
                const packageName = Application.applicationId || 'com.agricapture.app';
                await IntentLauncher.startActivityAsync(
                  IntentLauncher.ActivityAction.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                  { data: `package:${packageName}` }
                );
                resolve({ granted: false, canAskAgain: true, openedSettings: true });
              } catch (e) {
                resolve({ granted: false, canAskAgain: true });
              }
            },
          },
        ]
      );
    });
  }
  return { granted: true, canAskAgain: true };
};

/**
 * Request storage permission (Android)
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
    return { granted: writeGranted && readGranted, canAskAgain: true };
  } catch {
    return { granted: false, canAskAgain: true };
  }
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const defaultBasePaths = () => [
  `/storage/emulated/0/Documents/${EXTERNAL_FOLDER_NAME}`,
  `/storage/emulated/0/Download/${EXTERNAL_FOLDER_NAME}`,
  `/storage/emulated/0/${EXTERNAL_FOLDER_NAME}`,
  `/sdcard/Documents/${EXTERNAL_FOLDER_NAME}`,
  `/sdcard/Download/${EXTERNAL_FOLDER_NAME}`,
  `/sdcard/${EXTERNAL_FOLDER_NAME}`,
];

/**
 * Create app-named directory in external storage (e.g. /storage/emulated/0/Documents/AgriCapture)
 * with subdirs: images, data, config, cache, exports.
 * @param {string} [preferredPath] - If provided, try this path first (e.g. from checkFileManagerAccess).
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export const createExternalStorageDirectory = async (preferredPath) => {
  if (Platform.OS !== 'android') {
    return { success: true, path: FileSystem.documentDirectory };
  }
  const basePaths = preferredPath
    ? [preferredPath.replace(/\/$/, ''), ...defaultBasePaths()]
    : defaultBasePaths();
  let lastError = '';
  let lastPath = '';
  for (const basePath of basePaths) {
    try {
      lastPath = basePath;
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
    } catch (e) {
      lastError = (e && e.message) || String(e);
      continue;
    }
  }
  return {
    success: false,
    error: lastError || 'Could not create external storage directory',
    lastPath: lastPath || undefined,
  };
};

/**
 * Create external directory with retries. After user enables "all files" and returns,
 * the system may need a moment before writes succeed.
 * @param {string} [preferredPath] - Path from checkFileManagerAccess when known.
 */
export const createExternalStorageDirectoryWithRetry = async (preferredPath) => {
  if (Platform.OS !== 'android') {
    return { success: true, path: FileSystem.documentDirectory };
  }
  const maxTries = 3;
  const delayMs = 600;
  let lastResult = { success: false };
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    lastResult = await createExternalStorageDirectory(preferredPath);
    if (lastResult.success) return lastResult;
    if (attempt < maxTries) await delay(delayMs);
  }
  return lastResult;
};

/**
 * Get the current status of all permissions from the system
 * @returns {Object} - Object with permission statuses
 */
export const getCurrentPermissions = async () => {
  const cameraStatus = await Camera.getCameraPermissionsAsync();
  const locationStatus = await Location.getForegroundPermissionsAsync();
  let storageGranted = Platform.OS !== 'android';
  if (Platform.OS === 'android') {
    const saf = await checkSafStorageAccess();
    if (saf.granted) {
      storageGranted = true;
    } else {
      const fileManager = await checkFileManagerAccess();
      storageGranted = fileManager.granted;
    }
  }
  return {
    camera: cameraStatus?.granted || false,
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
    case 'storage':
      if (Platform.OS === 'android') {
        const dirResult = await createExternalStorageDirectoryWithRetry();
        return dirResult.success;
      }
      return true;
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
      const cameraResult = await Camera.requestCameraPermissionsAsync();
      return cameraResult.status === 'granted';
    }
    case 'location': {
      const locationResult = await Location.requestForegroundPermissionsAsync();
      return locationResult.status === 'granted';
    }
    case 'storage':
      if (Platform.OS === 'android') {
        if (Platform.Version >= 30) {
          await requestFileManagerAccess();
        }
        await requestStoragePermission();
        const dirResult = await createExternalStorageDirectoryWithRetry();
        if (dirResult.success && dirResult.path) {
          const { setExternalStorageLocation } = await import('./storageService').catch(() => ({}));
          if (setExternalStorageLocation) await setExternalStorageLocation(dirResult.path);
        }
        return dirResult.success;
      }
      return true;
    default:
      return false;
  }
};

/**
 * Request all necessary permissions at once
 * @returns {Object} - Object with permission results
 */
export const requestAllPermissions = async () => {
  const results = { camera: false, location: false, storage: Platform.OS !== 'android' };

  try {
    const cameraResult = await Camera.requestCameraPermissionsAsync();
    results.camera = cameraResult.status === 'granted';

    const locationResult = await Location.requestForegroundPermissionsAsync();
    results.location = locationResult.status === 'granted';

    if (Platform.OS === 'android') {
      if (Platform.Version >= 30) {
        await requestFileManagerAccess();
      }
      await requestStoragePermission();
      const dirResult = await createExternalStorageDirectoryWithRetry();
      results.storage = dirResult.success;
      if (dirResult.success && dirResult.path) {
        const { setExternalStorageLocation } = await import('./storageService').catch(() => ({}));
        if (setExternalStorageLocation) await setExternalStorageLocation(dirResult.path);
      }
    }

    return results;
  } catch (error) {
    console.error('[Permission] Request failed:', error.message);
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
