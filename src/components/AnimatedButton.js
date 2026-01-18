import React, { useRef } from 'react';
import { Animated, TouchableWithoutFeedback, StyleSheet, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Animated button wrapper with scale, opacity effects and haptic feedback
 *
 * Haptic types:
 * - 'light' - for frequent taps (form inputs, toggles)
 * - 'medium' - for standard buttons
 * - 'heavy' - for important actions (save, confirm, delete)
 * - 'success' - for completion feedback
 * - 'warning' - for warnings
 * - 'error' - for errors
 * - 'none' - no haptic
 */
export default function AnimatedButton({
  children,
  onPress,
  style,
  disabled = false,
  scaleValue = 0.96,
  opacityValue = 0.85,
  haptic = 'medium', // light, medium, heavy, success, warning, error, none
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const triggerHaptic = async () => {
    if (haptic === 'none') return;

    try {
      switch (haptic) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Haptics not available (web/emulator) - silently ignore
    }
  };

  const handlePressIn = () => {
    triggerHaptic();
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: scaleValue,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: opacityValue,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <TouchableWithoutFeedback
      onPress={disabled ? null : onPress}
      onPressIn={disabled ? null : handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: scaleAnim }],
            opacity: disabled ? 0.5 : opacityAnim,
          },
        ]}
      >
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
