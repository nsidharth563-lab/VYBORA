import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { AtSign, Calendar, Lock, Mail, Phone, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { signupSchema, usernameSchema } from '@vybora/shared';
import { ApiRequestError } from '@/lib/api';
import { authApi } from '@/lib/auth-api';
import { errorMessage, formatDateInput, zodFieldErrors } from '@/lib/form';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { Button, Segmented, Text, TextField, useToast } from '@/ui';

function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SignUp() {
  const { spacing } = useAppTheme();
  const toast = useToast();
  const signIn = useAuth((s) => s.signIn);

  const [via, setVia] = useState<'email' | 'phone'>('email');
  const [contact, setContact] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Live username availability (debounced, validated locally first).
  const debounced = useDebounced(username.trim());
  const localUsername = usernameSchema.safeParse(debounced);
  const availability = useQuery({
    queryKey: ['username-available', debounced],
    queryFn: ({ signal }) => authApi.usernameAvailable(debounced, signal),
    enabled: localUsername.success,
    staleTime: 30_000,
    retry: false,
  });
  const usernameHint =
    !debounced
      ? 'Your unique @handle. You can change it later.'
      : !localUsername.success
        ? undefined
        : availability.data?.available
          ? '✓ Available'
          : undefined;
  const usernameError =
    errors.username ??
    (debounced && !localUsername.success ? localUsername.error.issues[0]?.message : availability.data && !availability.data.available ? 'That username is taken.' : null);

  const submit = async () => {
    const input = { [via]: contact, password, username, displayName, dateOfBirth: dob };
    const { data, errors: local } = zodFieldErrors(signupSchema, input);
    setErrors(local);
    if (!data) return;
    setBusy(true);
    try {
      const res = await authApi.signup({ ...input, [via]: contact } as Parameters<typeof authApi.signup>[0]);
      await signIn(res, { landing: `/verify?channel=${res.verification?.channel ?? via}` });
    } catch (e) {
      if (e instanceof ApiRequestError && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      else toast.show({ message: errorMessage(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing[4], gap: spacing[4], maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <Text variant="title">Join VYBORA</Text>
        <Segmented
          value={via}
          onChange={(v) => {
            setVia(v);
            setContact('');
            setErrors({});
          }}
          accessibilityLabel="Sign up with"
          options={[
            { value: 'email', label: 'Email' },
            { value: 'phone', label: 'Phone' },
          ]}
        />
        {via === 'email' ? (
          <TextField label="Email" leftIcon={Mail} value={contact} onChangeText={setContact} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" error={errors.email} testID="signup-email" />
        ) : (
          <TextField label="Phone number" leftIcon={Phone} value={contact} onChangeText={setContact} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="+91 98765 43210" helper="Include your country code." error={errors.phone} testID="signup-phone" />
        )}
        <TextField label="Name" leftIcon={UserRound} value={displayName} onChangeText={setDisplayName} autoComplete="name" textContentType="name" maxLength={50} error={errors.displayName} testID="signup-name" />
        <TextField
          label="Username"
          leftIcon={AtSign}
          value={username}
          onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          maxLength={30}
          helper={usernameHint}
          error={usernameError}
          testID="signup-username"
        />
        <TextField
          label="Date of birth"
          leftIcon={Calendar}
          value={dob}
          onChangeText={(t) => setDob(formatDateInput(t))}
          placeholder="YYYY-MM-DD"
          keyboardType="number-pad"
          autoComplete="birthdate-full"
          helper="You must be 13 or older. This isn't shown on your profile."
          error={errors.dateOfBirth}
          testID="signup-dob"
        />
        <TextField label="Password" leftIcon={Lock} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" helper="At least 10 characters." error={errors.password} testID="signup-password" />
        <View style={{ gap: spacing[3], marginTop: spacing[2] }}>
          <Button label="Create account" size="lg" fullWidth loading={busy} onPress={submit} testID="signup-submit" />
          <Button label="I already have an account" variant="ghost" fullWidth onPress={() => router.replace('/log-in')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
