import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import type { CursorPage, UserListItem } from '@vybora/types';
import type { ComponentType, ReactNode } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';
import { errorMessage } from '@/lib/form';
import { useAppTheme } from '@/theme';
import { Button, EmptyState, Skeleton, SkeletonGroup, Spinner, Text } from '@/ui';
import { UserRow } from './user-row';

interface PeopleListProps {
  queryKey: QueryKey;
  fetchPage: (cursor?: string) => Promise<CursorPage<UserListItem>>;
  empty: { icon: ComponentType<LucideProps>; title: string; message: string };
  action?: (u: UserListItem) => ReactNode;
  header?: ReactNode;
}

/** Infinite, pull-to-refresh list of people with loading, error and empty states. */
export function PeopleList({ queryKey, fetchPage, empty, action, header }: PeopleListProps) {
  const { spacing } = useAppTheme();
  const q = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  if (q.isPending) {
    return (
      <View style={{ padding: spacing[4] }}>
        <SkeletonGroup label="Loading people">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Skeleton circle={44} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="40%" />
                <Skeleton width="60%" height={10} />
              </View>
            </View>
          ))}
        </SkeletonGroup>
      </View>
    );
  }
  if (q.isError) {
    return (
      <View style={{ padding: spacing[4], gap: spacing[3] }}>
        <Text variant="body" tone="danger" testID="list-error">
          {errorMessage(q.error)}
        </Text>
        <Button label="Try again" variant="outline" onPress={() => void q.refetch()} />
      </View>
    );
  }
  return (
    <FlatList
      data={items}
      keyExtractor={(u) => u.id}
      renderItem={({ item }) => <UserRow user={item} action={action?.(item)} />}
      contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: spacing[8], flexGrow: 1 }}
      ListHeaderComponent={header ? <>{header}</> : undefined}
      ListEmptyComponent={<EmptyState icon={empty.icon} title={empty.title} message={empty.message} />}
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListFooterComponent={q.isFetchingNextPage ? <Spinner /> : undefined}
      refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()} />}
    />
  );
}
