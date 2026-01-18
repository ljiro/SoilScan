import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import {
  savePermissionStatus,
  loadPermissionStatus,
  isOnboardingComplete,
} from '../services/permissionService';

// Note: MediaLibrary is NOT needed - expo-file-system documentDirectory
// is accessible without any permissions. Storage is always available.

const PermissionContext = createContext(undefined);

const defaultPermissionState = {
  camera: { granted: false, canAskAgain: true, status: 'undetermined' },
  location: { granted: false, canAskAgain: true, status: 'undetermined' },
  // Storage is ALWAYS available - documentDirectory needs no permission
  storage: { granted: true, canAskAgain: true, status: 'granted' },
};

export function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState(defaultPermissionState);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Computed property for checking if all permissions are granted
  const allGranted =
    permissions.camera.granted &&
    permissions.location.granted &&
    permissions.storage.granted;

  // Check all permissions and update state
  const checkAllPermissions = useCallback(async () => {
    try {
      setIsLoading(true);

      // Check camera permission
      const cameraStatus = await Camera.getCameraPermissionsAsync();

      // Check location permission
      const locationStatus = await Location.getForegroundPermissionsAsync();

      // Storage is always available - documentDirectory needs no permission
      const newPermissions = {
        camera: {
          granted: cameraStatus.granted,
          canAskAgain: cameraStatus.canAskAgain,
          status: cameraStatus.status,
        },
        location: {
          granted: locationStatus.granted,
          canAskAgain: locationStatus.canAskAgain,
          status: locationStatus.status,
        },
        storage: {
          granted: true, // Always available
          canAskAgain: true,
          status: 'granted',
        },
      };

      setPermissions(newPermissions);

      // Check if onboarding is complete
      const complete = await isOnboardingComplete();
      setOnboardingComplete(complete);

      // Save current permission status
      await savePermissionStatus('current_permissions', newPermissions);

      return newPermissions;
    } catch (error) {
      console.error('[PermissionContext] Error checking permissions:', error);
      return permissions;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Request all permissions
  const requestAllPermissions = useCallback(async () => {
    try {
      setIsLoading(true);

      // Request camera permission
      const cameraResult = await Camera.requestCameraPermissionsAsync();

      // Request location permission
      const locationResult = await Location.requestForegroundPermissionsAsync();

      // Storage is always available - no permission needed
      const newPermissions = {
        camera: {
          granted: cameraResult.granted,
          canAskAgain: cameraResult.canAskAgain,
          status: cameraResult.status,
        },
        location: {
          granted: locationResult.granted,
          canAskAgain: locationResult.canAskAgain,
          status: locationResult.status,
        },
        storage: {
          granted: true, // Always available
          canAskAgain: true,
          status: 'granted',
        },
      };

      setPermissions(newPermissions);

      // Save permission status
      await savePermissionStatus('current_permissions', newPermissions);

      return newPermissions;
    } catch (error) {
      console.error('[PermissionContext] Error requesting permissions:', error);
      return permissions;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Request a specific permission
  const requestPermission = useCallback(async (permissionType) => {
    try {
      let result;

      switch (permissionType) {
        case 'camera':
          result = await Camera.requestCameraPermissionsAsync();
          break;
        case 'location':
          result = await Location.requestForegroundPermissionsAsync();
          break;
        case 'storage':
          // Storage is always available - no permission needed
          return { granted: true, canAskAgain: true, status: 'granted' };
        default:
          throw new Error(`Unknown permission type: ${permissionType}`);
      }

      const newPermissionState = {
        granted: result.granted,
        canAskAgain: result.canAskAgain,
        status: result.status,
      };

      setPermissions((prev) => ({
        ...prev,
        [permissionType]: newPermissionState,
      }));

      return newPermissionState;
    } catch (error) {
      console.error(`[PermissionContext] Error requesting ${permissionType} permission:`, error);
      return permissions[permissionType];
    }
  }, [permissions]);

  // Refresh permissions (alias for checkAllPermissions for semantic clarity)
  const refreshPermissions = useCallback(async () => {
    return await checkAllPermissions();
  }, [checkAllPermissions]);

  // Mark onboarding as complete
  const completeOnboarding = useCallback(async () => {
    try {
      // CRITICAL: Must match the key used in permissionService.js isOnboardingComplete()
      await savePermissionStatus('onboarding_completed', true);
      setOnboardingComplete(true);
    } catch (error) {
      console.error('[PermissionContext] Error completing onboarding:', error);
    }
  }, []);

  // Initial permission check on mount
  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  const value = {
    permissions,
    allGranted,
    isLoading,
    onboardingComplete,
    checkAllPermissions,
    requestAllPermissions,
    requestPermission,
    refreshPermissions,
    completeOnboarding,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}

export default PermissionContext;
