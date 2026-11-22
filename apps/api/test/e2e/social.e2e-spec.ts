import sharp from 'sharp';
import type { Visibility } from '../../src/generated/prisma/client.js';
import { VisibilityService } from '../../src/modules/social/visibility.service.js';
import { cleanTestUsers, createHarness, DOB, GOOD_PASSWORD, type Harness, uniq } from './harness.js';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
  await cleanTestUsers(h.prisma);
});
afterAll(async () => {
  await cleanTestUsers(h.prisma);
  await h.close();
});
beforeEach(async () => {
  await h.redis.client.flushdb();
});

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface U {
  id: string;
  username: string;
  token: string;
}

async function user(opts: { private?: boolean; name?: string } = {}): Promise<U> {
  const u = uniq();
  const r = await h.app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { email: u.email, password: GOOD_PASSWORD, username: u.username, displayName: opts.name ?? 'Test Person', dateOfBirth: DOB },
  });
  const body = r.json();
  const me = { id: body.user.id, username: body.user.username, token: body.tokens.accessToken };
  if (opts.private) await api(me, 'PATCH', '/me/profile', { isPrivate: true });
  return me;
}

async function api(as: U, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, body?: unknown) {
  const r = await h.app.inject({ method, url: `/v1${url}`, payload: body as Json, headers: { authorization: `Bearer ${as.token}` } });
  return { status: r.statusCode, body: (r.body ? r.json() : undefined) as Json };
}
const profile = async (as: U, of: U) => api(as, 'GET', `/users/${of.username}`);
const counts = async (u: U) => h.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { followerCount: true, followingCount: true } });

// ------------------------------------------------------------------ visibility matrix

