import { AtSign, Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { completeProfileSchema } from '@vybora/shared';
import { ApiRequestError } from '@/lib/api';
import { authApi } from '@/lib/auth-api';
import { errorMessage, formatDateInput, zodFieldErrors } from '@/lib/form';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { Button, Text, TextField, useToast } from '@/ui';

/** Age gate + handle for accounts created with Apple/Google (they don't provide a birth date). */
export default function CompleteProfile() {
  const { spacing } = useAppTheme();
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const signOut = useAuth((s) => s.signOut);
  const [username, setUsername] = useState(user?.username ?? '');
  const [dob, setDob] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const changed = username !== user?.username ? username : undefined;
    const { data, errors: local } = zodFieldErrors(completeProfileSchema, { dateOfBirth: dob, ...(changed ? { username: changed } : {}) });
    setErrors(local);
    if (!data) return;
    setBusy(true);
    try {
      setUser(await authApi.completeProfile(data.dateOfBirth, data.username));
    } catch (e) {
      if (e instanceof ApiRequestError && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      else toast.show({ message: errorMessage(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing[4], gap: spacing[4], maxWidth: 520, width: '100%', alignSelf: 'center' }}>
      <Text variant="title">Almost there, {user?.displayName?.split(' ')[0] ?? 'friend'}</Text>
      <Text variant="body" tone="secondary">
        Confirm your birthday and pick your @handle.
      </Text>
      <TextField label="Username" leftIcon={AtSign} value={username} onChangeText={(t) => setUsername(t.replace(/\s/g, ''))} autoCapitalize="none" autoCorrect={false} error={errors.username} testID="complete-username" />
      <TextField label="Date of birth" leftIcon={Calendar} value={dob} onChangeText={(t) => setDob(formatDateInput(t))} placeholder="YYYY-MM-DD" keyboardType="number-pad" helper="You must be 13 or older. This isn't shown on your profile." error={errors.dateOfBirth} testID="complete-dob" />
      <Button label="Continue" size="lg" fullWidth loading={busy} onPress={submit} testID="complete-submit" />
      <Button label="Sign out" variant="ghost" fullWidth onPress={() => void signOut()} />
    </ScrollView>
  );
}
