import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { PeopleList } from '@/features/social/people-list';
import { socialApi } from '@/lib/social-api';
import { Spinner } from '@/ui';

export default function Following() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => socialApi.profile(username) });
  if (!profile.data) return <Spinner />;
  return (
    <>
      <Stack.Screen options={{ title: 'Following' }} />
      <PeopleList
        queryKey={['following', profile.data.id]}
        fetchPage={(c) => socialApi.following(profile.data.id, c)}
        empty={{ icon: Users, title: 'Not following anyone yet', message: 'Accounts this person follows will show up here.' }}
      />
    </>
  );
}
