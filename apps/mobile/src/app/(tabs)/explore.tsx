import { useQuery } from '@tanstack/react-query';
import { Compass, Search, SearchX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { TopBar } from '@/components/top-bar';
import { UserRow } from '@/features/social/user-row';
import { errorMessage } from '@/lib/form';
import { socialApi } from '@/lib/social-api';
import { useAppTheme } from '@/theme';
import { EmptyState, Screen, Spinner, Text, TextField } from '@/ui';

export default function ExploreScreen() {
  const { spacing } = useAppTheme();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: ({ signal }) => socialApi.search(debounced, signal),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });

  return (
    <Screen header={<TopBar title="Explore" />} contentStyle={{ paddingBottom: 0 }}>
      <TextField label="Search people" leftIcon={Search} value={q} onChangeText={setQ} placeholder="Name or @username" autoCapitalize="none" autoCorrect={false} returnKeyType="search" testID="search-input" />
      {!debounced ? (
        <EmptyState icon={Compass} title="Find people" message="Search by name or username. Trending posts, reels, hashtags and music arrive with Search & discovery." phase="Phase 12 · Discovery" />
      ) : results.isPending ? (
        <View style={{ paddingTop: spacing[6] }}>
          <Spinner label="Searching" />
        </View>
      ) : results.isError ? (
        <Text variant="body" tone="danger" style={{ marginTop: spacing[4] }}>
          {errorMessage(results.error)}
        </Text>
      ) : (
        <FlatList
          data={results.data}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <UserRow user={item} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon={SearchX} title="No results" message={`Nobody matches “${debounced}”.`} />}
          contentContainerStyle={{ paddingTop: spacing[2], paddingBottom: spacing[8] }}
          testID="search-results"
        />
      )}
    </Screen>
  );
}
