import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { UserListItem } from '@vybora/types';
import { useAppTheme } from '@/theme';
import { Avatar, Text } from '@/ui';
import { FollowButton } from './follow-button';

/** A person in a list: avatar, names, and an action (Follow by default). */
export function UserRow({ user, action }: { user: UserListItem; action?: ReactNode }) {
  const { spacing, colors } = useAppTheme();
  return (
    <View style={[styles.row, { gap: spacing[3], paddingVertical: spacing[2] }]} testID={`user-${user.username}`}>
      <Pressable
        onPress={() => router.push(`/u/${user.username}`)}
        accessibilityRole="button"
        accessibilityLabel={`${user.displayName}, @${user.username}${user.isVerified ? ', verified' : ''}`}
        style={({ pressed }) => [styles.who, { gap: spacing[3] }, pressed && { opacity: 0.7 }]}
      >
        <Avatar name={user.displayName} uri={user.avatarUrl} blurhash={user.avatarBlurhash} size="md" verified={user.isVerified} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {user.username}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {user.displayName}
            {user.viewer.followsYou ? <Text variant="caption" style={{ color: colors.textMuted }}>{' · Follows you'}</Text> : null}
          </Text>
        </View>
      </Pressable>
      {action === undefined ? (
        user.viewer.isSelf ? null : (
          <FollowButton userId={user.id} username={user.username} following={user.viewer.following} followsYou={user.viewer.followsYou} isPrivate={user.isPrivate} />
        )
      ) : (
        action
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center' },
});
