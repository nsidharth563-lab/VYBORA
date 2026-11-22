import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { PeopleList } from '@/features/social/people-list';
import { socialApi } from '@/lib/social-api';
import { Spinner } from '@/ui';

export default function Followers() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => socialApi.profile(username) });
  if (!profile.data) return <Spinner />;
  return (
    <>
      <Stack.Screen options={{ title: 'Followers' }} />
      <PeopleList
        queryKey={['followers', profile.data.id]}
        fetchPage={(c) => socialApi.followers(profile.data.id, c)}
        empty={{ icon: Users, title: 'No followers yet', message: 'When people follow this account, they’ll show up here.' }}
      />
    </>
  );
}
