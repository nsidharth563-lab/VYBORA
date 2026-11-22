import { router } from 'expo-router';
import { Lock, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { forgotPasswordSchema, resetPasswordSchema } from '@vybora/shared';
import { useCountdown } from '@/hooks/use-countdown';
import { authApi } from '@/lib/auth-api';
import { errorMessage, zodFieldErrors } from '@/lib/form';
import { useAppTheme } from '@/theme';
import { Button, CodeInput, Text, TextField, useToast } from '@/ui';

export default function ForgotPassword() {
  const { spacing } = useAppTheme();
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const resend = useCountdown(60);

  const request = async () => {
    const { data, errors: local } = zodFieldErrors(forgotPasswordSchema, { identifier });
    setErrors(local);
    if (!data) return;
    setBusy(true);
    try {
      setSentTo((await authApi.forgotPassword(data.identifier)).sentTo);
      resend.start();
    } catch (e) {
      setErrors({ identifier: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const { data, errors: local } = zodFieldErrors(resetPasswordSchema, { identifier, code, newPassword });
    setErrors(local);
    if (!data) return;
    setBusy(true);
    try {
      await authApi.resetPassword(data.identifier, data.code, data.newPassword);
      toast.show({ message: 'Password updated. Log in with your new password.', tone: 'success' });
      router.replace('/log-in');
    } catch (e) {
      setErrors({ code: errorMessage(e) });
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
              Enter the email, phone or username on your account and we’ll send you a code.
            </Text>
            <TextField label="Email, phone or username" leftIcon={UserRound} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} error={errors.identifier} testID="forgot-identifier" />
            <Button label="Send code" size="lg" fullWidth loading={busy} onPress={request} testID="forgot-send" />
          </>
        ) : (
          <>
            <Text variant="body" tone="secondary">
              If {sentTo} belongs to a VYBORA account, a code is on its way. Every device will be signed out after the reset.
            </Text>
            <CodeInput value={code} onChange={setCode} error={errors.code} testID="forgot-code" />
            <TextField label="New password" leftIcon={Lock} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" helper="At least 10 characters." error={errors.newPassword} testID="forgot-new-password" />
            <Button label="Reset password" size="lg" fullWidth loading={busy} onPress={reset} testID="forgot-reset" />
            <Button label={resend.left > 0 ? `Resend code in ${resend.left}s` : 'Resend code'} variant="ghost" fullWidth disabled={resend.left > 0 || busy} onPress={request} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
