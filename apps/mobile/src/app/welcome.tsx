import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TAGLINE } from '@vybora/shared';
import { isAppleSignInAvailable, signInWithApple } from '@/features/auth/apple';
import { errorMessage } from '@/lib/form';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { BrandMark, Button, Screen, Text, useToast } from '@/ui';

const ENDED: Record<string, string> = {
  AUTH_REFRESH_REUSED: 'For your security you were signed out because your session was used on another device. Please sign in again.',
  AUTH_SESSION_REVOKED: 'You were signed out. Please sign in again.',
  ACCOUNT_DELETION_SCHEDULED: 'Your account is scheduled for deletion. Sign in within 30 days if you change your mind.',
};

export default function Welcome() {
  const { spacing, colors, radii, scheme } = useAppTheme();
  const toast = useToast();
  const endedReason = useAuth((s) => s.endedReason);
  const signIn = useAuth((s) => s.signIn);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    void isAppleSignInAvailable().then(setApple);
  }, []);

  const onApple = async () => {
    try {
      const res = await signInWithApple();
      if (res) await signIn(res);
    } catch (e) {
      toast.show({ message: errorMessage(e), tone: 'error' });
    }
  };

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ justifyContent: 'space-between', paddingVertical: spacing[8] }}>
      <View style={styles.hero}>
        <BrandMark size={88} />
        <Text variant="display" style={{ letterSpacing: 3, marginTop: spacing[5] }} accessibilityRole="header">
          VYBORA
        </Text>
        <Text variant="heading" tone="secondary" align="center">
          {TAGLINE}
        </Text>
      </View>

      <View style={{ gap: spacing[3] }}>
        {endedReason && ENDED[endedReason] ? (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: radii.md, padding: spacing[3] }} accessibilityLiveRegion="polite">
            <Text variant="caption" tone="primary" testID="ended-reason">
              {ENDED[endedReason]}
            </Text>
          </View>
        ) : null}
        <Button label="Create account" fullWidth size="lg" onPress={() => router.push('/sign-up')} testID="go-sign-up" />
        <Button label="Log in" variant="outline" fullWidth size="lg" onPress={() => router.push('/log-in')} testID="go-log-in" />
        {apple ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radii.md}
            style={{ height: 54 }}
            onPress={onApple}
          />
        ) : null}
        <Text variant="caption" tone="muted" align="center" style={{ marginTop: spacing[2] }}>
          By continuing you agree to the Terms and acknowledge the Privacy Policy.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
});
