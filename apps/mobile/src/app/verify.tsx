import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { maskIdentifier } from '@vybora/shared';
import { useCountdown } from '@/hooks/use-countdown';
import { authApi } from '@/lib/auth-api';
import { errorMessage } from '@/lib/form';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { Button, CodeInput, Text, useToast } from '@/ui';

/** Verify the signed-in user's email or phone with the code we sent. */
export default function Verify() {
  const { spacing } = useAppTheme();
  const toast = useToast();
  const params = useLocalSearchParams<{ channel?: string; send?: string }>();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const channel: 'email' | 'phone' = params.channel === 'phone' ? 'phone' : 'email';
  const target = channel === 'email' ? user?.email : user?.phone;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resend = useCountdown(60);
  const sentOnOpen = useRef(false);
  const clearLanding = useAuth((s) => s.clearLanding);
  useEffect(() => clearLanding(), [clearLanding]);

  const send = async () => {
    setError(null);
    try {
      await authApi.sendVerification(channel);
      resend.start();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  // After sign-up the API already sent a code; opening from Settings asks for one.
  useEffect(() => {
    if (params.send === '1' && !sentOnOpen.current) {
      sentOnOpen.current = true;
      void send();
    } else {
      resend.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verify = async (value = code) => {
    setBusy(true);
    setError(null);
    try {
      setUser(await authApi.verifyContact(channel, value));
      toast.show({ message: channel === 'email' ? 'Email verified' : 'Phone verified', tone: 'success' });
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing[4], gap: spacing[4], maxWidth: 520, width: '100%', alignSelf: 'center' }}>
      <Text variant="title">Check your {channel === 'email' ? 'inbox' : 'messages'}</Text>
      <Text variant="body" tone="secondary">
        Enter the 6-digit code we sent to {target ? maskIdentifier({ kind: channel, value: target }) : `your ${channel}`}.
      </Text>
      <CodeInput value={code} onChange={setCode} onComplete={(c) => void verify(c)} error={error} testID="verify-code" />
      <Button label="Verify" size="lg" fullWidth loading={busy} disabled={code.length !== 6} onPress={() => void verify()} testID="verify-submit" />
      <Button label={resend.left > 0 ? `Resend code in ${resend.left}s` : 'Resend code'} variant="ghost" fullWidth disabled={resend.left > 0} onPress={send} testID="verify-resend" />
      <Button label="Skip for now" variant="ghost" fullWidth onPress={() => router.replace('/')} testID="verify-skip" />
    </ScrollView>
  );
}
