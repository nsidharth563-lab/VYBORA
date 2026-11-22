import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { Ban, BellOff, Grid3x3, Lock, MoreHorizontal, ShieldMinus, Star, UserMinus, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import type { ProfileView } from '@vybora/types';
import { FollowButton } from '@/features/social/follow-button';
import { ProfileHeader } from '@/features/social/profile-header';
import { ApiRequestError } from '@/lib/api';
import { errorMessage } from '@/lib/form';
import { socialApi } from '@/lib/social-api';
import { useAppTheme } from '@/theme';
import { Button, EmptyState, IconButton, ListItem, Sheet, Skeleton, SkeletonGroup, Text, useToast } from '@/ui';

type Action = 'block' | 'restrict' | 'mute' | 'closeFriend' | 'removeFollower' | 'accept' | 'decline';

export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { spacing, colors, radii } = useAppTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const q = useQuery({ queryKey: ['profile', username], queryFn: () => socialApi.profile(username), retry: false });
  const p = q.data;

  const act = useMutation({
    mutationFn: async (a: Action) => {
      if (!p) return;
      const v = p.viewer;
      switch (a) {
        case 'block':
          return socialApi.setBlocked(p.id, !v.blocked);
        case 'restrict':
          return socialApi.setRestricted(p.id, !v.restricted);
        case 'mute':
          return socialApi.setMuted(p.id, !v.muted);
        case 'closeFriend':
          return socialApi.setCloseFriend(p.id, !v.closeFriend);
        case 'removeFollower':
          return socialApi.removeFollower(p.id);
        case 'accept':
          return socialApi.acceptRequest(p.id);
        case 'decline':
          return socialApi.declineRequest(p.id);
      }
    },
    onSuccess: (_r, a) => {
      const v = p!.viewer;
      const msg: Record<Action, string> = {
        block: v.blocked ? `Unblocked @${p!.username}` : `Blocked @${p!.username}`,
        restrict: v.restricted ? 'Restriction removed' : `Restricted @${p!.username}`,
        mute: v.muted ? 'Unmuted' : `Muted @${p!.username}`,
        closeFriend: v.closeFriend ? 'Removed from close friends' : 'Added to close friends',
        removeFollower: 'Follower removed',
        accept: 'Request approved',
        decline: 'Request deleted',
      };
      toast.show({ message: msg[a], tone: 'success' });
      setMenu(false);
      setConfirmBlock(false);
      void qc.invalidateQueries({ queryKey: ['profile', username] });
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['blocked'] });
      void qc.invalidateQueries({ queryKey: ['closeFriends'] });
      void qc.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (e) => toast.show({ message: errorMessage(e), tone: 'error' }),
  });

  if (q.isPending) {
    return (
      <View style={{ padding: spacing[4] }}>
        <SkeletonGroup label="Loading profile">
          <Skeleton height={120} radius={radii.lg} />
          <Skeleton circle={96} style={{ marginTop: -44, marginLeft: 8 }} />
          <Skeleton width="50%" height={20} style={{ marginTop: 12 }} />
        </SkeletonGroup>
      </View>
    );
  }
  if (q.isError) {
    const missing = q.error instanceof ApiRequestError && q.error.status === 404;
    return (
      <View style={{ flex: 1, padding: spacing[4] }}>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon={UserX} title={missing ? "This account doesn't exist" : "Couldn't load profile"} message={missing ? 'The link may be broken, or the account may have been removed.' : errorMessage(q.error)} />
        {!missing ? <Button label="Try again" variant="outline" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  }

  const prof = p as ProfileView;
  const v = prof.viewer;
  if (v.isSelf) return <Redirect href="/profile" />;

  return (
    <>
      <Stack.Screen options={{ title: `@${prof.username}`, headerRight: () => <IconButton icon={MoreHorizontal} label="More options" onPress={() => setMenu(true)} /> }} />
      <ScrollView contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}>
        <ProfileHeader
          user={prof}
          canOpenLists={prof.canViewContent}
          actions={
            v.blocked ? (
              <View style={{ flex: 1 }}>
                <Button label="Unblock" variant="outline" size="sm" fullWidth loading={act.isPending} onPress={() => act.mutate('block')} testID="unblock" />
              </View>
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <FollowButton userId={prof.id} username={prof.username} following={v.following} followsYou={v.followsYou} isPrivate={prof.isPrivate} fullWidth />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Message" variant="outline" size="sm" fullWidth onPress={() => toast.show('Messaging arrives in Phase 8.')} />
                </View>
              </>
            )
          }
        />

        {v.requestedYou ? (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: radii.md, padding: spacing[3], gap: spacing[2] }}>
            <Text variant="body">@{prof.username} wants to follow you.</Text>
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <Button label="Confirm" size="sm" onPress={() => act.mutate('accept')} testID="accept-request" />
              <Button label="Delete" size="sm" variant="outline" onPress={() => act.mutate('decline')} />
            </View>
          </View>
        ) : null}

        {!prof.canViewContent ? (
          <View style={{ minHeight: 200 }}>
            <EmptyState
              icon={Lock}
              title={v.blocked ? 'You blocked this account' : 'This account is private'}
              message={v.blocked ? 'Unblock to see their posts and let them find you again.' : `Follow @${prof.username} to see their photos and videos.`}
            />
          </View>
        ) : (
          <View style={{ minHeight: 200 }}>
            <EmptyState icon={Grid3x3} title="No posts yet" message="Posts and reels arrive in Phases 5 and 7." />
          </View>
        )}
      </ScrollView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={`@${prof.username}`} testID="profile-menu">
        {!v.blocked ? (
          <>
            <ListItem icon={Star} title={v.closeFriend ? 'Remove from close friends' : 'Add to close friends'} onPress={() => act.mutate('closeFriend')} testID="menu-close-friend" />
            <ListItem icon={BellOff} title={v.muted ? 'Unmute' : 'Mute'} subtitle="They won't know. You won't see their posts and stories in your feed." onPress={() => act.mutate('mute')} testID="menu-mute" />
            <ListItem icon={ShieldMinus} title={v.restricted ? 'Unrestrict' : 'Restrict'} subtitle="Their comments on your posts are visible only to them." onPress={() => act.mutate('restrict')} testID="menu-restrict" />
            {v.followsYou ? <ListItem icon={UserMinus} title="Remove follower" onPress={() => act.mutate('removeFollower')} testID="menu-remove-follower" /> : null}
          </>
        ) : null}
        <ListItem icon={Ban} title={v.blocked ? 'Unblock' : 'Block'} destructive={!v.blocked} onPress={() => (v.blocked ? act.mutate('block') : (setMenu(false), setConfirmBlock(true)))} testID="menu-block" />
        <ListItem icon={UserX} title="Report" subtitle="Reporting arrives with moderation in Phase 5." onPress={() => toast.show('Reporting arrives in Phase 5.')} />
      </Sheet>

      <Sheet visible={confirmBlock} onClose={() => setConfirmBlock(false)} title={`Block @${prof.username}?`} testID="confirm-block-sheet">
        <Text variant="body" tone="secondary" style={{ marginBottom: spacing[4] }}>
          They won&apos;t be able to find your profile, posts or stories. You&apos;ll both stop following each other. They won&apos;t be told.
        </Text>
        <View style={{ gap: spacing[2] }}>
          <Button label="Block" variant="danger" fullWidth loading={act.isPending} onPress={() => act.mutate('block')} testID="confirm-block" />
          <Button label="Cancel" variant="ghost" fullWidth onPress={() => setConfirmBlock(false)} />
        </View>
      </Sheet>
    </>
  );
}
