import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Link2, Lock } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/theme';
import { Avatar, Icon, Text } from '@/ui';

export interface HeaderUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarBlurhash?: string | null;
  coverUrl?: string | null;
  coverBlurhash?: string | null;
  isVerified: boolean;
  isPrivate: boolean;
  bio: string | null;
  website?: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
}

const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : n.toLocaleString());

export function ProfileHeader({ user, actions, canOpenLists = true }: { user: HeaderUser; actions?: ReactNode; canOpenLists?: boolean }) {
  const { spacing, colors, gradients, radii } = useAppTheme();
  const stat = (n: number, label: string, to?: string) => {
    const body = (
      <>
        <Text variant="heading">{compact(n)}</Text>
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
      </>
    );
    return to && canOpenLists ? (
      <Pressable key={label} onPress={() => router.push(to as never)} accessibilityRole="button" accessibilityLabel={`${n} ${label}`} style={styles.stat} testID={`stat-${label.toLowerCase()}`}>
        {body}
      </Pressable>
    ) : (
      <View key={label} style={styles.stat} accessible accessibilityLabel={`${n} ${label}`}>
        {body}
      </View>
    );
  };

  return (
    <View>
      <View style={[styles.cover, { borderRadius: radii.lg, backgroundColor: colors.surfaceMuted }]}>
        {user.coverUrl ? (
          <Image source={{ uri: user.coverUrl }} placeholder={user.coverBlurhash ? { blurhash: user.coverBlurhash } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : (
          <LinearGradient colors={gradients.signal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.85 }]} />
        )}
      </View>
      <View style={{ paddingHorizontal: spacing[1], marginTop: -44, gap: spacing[2] }}>
        <View style={[styles.avatarRing, { backgroundColor: colors.background }]}>
          <Avatar name={user.displayName} uri={user.avatarUrl} blurhash={user.avatarBlurhash} size="xl" verified={user.isVerified} />
        </View>
        <View style={{ gap: 2 }}>
          <View style={styles.nameRow}>
            <Text variant="title" testID="profile-name">
              {user.displayName}
            </Text>
            {user.isPrivate ? <Icon as={Lock} size="sm" tone="secondary" /> : null}
          </View>
          <Text variant="body" tone="secondary">
            @{user.username}
          </Text>
        </View>
        {user.bio ? <Text variant="body">{user.bio}</Text> : null}
        {user.website ? (
          <Pressable onPress={() => void Linking.openURL(user.website!)} accessibilityRole="link" style={styles.link}>
            <Icon as={Link2} size="xs" tone="accent" />
            <Text variant="caption" tone="accent" numberOfLines={1}>
              {user.website.replace(/^https?:\/\//, '')}
            </Text>
          </Pressable>
        ) : null}
        <View style={[styles.stats, { marginTop: spacing[2] }]}>
          {stat(user.postCount, 'Posts')}
          {stat(user.followerCount, 'Followers', `/u/${user.username}/followers`)}
          {stat(user.followingCount, 'Following', `/u/${user.username}/following`)}
        </View>
        {actions ? <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] }}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 120, overflow: 'hidden' },
  avatarRing: { alignSelf: 'flex-start', borderRadius: 999, padding: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 32 },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', minWidth: 72, minHeight: 44, justifyContent: 'center' },
});
