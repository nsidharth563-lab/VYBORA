import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { authApi } from '@/lib/auth-api';
import { useAuth } from '@/stores/auth';

/** Fresh "me" (counts, avatar) from the API, mirrored into the auth store. */
export function useMe() {
  const setUser = useAuth((s) => s.setUser);
  const q = useQuery({ queryKey: ['me'], queryFn: authApi.me, staleTime: 15_000 });
  useEffect(() => {
    if (q.data) setUser(q.data);
  }, [q.data, setUser]);
  return q;
}
