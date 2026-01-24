import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  isSAFInitialized,
  initializeSAF,
  enableMediaLibrary,
  getStorageLocationInfo,
} from '../services/publicStorageService';

/**
 * SAF Permission Screen
 *
 * This screen guides users through setting up public storage access.
 * It's shown once after app install to:
 * 1. Request SAF permission (user selects Documents folder)
 * 2. Automatically create AgriCapture folder structure
 * 3. Enable Gallery sync for images
 *
 * After completion, all captured data will be visible in file managers.
 */
const SAFPermissionScreen = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('initial'); // 'initial', 'saf', 'media', 'complete'
  const [storageInfo, setStorageInfo] = useState(null);

  useEffect(() => {
    checkExistingSetup();
  }, []);

  const checkExistingSetup = async () => {
    setCheckingStatus(true);
    try {
      const safReady = await isSAFInitialized();
      if (safReady) {
        const info = await getStorageLocationInfo();
        setStorageInfo(info);
        setStep('complete');
      }
    } catch (err) {
      console.error('[SAFScreen] Error checking setup:', err);
    }
    setCheckingStatus(false);
  };

  const handleSetupStorage = async () => {
    setLoading(true);
    setError(null);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Step 1: Initialize SAF (opens folder picker)
      console.log('[SAFScreen] Starting SAF initialization...');
      setStep('saf');

      const safResult = await initializeSAF();

      if (!safResult.success) {
        setError(safResult.error || 'Failed to set up storage. Please try again.');
        setStep('initial');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLoading(false);
        return;
      }

      console.log('[SAFScreen] SAF initialized, enabling media library...');
      setStep('media');

      // Step 2: Enable media library for Gallery visibility
      const mediaResult = await enableMediaLibrary();
      if (!mediaResult.success) {
        console.warn('[SAFScreen] Media library not enabled:', mediaResult.error);
        // Continue anyway - SAF is the primary storage
      }

      // Step 3: Get storage info for display
      const info = await getStorageLocationInfo();
      setStorageInfo(info);

      setStep('complete');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Auto-complete after showing success
      setTimeout(() => {
        onComplete(true);
      }, 1500);
    } catch (err) {
      console.error('[SAFScreen] Setup error:', err);
      setError(err.message || 'An unexpected error occurred');
      setStep('initial');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setLoading(false);
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Public Storage?',
      'Without public storage, your data will only be accessible within the app. You won\'t be able to access files via USB or file manager.\n\nYou can set this up later in Settings.',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Skip Anyway',
          style: 'destructive',
          onPress: () => {
            console.log('[SAFScreen] User skipped public storage setup');
            onComplete(false);
          },
        },
      ]
    );
  };

  // iOS doesn't need SAF
  if (Platform.OS !== 'android') {
    useEffect(() => {
      onComplete(true);
    }, []);
    return null;
  }

  // Loading state while checking existing setup
  if (checkingStatus) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Checking storage setup...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name={step === 'complete' ? 'checkmark-circle' : 'folder-open'}
              size={80}
              color={step === 'complete' ? '#4CAF50' : '#2196F3'}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {step === 'complete' ? 'Storage Ready!' : 'Set Up Public Storage'}
          </Text>

          {/* Description based on step */}
          {step === 'initial' && (
            <>
              <Text style={styles.description}>
                Choose where to save your soil data. This makes files visible in
                your file manager and accessible via USB.
              </Text>

              <View style={styles.benefitsList}>
                <BenefitItem
                  icon="folder-outline"
                  text="Files visible in file manager"
                />
                <BenefitItem
                  icon="laptop-outline"
                  text="Easy USB transfer to computer"
                />
                <BenefitItem
                  icon="images-outline"
                  text="Images appear in Gallery"
                />
                <BenefitItem
                  icon="cloud-upload-outline"
                  text="Backup to Google Drive"
                />
              </View>

              <View style={styles.instructionBox}>
                <Ionicons name="information-circle" size={24} color="#2196F3" />
                <Text style={styles.instructionText}>
                  When prompted, select the "Documents" folder (or any folder you prefer).
                  The app will create an "AgriCapture" folder there automatically.
                </Text>
              </View>
            </>
          )}

          {step === 'saf' && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.progressText}>
                Waiting for folder selection...
              </Text>
              <Text style={styles.progressSubtext}>
                Please select a folder in the dialog
              </Text>
            </View>
          )}

          {step === 'media' && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.progressText}>
                Setting up Gallery sync...
              </Text>
            </View>
          )}

          {step === 'complete' && (
            <>
              <Text style={styles.successDescription}>
                Your data will be saved to a public folder that's accessible
                via file manager and USB.
              </Text>

              {storageInfo && (
                <View style={styles.locationBox}>
                  <Ionicons name="folder" size={24} color="#4CAF50" />
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.locationLabel}>Storage Location:</Text>
                    <Text style={styles.locationPath}>
                      {storageInfo.displayPath}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.folderStructure}>
                <Text style={styles.structureTitle}>Folder Structure Created:</Text>
                <Text style={styles.structureItem}>AgriCapture/</Text>
                <Text style={styles.structureItem}>  municipalities/</Text>
                <Text style={styles.structureItem}>    [Municipality Name]/</Text>
                <Text style={styles.structureItem}>      images/</Text>
                <Text style={styles.structureItem}>      agricapture_data.csv</Text>
                <Text style={styles.structureItem}>  exports/</Text>
              </View>
            </>
          )}

          {/* Error display */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="warning" size={20} color="#ff6b6b" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Buttons */}
          {step === 'initial' && (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleSetupStorage}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="folder-open" size={24} color="#fff" />
                    <Text style={styles.primaryButtonText}>
                      Choose Storage Folder
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
                disabled={loading}
              >
                <Text style={styles.skipButtonText}>Skip for now</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'complete' && (
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => onComplete(true)}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

const BenefitItem = ({ icon, text }) => (
  <View style={styles.benefitItem}>
    <Ionicons name={icon} size={24} color="#4CAF50" />
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  successDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  benefitsList: {
    width: '100%',
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  benefitText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 12,
  },
  instructionBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginLeft: 12,
    flex: 1,
    lineHeight: 22,
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  progressText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 20,
    fontWeight: '600',
  },
  progressSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
  },
  locationBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    width: '100%',
  },
  locationTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  locationPath: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  folderStructure: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  structureTitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 12,
  },
  structureItem: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    color: '#ff6b6b',
    marginLeft: 8,
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

export default SAFPermissionScreen;
