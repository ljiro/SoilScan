import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fonts, fontSizes, colors, spacing, radius, glass, shadows } from '../constants/theme';
import AnimatedButton from '../components/AnimatedButton';
import { saveConfig, loadConfig } from '../services/storageService';

const TERMS_ACCEPTANCE_KEY = 'terms_acceptance';

/**
 * Check if user has accepted terms
 */
export const hasAcceptedTerms = async () => {
  try {
    const acceptance = await loadConfig(TERMS_ACCEPTANCE_KEY);
    return acceptance?.accepted === true;
  } catch (error) {
    console.error('Error checking terms acceptance:', error);
    return false;
  }
};

/**
 * Save terms acceptance status
 */
export const saveTermsAcceptance = async (accepted) => {
  return await saveConfig(TERMS_ACCEPTANCE_KEY, {
    accepted,
    acceptedAt: new Date().toISOString(),
    version: '1.0',
  });
};

export default function TermsAgreement({ onAccept }) {
  const [isAccepted, setIsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Animation values
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-30)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(30)).current;
  const checkboxScale = useRef(new Animated.Value(1)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startEntranceAnimations();
  }, []);

  const startEntranceAnimations = () => {
    // Header animation
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Content animation (delayed)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 200);

    // Button animation (delayed)
    setTimeout(() => {
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 400);
  };

  const handleCheckboxPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Animate checkbox
    Animated.sequence([
      Animated.timing(checkboxScale, {
        toValue: 0.85,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(checkboxScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    setIsAccepted(!isAccepted);
  };

  const handleContinue = async () => {
    if (!isAccepted || isSubmitting) return;

    setIsSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      await saveTermsAcceptance(true);
      onAccept && onAccept();
    } catch (error) {
      console.error('Error saving terms acceptance:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setIsSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient}>
        <View style={styles.gradientCircle1} />
        <View style={styles.gradientCircle2} />
      </View>

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="document-text-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.subtitle}>
          Please review and accept our terms to continue
        </Text>
      </Animated.View>

      {/* Scrollable Terms Content */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
          },
        ]}
      >
        <View style={styles.glassCard}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Data Collection Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="leaf-outline" size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Agricultural Data Collection</Text>
              </View>
              <Text style={styles.sectionText}>
                AgriCapture is designed to assist in collecting agricultural data for research and analysis purposes. By using this application, you agree to the following terms regarding data collection:
              </Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>
                  {'\u2022'} Images captured may include crop conditions, field boundaries, and environmental factors
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} GPS coordinates are recorded with each capture to enable spatial analysis
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} Metadata including timestamps, device information, and capture settings are stored
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} All data is stored locally on your device unless you choose to export it
                </Text>
              </View>
            </View>

            {/* Data Privacy Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.secondary} />
                <Text style={styles.sectionTitle}>Data Privacy Policy</Text>
              </View>
              <Text style={styles.sectionText}>
                We are committed to protecting your privacy and ensuring the security of your agricultural data:
              </Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>
                  {'\u2022'} All captured data remains on your device by default
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} No data is transmitted to external servers without your explicit consent
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} You retain full ownership and control over all collected data
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} Location data is used solely for geotagging captures and is not shared
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} You may delete your data at any time through the app settings
                </Text>
              </View>
            </View>

            {/* Data Usage Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="analytics-outline" size={20} color={colors.warning} />
                <Text style={styles.sectionTitle}>Data Usage Terms</Text>
              </View>
              <Text style={styles.sectionText}>
                The following terms govern how collected data may be used:
              </Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>
                  {'\u2022'} Data is intended for agricultural research, crop monitoring, and field documentation
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} Exported data may be used in accordance with your organization's data policies
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} The app does not perform any automated analysis or sharing of your data
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} You are responsible for complying with local regulations regarding land and agricultural data
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} Commercial use of collected data is subject to your own licensing agreements
                </Text>
              </View>
            </View>

            {/* User Responsibilities Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="person-outline" size={20} color="#9C27B0" />
                <Text style={styles.sectionTitle}>User Responsibilities</Text>
              </View>
              <Text style={styles.sectionText}>
                As a user of AgriCapture, you agree to:
              </Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>
                  {'\u2022'} Obtain necessary permissions before capturing data on private property
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} Use the application in compliance with applicable laws and regulations
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} Maintain the security of your device and exported data
                </Text>
                <Text style={styles.bulletItem}>
                  {'\u2022'} Report any issues or vulnerabilities discovered in the application
                </Text>
              </View>
            </View>

            {/* Disclaimer Section */}
            <View style={[styles.section, styles.lastSection]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
                <Text style={styles.sectionTitle}>Disclaimer</Text>
              </View>
              <Text style={styles.sectionText}>
                AgriCapture is provided "as is" without warranty of any kind. The developers are not liable for any damages arising from the use of this application or the data collected through it. GPS accuracy depends on device capabilities and environmental conditions.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Animated.View>

      {/* Footer with Checkbox and Button */}
      <Animated.View style={[styles.footer, { opacity: buttonOpacity }]}>
        {/* Checkbox */}
        <AnimatedButton
          style={styles.checkboxRow}
          onPress={handleCheckboxPress}
          scaleValue={0.98}
          haptic="light"
        >
          <Animated.View
            style={[
              styles.checkbox,
              isAccepted && styles.checkboxChecked,
              { transform: [{ scale: checkboxScale }] },
            ]}
          >
            {isAccepted && (
              <Ionicons name="checkmark" size={16} color={colors.text.inverse} />
            )}
          </Animated.View>
          <Text style={styles.checkboxLabel}>
            I have read and agree to the Terms & Conditions and Privacy Policy
          </Text>
        </AnimatedButton>

        {/* Continue Button */}
        <AnimatedButton
          style={[
            styles.continueButton,
            !isAccepted && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!isAccepted || isSubmitting}
          haptic="success"
        >
          <Text style={[
            styles.continueButtonText,
            !isAccepted && styles.continueButtonTextDisabled,
          ]}>
            {isSubmitting ? 'Processing...' : 'Accept & Continue'}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={20}
            color={isAccepted ? colors.text.inverse : colors.text.tertiary}
          />
        </AnimatedButton>

        {/* Version info */}
        <Text style={styles.versionText}>Terms Version 1.0</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  gradientCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primaryLight,
    opacity: 0.5,
  },
  gradientCircle2: {
    position: 'absolute',
    bottom: 100,
    left: -150,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: colors.secondaryLight,
    opacity: 0.3,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  glassCard: {
    flex: 1,
    ...glass.light,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.lg,
    color: colors.text.primary,
  },
  sectionText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  bulletList: {
    gap: spacing.sm,
  },
  bulletItem: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    paddingLeft: spacing.sm,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  continueButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  continueButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.text.inverse,
  },
  continueButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  versionText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
