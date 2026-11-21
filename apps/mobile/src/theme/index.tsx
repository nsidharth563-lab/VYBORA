import { darkTheme, gradients, lightTheme, radii, spacing, typography, type ThemeColors } from '@vybora/ui';
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { usePreferences } from '@/stores/preferences';

export type Scheme = 'light' | 'dark';

export interface AppTheme {
  scheme: Scheme;
  colors: ThemeColors;
  gradients: typeof gradients;
  spacing: typeof spacing;
  radii: typeof radii;
  fonts: typeof fonts;
}

/** Font family names registered with expo-font in the root layout. */
export const fonts = {
  displayBold: 'Sora_700Bold',
  displaySemibold: 'Sora_600SemiBold',
  textRegular: 'Inter_400Regular',
  textMedium: 'Inter_500Medium',
  textSemibold: 'Inter_600SemiBold',
} as const;

export function buildTheme(scheme: Scheme): AppTheme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkTheme : lightTheme,
    gradients,
    spacing,
    radii,
    fonts,
  };
}

/** Resolves the user's preference ('system' follows the OS) to a concrete scheme. */
export function resolveScheme(pref: 'system' | Scheme, system: string | null | undefined): Scheme {
  if (pref === 'light' || pref === 'dark') return pref;
  return system === 'dark' ? 'dark' : 'light';
}

const ThemeContext = createContext<AppTheme>(buildTheme('light'));

export function AppThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const pref = usePreferences((s) => s.theme);
  const scheme = resolveScheme(pref, system);
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);

export { typography };
