// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';

// Note: App uses documentDirectory for all storage (images, CSV, etc.)
// This is internal app storage and requires NO permissions.

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
 * Get the current status of all permissions from the system
 * @returns {Object} - Object with permission statuses
 */
export const getCurrentPermissions = async () => {
  const cameraStatus = await Camera.getCameraPermissionsAsync();
  const locationStatus = await Location.getForegroundPermissionsAsync();
  return {
    camera: cameraStatus?.granted || false,
    location: locationStatus.status === 'granted',
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
 * @param {string} permissionType - 'camera' or 'location'
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
    default:
      return false;
  }
};

/**
 * Request a specific permission
 * @param {string} permissionType - 'camera' or 'location'
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

  const results = { camera: false, location: false };

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
