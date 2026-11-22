import type { AuthResponse, MeUser } from '@vybora/types';
import { create } from 'zustand';
import { api, ApiRequestError } from '@/lib/api';
import { authApi, type TokenPair } from '@/lib/auth-api';
import { tokenStorage } from '@/lib/token-storage';

export type AuthStatus = 'booting' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: MeUser | null;
  accessToken: string | null;
  /** Why the last session ended (e.g. AUTH_REFRESH_REUSED) — shown once on the welcome screen. */
  endedReason: string | null;
  /**
   * Where to land right after signing in (e.g. the verify screen after sign-up).
   * Read by the root layout's route guard so there's a single navigation, not
   * a guard redirect racing an imperative router.replace().
   */
  landing: string | null;
  clearLanding: () => void;
  bootstrap: () => Promise<void>;
  signIn: (res: AuthResponse, opts?: { landing?: string }) => Promise<void>;
  setUser: (u: MeUser) => void;
  signOut: (opts?: { remote?: boolean; reason?: string }) => Promise<void>;
  /** Single-flight refresh used by the API client; true when a new access token is ready. */
  refresh: () => Promise<boolean>;
}

let inflight: Promise<boolean> | null = null;

export const useAuth = create<AuthState>()((set, get) => ({
  status: 'booting',
  user: null,
  accessToken: null,
  endedReason: null,
  landing: null,

  clearLanding() {
    set({ landing: null });
  },

  async bootstrap() {
    const stored = await tokenStorage.get().catch(() => null);
    if (!stored) return set({ status: 'signedOut' });
    if (await get().refresh()) {
      try {
        const user = await authApi.me();
        return set({ user, status: 'signedIn' });
      } catch {
        /* fall through */
      }
    }
    // Offline at launch: keep the session (refresh token stays stored) but show signed-out UI
    // only if the server definitively rejected it; otherwise retry next launch.
    if (get().status === 'booting') set({ status: 'signedOut' });
  },

  async signIn(res, opts) {
    await tokenStorage.set(res.tokens.refreshToken);
    set({ status: 'signedIn', user: res.user, accessToken: res.tokens.accessToken, endedReason: null, landing: opts?.landing ?? null });
  },

  setUser(user) {
    set({ user });
  },

  async signOut({ remote = true, reason } = {}) {
    if (remote && get().accessToken) {
      await authApi.logout().catch(() => undefined); // best effort; local sign-out always happens
    }
    await tokenStorage.clear().catch(() => undefined);
    set({ status: 'signedOut', user: null, accessToken: null, endedReason: reason ?? null, landing: null });
  },

  refresh() {
    inflight ??= (async () => {
      try {
        const stored = await tokenStorage.get();
        if (!stored) return false;
        const pair: TokenPair = await authApi.refresh(stored);
        await tokenStorage.set(pair.refreshToken);
        set({ accessToken: pair.accessToken });
        return true;
      } catch (e) {
        // Only a definitive rejection ends the session; network errors keep it for a retry.
        if (e instanceof ApiRequestError && (e.status === 401 || e.status === 403)) {
          await get().signOut({ remote: false, reason: e.code });
        }
        return false;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },
}));

// Wire the API client to the store (access token in memory, refresh on expiry).
api.setAuth({
  getAccessToken: () => useAuth.getState().accessToken,
  refresh: () => useAuth.getState().refresh(),
  onSessionEnded: (code) => void useAuth.getState().signOut({ remote: false, reason: code }),
});
