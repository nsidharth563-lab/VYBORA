import { router } from 'expo-router';
import { Lock, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { loginSchema } from '@vybora/shared';
import { authApi } from '@/lib/auth-api';
import { errorMessage, zodFieldErrors } from '@/lib/form';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { Button, Text, TextField, useToast } from '@/ui';

export default function LogIn() {
  const { spacing, colors, radii } = useAppTheme();
  const toast = useToast();
  const signIn = useAuth((s) => s.signIn);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setFormError(null);
    const { data, errors: local } = zodFieldErrors(loginSchema, { identifier, password });
    setErrors(local);
    if (!data) return;
    setBusy(true);
    try {
      const res = await authApi.login(data.identifier, data.password);
      await signIn(res);
      if (res.restored) toast.show({ message: 'Welcome back — your account deletion was cancelled.', tone: 'success' });
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing[4], gap: spacing[4], maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <Text variant="title">Welcome back</Text>
        {formError ? (
          <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing[3], borderLeftWidth: 3, borderLeftColor: colors.danger }}>
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite" testID="login-error">
              {formError}
            </Text>
          </View>
        ) : null}
        <TextField
          label="Email, phone or username"
          leftIcon={UserRound}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          error={errors.identifier}
          testID="login-identifier"
        />
        <TextField label="Password" leftIcon={Lock} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" error={errors.password} onSubmitEditing={submit} testID="login-password" />
        <Button label="Log in" size="lg" fullWidth loading={busy} onPress={submit} testID="login-submit" />
        <View style={{ gap: spacing[1] }}>
          <Button label="Sign in with a one-time code" variant="ghost" fullWidth onPress={() => router.push('/code-login')} testID="go-code-login" />
          <Button label="Forgot password?" variant="ghost" fullWidth onPress={() => router.push('/forgot-password')} testID="go-forgot" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
