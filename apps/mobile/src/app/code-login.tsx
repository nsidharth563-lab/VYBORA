import { UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { otpRequestSchema } from '@vybora/shared';
import { authApi } from '@/lib/auth-api';
import { errorMessage, zodFieldErrors } from '@/lib/form';
import { useCountdown } from '@/hooks/use-countdown';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { Button, CodeInput, Text, TextField } from '@/ui';

export default function CodeLogin() {
  const { spacing } = useAppTheme();
  const signIn = useAuth((s) => s.signIn);
  const [identifier, setIdentifier] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resend = useCountdown(60);

  const request = async () => {
    setError(null);
    const { data, errors } = zodFieldErrors(otpRequestSchema, { identifier });
    if (!data) return setError(errors.identifier ?? null);
    setBusy(true);
    try {
      const r = await authApi.requestLoginCode(data.identifier);
      setSentTo(r.sentTo);
      setCode('');
      resend.start();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    setError(null);
    setBusy(true);
    try {
      await signIn(await authApi.loginWithCode(identifier, value));
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing[4], gap: spacing[4], maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        {!sentTo ? (
          <>
            <Text variant="body" tone="secondary">
              We’ll send a 6-digit code to your verified email or phone.
            </Text>
            <TextField label="Email, phone or username" leftIcon={UserRound} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} autoComplete="username" error={error} testID="code-identifier" />
            <Button label="Send code" size="lg" fullWidth loading={busy} onPress={request} testID="code-send" />
          </>
        ) : (
          <>
            <Text variant="body" tone="secondary" testID="code-sent-to">
              If {sentTo} belongs to a verified VYBORA account, a code is on its way.
            </Text>
            <CodeInput value={code} onChange={setCode} onComplete={(c) => void verify(c)} error={error} testID="code-input" />
            <Button label="Sign in" size="lg" fullWidth loading={busy} disabled={code.length !== 6} onPress={() => void verify()} testID="code-verify" />
            <Button label={resend.left > 0 ? `Resend code in ${resend.left}s` : 'Resend code'} variant="ghost" fullWidth disabled={resend.left > 0 || busy} onPress={request} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
