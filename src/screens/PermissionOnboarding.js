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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { fonts, fontSizes, colors } from '../constants/theme';
import AnimatedButton from '../components/AnimatedButton';

import {
  savePermissionStatus,
  markOnboardingComplete,
} from '../services/permissionService';
import { verifyAndInitializeStorage } from '../services/storageService';
import { initCSV, verifyCSVStorage } from '../services/csvService';

// Note: Storage permission is NOT needed - expo-file-system documentDirectory
// is accessible without any permissions. Only Camera and Location need user consent.
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
];

export default function PermissionOnboarding({ onComplete }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  // Storage is always true - documentDirectory doesn't need permissions
  const [permissions, setPermissions] = useState({
    camera: false,
    location: false,
    storage: true, // Always available, no permission needed
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
      setPermissions(prev => ({
        ...prev,
        camera: cameraPermission?.granted || false,
        location: locationStatus.status === 'granted',
        storage: true, // Always available
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

      // Request location permission
      console.log('[PermissionOnboarding] Requesting location permission...');
      const locationResult = await Location.requestForegroundPermissionsAsync();
      const locationGranted = locationResult.status === 'granted';
      console.log('[PermissionOnboarding] Location result:', locationResult.status, '- granted:', locationGranted);

      // Request media library permission (for saving to gallery/DCIM)
      console.log('[PermissionOnboarding] Requesting media library permission...');
      const mediaResult = await MediaLibrary.requestPermissionsAsync();
      const mediaGranted = mediaResult.status === 'granted';
      console.log('[PermissionOnboarding] Media library result:', mediaResult.status, '- granted:', mediaGranted);

      // Storage is always available - documentDirectory doesn't need permissions
      const storageGranted = true;

      const newPermissions = {
        camera: cameraGranted,
        location: locationGranted,
        mediaLibrary: mediaGranted,
        storage: storageGranted,
      };
      console.log('[PermissionOnboarding] Final permissions:', JSON.stringify(newPermissions));

      setPermissions(newPermissions);

      // Save permission statuses
      console.log('[PermissionOnboarding] Saving permission statuses...');
      await savePermissionStatus('camera', cameraGranted);
      await savePermissionStatus('location', locationGranted);
      await savePermissionStatus('mediaLibrary', mediaGranted);
      await savePermissionStatus('storage', true); // Always true
      await savePermissionStatus('permissions_summary', {
        ...newPermissions,
        completedAt: new Date().toISOString(),
      });

      await markOnboardingComplete();
      console.log('[PermissionOnboarding] Onboarding marked as complete');

      if (!cameraGranted || !locationGranted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        const deniedPerms = [];
        if (!cameraGranted) deniedPerms.push('Camera');
        if (!locationGranted) deniedPerms.push('Location');
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
      'Camera and location features will not work without permissions. You can enable them later in settings.',
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
              storage: true, // Always available
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
      }
      // Note: Storage doesn't need permission request - documentDirectory is always accessible
    } catch (error) {
      console.error('Error requesting permission:', error);
      Alert.alert('Error', 'Failed to request permission.');
    }
  };

  // Only camera and location need user consent - storage is always available
  const allGranted = permissions.camera && permissions.location;

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
        {PERMISSIONS.map((perm, index) => {
          const isGranted = permissions[perm.id];
          return (
            <Animated.View
              key={perm.id}
              style={[
                {
                  opacity: itemAnimations[index],
                  transform: [{
                    translateX: itemAnimations[index].interpolate({
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
