import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fonts, fontSizes, colors } from '../constants/theme';
import { saveConfig, loadConfig } from '../services/storageService';

const { width, height } = Dimensions.get('window');

const GUIDE_STEPS = [
  {
    id: '1',
    icon: 'leaf',
    iconColor: colors.primary,
    title: 'Welcome to AgriCapture',
    subtitle: 'Agricultural Data Collection App',
    description: 'Capture geo-tagged photos of crops for soil nutrient analysis research in Benguet highlands.',
    tip: null,
  },
  {
    id: '2',
    icon: 'settings-outline',
    iconColor: colors.secondary,
    title: 'Step 1: Setup First',
    subtitle: 'Configure before capturing',
    description: 'Go to the Setup tab to select your municipality, barangay, and the crops you are documenting.',
    tip: 'These settings will apply to all photos until you change them.',
  },
  {
    id: '3',
    icon: 'location',
    iconColor: '#FF9800',
    title: 'Step 2: GPS Accuracy',
    subtitle: 'Wait for good signal',
    description: 'Before capturing, check the GPS status bar. Wait for "Good" or "Excellent" accuracy for reliable coordinates.',
    tip: 'Green = Excellent (< 5m), Light Green = Good (< 10m)',
  },
  {
    id: '4',
    icon: 'camera',
    iconColor: '#2196F3',
    title: 'Step 3: Capture Photos',
    subtitle: 'Point and shoot',
    description: 'Aim at the crop/soil area and tap the capture button. Review the preview, add optional notes, then save.',
    tip: 'Photos are automatically tagged with GPS, time, and your setup data.',
  },
  {
    id: '5',
    icon: 'document-text-outline',
    iconColor: '#9C27B0',
    title: 'Step 4: View Data',
    subtitle: 'Check your collections',
    description: 'Go to the Data tab to see all captured records. You can export the CSV file for analysis.',
    tip: 'Data includes: coordinates, altitude, accuracy, weather, and more.',
  },
  {
    id: '6',
    icon: 'checkmark-circle',
    iconColor: colors.primary,
    title: 'You are Ready!',
    subtitle: 'Start collecting data',
    description: 'Complete your setup first, then start capturing photos of crops in the field.',
    tip: 'For best results, capture during clear weather with stable GPS signal.',
  },
];

export default function OnboardingGuide({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(iconScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
          tension: 40,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const animateStep = () => {
    iconScale.setValue(0.8);
    contentOpacity.setValue(0.5);
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNext = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics may not be available on all devices - safe to ignore
    }

    if (currentIndex < GUIDE_STEPS.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
      animateStep();
    } else {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics may not be available on all devices - safe to ignore
      }
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics may not be available on all devices - safe to ignore
    }
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      // Mark guide as completed
      const config = await loadConfig('user_config') || {};
      const result = await saveConfig('user_config', {
        ...config,
        guideCompleted: true,
        guideCompletedAt: new Date().toISOString(),
      });
      if (!result.success) {
        console.warn('Guide completion save failed:', result.error);
      }
    } catch (e) {
      console.error('Error saving config:', e);
    }
    // Always call onComplete even if save fails
    if (onComplete) {
      onComplete();
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const renderStep = ({ item }) => (
    <View style={styles.stepContainer}>
      {/* Icon */}
      <Animated.View
        style={[
          styles.iconCircle,
          { backgroundColor: `${item.iconColor}20` },
          { transform: [{ scale: iconScale }] },
        ]}
      >
        <Ionicons name={item.icon} size={56} color={item.iconColor} />
      </Animated.View>

      {/* Content */}
      <Animated.View style={{ opacity: contentOpacity }}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        <Text style={styles.description}>{item.description}</Text>

        {/* Tip Box */}
        {item.tip && (
          <View style={styles.tipBox}>
            <Ionicons name="bulb-outline" size={18} color={colors.warning} />
            <Text style={styles.tipText}>{item.tip}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {GUIDE_STEPS.map((_, index) => {
        const inputRange = [
          (index - 1) * width,
          index * width,
          (index + 1) * width,
        ];

        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: dotWidth,
                opacity,
                backgroundColor: colors.primary,
              },
            ]}
          />
        );
      })}
    </View>
  );

  const isLastStep = currentIndex === GUIDE_STEPS.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip Button */}
      {!isLastStep && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Steps Carousel */}
      <FlatList
        ref={flatListRef}
        data={GUIDE_STEPS}
        renderItem={renderStep}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        bounces={false}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="center"
        contentContainerStyle={{ alignItems: 'center' }}
      />

      {/* Dots Indicator */}
      {renderDots()}

      {/* Bottom Buttons */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {isLastStep ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons
            name={isLastStep ? 'checkmark' : 'arrow-forward'}
            size={20}
            color={colors.text.inverse}
          />
        </TouchableOpacity>

        {/* Step Counter */}
        <Text style={styles.stepCounter}>
          {currentIndex + 1} of {GUIDE_STEPS.length}
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
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text.secondary,
  },
  stepContainer: {
    width: width,
    height: height * 0.55,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningLight || '#FFF8E1',
    padding: 14,
    borderRadius: 10,
    marginTop: 8,
    gap: 10,
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    gap: 8,
  },
  nextButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.text.inverse,
  },
  stepCounter: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.tertiary,
    marginTop: 16,
  },
});
