import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing } from '../constants/theme';

const { width } = Dimensions.get('window');

const TAB_CONFIG = [
  { name: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'Capture', icon: 'camera', iconOutline: 'camera-outline' },
  { name: 'Review', icon: 'images', iconOutline: 'images-outline' },
  { name: 'Data', icon: 'grid', iconOutline: 'grid-outline' },
  { name: 'Sync', icon: 'share-social', iconOutline: 'share-social-outline' },
  { name: 'Setup', icon: 'settings', iconOutline: 'settings-outline' },
];

export default function GlassTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const tabWidth = (width - spacing.lg * 2) / TAB_CONFIG.length;

  // Animated value for indicator position
  const indicatorPosition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate indicator to current tab with smooth cubic easing
    Animated.timing(indicatorPosition, {
      toValue: state.index * tabWidth,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [state.index, tabWidth]);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics not available - silently ignore
    }
  };

  const handlePress = (routeName, index, isFocused) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[index].key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      triggerHaptic();
      navigation.navigate(routeName);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <BlurView intensity={80} tint="light" style={styles.blurContainer}>
        <View style={styles.tabsContainer}>
          {/* Sliding indicator */}
          <Animated.View
            style={[
              styles.indicator,
              {
                width: tabWidth - spacing.sm,
                transform: [{ translateX: Animated.add(indicatorPosition, spacing.xs) }],
              },
            ]}
          />

          {/* Tab buttons */}
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const tabConfig = TAB_CONFIG.find(t => t.name === route.name) || TAB_CONFIG[0];

            return (
              <TouchableOpacity
                key={route.key}
                style={[styles.tab, { width: tabWidth }]}
                onPress={() => handlePress(route.name, index, isFocused)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isFocused ? tabConfig.icon : tabConfig.iconOutline}
                  size={24}
                  color={isFocused ? colors.primary : colors.text.tertiary}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  blurContainer: {
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.9)' : 'transparent',
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  indicator: {
    position: 'absolute',
    height: 44,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    top: 8,
  },
  tab: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});
