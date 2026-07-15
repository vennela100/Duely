export const Colors = {
  // Minimal Black & White — refined finance palette
  primary: '#111111',
  primaryLight: '#2A2A2A',
  primaryDark: '#000000',
  primarySurface: '#F5F5F2', // soft fill

  accent: '#111111',
  accentSurface: '#F5F5F2',
  accentText: '#111111',

  success: '#067A3D', // received / profit
  successLight: '#EAF8EF',

  warning: '#B26A00',
  warningLight: '#FFF6E5',

  danger: '#D71920', // due / outstanding
  dangerLight: '#FFF2F2',

  background: '#FAFAF7', // warm off-white
  surface: '#FFFFFF',
  surfaceElevated: '#F4F4F2',
  border: '#ECECEC',
  borderLight: '#F2F2F0',

  textPrimary: '#111111',
  textSecondary: '#5F5F5F',
  textTertiary: '#9A9A9A',
  textInverse: '#FFFFFF',

  amountPositive: '#067A3D',
  amountNegative: '#D71920',
  amountNeutral: '#111111',

  overlay: 'rgba(17, 17, 17, 0.45)',
} as const;

// Consistent spacing system
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 28,
  xxl: 40,
} as const;

export const Radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 26,
  full: 9999,
} as const;

// Soft premium shadows — never heavy.
export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 6,
  },
} as const;

// Premium card surface — soft border + very soft lift.
export const Glass = {
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#ECECEC',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.05,
  shadowRadius: 18,
  elevation: 2,
} as const;

export const Typography = {
  display: 'Geist_800ExtraBold',
  heading: 'Geist_600SemiBold',
  body: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
  mono: 'GeistMono_500Medium',
  monoBold: 'GeistMono_700Bold',
} as const;
