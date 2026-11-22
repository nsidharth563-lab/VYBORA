import { router } from 'expo-router';
import { Grid3x3, Settings } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, Share, View } from 'react-native';
import { TopBar } from '@/components/top-bar';
import { ProfileHeader } from '@/features/social/profile-header';
import { useMe } from '@/hooks/use-me';
import { useAuth } from '@/stores/auth';
import { useAppTheme } from '@/theme';
import { Button, EmptyState, IconButton, Screen, Tabs } from '@/ui';

export default function ProfileScreen() {
  const { spacing } = useAppTheme();
  const me = useMe();
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  if (!user) return null;

  return (
    <Screen edges={['top']} contentStyle={{ padding: 0 }} header={<TopBar title={`@${user.username}`} right={<IconButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />} />}>
      <ScrollView
        contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}
        refreshControl={<RefreshControl refreshing={me.isRefetching} onRefresh={() => void me.refetch()} />}
      >
        <ProfileHeader
          user={{ ...user, coverUrl: user.coverUrl ?? null, followerCount: user.followerCount ?? 0, followingCount: user.followingCount ?? 0, postCount: user.postCount ?? 0 }}
          actions={
            <>
              <View style={{ flex: 1 }}>
                <Button label="Edit profile" variant="outline" size="sm" fullWidth onPress={() => router.push('/edit-profile')} testID="edit-profile" />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Share profile" variant="outline" size="sm" fullWidth onPress={() => void Share.share({ message: `Find me on VYBORA: @${user.username} — https://vybora.app/u/${user.username}` })} />
              </View>
            </>
          }
        />
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
        <View style={{ minHeight: 220 }}>
          <EmptyState icon={Grid3x3} title="Nothing here yet" message="Your posts, reels and saved items will appear here." phase="Posts arrive in Phase 5 · Reels in Phase 7" />
        </View>
      </ScrollView>
    </Screen>
  );
}
