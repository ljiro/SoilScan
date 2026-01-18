import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../contexts/NetworkContext';
import { fonts, fontSizes, colors, radius, spacing, shadows } from '../constants/theme';

/**
 * NetworkMonitor - Displays a banner when network connectivity changes
 *
 * Features:
 * - Smooth slide-in animation when going offline
 * - Shows "Offline - Some features unavailable" message
 * - Green indicator when back online (then fades out)
 * - Uses smooth Easing.out(Easing.cubic) animations
 */
export default function NetworkMonitor() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetwork();

  // Track previous online state to detect transitions
  const prevOnlineRef = useRef(isOnline);
  const [showBanner, setShowBanner] = useState(false);
  const [isReconnected, setIsReconnected] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Timeout ref for auto-hide
  const hideTimeoutRef = useRef(null);

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    // Clear any existing timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (!isOnline) {
      // Going offline - show banner
      setIsReconnected(false);
      setShowBanner(true);
      animateIn();
    } else if (wasOnline === false && isOnline) {
      // Coming back online - show reconnected banner briefly
      setIsReconnected(true);
      setShowBanner(true);
      animateIn();

      // Auto-hide after 2 seconds
      hideTimeoutRef.current = setTimeout(() => {
        animateOut(() => setShowBanner(false));
      }, 2000);
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isOnline]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = (callback) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
    });
  };

  if (!showBanner) {
    return null;
  }

  const bannerStyle = isReconnected ? styles.bannerOnline : styles.bannerOffline;
  const iconName = isReconnected ? 'wifi' : 'cloud-offline';
  const iconColor = isReconnected ? colors.success : colors.text.inverse;
  const message = isReconnected
    ? 'Back online'
    : 'Offline - Some features unavailable';

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.xs },
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.banner, bannerStyle]}>
        <Ionicons name={iconName} size={16} color={iconColor} />
        <Text style={[styles.message, isReconnected && styles.messageOnline]}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    gap: spacing.sm,
    ...shadows.md,
  },
  bannerOffline: {
    backgroundColor: colors.error,
  },
  bannerOnline: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.success,
  },
  message: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.inverse,
  },
  messageOnline: {
    color: colors.success,
  },
});
