import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { authApi } from '@/lib/auth-api';
import { errorMessage } from '@/lib/form';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { Button, CodeInput, Text, TextField } from '@/ui';

export default function DeleteAccount() {
  const { spacing, colors, radii } = useAppTheme();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const usePassword = !!user?.hasPassword;
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setError(null);
    try {
      setCodeSentTo((await authApi.deletionCode()).sentTo);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const confirm = async () => {
    setError(null);
    setBusy(true);
    try {
      await authApi.deleteAccount(usePassword ? { password } : { code });
      await signOut({ remote: false, reason: 'ACCOUNT_DELETION_SCHEDULED' });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing[4], gap: spacing[4], maxWidth: 520, width: '100%', alignSelf: 'center' }}>
      <Text variant="title">Delete your account</Text>
      <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing[4], gap: spacing[2] }}>
        <Text variant="body">• You’ll be signed out on every device right away.</Text>
        <Text variant="body">• Your profile, posts and messages are permanently erased after 30 days.</Text>
        <Text variant="body">• Changed your mind? Just sign in again within 30 days.</Text>
      </View>
      {usePassword ? (
        <TextField label="Confirm with your password" leftIcon={Lock} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" error={error} testID="delete-password" />
      ) : codeSentTo ? (
        <>
          <Text variant="body" tone="secondary">
            Enter the code we sent to {codeSentTo}.
          </Text>
          <CodeInput value={code} onChange={setCode} error={error} testID="delete-code" />
        </>
      ) : (
        <>
          <Button label="Email me a confirmation code" variant="outline" fullWidth onPress={sendCode} testID="delete-send-code" />
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </>
      )}
      <Button
        label="Delete my account"
        variant="danger"
        size="lg"
        fullWidth
        loading={busy}
        disabled={usePassword ? !password : code.length !== 6}
        onPress={confirm}
        testID="delete-confirm"
      />
    </ScrollView>
  );
}
