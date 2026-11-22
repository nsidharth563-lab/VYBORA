import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { changePasswordSchema } from '@vybora/shared';
import { ApiRequestError } from '@/lib/api';
import { authApi } from '@/lib/auth-api';
import { errorMessage, zodFieldErrors } from '@/lib/form';
import { useAppTheme } from '@/theme';
import { Button, TextField, useToast } from '@/ui';

export default function ChangePassword() {
  const { spacing } = useAppTheme();
  const toast = useToast();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const { data, errors: local } = zodFieldErrors(changePasswordSchema, { currentPassword, newPassword });
    setErrors(local);
    if (!data) return;
    setBusy(true);
    try {
      const r = await authApi.changePassword(data.currentPassword, data.newPassword);
      toast.show({
        message: r.otherSessionsSignedOut ? `Password changed. ${r.otherSessionsSignedOut} other device${r.otherSessionsSignedOut > 1 ? 's were' : ' was'} signed out.` : 'Password changed.',
        tone: 'success',
      });
      router.back();
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'AUTH_INVALID_CREDENTIALS') setErrors({ currentPassword: e.message });
      else if (e instanceof ApiRequestError && e.code === 'PASSWORD_BREACHED') setErrors({ newPassword: e.message });
      else if (e instanceof ApiRequestError && Object.keys(e.fieldErrors).length) setErrors(e.fieldErrors);
      else toast.show({ message: errorMessage(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing[4], gap: spacing[4], maxWidth: 520, width: '100%', alignSelf: 'center' }}>
      <TextField label="Current password" leftIcon={Lock} value={currentPassword} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" error={errors.currentPassword} testID="cp-current" />
      <TextField label="New password" leftIcon={Lock} value={newPassword} onChangeText={setNext} secureTextEntry autoComplete="new-password" textContentType="newPassword" helper="At least 10 characters." error={errors.newPassword} testID="cp-new" />
      <Button label="Change password" size="lg" fullWidth loading={busy} onPress={submit} testID="cp-submit" />
    </ScrollView>
  );
}
