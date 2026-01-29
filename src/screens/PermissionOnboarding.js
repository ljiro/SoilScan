import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { fonts, fontSizes, colors } from '../constants/theme';
import AnimatedButton from '../components/AnimatedButton';

import {
  savePermissionStatus,
  markOnboardingComplete,
  requestStoragePermission,
  checkStoragePermission,
  createExternalStorageDirectory,
  requestFileManagerAccess,
  checkFileManagerAccess,
} from '../services/permissionService';
import { setExternalStorageLocation } from '../services/storageService';

const PERMISSIONS = [
  {
    id: 'camera',
    title: 'Camera',
    description: 'Capture photos of crops',
    iconName: 'camera-outline',
    iconColor: colors.secondary,
  },
  {
    id: 'location',
    title: 'Location',
    description: 'Tag photos with GPS coordinates',
    iconName: 'location-outline',
    iconColor: colors.warning,
  },
  {
    id: 'storage',
    title: 'File Manager Access',
    description: 'Save images and data to device storage',
    iconName: 'folder-outline',
    iconColor: colors.primary,
  },
];

export default function PermissionOnboarding({ onComplete }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  // Storage permission is needed on Android for external storage access
  const [permissions, setPermissions] = useState({
    camera: false,
    location: false,
    storage: Platform.OS !== 'android', // Only Android needs storage permission
  });
  const [isLoading, setIsLoading] = useState(false);

  // Animation values
  const headerScale = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const itemAnimations = useRef(PERMISSIONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    checkExistingPermissions();
    startEntranceAnimations();
  }, []);

  // Update camera permission state when it changes
  useEffect(() => {
    if (cameraPermission) {
      setPermissions(prev => ({
        ...prev,
        camera: cameraPermission.granted,
      }));
    }
  }, [cameraPermission]);

  const startEntranceAnimations = () => {
    // Header animation
    Animated.parallel([
      Animated.spring(headerScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 40,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Stagger permission items
    Animated.stagger(150, itemAnimations.map((anim) =>
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      })
    )).start();
  };

  const checkExistingPermissions = async () => {
    try {
      const locationStatus = await Location.getForegroundPermissionsAsync();
      
      // Check storage permission on Android
      let storageGranted = true;
      if (Platform.OS === 'android') {
        const storageStatus = await checkStoragePermission();
        const fileManagerStatus = await checkFileManagerAccess();
        // Consider granted if either standard storage or file manager access is granted
        storageGranted = storageStatus.granted || fileManagerStatus.granted;
      }
      
      setPermissions(prev => ({
        ...prev,
        camera: cameraPermission?.granted || false,
        location: locationStatus.status === 'granted',
        storage: storageGranted,
      }));
    } catch (error) {
      console.log('Error checking permissions:', error);
    }
  };

  const requestAllPermissions = async () => {
    console.log('[PermissionOnboarding] === Requesting All Permissions ===');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsLoading(true);

    try {
      // Request camera permission using the hook
      console.log('[PermissionOnboarding] Requesting camera permission...');
      const cameraResult = await requestCameraPermission();
      const cameraGranted = cameraResult?.granted || false;
      console.log('[PermissionOnboarding] Camera result:', cameraResult?.status, '- granted:', cameraGranted);
      if (!cameraGranted && cameraResult?.canAskAgain === false) {
        console.warn('[PermissionOnboarding] Camera permission permanently denied');
      }

      // Request location permission
      console.log('[PermissionOnboarding] Requesting location permission...');
      const locationResult = await Location.requestForegroundPermissionsAsync();
      const locationGranted = locationResult.status === 'granted';
      console.log('[PermissionOnboarding] Location result:', locationResult.status, '- granted:', locationGranted);
      if (!locationGranted && locationResult.canAskAgain === false) {
        console.warn('[PermissionOnboarding] Location permission permanently denied');
      }

      // Request storage and file manager access on Android
      let storageGranted = true;
      if (Platform.OS === 'android') {
        console.log('[PermissionOnboarding] Requesting storage and file manager access...');
        
        // For Android 11+, request file manager access first
        if (Platform.Version >= 30) {
          const fileManagerResult = await requestFileManagerAccess();
          console.log('[PermissionOnboarding] File manager access requested (user needs to enable in Settings)');
        }
        
        // Request standard storage permissions
        const storageResult = await requestStoragePermission();
        storageGranted = storageResult.granted;
        console.log('[PermissionOnboarding] Storage permission result:', storageGranted);
        
        if (storageGranted) {
          // Create the external storage directory
          console.log('[PermissionOnboarding] Creating external storage directory...');
          const dirResult = await createExternalStorageDirectory();
          if (dirResult.success) {
            console.log('[PermissionOnboarding] ✓ External storage directory created:', dirResult.path);
            // Configure the storage service to use this path
            await setExternalStorageLocation(dirResult.path);
          } else {
            console.warn('[PermissionOnboarding] Failed to create external directory:', dirResult.error);
          }
        } else if (!storageResult.canAskAgain) {
          console.warn('[PermissionOnboarding] Storage permission permanently denied');
        }
      }

      const newPermissions = {
        camera: cameraGranted,
        location: locationGranted,
        storage: storageGranted,
      };
      console.log('[PermissionOnboarding] Final permissions:', JSON.stringify(newPermissions));

      setPermissions(newPermissions);

      // Save permission statuses
      console.log('[PermissionOnboarding] Saving permission statuses...');
      await savePermissionStatus('camera', cameraGranted);
      await savePermissionStatus('location', locationGranted);
      await savePermissionStatus('storage', storageGranted);
      await savePermissionStatus('permissions_summary', {
        ...newPermissions,
        completedAt: new Date().toISOString(),
      });

      await markOnboardingComplete();
      console.log('[PermissionOnboarding] Onboarding marked as complete');

      const deniedPerms = [];
      if (!cameraGranted) deniedPerms.push('Camera');
      if (!locationGranted) deniedPerms.push('Location');
      if (!storageGranted && Platform.OS === 'android') deniedPerms.push('File Manager Access');

      if (deniedPerms.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'Some Permissions Denied',
          `${deniedPerms.join(' and ')} permission was denied. Some features may be limited. You can enable permissions later in device settings.`,
          [{ text: 'Continue', onPress: () => onComplete && onComplete(newPermissions) }]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onComplete && onComplete(newPermissions);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('[PermissionOnboarding] Error requesting permissions:', error.message);
      console.error('[PermissionOnboarding] Stack:', error.stack);
      Alert.alert('Permission Error', `Failed to request permissions: ${error.message}\n\nPlease try again.`);
    }

    setIsLoading(false);
    console.log('[PermissionOnboarding] === Permission Request Complete ===');
  };

  const skipPermissions = async () => {
    Alert.alert(
      'Skip Permissions?',
      'Camera, location, and file manager access features will not work without permissions. You can enable them later in settings.',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            await markOnboardingComplete();
            await savePermissionStatus('permissions_summary', {
              camera: false,
              location: false,
              storage: Platform.OS !== 'android', // Only Android needs storage permission
              skipped: true,
              completedAt: new Date().toISOString(),
            });
            onComplete && onComplete(permissions);
          },
        },
      ]
    );
  };

  const requestIndividualPermission = async (permId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (permId === 'camera') {
        const result = await requestCameraPermission();
        const granted = result?.granted || false;
        setPermissions(prev => ({ ...prev, camera: granted }));
        await savePermissionStatus('camera', granted);
        if (!granted) {
          Alert.alert('Permission Denied', 'Camera permission was denied. You can enable it in device settings.');
        }
      } else if (permId === 'location') {
        const result = await Location.requestForegroundPermissionsAsync();
        const granted = result.status === 'granted';
        setPermissions(prev => ({ ...prev, location: granted }));
        await savePermissionStatus('location', granted);
        if (!granted) {
          Alert.alert('Permission Denied', 'Location permission was denied. You can enable it in device settings.');
        }
      } else if (permId === 'storage') {
        if (Platform.OS === 'android') {
          // For Android 11+, request file manager access first
          if (Platform.Version >= 30) {
            await requestFileManagerAccess();
          }
          
          const result = await requestStoragePermission();
          const granted = result.granted;
          setPermissions(prev => ({ ...prev, storage: granted }));
          await savePermissionStatus('storage', granted);
          
          if (granted) {
            // Create the external storage directory
            const dirResult = await createExternalStorageDirectory();
            if (dirResult.success) {
              console.log('[PermissionOnboarding] ✓ External storage directory created:', dirResult.path);
              await setExternalStorageLocation(dirResult.path);
            }
          } else {
            Alert.alert('Permission Denied', 'File manager access was denied. Images will be saved to internal storage only. You can enable it in device settings.');
          }
        }
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      Alert.alert('Error', 'Failed to request permission.');
    }
  };

  // Check if all permissions are granted (storage only required on Android)
  const allGranted = permissions.camera && permissions.location && permissions.storage;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerOpacity,
            transform: [{ scale: headerScale }],
          },
        ]}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.title}>App Permissions</Text>
        <Text style={styles.subtitle}>
          AgriCapture needs the following permissions to work properly
        </Text>
      </Animated.View>

      {/* Permission List */}
      <View style={styles.permissionList}>
        {PERMISSIONS.filter((p) => p.id !== 'storage' || Platform.OS === 'android').map((perm, index) => {
          const isGranted = permissions[perm.id];
          const animIndex = PERMISSIONS.findIndex((p) => p.id === perm.id);
          return (
            <Animated.View
              key={perm.id}
              style={[
                {
                  opacity: itemAnimations[animIndex],
                  transform: [{
                    translateX: itemAnimations[animIndex].interpolate({
                      inputRange: [0, 1],
                      outputRange: [-50, 0],
                    }),
                  }],
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.permissionItem, isGranted && styles.permissionItemGranted]}
                onPress={() => requestIndividualPermission(perm.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.permIcon, { backgroundColor: `${perm.iconColor}15` }]}>
                  <Ionicons name={perm.iconName} size={24} color={perm.iconColor} />
                </View>
                <View style={styles.permInfo}>
                  <Text style={styles.permTitle}>{perm.title}</Text>
                  <Text style={styles.permDescription}>{perm.description}</Text>
                </View>
                <Ionicons
                  name={isGranted ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={isGranted ? colors.primary : colors.border}
                />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {allGranted ? (
          <AnimatedButton
            style={styles.primaryButton}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              markOnboardingComplete();
              onComplete && onComplete(permissions);
            }}
            haptic="success"
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.text.inverse} />
          </AnimatedButton>
        ) : (
          <AnimatedButton
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={requestAllPermissions}
            disabled={isLoading}
            haptic="heavy"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={20} color={colors.text.inverse} />
                <Text style={styles.primaryButtonText}> Allow All Permissions</Text>
              </>
            )}
          </AnimatedButton>
        )}

        {!allGranted && (
          <AnimatedButton
            style={styles.secondaryButton}
            onPress={skipPermissions}
            disabled={isLoading}
            haptic="light"
          >
            <Text style={styles.secondaryButtonText}>Skip for Now</Text>
          </AnimatedButton>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Ionicons name="lock-closed-outline" size={16} color={colors.text.tertiary} />
        <Text style={styles.footerText}>
          Your data stays on your device. We respect your privacy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.secondary,
    borderRadius: 12,
    marginBottom: 8,
  },
  permissionItemGranted: {
    backgroundColor: `${colors.primary}10`,
    borderBottomColor: 'transparent',
  },
  permIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  permInfo: {
    flex: 1,
  },
  permTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.text.primary,
    marginBottom: 2,
  },
  permDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.tertiary,
  },
  buttonContainer: {
    padding: 24,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.text.inverse,
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text.secondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 32,
    gap: 6,
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.tertiary,
  },
});
