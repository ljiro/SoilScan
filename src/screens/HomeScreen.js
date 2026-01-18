import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { initStorage, loadConfig, verifyAndInitializeStorage } from '../services/storageService';
import { initCSV, verifyCSVStorage, getRecordCount } from '../services/csvService';
import { fonts, fontSizes, colors, radius, shadows, spacing, layout } from '../constants/theme';
import OnboardingGuide from './OnboardingGuide';

export default function HomeScreen({ navigation }) {
  const [setupInfo, setSetupInfo] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [csvRecordCount, setCsvRecordCount] = useState(0);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [storageDiagnostics, setStorageDiagnostics] = useState(null);
  const [isCheckingStorage, setIsCheckingStorage] = useState(false);

  // Animation values - subtle fades only, no bouncing
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    initialize();
    // Simple fade in animation
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslate, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', checkSetup);
    return unsubscribe;
  }, [navigation]);

  const initialize = async () => {
    await initStorage();
    await initCSV();
    await checkSetup();
  };

  const checkSetup = async () => {
    const config = await loadConfig('user_config');
    if (config?.municipalityLabel && config?.barangayLabel && config?.selectedCropIds?.length > 0) {
      setSetupInfo({
        municipality: config.municipalityLabel,
        barangay: config.barangayLabel,
        crops: config.selectedCropLabels || [],
      });
    } else {
      setSetupInfo(null);
    }
  };

  const GlassCard = ({ children, style, onPress, highlight }) => {
    const Card = onPress ? TouchableOpacity : View;
    return (
      <Card
        style={[styles.glassCard, highlight && styles.glassCardHighlight, style]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Gradient Background */}
      <LinearGradient
        colors={['#16A34A', '#22C55E', '#4ADE80']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      {/* Decorative circles */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslate }],
          },
        ]}
      >
        {/* Header - Simple, no duplication */}
        <View style={styles.header}>
          <Text style={styles.logo}>AgriCapture</Text>
          <Text style={styles.tagline}>Benguet Agricultural Data</Text>
        </View>

        {/* Status Card */}
        {setupInfo ? (
          <GlassCard style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusBadge}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
              <Text style={styles.statusTitle}>Ready to capture</Text>
            </View>
            <Text style={styles.statusLocation}>
              {setupInfo.municipality}, {setupInfo.barangay}
            </Text>
            <Text style={styles.statusCrops}>
              {setupInfo.crops.join(' · ')}
            </Text>
          </GlassCard>
        ) : (
          <GlassCard
            style={styles.warningCard}
            onPress={() => navigation.navigate('Setup')}
          >
            <View style={styles.statusHeader}>
              <View style={styles.warningBadge}>
                <Ionicons name="alert" size={14} color="#fff" />
              </View>
              <Text style={styles.warningTitle}>Setup required</Text>
            </View>
            <Text style={styles.warningText}>
              Tap to set your location and crops
            </Text>
          </GlassCard>
        )}

        {/* Main Actions */}
        <View style={styles.actions}>
          {/* Primary Capture Button */}
          <TouchableOpacity
            style={styles.captureButton}
            onPress={() => navigation.navigate('Capture')}
            activeOpacity={0.9}
          >
            <View style={styles.captureIcon}>
              <Ionicons name="camera" size={32} color={colors.primary} />
            </View>
            <View style={styles.captureText}>
              <Text style={styles.captureTitle}>Capture</Text>
              <Text style={styles.captureSubtitle}>Take photo & record data</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.text.tertiary} />
          </TouchableOpacity>

          {/* Secondary Actions */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Review')}
              activeOpacity={0.8}
            >
              <View style={styles.secondaryIcon}>
                <Ionicons name="images-outline" size={22} color={colors.text.secondary} />
              </View>
              <Text style={styles.secondaryText}>Review</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Export')}
              activeOpacity={0.8}
            >
              <View style={styles.secondaryIcon}>
                <Ionicons name="cloud-upload-outline" size={22} color={colors.text.secondary} />
              </View>
              <Text style={styles.secondaryText}>Export</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Setup')}
              activeOpacity={0.8}
            >
              <View style={styles.secondaryIcon}>
                <Ionicons name="settings-outline" size={22} color={colors.text.secondary} />
              </View>
              <Text style={styles.secondaryText}>Setup</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: layout.contentPaddingBottom }]}>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => setShowGuide(true)}
          >
            <Ionicons name="help-circle-outline" size={18} color="rgba(255,255,255,0.7)" />
            <Text style={styles.helpText}>How to use</Text>
          </TouchableOpacity>
          <Text style={styles.version}>v1.0.0</Text>
        </View>
      </Animated.View>

      {/* Guide Modal */}
      <Modal visible={showGuide} animationType="slide">
        <OnboardingGuide onComplete={() => setShowGuide(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  decorCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -100,
    right: -100,
  },
  decorCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: 100,
    left: -50,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Header
  header: {
    paddingTop: 60,
    paddingBottom: spacing.xl,
  },
  logo: {
    fontFamily: fonts.bold,
    fontSize: 34,
    color: '#fff',
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  // Glass Card
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: spacing.lg,
  },
  glassCardHighlight: {
    borderColor: 'rgba(255,255,255,0.4)',
  },

  // Status Card
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statusTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: '#fff',
  },
  statusLocation: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 32,
  },
  statusCrops: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 32,
    marginTop: 2,
  },

  // Warning Card
  warningCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  warningBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  warningTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: '#fff',
  },
  warningText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 32,
  },

  // Actions
  actions: {
    flex: 1,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  captureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  captureText: {
    flex: 1,
  },
  captureTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xl,
    color: colors.text.primary,
  },
  captureSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Secondary Buttons
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  secondaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  secondaryText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: '#fff',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  helpText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 6,
  },
  version: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.5)',
  },
});
