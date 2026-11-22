/**
 * In-memory stand-in for the VYBORA auth API, used by router-level tests.
 * Mirrors the real contract (status codes, error codes, shapes) closely enough
 * to drive the screens; the real API has its own integration tests.
 */
import type { MeUser, SessionInfo } from '@vybora/types';

export const CODE = '123456';

interface FakeUser {
  me: MeUser;
  password: string;
}
interface FakeSession {
  id: string;
  userId: string;
  refresh: string;
  access: string;
  revoked: boolean;
  deviceName: string;
}

export function createFakeApi() {
  const users = new Map<string, FakeUser>();
  const sessions: FakeSession[] = [];
  let n = 0;
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const state = { expireNextAccess: false, offline: false, health: 'ok' as 'ok' | 'down' };
  // Social graph: "a->b" → status; blocks: "a->b"; closeFriends/mutes/restricts: "owner->other".
  const follows = new Map<string, 'ACCEPTED' | 'PENDING'>();
  const blocks = new Set<string>();
  const flags = { close: new Set<string>(), mute: new Set<string>(), restrict: new Set<string>() };
  const media = new Map<string, { status: 'PENDING_UPLOAD' | 'READY' | 'FAILED'; ownerId: string }>();

  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-request-id': `req-${n}` } });
  const err = (status: number, code: string, message: string, details?: unknown) => json(status, { statusCode: status, code, message, details, requestId: 'req' });

  function addUser(p: Partial<MeUser> & { password?: string } = {}): FakeUser {
    const id = `u${++n}`;
    const u: FakeUser = {
      password: p.password ?? 'violet-signal-2026',
      me: {
        id,
        username: p.username ?? `nova${n}`,
        displayName: p.displayName ?? 'Nova Rao',
        avatarUrl: null,
        isVerified: false,
        isPrivate: false,
        email: p.email ?? `nova${n}@example.com`,
        emailVerified: p.emailVerified ?? false,
        phone: p.phone ?? null,
        phoneVerified: false,
        hasPassword: true,
        bio: null,
        createdAt: new Date().toISOString(),
        needsProfileCompletion: p.needsProfileCompletion ?? false,
      },
    };
    users.set(id, u);
    return u;
  }

  function startSession(userId: string, deviceName = 'Test Phone'): FakeSession {
    const s: FakeSession = { id: `s${++n}`, userId, refresh: `refresh-${n}-${'x'.repeat(24)}`, access: `access-${n}`, revoked: false, deviceName };
    sessions.push(s);
    return s;
  }
  const authResponse = (u: FakeUser, s: FakeSession, extra: object = {}) => ({
    user: u.me,
    tokens: { accessToken: s.access, accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: s.refresh },
    ...extra,
  });
  const counts = (id: string) => ({
    followerCount: [...follows].filter(([k, v]) => k.endsWith(`->${id}`) && v === 'ACCEPTED').length,
    followingCount: [...follows].filter(([k, v]) => k.startsWith(`${id}->`) && v === 'ACCEPTED').length,
    postCount: 0,
  });
  const listItem = (viewer: string, u: FakeUser) => ({
    ...u.me,
    viewer: { isSelf: u.me.id === viewer, following: follows.get(`${viewer}->${u.me.id}`) ?? null, followsYou: follows.get(`${u.me.id}->${viewer}`) === 'ACCEPTED' },
  });
  const byIdentifier = (id: string) => [...users.values()].find((u) => [u.me.email, u.me.username, u.me.phone].includes(id.trim().toLowerCase()));

  const fetchImpl = (async (input: string, init: RequestInit = {}) => {
    if (state.offline) throw new TypeError('Network request failed');
    const url = new URL(input);
    if (url.hostname === 's3.test') return new Response(null, { status: 200 });
    if (url.protocol === 'file:' || url.hostname === 'photos.test') return new Response(new Blob([new Uint8Array(2048)], { type: 'image/jpeg' }), { status: 200 });
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const path = url.pathname;
    calls.push({ method, path, body });
    const auth = (init.headers as Record<string, string> | undefined)?.authorization?.replace('Bearer ', '');
    const session = sessions.find((s) => s.access === auth);

    // ---- public
    if (path === '/v1/health/ready') {
      return state.health === 'ok'
        ? json(200, { status: 'ok', checks: { database: { status: 'up', latencyMs: 3 }, redis: { status: 'up', latencyMs: 1 } } })
        : json(503, { status: 'degraded', checks: {} });
    }
    if (path === '/v1/auth/username-available') {
      const u = url.searchParams.get('username') ?? '';
      return json(200, { username: u, available: ![...users.values()].some((x) => x.me.username === u) });
    }
    if (path === '/v1/auth/signup' && method === 'POST') {
      if ([...users.values()].some((x) => x.me.username === body.username)) return err(409, 'USERNAME_TAKEN', 'That username is taken.', { field: 'username' });
      const u = addUser({ username: body.username, displayName: body.displayName, email: body.email ?? null, phone: body.phone ?? null, password: body.password });
      return json(201, authResponse(u, startSession(u.me.id), { verification: { channel: body.email ? 'email' : 'phone', sentTo: 'no••@example.com' } }));
    }
    if (path === '/v1/auth/login' && method === 'POST') {
      const u = byIdentifier(body.identifier);
      if (!u || u.password !== body.password) return err(401, 'AUTH_INVALID_CREDENTIALS', "That login didn't work. Check your details and try again.");
      return json(200, authResponse(u, startSession(u.me.id)));
    }
    if (path === '/v1/auth/code/request') return json(202, { sentTo: 'no••@example.com' });
    if (path === '/v1/auth/code/verify') {
      const u = byIdentifier(body.identifier);
      if (!u || body.code !== CODE) return err(400, 'OTP_INVALID', "That code isn't right.");
      return json(200, authResponse(u, startSession(u.me.id)));
    }
    if (path === '/v1/auth/password/forgot') return json(202, { sentTo: 'no••@example.com' });
    if (path === '/v1/auth/password/reset') {
      const u = byIdentifier(body.identifier);
      if (!u || body.code !== CODE) return err(400, 'OTP_INVALID', "That code isn't right.");
      u.password = body.newPassword;
      sessions.filter((s) => s.userId === u.me.id).forEach((s) => (s.revoked = true));
      return json(204);
    }
    if (path === '/v1/auth/refresh') {
      const s = sessions.find((x) => x.refresh === body.refreshToken && !x.revoked);
      if (!s) return err(401, 'AUTH_REFRESH_INVALID', 'Please sign in again.');
      s.refresh = `refresh-${++n}-${'y'.repeat(24)}`;
      s.access = `access-${n}`;
      return json(200, { accessToken: s.access, accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshToken: s.refresh });
    }

    // ---- authenticated
    if (!session || session.revoked) return err(401, auth ? 'AUTH_SESSION_REVOKED' : 'AUTH_REQUIRED', 'Please sign in.');
    if (state.expireNextAccess) {
      state.expireNextAccess = false;
      return err(401, 'AUTH_TOKEN_EXPIRED', 'Your session needs refreshing.');
    }
    const me = users.get(session.userId)!;
    const vid = me.me.id;
    if (path === '/v1/me') return json(200, { ...me.me, ...counts(vid) });

    // ---- social
    if (path === '/v1/users/search') {
      const q = (url.searchParams.get('q') ?? '').replace(/^@/, '').toLowerCase();
      const found = [...users.values()].filter((u) => !blocks.has(`${u.me.id}->${vid}`) && !blocks.has(`${vid}->${u.me.id}`) && (u.me.username.startsWith(q) || u.me.displayName.toLowerCase().includes(q)));
      return json(200, found.map((u) => listItem(vid, u)));
    }
    const userRoute = path.match(/^\/v1\/users\/([^/]+)(?:\/(follow|block|restrict|mute|followers|following))?$/);
    if (userRoute) {
      const [, key, action] = userRoute;
      const target = action ? users.get(key!) : [...users.values()].find((u) => u.me.username === key);
      if (!target || blocks.has(`${target.me.id}->${vid}`)) return err(404, 'NOT_FOUND', "This account doesn't exist.");
      const tid = target.me.id;
      if (!action) {
        const blocked = blocks.has(`${vid}->${tid}`);
        const following = follows.get(`${vid}->${tid}`) ?? null;
        return json(200, {
          ...target.me,
          ...counts(tid),
          coverUrl: null,
          website: null,
          canViewContent: !blocked && (tid === vid || !target.me.isPrivate || following === 'ACCEPTED'),
          viewer: {
            isSelf: tid === vid,
            following,
            followsYou: follows.get(`${tid}->${vid}`) === 'ACCEPTED',
            requestedYou: follows.get(`${tid}->${vid}`) === 'PENDING',
            blocked,
            restricted: flags.restrict.has(`${vid}->${tid}`),
            muted: flags.mute.has(`${vid}->${tid}`),
            closeFriend: flags.close.has(`${vid}->${tid}`),
          },
        });
      }
      if (action === 'follow') {
        if (method === 'POST') {
          const st = follows.get(`${vid}->${tid}`) ?? (target.me.isPrivate ? 'PENDING' : 'ACCEPTED');
          follows.set(`${vid}->${tid}`, st);
          return json(200, { following: st });
        }
        follows.delete(`${vid}->${tid}`);
        return json(200, { following: null });
      }
      if (action === 'block') {
        if (method === 'POST') {
          blocks.add(`${vid}->${tid}`);
          follows.delete(`${vid}->${tid}`);
          follows.delete(`${tid}->${vid}`);
        } else blocks.delete(`${vid}->${tid}`);
        return json(204);
      }
      if (action === 'restrict' || action === 'mute') {
        const set = action === 'restrict' ? flags.restrict : flags.mute;
        if (method === 'POST') set.add(`${vid}->${tid}`);
        else set.delete(`${vid}->${tid}`);
        return json(204);
      }
      const list = [...follows]
        .filter(([k, v]) => v === 'ACCEPTED' && (action === 'followers' ? k.endsWith(`->${tid}`) : k.startsWith(`${tid}->`)))
        .map(([k]) => users.get(action === 'followers' ? k.split('->')[0]! : k.split('->')[1]!)!);
      return json(200, { items: list.map((u) => listItem(vid, u)), nextCursor: null });
    }
    if (path === '/v1/me/profile' && method === 'PATCH') {
      if (body.website && !String(body.website).includes('.')) return err(400, 'VALIDATION_FAILED', 'Enter a valid website', { issues: [{ path: 'website', message: 'Enter a valid website, e.g. vybora.app' }] });
      const { avatarMediaId, coverMediaId, website, ...rest } = body;
      me.me = { ...me.me, ...rest };
      if (website !== undefined) me.me.website = website ? (String(website).startsWith('http') ? website : `https://${website}`) : null;
      if (avatarMediaId !== undefined) me.me.avatarUrl = avatarMediaId ? `http://cdn.test/m/${avatarMediaId}/lg.webp` : null;
      if (coverMediaId !== undefined) me.me.coverUrl = coverMediaId ? `http://cdn.test/m/${coverMediaId}/lg.webp` : null;
      if (body.isPrivate === false) for (const [k, v] of follows) if (k.endsWith(`->${vid}`) && v === 'PENDING') follows.set(k, 'ACCEPTED');
      return json(200, { ...me.me, ...counts(vid) });
    }
    if (path === '/v1/me/follow-requests') {
      const reqs = [...follows].filter(([k, v]) => k.endsWith(`->${vid}`) && v === 'PENDING').map(([k]) => users.get(k.split('->')[0]!)!);
      return json(200, { items: reqs.map((u) => listItem(vid, u)), nextCursor: null });
    }
    const req = path.match(/^\/v1\/me\/follow-requests\/([^/]+)(\/accept)?$/);
    if (req) {
      const k = `${req[1]}->${vid}`;
      if (follows.get(k) !== 'PENDING') return err(404, 'NOT_FOUND', 'Request not found.');
      if (req[2]) follows.set(k, 'ACCEPTED');
      else follows.delete(k);
      return json(204);
    }
    const cf = path.match(/^\/v1\/me\/close-friends(?:\/([^/]+))?$/);
    if (cf) {
      if (!cf[1]) return json(200, [...flags.close].filter((k) => k.startsWith(`${vid}->`)).map((k) => listItem(vid, users.get(k.split('->')[1]!)!)));
      if (method === 'PUT') flags.close.add(`${vid}->${cf[1]}`);
      else flags.close.delete(`${vid}->${cf[1]}`);
      return json(204);
    }
    if (path === '/v1/me/blocked') return json(200, [...blocks].filter((k) => k.startsWith(`${vid}->`)).map((k) => listItem(vid, users.get(k.split('->')[1]!)!)));

    // ---- media
    if (path === '/v1/media/uploads') {
      const id = `00000000-0000-7000-8000-${String(++n).padStart(12, '0')}`;
      media.set(id, { status: 'PENDING_UPLOAD', ownerId: vid });
      return json(201, { mediaId: id, uploadUrl: `http://s3.test/upload/${id}`, uploadHeaders: { 'content-type': body.mimeType }, expiresAt: new Date(Date.now() + 600_000).toISOString() });
    }
    const mm = path.match(/^\/v1\/media\/([^/]+)(\/complete)?$/);
    if (mm) {
      const m = media.get(mm[1]!);
      if (!m || m.ownerId !== vid) return err(404, 'NOT_FOUND', 'Media not found.');
      if (mm[2]) m.status = 'READY';
      return json(mm[2] ? 202 : 200, { id: mm[1], status: m.status, urls: m.status === 'READY' ? { sm: 'x', lg: 'y' } : {}, blurhash: null, width: 10, height: 10 });
    }
    if (path === '/v1/me/verify/send') return json(202, { sentTo: 'no••@example.com' });
    if (path === '/v1/me/verify') {
      if (body.code !== CODE) return err(400, 'OTP_INVALID', "That code isn't right.", { attemptsRemaining: 4 });
      me.me = { ...me.me, [body.channel === 'email' ? 'emailVerified' : 'phoneVerified']: true };
      return json(200, me.me);
    }
    if (path === '/v1/me/complete-profile') {
      me.me = { ...me.me, needsProfileCompletion: false, ...(body.username ? { username: body.username } : {}) };
      return json(200, me.me);
    }
    if (path === '/v1/auth/logout') {
      session.revoked = true;
      return json(204);
    }
    if (path === '/v1/auth/logout-all') {
      const mine = sessions.filter((s) => s.userId === me.me.id && !s.revoked);
      mine.forEach((s) => (s.revoked = true));
      return json(200, { signedOut: mine.length });
    }
    if (path === '/v1/auth/sessions' && method === 'GET') {
      const list: SessionInfo[] = sessions
        .filter((s) => s.userId === me.me.id && !s.revoked)
        .map((s) => ({ id: s.id, deviceName: s.deviceName, platform: 'IOS', appVersion: '0.1.0', ipCountry: 'IN', createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), current: s.id === session.id }));
      return json(200, list);
    }
    if (path.startsWith('/v1/auth/sessions/') && method === 'DELETE') {
      const target = sessions.find((s) => s.id === path.split('/').pop() && s.userId === me.me.id);
      if (!target) return err(404, 'NOT_FOUND', 'Session not found.');
      target.revoked = true;
      return json(204);
    }
    if (path === '/v1/auth/password/change') {
      if (body.currentPassword !== me.password) return err(401, 'AUTH_INVALID_CREDENTIALS', 'Your current password is incorrect.', { field: 'currentPassword' });
      me.password = body.newPassword;
      return json(200, { otherSessionsSignedOut: 0 });
    }
    if (path === '/v1/me/delete') {
      if (body.password !== me.password) return err(401, 'AUTH_INVALID_CREDENTIALS', 'Incorrect password.');
      sessions.filter((s) => s.userId === me.me.id).forEach((s) => (s.revoked = true));
      return json(202, { scheduledFor: new Date(Date.now() + 30 * 86_400_000).toISOString() });
    }
    return err(404, 'NOT_FOUND', `fake api: no route ${method} ${path}`);
  }) as unknown as typeof fetch;

  const follow = (a: string, b: string, status: 'ACCEPTED' | 'PENDING' = 'ACCEPTED') => follows.set(`${a}->${b}`, status);
  return { fetchImpl, users, sessions, calls, state, addUser, startSession, follow, follows, blocks, flags, media };
}