describe('VisibilityService policy matrix', () => {
  type Viewer = 'self' | 'stranger' | 'pending' | 'follower' | 'closeFriend' | 'blockedByOwner' | 'blocksOwner';
  type Row = { account: 'public' | 'private'; viewer: Viewer; profile: boolean; content: boolean; items: Partial<Record<Visibility, boolean>> };

  const T = true;
  const F = false;
  // Expected results: profile visible, content visible, and per-item audience.
  const matrix: Row[] = [
    { account: 'public', viewer: 'self', profile: T, content: T, items: { PUBLIC: T, FOLLOWERS: T, CLOSE_FRIENDS: T, SUBSCRIBERS: T } },
    { account: 'public', viewer: 'stranger', profile: T, content: T, items: { PUBLIC: T, FOLLOWERS: F, CLOSE_FRIENDS: F, SUBSCRIBERS: F } },
    { account: 'public', viewer: 'pending', profile: T, content: T, items: { PUBLIC: T, FOLLOWERS: F, CLOSE_FRIENDS: F } },
    { account: 'public', viewer: 'follower', profile: T, content: T, items: { PUBLIC: T, FOLLOWERS: T, CLOSE_FRIENDS: F } },
    { account: 'public', viewer: 'closeFriend', profile: T, content: T, items: { PUBLIC: T, FOLLOWERS: T, CLOSE_FRIENDS: T } },
    { account: 'public', viewer: 'blockedByOwner', profile: F, content: F, items: { PUBLIC: F, FOLLOWERS: F } },
    { account: 'public', viewer: 'blocksOwner', profile: T, content: F, items: { PUBLIC: F, FOLLOWERS: F } },
    { account: 'private', viewer: 'self', profile: T, content: T, items: { PUBLIC: T, FOLLOWERS: T, CLOSE_FRIENDS: T } },
    { account: 'private', viewer: 'stranger', profile: T, content: F, items: { PUBLIC: F, FOLLOWERS: F, CLOSE_FRIENDS: F } },
    { account: 'private', viewer: 'pending', profile: T, content: F, items: { PUBLIC: F, FOLLOWERS: F } },
    { account: 'private', viewer: 'follower', profile: T, content: T, items: { PUBLIC: T, FOLLOWERS: T, CLOSE_FRIENDS: F } },
    { account: 'private', viewer: 'closeFriend', profile: T, content: T, items: { PUBLIC: T, FOLLOWERS: T, CLOSE_FRIENDS: T } },
    { account: 'private', viewer: 'blockedByOwner', profile: F, content: F, items: { PUBLIC: F } },
    { account: 'private', viewer: 'blocksOwner', profile: T, content: F, items: { PUBLIC: F } },
  ];

  it.each(matrix)('$account account · viewer=$viewer', async ({ account, viewer, profile: canProfile, content, items }) => {
    const vis = h.app.get(VisibilityService);
    const owner = await user({ private: account === 'private' });
    const v = viewer === 'self' ? owner : await user();

    if (viewer === 'pending' || viewer === 'follower' || viewer === 'closeFriend') {
      await api(v, 'POST', `/users/${owner.id}/follow`);
      if (account === 'private' && viewer !== 'pending') await api(owner, 'POST', `/me/follow-requests/${v.id}/accept`);
      if (account === 'public' && viewer === 'pending') {
        // A public account has no pending state; simulate a stale pending row.
        await h.prisma.follow.update({ where: { followerId_followingId: { followerId: v.id, followingId: owner.id } }, data: { status: 'PENDING' } });
      }
      if (viewer === 'closeFriend') await api(owner, 'PUT', `/me/close-friends/${v.id}`);
    }
    if (viewer === 'blockedByOwner') await api(owner, 'POST', `/users/${v.id}/block`);
    if (viewer === 'blocksOwner') await api(v, 'POST', `/users/${owner.id}/block`);

    const target = await h.prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    const rel = await vis.relationship(v.id, owner.id);
    const isCloseFriend = !!(await h.prisma.closeFriend.findUnique({ where: { ownerId_friendId: { ownerId: owner.id, friendId: v.id } } }));
    expect(vis.canSeeProfile(target, rel)).toBe(canProfile);
    expect(vis.canSeeContent(target, rel)).toBe(content);
    for (const [visibility, expected] of Object.entries(items)) {
      expect([visibility, vis.canSeeItem(target, rel, visibility as Visibility, isCloseFriend)]).toEqual([visibility, expected]);
    }

    // The HTTP surface agrees with the policy.
    const p = await profile(v, owner);
    expect(p.status).toBe(canProfile ? 200 : 404);
    if (canProfile) expect(p.body.canViewContent).toBe(content);
  });
});

// ------------------------------------------------------------------ follows

