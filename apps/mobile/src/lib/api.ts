import type { ApiError } from '@vybora/types';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Error thrown for any failed API call — always carries a stable `code`. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
  /** True for connectivity problems where a retry may succeed. */
  get isNetwork() {
    return this.status === 0;
  }
  /** Field-level messages from VALIDATION_FAILED / conflict responses, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    const issues = (this.details?.issues ?? []) as { path: string; message: string }[];
    for (const i of issues) if (i.path && !out[i.path]) out[i.path] = i.message;
    const field = this.details?.field;
    if (typeof field === 'string' && !out[field]) out[field] = this.message;
    return out;
  }
}

const isLocalHost = (host: string) => host === 'localhost' || host === '127.0.0.1';

/**
 * Picks the API base URL for the current runtime:
 *  - explicit EXPO_PUBLIC_API_URL pointing at a real host → use as-is
 *  - localhost in dev on a device/emulator → swap for the dev machine's LAN IP
 *    (from the Metro host) or 10.0.2.2 on the Android emulator.
 */
export function resolveApiUrl(
  configured: string | undefined = process.env.EXPO_PUBLIC_API_URL,
  hostUri: string | undefined = Constants.expoConfig?.hostUri,
  os: string = Platform.OS,
): string {
  const url = new URL(configured || 'http://localhost:4000');
  if (isLocalHost(url.hostname) && os !== 'web') {
    const devHost = hostUri?.split(':')[0];
    if (devHost && !isLocalHost(devHost)) url.hostname = devHost;
    else if (os === 'android') url.hostname = '10.0.2.2';
  }
  return url.toString().replace(/\/$/, '');
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Skip the Authorization header and refresh logic (auth endpoints). */
  anonymous?: boolean;
}

export interface AuthHooks {
  getAccessToken: () => string | null | undefined;
  /** Obtain a fresh access token; resolve false if the session is gone. */
  refresh: () => Promise<boolean>;
  /** The session can't be recovered — sign out locally. */
  onSessionEnded: (code: string) => void;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  defaultTimeoutMs?: number;
  defaultHeaders?: () => Record<string, string>;
}

const SESSION_ENDED = new Set(['AUTH_SESSION_REVOKED', 'AUTH_TOKEN_INVALID', 'AUTH_REQUIRED', 'AUTH_REFRESH_INVALID', 'AUTH_REFRESH_REUSED']);

export function createApiClient(opts: ApiClientOptions) {
  const fetchImpl = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const defaultTimeout = opts.defaultTimeoutMs ?? 15_000;
  let auth: AuthHooks | null = null;

  async function send<T>(path: string, o: RequestOptions): Promise<T> {
    const url = new URL(opts.baseUrl + path);
    for (const [k, v] of Object.entries(o.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { accept: 'application/json', ...opts.defaultHeaders?.(), ...o.headers };
    if (o.body !== undefined) headers['content-type'] = 'application/json';
    const token = o.anonymous ? null : auth?.getAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), o.timeoutMs ?? defaultTimeout);
    const onAbort = () => controller.abort(o.signal?.reason);
    o.signal?.addEventListener('abort', onAbort);

    let res: Response;
    try {
      res = await fetchImpl(url.toString(), {
        method: o.method ?? 'GET',
        headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
        signal: controller.signal,
      });
    } catch (e) {
      if (o.signal?.aborted) throw e; // caller cancelled (e.g. React Query) — propagate as-is
      const timedOut = controller.signal.aborted;
      throw new ApiRequestError(
        0,
        timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        timedOut ? 'The server took too long to respond.' : "Can't reach VYBORA. Check your connection.",
      );
    } finally {
      clearTimeout(timer);
      o.signal?.removeEventListener('abort', onAbort);
    }

    const requestId = res.headers.get('x-request-id') ?? undefined;
    const text = await res.text();
    let json: unknown = undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON body (proxy error page etc.) */
      }
    }
    if (!res.ok) {
      const err = json as Partial<ApiError> | undefined;
      throw new ApiRequestError(
        res.status,
        err?.code ?? `HTTP_${res.status}`,
        err?.message ?? `Request failed (${res.status})`,
        err?.requestId ?? requestId,
        err?.details,
      );
    }
    return json as T;
  }

  async function request<T>(path: string, o: RequestOptions = {}): Promise<T> {
    try {
      return await send<T>(path, o);
    } catch (e) {
      if (!(e instanceof ApiRequestError) || o.anonymous || !auth || e.status !== 401) throw e;
      if (e.code === 'AUTH_TOKEN_EXPIRED') {
        // Refresh once (shared by concurrent callers) and replay the request.
        if (await auth.refresh()) return send<T>(path, o);
        throw e;
      }
      if (SESSION_ENDED.has(e.code)) auth.onSessionEnded(e.code);
      throw e;
    }
  }

  return {
    request,
    setAuth(hooks: AuthHooks | null) {
      auth = hooks;
    },
    get: <T>(path: string, o?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...o, method: 'GET' }),
    post: <T>(path: string, body?: unknown, o?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...o, method: 'POST', body }),
    del: <T>(path: string, o?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...o, method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Informational client headers (shown in the user's sessions list). */
function clientHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'x-client-platform': Platform.OS, 'x-app-version': Constants.expoConfig?.version ?? '0' };
  const name = Constants.deviceName;
  if (name) h['x-device-name'] = name.slice(0, 64);
  return h;
}

/** App-wide client; the auth store installs its hooks via api.setAuth(). */
export const api = createApiClient({ baseUrl: resolveApiUrl(), defaultHeaders: clientHeaders });
