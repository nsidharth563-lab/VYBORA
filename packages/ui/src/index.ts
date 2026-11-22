/**
 * VYBORA design tokens — original brand identity.
 *
 * Brand idea: "signal" — a pulse moving from deep indigo (connect) through
 * electric violet (create) to warm coral (discover). The gradient is reserved
 * for brand moments (logo, Create button, primary CTA, active story rings);
 * everyday UI stays neutral so content is the hero.
 *
 * Contrast of every text/background pair is enforced by src/contrast.test.ts.
 */

export const palette = {
  indigo: {
    50: '#EEF0FF',
    100: '#DDE1FF',
    300: '#9AA3FF',
    500: '#4F46E5',
    700: '#3730A3',
    900: '#1E1B4B',
  },
  violet: {
    50: '#F5F0FF',
    100: '#EADFFF',
    300: '#C4A5FF',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
    900: '#3B0A73',
  },
  coral: {
    50: '#FFF2EE',
    100: '#FFE2D9',
    300: '#FFA48A',
    500: '#FF6B4A',
    700: '#D9431F',
    800: '#C2410C',
    900: '#7A1F0A',
  },
  mint: { 500: '#10B981', 700: '#047857' },
  amber: { 500: '#F59E0B', 700: '#B45309' },
  red: { 500: '#EF4444', 700: '#B91C1C' },
  neutral: {
    0: '#FFFFFF',
    25: '#FBFBFD',
    50: '#F5F5F8',
    100: '#ECECF1',
    200: '#DCDCE4',
    300: '#C2C2CE',
    400: '#9A9AAB',
    500: '#717184',
    600: '#53536A',
    700: '#3A3A4D',
    800: '#24242F',
    850: '#1A1A23',
    900: '#121218',
    950: '#0A0A0F',
  },
} as const;

export const gradients = {
  /** Signature brand gradient: connect → create → discover. */
  signal: ['#4F46E5', '#8B5CF6', '#FF6B4A'] as const,
  /**
   * Same idea, darkened so white labels/icons stay WCAG AA (>= 4.5:1) at every stop.
   * Use for anything carrying text or icons (buttons, Create tab); keep `signal`
   * for the logo and purely decorative surfaces.
   */
  signalStrong: ['#4F46E5', '#7C3AED', '#C2410C'] as const,
  storyRing: ['#8B5CF6', '#FF6B4A'] as const,
  closeFriendsRing: ['#10B981', '#34D399'] as const,
  aiStudio: ['#6D28D9', '#4F46E5', '#06B6D4'] as const,
};

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  /** Neutral fill for inputs, skeletons, chips. */
  surfaceMuted: string;
  /** Hairline dividers (decorative, no contrast requirement). */
  border: string;
  /** Boundaries of interactive controls — WCAG 1.4.11 requires >= 3:1. */
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  /** Tinted background for selected chips, badges, highlights. */
  primarySoft: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  /** Foreground on solid status fills (badges, destructive buttons). */
  onSuccess: string;
  onWarning: string;
  onDanger: string;
  overlay: string;
}

export const lightTheme: ThemeColors = {
  background: palette.neutral[25],
  surface: palette.neutral[0],
  surfaceRaised: palette.neutral[0],
  surfaceMuted: palette.neutral[50],
  border: palette.neutral[100],
  borderStrong: '#85859A',
  textPrimary: palette.neutral[950],
  textSecondary: palette.neutral[600],
  textMuted: palette.neutral[500],
  primary: palette.violet[700],
  primaryText: palette.neutral[0],
  primarySoft: palette.violet[50],
  accent: palette.coral[800],
  success: palette.mint[700],
  warning: palette.amber[700],
  danger: palette.red[700],
  onSuccess: palette.neutral[0],
  onWarning: palette.neutral[0],
  onDanger: palette.neutral[0],
  overlay: 'rgba(10,10,15,0.5)',
};

export const darkTheme: ThemeColors = {
  background: palette.neutral[950],
  surface: palette.neutral[900],
  surfaceRaised: palette.neutral[850],
  surfaceMuted: palette.neutral[800],
  border: palette.neutral[800],
  borderStrong: '#6E6E84',
  textPrimary: palette.neutral[50],
  textSecondary: palette.neutral[300],
  textMuted: palette.neutral[500],
  primary: palette.violet[300],
  primaryText: palette.neutral[950],
  primarySoft: '#2A1F45',
  accent: palette.coral[300],
  success: palette.mint[500],
  warning: palette.amber[500],
  danger: palette.red[500],
  onSuccess: palette.neutral[950],
  onWarning: palette.neutral[950],
  onDanger: palette.neutral[950],
  overlay: 'rgba(0,0,0,0.6)',
};

/** 4-pt spacing scale. */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

/** Display: "Sora" (geometric, distinctive); Text: "Inter" (legible at small sizes). Both OFL-licensed. */
export const typography = {
  fontFamily: { display: 'Sora', text: 'Inter', mono: 'JetBrains Mono' },
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, '2xl': 28, '3xl': 34 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  lineHeight: { tight: 1.15, normal: 1.4, relaxed: 1.6 },
} as const;

export const motion = {
  duration: { instant: 100, fast: 180, base: 260, slow: 400 },
  /** Reanimated spring presets. */
  spring: {
    snappy: { damping: 18, stiffness: 260, mass: 0.9 },
    gentle: { damping: 20, stiffness: 140, mass: 1 },
  },
} as const;

export * from './contrast.js';

export const tokens = {
  palette,
  gradients,
  lightTheme,
  darkTheme,
  spacing,
  radii,
  typography,
  motion,
};
export default tokens;