describe('follow graph', () => {
  it('follows a public account instantly, keeps counters exact, notifies, and unfollows', async () => {
    const [a, b] = [await user(), await user()];
    expect((await api(a, 'POST', `/users/${b.id}/follow`)).body).toEqual({ following: 'ACCEPTED' });
    expect((await api(a, 'POST', `/users/${b.id}/follow`)).body).toEqual({ following: 'ACCEPTED' }); // idempotent
    expect(await counts(a)).toEqual({ followerCount: 0, followingCount: 1 });
    expect(await counts(b)).toEqual({ followerCount: 1, followingCount: 0 });
    expect(await h.prisma.notification.count({ where: { recipientId: b.id, actorId: a.id, type: 'FOLLOW' } })).toBe(1);

    const p = await profile(a, b);
    expect(p.body.viewer).toMatchObject({ following: 'ACCEPTED', followsYou: false, isSelf: false });
    expect((await profile(b, a)).body.viewer.followsYou).toBe(true);

    await api(a, 'DELETE', `/users/${b.id}/follow`);
    expect(await counts(b)).toEqual({ followerCount: 0, followingCount: 0 });
    expect(await counts(a)).toEqual({ followerCount: 0, followingCount: 0 });
  });

  it('concurrent duplicate follows count once', async () => {
    const [a, b] = [await user(), await user()];
    await Promise.all([1, 2, 3].map(() => api(a, 'POST', `/users/${b.id}/follow`)));
    expect(await counts(b)).toEqual({ followerCount: 1, followingCount: 0 });
  });

  it('private accounts: request → hidden lists → accept → visible', async () => {
    const owner = await user({ private: true });
    const fan = await user();
    expect((await api(fan, 'POST', `/users/${owner.id}/follow`)).body).toEqual({ following: 'PENDING' });
    expect(await counts(owner)).toEqual({ followerCount: 0, followingCount: 0 });
    expect(await h.prisma.notification.count({ where: { recipientId: owner.id, type: 'FOLLOW_REQUEST' } })).toBe(1);

    const p = await profile(fan, owner);
    expect(p.body).toMatchObject({ isPrivate: true, canViewContent: false, viewer: { following: 'PENDING' } });
    expect((await api(fan, 'GET', `/users/${owner.id}/followers`)).body.code).toBe('PRIVATE_ACCOUNT');

    const requests = await api(owner, 'GET', '/me/follow-requests');
    expect(requests.body.items.map((x: Json) => x.id)).toEqual([fan.id]);
    expect((await profile(owner, fan)).body.viewer.requestedYou).toBe(true);

    expect((await api(owner, 'POST', `/me/follow-requests/${fan.id}/accept`)).status).toBe(204);
    expect((await api(owner, 'POST', `/me/follow-requests/${fan.id}/accept`)).status).toBe(404);
    expect(await counts(owner)).toEqual({ followerCount: 1, followingCount: 0 });
    expect(await h.prisma.notification.count({ where: { recipientId: fan.id, type: 'FOLLOW_ACCEPTED' } })).toBe(1);
    const list = await api(fan, 'GET', `/users/${owner.id}/followers`);
    expect(list.status).toBe(200);
    expect(list.body.items[0]).toMatchObject({ id: fan.id, viewer: { isSelf: true } });
  });

  it('decline, cancel and remove follower', async () => {
    const owner = await user({ private: true });
    const [x, y, z] = [await user(), await user(), await user()];
    await api(x, 'POST', `/users/${owner.id}/follow`);
    await api(y, 'POST', `/users/${owner.id}/follow`);
    await api(z, 'POST', `/users/${owner.id}/follow`);
    await api(owner, 'DELETE', `/me/follow-requests/${x.id}`); // decline
    await api(y, 'DELETE', `/users/${owner.id}/follow`); // cancel own request
    expect((await api(owner, 'GET', '/me/follow-requests')).body.items.map((u: Json) => u.id)).toEqual([z.id]);
    await api(owner, 'POST', `/me/follow-requests/${z.id}/accept`);
    await api(owner, 'DELETE', `/me/followers/${z.id}`);
    expect(await counts(owner)).toEqual({ followerCount: 0, followingCount: 0 });
    expect(await counts(z)).toEqual({ followerCount: 0, followingCount: 0 });
  });

  it('switching to public accepts every pending request', async () => {
    const owner = await user({ private: true });
    const fans = [await user(), await user(), await user()];
    for (const f of fans) await api(f, 'POST', `/users/${owner.id}/follow`);
    const r = await api(owner, 'PATCH', '/me/profile', { isPrivate: false });
    expect(r.body.followerCount).toBe(3);
    for (const f of fans) expect(await counts(f)).toEqual({ followerCount: 0, followingCount: 1 });
    expect((await api(owner, 'GET', '/me/follow-requests')).body.items).toEqual([]);
  });

  it('paginates followers with stable cursors', async () => {
    const owner = await user();
    const fans: U[] = [];
    for (let i = 0; i < 5; i++) {
      const f = await user();
      fans.push(f);
      await api(f, 'POST', `/users/${owner.id}/follow`);
    }
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: { body: Json } = await api(owner, 'GET', `/users/${owner.id}/followers?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      expect(page.body.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.body.items.map((u: Json) => u.id));
      cursor = page.body.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(fans.map((f) => f.id)));
    expect(seen[0]).toBe(fans[4]!.id); // newest first
  });

  it('rejects self-follow and unknown users', async () => {
    const a = await user();
    expect((await api(a, 'POST', `/users/${a.id}/follow`)).body.code).toBe('SELF_ACTION');
    expect((await api(a, 'POST', '/users/0190a000-0000-7000-8000-000000000999/follow')).status).toBe(404);
    expect((await api(a, 'POST', '/users/not-a-uuid/follow')).status).toBe(400);
  });
});

// ------------------------------------------------------------------ block / restrict / mute / close friends

describe('safety controls', () => {
  it('blocking severs follows both ways, hides each from the other, and is reversible', async () => {
    const [a, b] = [await user({ name: 'Blocker Ana' }), await user({ name: 'Blocked Bo' })];
    await api(a, 'POST', `/users/${b.id}/follow`);
    await api(b, 'POST', `/users/${a.id}/follow`);
    await api(a, 'PUT', `/me/close-friends/${b.id}`);

    expect((await api(a, 'POST', `/users/${b.id}/block`)).status).toBe(204);
    expect(await counts(a)).toEqual({ followerCount: 0, followingCount: 0 });
    expect(await counts(b)).toEqual({ followerCount: 0, followingCount: 0 });
    expect((await api(a, 'GET', '/me/close-friends')).body).toEqual([]);

    // The blocked user can't tell they were blocked — the profile just doesn't exist.
    const seenByB = await profile(b, a);
    expect(seenByB.status).toBe(404);
    expect(seenByB.body.message).toBe("This account doesn't exist.");
    expect((await api(b, 'POST', `/users/${a.id}/follow`)).status).toBe(404);
    expect((await api(b, 'GET', `/users/search?q=${a.username}`)).body).toEqual([]);
    expect((await api(a, 'GET', `/users/search?q=${b.username}`)).body).toEqual([]);

    // The blocker can still open the profile to unblock, but sees no content.
    const seenByA = await profile(a, b);
    expect(seenByA.body).toMatchObject({ canViewContent: false, viewer: { blocked: true } });
    expect((await api(a, 'GET', `/users/${b.id}/followers`)).body.code).toBe('BLOCKED');
    expect((await api(a, 'GET', '/me/blocked')).body.map((u: Json) => u.id)).toEqual([b.id]);
    expect((await api(a, 'POST', `/users/${b.id}/follow`)).body.code).toBe('BLOCKED');

    await api(a, 'DELETE', `/users/${b.id}/block`);
    expect((await profile(b, a)).status).toBe(200);
    expect((await profile(a, b)).body.viewer).toMatchObject({ blocked: false, following: null }); // follows aren't restored
  });

  it('hides blocked users from follower lists', async () => {
    const owner = await user();
    const [good, bad] = [await user(), await user()];
    await api(good, 'POST', `/users/${owner.id}/follow`);
    await api(bad, 'POST', `/users/${owner.id}/follow`);
    await api(good, 'POST', `/users/${bad.id}/block`);
    const list = await api(good, 'GET', `/users/${owner.id}/followers`);
    expect(list.body.items.map((u: Json) => u.id)).toEqual([good.id]);
  });

  it('restrict, mute and close friends are private flags on the relationship', async () => {
    const [a, b] = [await user(), await user()];
    await api(a, 'POST', `/users/${b.id}/restrict`);
    await api(a, 'POST', `/users/${b.id}/mute`);
    await api(a, 'PUT', `/me/close-friends/${b.id}`);
    expect((await profile(a, b)).body.viewer).toMatchObject({ restricted: true, muted: true, closeFriend: true });
    // b sees none of it
    expect((await profile(b, a)).body.viewer).toMatchObject({ restricted: false, muted: false, closeFriend: false });
    expect((await api(a, 'GET', '/me/close-friends')).body.map((u: Json) => u.id)).toEqual([b.id]);
    await api(a, 'DELETE', `/users/${b.id}/restrict`);
    await api(a, 'DELETE', `/users/${b.id}/mute`);
    await api(a, 'DELETE', `/me/close-friends/${b.id}`);
    expect((await profile(a, b)).body.viewer).toMatchObject({ restricted: false, muted: false, closeFriend: false });
  });
});

// ------------------------------------------------------------------ profiles

describe('profiles', () => {
  it('edits name, bio, website and username with validation', async () => {
    const a = await user();
    const r = await api(a, 'PATCH', '/me/profile', { displayName: ' Nova Rao ', bio: 'Making things that move', website: 'nova.dev' });
    expect(r.body).toMatchObject({ displayName: 'Nova Rao', bio: 'Making things that move', website: 'https://nova.dev' });
    expect((await api(a, 'PATCH', '/me/profile', { website: 'javascript:alert(1)' })).body.code).toBe('VALIDATION_FAILED');
    expect((await api(a, 'PATCH', '/me/profile', { isVerified: true })).body.code).toBe('VALIDATION_FAILED');

    const b = await user();
    expect((await api(a, 'PATCH', '/me/profile', { username: b.username })).body).toMatchObject({ code: 'USERNAME_TAKEN', details: { field: 'username' } });
    const newName = `u_new_${Date.now().toString(36)}`;
    expect((await api(a, 'PATCH', '/me/profile', { username: newName.toUpperCase() })).body.username).toBe(newName);
    expect((await api(b, 'GET', `/users/${newName}`)).body.id).toBe(a.id);
  });

  it('never exposes private fields on public profiles', async () => {
    const [a, b] = [await user(), await user()];
    const p = await profile(b, a);
    for (const k of ['email', 'phone', 'dateOfBirth', 'passwordHash', 'tokenVersion', 'emailVerified']) expect(p.body).not.toHaveProperty(k);
  });

  it('sets an avatar from a processed upload and rejects media it does not own', async () => {
    const a = await user();
    const jpeg = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#4F46E5' } }).jpeg().toBuffer();
    const t = (await api(a, 'POST', '/media/uploads', { purpose: 'avatar', mimeType: 'image/jpeg', sizeBytes: jpeg.length })).body;
    await fetch(t.uploadUrl, { method: 'PUT', headers: t.uploadHeaders, body: new Uint8Array(jpeg) });
    await api(a, 'POST', `/media/${t.mediaId}/complete`);
    for (let i = 0; i < 100 && (await api(a, 'GET', `/media/${t.mediaId}`)).body.status !== 'READY'; i++) await new Promise((r) => setTimeout(r, 100));

    const me = await api(a, 'PATCH', '/me/profile', { avatarMediaId: t.mediaId });
    expect(me.body.avatarUrl).toMatch(/\/m\/.+\/lg\.webp$/);
    expect(me.body.avatarBlurhash).toBeTruthy();

    const b = await user();
    expect((await api(b, 'PATCH', '/me/profile', { avatarMediaId: t.mediaId })).body.code).toBe('MEDIA_INVALID');
    expect((await api(a, 'PATCH', '/me/profile', { coverMediaId: t.mediaId })).body.code).toBe('MEDIA_INVALID'); // avatar asset can't be a cover
    expect((await profile(b, a)).body.avatarUrl).toBe(me.body.avatarUrl);
    expect((await api(a, 'PATCH', '/me/profile', { avatarMediaId: null })).body.avatarUrl).toBeNull();
  });

  it('hides accounts pending deletion and unknown usernames', async () => {
    const [a, b] = [await user(), await user()];
    await h.prisma.user.update({ where: { id: a.id }, data: { status: 'PENDING_DELETION' } });
    expect((await profile(b, a)).status).toBe(404);
    expect((await api(b, 'GET', '/users/nobody_here_zz')).status).toBe(404);
  });

  it('searches people by username prefix or name', async () => {
    const me = await user();
    const target = await user({ name: 'Zephyrina Quokka' });
    const byName = await api(me, 'GET', '/users/search?q=zephyrina');
    expect(byName.body.map((u: Json) => u.id)).toContain(target.id);
    const byHandle = await api(me, 'GET', `/users/search?q=@${target.username}`);
    expect(byHandle.body[0].id).toBe(target.id);
    expect((await api(me, 'GET', '/users/search?q=')).status).toBe(400);
  });
});
