import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react-native';
import { PeopleList } from '@/features/social/people-list';
import { errorMessage } from '@/lib/form';
import { socialApi } from '@/lib/social-api';
import { useAppTheme } from '@/theme';
import { Button, Text, useToast } from '@/ui';

export default function CloseFriends() {
  const { spacing } = useAppTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const remove = useMutation({
    mutationFn: (id: string) => socialApi.setCloseFriend(id, false),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['closeFriends'] }),
    onError: (e) => toast.show({ message: errorMessage(e), tone: 'error' }),
  });
  return (
    <PeopleList
      queryKey={['closeFriends']}
      fetchPage={async () => ({ items: await socialApi.closeFriends(), nextCursor: null })}
      header={
        <Text variant="caption" tone="secondary" style={{ paddingVertical: spacing[3] }}>
          Only people on this list see stories you share with Close Friends. Nobody is told when you add or remove them. Add people from the ⋯ menu on their profile.
        </Text>
      }
      empty={{ icon: Star, title: 'No close friends yet', message: 'Open someone’s profile, tap ⋯ and choose “Add to close friends”.' }}
      action={(u) => <Button label="Remove" size="sm" variant="outline" onPress={() => remove.mutate(u.id)} testID={`remove-cf-${u.username}`} />}
    />
  );
}
