import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { bindAppFocus, createQueryClient } from '@/lib/query-client';
import { AppThemeProvider, useAppTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function NavigationRoot() {
  const { scheme, colors, fonts } = useAppTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
    },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTitleStyle: { fontFamily: fonts.displaySemibold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="messages" options={{ title: 'Messages' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const ready = fontsLoaded || !!fontError; // never block startup on a font failure

  useEffect(() => bindAppFocus(), []);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <NavigationRoot />
          </AppThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
