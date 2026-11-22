import { router } from 'expo-router';
import { Grid3x3, Settings } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { TopBar } from '@/components/top-bar';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { Avatar, EmptyState, IconButton, Screen, Tabs, Text } from '@/ui';

export default function ProfileScreen() {
  const { spacing } = useAppTheme();
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  if (!user) return null;

  return (
    <Screen header={<TopBar title={`@${user.username}`} right={<IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />} />} scroll>
      <View style={{ alignItems: 'center', gap: spacing[2], paddingVertical: spacing[4] }}>
        <Avatar name={user.displayName} size="xl" verified={user.isVerified} />
        <Text variant="title" testID="profile-name">
          {user.displayName}
        </Text>
        <Text variant="body" tone="secondary">
          @{user.username}
        </Text>
        {user.bio ? (
          <Text variant="body" align="center">
            {user.bio}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing[8], marginTop: spacing[3] }}>
          {[
            ['0', 'Posts'],
            ['0', 'Followers'],
            ['0', 'Following'],
          ].map(([n, l]) => (
            <View key={l} style={{ alignItems: 'center' }} accessible accessibilityLabel={`${n} ${l}`}>
              <Text variant="heading">{n}</Text>
              <Text variant="caption" tone="secondary">
                {l}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Tabs
        accessibilityLabel="Profile content"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'posts', label: 'Posts' },
          { key: 'reels', label: 'Reels' },
          { key: 'saved', label: 'Saved' },
        ]}
      />
      <View style={{ minHeight: 260 }}>
        <EmptyState icon={Grid3x3} title="Nothing here yet" message="Profile editing, photos and follows arrive in Phase 4; posts and reels in Phases 5 and 7." phase="Phase 4 · Profiles" />
      </View>
    </Screen>
  );
}
