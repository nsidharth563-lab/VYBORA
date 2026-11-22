import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FollowStatus } from '@vybora/types';
import { useState } from 'react';
import { errorMessage } from '@/lib/form';
import { socialApi } from '@/lib/social-api';
import { Button, useToast } from '@/ui';

interface FollowButtonProps {
  userId: string;
  username: string;
  following: FollowStatus | null;
  followsYou?: boolean;
  isPrivate?: boolean;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

/**
 * Follow / Follow back / Requested / Following. Optimistic: flips instantly,
 * rolls back with a toast if the API refuses. Refreshes cached profiles & lists.
 */
export function FollowButton({ userId, username, following, followsYou, isPrivate, size = 'sm', fullWidth }: FollowButtonProps) {
  const qc = useQueryClient();
  const toast = useToast();
  const [state, setState] = useState<FollowStatus | null>(following);
  // When the server value changes (refetch), adopt it — React's "adjust state on prop change" pattern.
  const [seen, setSeen] = useState(following);
  if (seen !== following) {
    setSeen(following);
    setState(following);
  }

  const m = useMutation({
    mutationFn: (next: 'follow' | 'unfollow'): Promise<{ following: FollowStatus | null }> =>
      next === 'follow' ? socialApi.follow(userId) : socialApi.unfollow(userId),
    onMutate: (next): { prev: FollowStatus | null } => {
      const prev = state;
      setState(next === 'follow' ? (isPrivate ? 'PENDING' : 'ACCEPTED') : null);
      return { prev };
    },
    onSuccess: (res) => setState(res.following),
    onError: (e, _v, ctx) => {
      setState(ctx?.prev ?? null);
      toast.show({ message: errorMessage(e), tone: 'error' });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['profile', username] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const label = state === 'ACCEPTED' ? 'Following' : state === 'PENDING' ? 'Requested' : followsYou ? 'Follow back' : 'Follow';
  const hint = state ? `Tap to ${state === 'PENDING' ? 'cancel your request to' : 'unfollow'} @${username}` : `Follows @${username}`;
  return (
    <Button
      label={label}
      size={size}
      fullWidth={fullWidth}
      variant={state ? 'outline' : 'primary'}
      accessibilityHint={hint}
      onPress={() => m.mutate(state ? 'unfollow' : 'follow')}
      testID={`follow-${username}`}
    />
  );
}
