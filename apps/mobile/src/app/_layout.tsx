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
import { useAuth } from '@/stores/auth';
import { AppThemeProvider, useAppTheme } from '@/theme';
import { ToastProvider } from '@/ui';

void SplashScreen.preventAutoHideAsync();

function NavigationRoot() {
  const { scheme, colors, fonts } = useAppTheme();
  const status = useAuth((s) => s.status);
  const needsProfile = useAuth((s) => !!s.user?.needsProfileCompletion);
  const signedIn = status === 'signedIn';
  const landing = useAuth((s) => s.landing);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.textPrimary, border: colors.border },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTitleStyle: { fontFamily: fonts.displaySemibold },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {/* Signed in */}
        <Stack.Protected guard={signedIn && !needsProfile} redirectTo={signedIn ? '/complete-profile' : '/welcome'}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="messages" options={{ title: 'Messages' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="security" options={{ title: 'Security' }} />
          <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
          <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
          <Stack.Screen name="verify" options={{ title: 'Verify' }} />
          <Stack.Screen name="design-system" options={{ title: 'Design system' }} />
        </Stack.Protected>
        {/* Social sign-ups must pass the age gate before using the app */}
        <Stack.Protected guard={signedIn && needsProfile} redirectTo={signedIn ? '/' : '/welcome'}>
          <Stack.Screen name="complete-profile" options={{ title: 'Finish signing up', headerBackVisible: false }} />
        </Stack.Protected>
        {/* Signed out */}
        <Stack.Protected guard={status === 'signedOut'} redirectTo={needsProfile ? '/complete-profile' : ((landing ?? '/') as '/')}>
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
          <Stack.Screen name="log-in" options={{ title: 'Log in' }} />
          <Stack.Screen name="code-login" options={{ title: 'Sign in with a code' }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const status = useAuth((s) => s.status);
  const [fontsLoaded, fontError] = useFonts({ Sora_600SemiBold, Sora_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const fontsReady = fontsLoaded || !!fontError; // never block startup on a font failure

  useEffect(() => bindAppFocus(), []);
  useEffect(() => {
    void useAuth.getState().bootstrap();
  }, []);
  useEffect(() => {
    if (status === 'signedOut') queryClient.clear(); // no cached data survives a sign-out
  }, [status, queryClient]);
  useEffect(() => {
    if (fontsReady && status !== 'booting') void SplashScreen.hideAsync();
  }, [fontsReady, status]);

  if (!fontsReady || status === 'booting') return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <ToastProvider>
              <NavigationRoot />
            </ToastProvider>
          </AppThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
