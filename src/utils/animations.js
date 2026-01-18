import { Animated, Easing } from 'react-native';

/**
 * Fade in animation
 */
export const fadeIn = (animValue, duration = 300, delay = 0) => {
  return Animated.timing(animValue, {
    toValue: 1,
    duration,
    delay,
    useNativeDriver: true,
    easing: Easing.out(Easing.ease),
  });
};

/**
 * Fade out animation
 */
export const fadeOut = (animValue, duration = 300) => {
  return Animated.timing(animValue, {
    toValue: 0,
    duration,
    useNativeDriver: true,
    easing: Easing.in(Easing.ease),
  });
};

/**
 * Slide up animation - smooth cubic easing (no bounce)
 */
export const slideUp = (animValue, duration = 400, delay = 0) => {
  return Animated.timing(animValue, {
    toValue: 0,
    duration,
    delay,
    useNativeDriver: true,
    easing: Easing.out(Easing.cubic),
  });
};

/**
 * Slide down animation - smooth cubic easing
 */
export const slideDown = (animValue, toValue = 100, duration = 300) => {
  return Animated.timing(animValue, {
    toValue,
    duration,
    useNativeDriver: true,
    easing: Easing.in(Easing.cubic),
  });
};

/**
 * Pulse animation (loop) - smooth sine wave
 */
export const pulse = (animValue, minValue = 0.95, maxValue = 1.05, duration = 1000) => {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: maxValue,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
      Animated.timing(animValue, {
        toValue: minValue,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
    ])
  );
};

/**
 * Smooth button press animation - no spring/bounce
 */
export const smoothPress = (animValue, toValue = 0.95) => {
  return Animated.sequence([
    Animated.timing(animValue, {
      toValue,
      duration: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.timing(animValue, {
      toValue: 1,
      duration: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
  ]);
};

/**
 * @deprecated Use smoothPress instead - this is kept for backward compatibility
 * Spring animation for button press
 */
export const springPress = (animValue, toValue = 0.95) => {
  return smoothPress(animValue, toValue);
};

/**
 * Glow animation for indicators
 */
export const glow = (animValue, duration = 2000) => {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 1,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.sin),
      }),
      Animated.timing(animValue, {
        toValue: 0.4,
        duration: duration / 2,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.sin),
      }),
    ])
  );
};
