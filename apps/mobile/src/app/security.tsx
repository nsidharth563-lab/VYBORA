import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { KeyRound, LogOut, Monitor, Smartphone, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { SessionInfo } from '@vybora/types';
import { Section } from '@/components/section';
import { authApi } from '@/lib/auth-api';
import { errorMessage } from '@/lib/form';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { Button, ListItem, Sheet, Skeleton, SkeletonGroup, Text, useToast } from '@/ui';

const PLATFORM: Record<string, string> = { IOS: 'iPhone / iPad', ANDROID: 'Android', WEB: 'Web' };

function relative(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 2) return 'Active now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export default function Security() {
  const { spacing } = useAppTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const [confirmAll, setConfirmAll] = useState(false);

  const sessions = useQuery({ queryKey: ['sessions'], queryFn: authApi.sessions });
  const revoke = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      toast.show({ message: 'Device signed out', tone: 'success' });
      void qc.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (e) => toast.show({ message: errorMessage(e), tone: 'error' }),
  });
  const logoutAll = useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess: () => void signOut({ remote: false }),
    onError: (e) => toast.show({ message: errorMessage(e), tone: 'error' }),
  });

  const row = (s: SessionInfo) => (
    <ListItem
      key={s.id}
      icon={s.platform === 'WEB' ? Monitor : Smartphone}
      title={s.deviceName ?? PLATFORM[s.platform ?? ''] ?? 'Unknown device'}
      subtitle={[s.current ? 'This device' : relative(s.lastSeenAt), s.platform && PLATFORM[s.platform], s.ipCountry].filter(Boolean).join(' · ')}
      trailing={
        s.current ? null : (
          <Button label="Sign out" size="sm" variant="outline" loading={revoke.isPending && revoke.variables === s.id} onPress={() => revoke.mutate(s.id)} accessibilityHint={`Signs out ${s.deviceName ?? 'this device'}`} testID={`revoke-${s.id}`} />
        )
      }
      testID={`session-${s.current ? 'current' : s.id}`}
    />
  );

  return (
    <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[6], maxWidth: 680, width: '100%', alignSelf: 'center' }}>
      <Section title="Where you're signed in">
        {sessions.isPending ? (
          <SkeletonGroup label="Loading devices">
            <Skeleton height={44} />
            <Skeleton height={44} style={{ marginTop: 12 }} />
          </SkeletonGroup>
        ) : sessions.isError ? (
          <View style={{ gap: spacing[2] }}>
            <Text variant="caption" tone="danger">
              {errorMessage(sessions.error)}
            </Text>
            <Button label="Try again" size="sm" variant="outline" onPress={() => void sessions.refetch()} />
          </View>
        ) : (
          sessions.data.map(row)
        )}
      </Section>

      <Section title="Password">
        <ListItem
          icon={KeyRound}
          title={user?.hasPassword ? 'Change password' : 'Add a password'}
          subtitle={user?.hasPassword ? 'Other devices will be signed out' : 'You sign in with Apple or Google'}
          onPress={() => (user?.hasPassword ? router.push('/change-password') : toast.show('Use "Forgot password" on the log-in screen to add one.'))}
          testID="go-change-password"
        />
      </Section>

      <Section title="Sign out">
        <ListItem icon={LogOut} title="Sign out of all devices" subtitle="Including this one" onPress={() => setConfirmAll(true)} testID="logout-all" />
        <ListItem icon={Trash2} title="Delete account" destructive onPress={() => router.push('/delete-account')} testID="go-delete" />
      </Section>

      <Sheet visible={confirmAll} onClose={() => setConfirmAll(false)} title="Sign out everywhere?">
        <Text variant="body" tone="secondary" style={{ marginBottom: spacing[4] }}>
          Every device, including this one, will need to sign in again.
        </Text>
        <View style={{ gap: spacing[2] }}>
          <Button label="Sign out everywhere" variant="danger" fullWidth loading={logoutAll.isPending} onPress={() => logoutAll.mutate()} testID="confirm-logout-all" />
          <Button label="Cancel" variant="ghost" fullWidth onPress={() => setConfirmAll(false)} />
        </View>
      </Sheet>
    </ScrollView>
  );
}
