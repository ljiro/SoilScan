// Typography - Clean Inter font family
export const fonts = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

// Font sizes - Better hierarchy
export const fontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 26,
  xxxl: 32,
  display: 40,
};

// Spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Layout constants - for consistent screen padding
export const layout = {
  // Tab bar total height (60px content + padding + safe area buffer)
  tabBarHeight: 100,
  // Header safe padding from top (including status bar)
  headerPaddingTop: 60,
  // Content padding to avoid tab bar overlap
  contentPaddingBottom: 100,
};

// Border radius
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

// Colors - Fresh green palette
export const colors = {
  // Primary green
  primary: '#22C55E',
  primaryDark: '#16A34A',
  primaryLight: 'rgba(34, 197, 94, 0.15)',

  // Accent
  accent: '#10B981',
  accentLight: 'rgba(16, 185, 129, 0.15)',

  // Secondary blue
  secondary: '#3B82F6',
  secondaryLight: 'rgba(59, 130, 246, 0.15)',

  // Status colors
  error: '#EF4444',
  errorLight: 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.15)',
  success: '#22C55E',

  // Text
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    muted: '#D1D5DB',
    inverse: '#FFFFFF',
  },

  // Backgrounds
  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
    dark: '#111827',
  },

  // Glass effects
  glass: {
    white: 'rgba(255, 255, 255, 0.7)',
    whiteMedium: 'rgba(255, 255, 255, 0.5)',
    whiteLight: 'rgba(255, 255, 255, 0.25)',
    dark: 'rgba(0, 0, 0, 0.5)',
    darkLight: 'rgba(0, 0, 0, 0.25)',
    border: 'rgba(255, 255, 255, 0.3)',
    borderDark: 'rgba(0, 0, 0, 0.1)',
  },

  border: '#E5E7EB',
  borderLight: '#F3F4F6',
};

// Glassmorphism styles
export const glass = {
  light: {
    backgroundColor: colors.glass.white,
    borderWidth: 1,
    borderColor: colors.glass.border,
  },
  medium: {
    backgroundColor: colors.glass.whiteMedium,
    borderWidth: 1,
    borderColor: colors.glass.border,
  },
  subtle: {
    backgroundColor: colors.glass.whiteLight,
    borderWidth: 1,
    borderColor: colors.glass.border,
  },
  dark: {
    backgroundColor: colors.glass.dark,
    borderWidth: 1,
    borderColor: colors.glass.whiteLight,
  },
};

// Shadow presets
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  // Header-specific shadow - subtle bottom shadow
  header: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
};

// Text styles
export const textStyles = {
  display: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.display,
    color: colors.text.primary,
    letterSpacing: -1,
  },
  h1: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxxl,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xxl,
    color: colors.text.primary,
  },
  h3: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xl,
    color: colors.text.primary,
  },
  h4: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.lg,
    color: colors.text.primary,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  bodySmall: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    letterSpacing: 0.3,
  },
  labelBold: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
    letterSpacing: 0.3,
  },
  button: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.text.inverse,
    letterSpacing: 0.2,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
  },
};
