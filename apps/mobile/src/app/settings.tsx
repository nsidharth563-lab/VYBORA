import Constants from 'expo-constants';
import { LogOut, Mail, Palette, Phone, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Row, Section } from '@/components/section';
import { Badge, ListItem } from '@/ui';
import { useAuth } from '@/stores/auth';
import { Screen } from '@/ui/screen';
import { Segmented } from '@/ui/segmented';
import { Text } from '@/ui/text';
import { useApiHealth } from '@/hooks/use-api-health';
import { ApiRequestError, resolveApiUrl } from '@/lib/api';
import { usePreferences, type ThemePreference } from '@/stores/preferences';
import { useAppTheme } from '@/theme';
import { TAGLINE } from '@vybora/shared';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function ServerStatus() {
  const { colors, spacing } = useAppTheme();
  const health = useApiHealth();
  const ok = health.data?.status === 'ok';
  const dot = health.isFetching ? colors.textMuted : ok ? colors.success : colors.danger;
  const err = health.error instanceof ApiRequestError ? health.error : null;

  let label = 'Checking…';
  if (!health.isFetching || health.data || health.error) {
    if (ok) label = 'All systems operational';
    else if (err?.isNetwork) label = err.message;
    else if (err) label = `Degraded (${err.status})`;
  }

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={styles.row}>
        <View style={styles.statusLeft}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Text variant="body" style={{ flexShrink: 1 }} testID="server-status">
            {label}
          </Text>
        </View>
        <Pressable
          onPress={() => void health.refetch()}
          disabled={health.isFetching}
          accessibilityRole="button"
          accessibilityLabel="Check server status again"
          hitSlop={8}
          style={styles.retry}
        >
          {health.isFetching ? <ActivityIndicator color={colors.primary} /> : <RefreshCw size={20} color={colors.primary} />}
        </Pressable>
      </View>
      {health.data
        ? Object.entries(health.data.checks).map(([name, c]) => (
            <Row key={name} label={name} value={c.status === 'up' ? `up · ${c.latencyMs} ms` : 'down'} />
          ))
        : null}
    </View>
  );
}

function AccountSection() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  if (!user) return null;
  const contact = (channel: 'email' | 'phone', value: string | null, verified: boolean) =>
    value ? (
      <ListItem
        icon={channel === 'email' ? Mail : Phone}
        title={value}
        subtitle={verified ? undefined : 'Not verified — tap to verify'}
        trailing={verified ? <Badge label="VERIFIED" tone="success" /> : undefined}
        onPress={verified ? undefined : () => router.push({ pathname: '/verify', params: { channel, send: '1' } })}
        testID={`contact-${channel}`}
      />
    ) : null;
  return (
    <Section title="Account">
      {contact('email', user.email, user.emailVerified)}
      {contact('phone', user.phone, user.phoneVerified)}
      <ListItem icon={ShieldCheck} title="Security" subtitle="Devices, password, delete account" onPress={() => router.push('/security')} testID="open-security" />
      <ListItem icon={LogOut} title="Log out" onPress={() => void signOut()} testID="logout" />
    </Section>
  );
}

export default function SettingsScreen() {
  const { spacing } = useAppTheme();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);

  return (
    <Screen edges={[]} scroll contentStyle={{ gap: spacing[6] }}>
      <AccountSection />

      <Section title="Appearance">
        <Segmented value={theme} options={THEME_OPTIONS} onChange={setTheme} accessibilityLabel="Theme" />
      </Section>

      <Section title="Server">
        <ServerStatus />
      </Section>

      <Section title="About">
        <Row label="Version" value={Constants.expoConfig?.version ?? '—'} />
        <Row label="API" value={resolveApiUrl()} />
        <ListItem title="Design system" subtitle="Every VYBORA component, live" icon={Palette} onPress={() => router.push('/design-system')} testID="open-design-system" />
        <Text variant="caption" tone="muted" align="center">
          VYBORA · {TAGLINE}
        </Text>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  retry: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
