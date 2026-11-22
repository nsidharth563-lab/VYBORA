import { contrastRatio, gradients as tokenGradients } from '@vybora/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, Bell, Heart, Lock, Music2, Search, Share2, Sparkles, Trash2, UserPlus } from 'lucide-react-native';
import { useState, type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { validateUsername } from '@vybora/shared';
import { usePreferences } from '@/stores/preferences';
import { useAppTheme } from '@/theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  ListItem,
  Segmented,
  Sheet,
  Skeleton,
  SkeletonGroup,
  Spinner,
  SwitchRow,
  Tabs,
  Text,
  TextField,
  useToast,
  Wordmark,
} from '@/ui';

function Block({ title, children }: PropsWithChildren<{ title: string }>) {
  const { spacing } = useAppTheme();
  return (
    <View style={{ gap: spacing[3] }}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const Row = ({ children }: PropsWithChildren) => <View style={styles.row}>{children}</View>;

const USERNAME_ERRORS = {
  too_short: 'At least 3 characters.',
  too_long: 'At most 30 characters.',
  invalid_chars: 'Use letters, numbers, periods and underscores.',
  reserved: 'That username is reserved.',
} as const;

function Swatches() {
  const { colors, radii } = useAppTheme();
  const keys = ['primary', 'accent', 'success', 'warning', 'danger', 'textPrimary', 'textSecondary', 'textMuted'] as const;
  return (
    <View style={styles.wrap}>
      {keys.map((k) => (
        <View key={k} style={{ width: '23%', minWidth: 70, gap: 4 }} accessible accessibilityLabel={`${k}, contrast ${contrastRatio(colors[k], colors.background).toFixed(1)} to 1`}>
          <View style={{ height: 40, borderRadius: radii.sm, backgroundColor: colors[k] }} />
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {k}
          </Text>
          <Text variant="label" tone="muted">
            {contrastRatio(colors[k], colors.background).toFixed(1)}:1
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function DesignSystemScreen() {
  const { colors, spacing, radii } = useAppTheme();
  const toast = useToast();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);

  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState('nova');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('Making things that move ✨');
  const [interests, setInterests] = useState<Set<string>>(new Set(['Music']));
  const [tab, setTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [privateAccount, setPrivateAccount] = useState(false);
  const [activity, setActivity] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [liked, setLiked] = useState(false);

  const usernameProblem = validateUsername(username);

  const fakeSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.show({ message: 'Saved', tone: 'success' });
    }, 1200);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { padding: spacing[4], gap: spacing[8] }]} testID="design-system">
      <View style={{ gap: spacing[3] }}>
        <Wordmark size={24} />
        <Text variant="body" tone="secondary">
          Every component below is live. Switch the theme to review light and dark.
        </Text>
        <Segmented
          value={theme}
          onChange={setTheme}
          accessibilityLabel="Theme"
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </View>

      <Block title="Colour">
        <LinearGradient colors={tokenGradients.signal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 56, borderRadius: radii.lg }} />
        <Text variant="caption" tone="muted">
          Signal gradient — connect → create → discover. Ratios are contrast against the page background.
        </Text>
        <Swatches />
      </Block>

      <Block title="Typography">
        <Text variant="display">Display</Text>
        <Text variant="title">Title — Sora</Text>
        <Text variant="heading">Heading</Text>
        <Text variant="body">Body — Inter. Connect. Create. Discover.</Text>
        <Text variant="caption" tone="secondary">
          Caption · secondary
        </Text>
        <Text variant="label" tone="muted">
          LABEL · MUTED
        </Text>
      </Block>

      <Block title="Buttons">
        <Button label="Save changes" onPress={fakeSave} loading={saving} fullWidth testID="btn-save" />
        <Row>
          <Button label="Follow" icon={UserPlus} onPress={() => toast.show('Followed')} size="sm" />
          <Button label="Message" variant="secondary" onPress={() => toast.show('Opening chat…')} size="sm" />
          <Button label="Share" variant="outline" icon={Share2} onPress={() => toast.show('Link copied')} size="sm" />
        </Row>
        <Row>
          <Button label="Cancel" variant="ghost" onPress={() => toast.show('Cancelled')} />
          <Button label="Delete" variant="danger" icon={Trash2} onPress={() => toast.show({ message: 'Deleted', tone: 'error' })} />
          <Button label="Disabled" onPress={() => {}} disabled />
        </Row>
      </Block>

      <Block title="Inputs">
        <TextField
          label="Username"
          leftIcon={AtSign}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          error={usernameProblem ? USERNAME_ERRORS[usernameProblem] : null}
          helper={usernameProblem ? undefined : 'Looks good.'}
          testID="field-username"
        />
        <TextField label="Password" leftIcon={Lock} value={password} onChangeText={setPassword} secureTextEntry helper="At least 10 characters." testID="field-password" />
        <TextField label="Bio" value={bio} onChangeText={setBio} multiline maxLength={160} showCount />
        <TextField label="Search" leftIcon={Search} placeholder="People, reels, sounds…" />
      </Block>

      <Block title="Avatars & story rings">
        <Row>
          <Avatar name="Nova Rao" size="xl" ring="unseen" verified />
          <Avatar name="Kai" size="lg" ring="closeFriends" />
          <Avatar name="Mira Shah" size="md" ring="seen" online />
          <Avatar name="dj_kay" size="sm" />
          <Avatar name="Leo" size="xs" />
        </Row>
      </Block>

      <Block title="Chips & badges">
        <Row>
          {['Music', 'Travel', 'Food', 'Gaming', 'Art'].map((i) => (
            <Chip
              key={i}
              label={i}
              selected={interests.has(i)}
              icon={i === 'Music' ? Music2 : undefined}
              onPress={() =>
                setInterests((s) => {
                  const n = new Set(s);
                  if (n.has(i)) n.delete(i);
                  else n.add(i);
                  return n;
                })
              }
              testID={`chip-${i}`}
            />
          ))}
        </Row>
        <Row>
          <Badge label="NEW" />
          <Badge label={3} tone="danger" accessibilityLabel="3 unread" />
          <Badge label={120} tone="neutral" accessibilityLabel="More than 99" />
          <Badge label="LIVE" tone="success" />
          <Badge label="BETA" tone="warning" />
        </Row>
      </Block>

      <Block title="Tabs">
        <Tabs
          accessibilityLabel="Profile content"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'posts', label: 'Posts', count: 128 },
            { key: 'reels', label: 'Reels', count: 42 },
            { key: 'saved', label: 'Saved' },
          ]}
        />
        <Text variant="caption" tone="secondary" testID="tab-selection">
          Showing: {tab}
        </Text>
      </Block>

      <Block title="Lists & toggles">
        <Card padded={false} style={{ paddingHorizontal: spacing[4] }}>
          <SwitchRow label="Private account" description="Only approved followers see your posts." value={privateAccount} onValueChange={setPrivateAccount} testID="switch-private" />
          <SwitchRow label="Show activity status" value={activity} onValueChange={setActivity} />
          <ListItem title="Notifications" subtitle="Likes, comments, follows" icon={Bell} onPress={() => toast.show('Notification settings arrive in Phase 12')} />
          <ListItem title="Delete account" icon={Trash2} destructive onPress={() => setSheetOpen(true)} />
        </Card>
      </Block>

      <Block title="Cards">
        <Card onPress={() => setLiked((v) => !v)} accessibilityLabel={liked ? 'Unlike sample post' : 'Like sample post'}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={[styles.row, { flexWrap: 'nowrap' }]}>
              <Avatar name="Nova Rao" size="sm" />
              <Text variant="bodyStrong">nova.creates</Text>
            </View>
            <Icon as={Heart} filled={liked} color={liked ? colors.danger : colors.textSecondary} />
          </View>
          <Text variant="body" style={{ marginTop: spacing[3] }}>
            Tap this card to toggle the heart.
          </Text>
        </Card>
      </Block>

      <Block title="Loading">
        <SkeletonGroup label="Loading post">
          <View style={[styles.row, { flexWrap: 'nowrap' }]}>
            <Skeleton circle={44} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="50%" />
              <Skeleton width="30%" height={10} />
            </View>
          </View>
          <Skeleton height={220} radius={radii.lg} style={{ marginTop: spacing[3] }} />
        </SkeletonGroup>
        <Row>
          <Spinner />
          <Text variant="caption" tone="secondary">
            Spinner for short waits; skeletons for content.
          </Text>
        </Row>
      </Block>

      <Block title="Feedback">
        <Row>
          <Button label="Info toast" size="sm" variant="outline" onPress={() => toast.show('Heads up — this is a toast.')} testID="btn-toast-info" />
          <Button label="Success" size="sm" variant="outline" onPress={() => toast.show({ message: 'Posted to your profile', tone: 'success' })} />
          <Button label="Error" size="sm" variant="outline" onPress={() => toast.show({ message: "Couldn't upload. We'll retry when you're online.", tone: 'error' })} />
        </Row>
        <Button label="Open sheet" variant="secondary" icon={Sparkles} onPress={() => setSheetOpen(true)} testID="btn-sheet" />
        <Card>
          <EmptyState icon={Bell} title="Empty state" message="Used when a list has nothing to show yet." />
        </Card>
        <Row>
          <IconButton icon={Share2} label="Share" onPress={() => toast.show('Share sheet')} />
          <IconButton icon={Bell} label="Notifications" onPress={() => toast.show('Notifications')} />
        </Row>
      </Block>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Delete account?" testID="sheet">
        <Text variant="body" tone="secondary" style={{ marginBottom: spacing[4] }}>
          This is the sheet component. Real account deletion arrives with authentication in Phase 3.
        </Text>
        <View style={{ gap: spacing[2] }}>
          <Button label="I understand" variant="danger" fullWidth onPress={() => setSheetOpen(false)} />
          <Button label="Cancel" variant="ghost" fullWidth onPress={() => setSheetOpen(false)} testID="sheet-cancel" />
        </View>
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingBottom: 64 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
