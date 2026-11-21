import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { ApiRequestError } from './api';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        // Retry only transient failures; 4xx won't fix themselves.
        retry: (count, error) =>
          count < 2 && (!(error instanceof ApiRequestError) || error.isNetwork || error.status >= 500),
      },
      mutations: { retry: false },
    },
  });
}

/** Refetch stale queries when the app returns to the foreground. */
export function bindAppFocus() {
  if (Platform.OS === 'web') return () => {};
  const sub = AppState.addEventListener('change', (s: AppStateStatus) => focusManager.setFocused(s === 'active'));
  return () => sub.remove();
}
