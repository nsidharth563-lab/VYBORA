import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban } from 'lucide-react-native';
import { PeopleList } from '@/features/social/people-list';
import { errorMessage } from '@/lib/form';
import { socialApi } from '@/lib/social-api';
import { Button, useToast } from '@/ui';

export default function Blocked() {
  const qc = useQueryClient();
  const toast = useToast();
  const unblock = useMutation({
    mutationFn: (id: string) => socialApi.setBlocked(id, false),
    onSuccess: () => {
      toast.show({ message: 'Unblocked', tone: 'success' });
      void qc.invalidateQueries({ queryKey: ['blocked'] });
    },
    onError: (e) => toast.show({ message: errorMessage(e), tone: 'error' }),
  });
  return (
    <PeopleList
      queryKey={['blocked']}
      fetchPage={async () => ({ items: await socialApi.blocked(), nextCursor: null })}
      empty={{ icon: Ban, title: 'No blocked accounts', message: 'People you block can’t find your profile, posts or stories.' }}
      action={(u) => <Button label="Unblock" size="sm" variant="outline" onPress={() => unblock.mutate(u.id)} testID={`unblock-${u.username}`} />}
    />
  );
}
