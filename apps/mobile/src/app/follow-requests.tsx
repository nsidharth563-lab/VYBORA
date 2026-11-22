import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react-native';
import { View } from 'react-native';
import { PeopleList } from '@/features/social/people-list';
import { errorMessage } from '@/lib/form';
import { socialApi } from '@/lib/social-api';
import { Button, useToast } from '@/ui';

export default function FollowRequests() {
  const qc = useQueryClient();
  const toast = useToast();
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => (accept ? socialApi.acceptRequest(id) : socialApi.declineRequest(id)),
    onSuccess: (_r, { accept }) => {
      toast.show({ message: accept ? 'Request approved' : 'Request deleted', tone: 'success' });
      void qc.invalidateQueries({ queryKey: ['requests'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => toast.show({ message: errorMessage(e), tone: 'error' }),
  });
  return (
    <PeopleList
      queryKey={['requests']}
      fetchPage={socialApi.requests}
      empty={{ icon: UserPlus, title: 'No requests', message: 'When your account is private, people who ask to follow you appear here.' }}
      action={(u) => (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button label="Confirm" size="sm" onPress={() => respond.mutate({ id: u.id, accept: true })} testID={`accept-${u.username}`} />
          <Button label="Delete" size="sm" variant="outline" onPress={() => respond.mutate({ id: u.id, accept: false })} testID={`decline-${u.username}`} />
        </View>
      )}
    />
  );
}
