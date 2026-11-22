import { createHash, randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import { AccountService } from '../../src/modules/auth/account.service.js';
import {
  APPLE_BUNDLE_ID,
  BREACHED_PASSWORD,
  cleanTestUsers,
  createHarness,
  DOB,
  GOOD_PASSWORD,
  type Harness,
  lastCode,
  uniq,
} from './harness.js';

/**
 * Authentication integration tests: real Postgres + Redis, real HTTP stack,
 * captured email/SMS, local Google/Apple signing keys.
 */
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
  await h.redis.client.flushdb(); // DB 15 only — resets rate-limit counters between tests
});

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(method: 'GET' | 'POST' | 'DELETE', url: string, opts: { body?: unknown; token?: string; headers?: Record<string, string> } = {}) {
  const res = await h.app.inject({
    method,
    url: `/v1${url}`,
    payload: opts.body as Json | undefined,
    headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...opts.headers },
  });
  return { status: res.statusCode, body: (res.body ? res.json() : undefined) as Json, headers: res.headers };
}

async function signupEmail(overrides: Json = {}) {
  const u = uniq();
  const res = await call('POST', '/auth/signup', {
    body: { email: u.email, password: GOOD_PASSWORD, username: u.username, displayName: 'Test User', dateOfBirth: DOB, ...overrides },
    headers: { 'x-client-platform': 'ios', 'x-device-name': "Nova's iPhone" },
  });
  return { ...u, res };
}

async function verifiedEmailUser() {
  const s = await signupEmail();
  const code = lastCode(h, s.email);
  const v = await call('POST', '/me/verify', { token: s.res.body.tokens.accessToken, body: { channel: 'email', code } });
  expect(v.status).toBe(200);
  return s;
}

// ------------------------------------------------------------------ sign-up

describe('sign-up', () => {
  it('creates an account, signs in, and sends an email verification code', async () => {
    const s = await signupEmail();
    expect(s.res.status).toBe(201);
    const b = s.res.body;
    expect(b.user).toMatchObject({ username: s.username, email: s.email, emailVerified: false, hasPassword: true, needsProfileCompletion: false });
    expect(b.user).not.toHaveProperty('passwordHash');
    expect(b.tokens.accessToken).toMatch(/^ey/);
    expect(b.tokens.refreshToken.length).toBeGreaterThan(30);
    expect(b.verification).toEqual({ channel: 'email', sentTo: expect.stringContaining('@example.com') });

    const code = lastCode(h, s.email);
    const v = await call('POST', '/me/verify', { token: b.tokens.accessToken, body: { channel: 'email', code } });
    expect(v.status).toBe(200);
    expect(v.body.emailVerified).toBe(true);

    // Stored securely: argon2id hash, hashed OTP, hashed refresh token.
    const row = await h.prisma.user.findUniqueOrThrow({ where: { email: s.email }, include: { sessions: { include: { refreshTokens: true } } } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.sessions[0]!.refreshTokens[0]!.tokenHash).not.toBe(b.tokens.refreshToken);
    expect(row.sessions[0]).toMatchObject({ platform: 'IOS', deviceName: "Nova's iPhone" });
    const otp = await h.prisma.verificationCode.findFirstOrThrow({ where: { target: s.email } });
    expect(otp.codeHash).not.toContain(code);
  });

  it('supports phone sign-up with SMS verification', async () => {
    const u = uniq();
    const res = await call('POST', '/auth/signup', {
      body: { phone: u.phone, password: GOOD_PASSWORD, username: u.username, displayName: 'Phone User', dateOfBirth: DOB },
    });
    expect(res.status).toBe(201);
    expect(res.body.verification.channel).toBe('phone');
    const code = lastCode(h, u.phone);
    expect(h.sms.sent.at(-1)!.body).toMatch(/^\d{6} is your VYBORA code/);
    const v = await call('POST', '/me/verify', { token: res.body.tokens.accessToken, body: { channel: 'phone', code } });
    expect(v.body.phoneVerified).toBe(true);
  });

  it('rejects duplicates, invalid input, mass-assignment and breached passwords', async () => {
    const s = await signupEmail();
    const dupUser = await call('POST', '/auth/signup', { body: { email: uniq().email, password: GOOD_PASSWORD, username: s.username, displayName: 'X', dateOfBirth: DOB } });
    expect(dupUser).toMatchObject({ status: 409, body: { code: 'USERNAME_TAKEN' } });
    const dupEmail = await call('POST', '/auth/signup', { body: { email: s.email.toUpperCase(), password: GOOD_PASSWORD, username: uniq().username, displayName: 'X', dateOfBirth: DOB } });
    expect(dupEmail).toMatchObject({ status: 409, body: { code: 'EMAIL_TAKEN' } });

    const bad = await call('POST', '/auth/signup', { body: { email: 'nope', password: 'short', username: 'a', displayName: '', dateOfBirth: '2020-01-01' } });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
    expect(bad.body.details.issues.length).toBeGreaterThan(1);

    const escalate = await signupEmail({ role: 'STAFF', isVerified: true });
    expect(escalate.res).toMatchObject({ status: 400, body: { code: 'VALIDATION_FAILED' } });

    const breached = await signupEmail({ password: BREACHED_PASSWORD });
    expect(breached.res).toMatchObject({ status: 400, body: { code: 'PASSWORD_BREACHED' } });
  });

  it('reports username availability', async () => {
    const s = await signupEmail();
    expect((await call('GET', `/auth/username-available?username=${s.username.toUpperCase()}`)).body).toEqual({ username: s.username, available: false });
    expect((await call('GET', `/auth/username-available?username=${uniq().username}`)).body.available).toBe(true);
    expect((await call('GET', '/auth/username-available?username=admin')).body).toMatchObject({ available: false, reason: 'That username is reserved.' });
  });
});

// ------------------------------------------------------------------ login

describe('login', () => {
  it('works with email, username or phone', async () => {
    const s = await signupEmail();
    for (const identifier of [s.email, s.username, s.username.toUpperCase()]) {
      const r = await call('POST', '/auth/login', { body: { identifier, password: GOOD_PASSWORD } });
      expect(r.status).toBe(200);
      expect(r.body.user.id).toBe(s.res.body.user.id);
    }
    const u = uniq();
    await call('POST', '/auth/signup', { body: { phone: u.phone, password: GOOD_PASSWORD, username: u.username, displayName: 'P', dateOfBirth: DOB } });
    const byPhone = await call('POST', '/auth/login', { body: { identifier: u.phone.replace('+1', '+1 '), password: GOOD_PASSWORD } });
    expect(byPhone.status).toBe(200);
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    const s = await signupEmail();
    const wrong = await call('POST', '/auth/login', { body: { identifier: s.email, password: 'not-the-password' } });
    const unknown = await call('POST', '/auth/login', { body: { identifier: `nobody.${Date.now()}@example.com`, password: 'not-the-password' } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('locks an account after repeated failures (429 + Retry-After) and audits it', async () => {
    const s = await signupEmail();
    for (let i = 0; i < 8; i++) {
      expect((await call('POST', '/auth/login', { body: { identifier: s.email, password: 'wrong-wrong-1' } })).status).toBe(401);
    }
    const locked = await call('POST', '/auth/login', { body: { identifier: s.email, password: GOOD_PASSWORD } });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('RATE_LIMITED');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    const fails = await h.prisma.auditLog.count({ where: { action: 'auth.login_failed', actorId: s.res.body.user.id } });
    expect(fails).toBe(8);
  });

  it('blocks suspended accounts', async () => {
    const s = await signupEmail();
    await h.prisma.user.update({ where: { id: s.res.body.user.id }, data: { status: 'SUSPENDED' } });
    const r = await call('POST', '/auth/login', { body: { identifier: s.email, password: GOOD_PASSWORD } });
    expect(r).toMatchObject({ status: 403, body: { code: 'AUTH_ACCOUNT_SUSPENDED' } });
    // An existing session stops working immediately too.
    const me = await call('GET', '/me', { token: s.res.body.tokens.accessToken });
    expect(me).toMatchObject({ status: 403, body: { code: 'AUTH_ACCOUNT_SUSPENDED' } });
  });
});

// ------------------------------------------------------------------ access tokens

describe('access tokens', () => {
  it('protects routes by default', async () => {
    expect(await call('GET', '/me')).toMatchObject({ status: 401, body: { code: 'AUTH_REQUIRED' } });
    expect(await call('GET', '/me', { token: 'garbage' })).toMatchObject({ status: 401, body: { code: 'AUTH_TOKEN_INVALID' } });
  });

  it('distinguishes expired tokens so the app knows to refresh', async () => {
    const s = await signupEmail();
    const { sub, sid, ver, role } = JSON.parse(Buffer.from(s.res.body.tokens.accessToken.split('.')[1], 'base64url').toString());
    const expired = await new SignJWT({ sid, ver, role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sub)
      .setIssuer('vybora-api')
      .setAudience('vybora-app')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(h.config.JWT_ACCESS_SECRET));
    expect(await call('GET', '/me', { token: expired })).toMatchObject({ status: 401, body: { code: 'AUTH_TOKEN_EXPIRED' } });

    const forged = await new SignJWT({ sid, ver, role }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuer('vybora-api').setAudience('vybora-app').setExpirationTime('5m').sign(new TextEncoder().encode('x'.repeat(48)));
    expect(await call('GET', '/me', { token: forged })).toMatchObject({ status: 401, body: { code: 'AUTH_TOKEN_INVALID' } });
  });
});

// ------------------------------------------------------------------ refresh rotation

describe('refresh token rotation', () => {
  it('rotates on every use', async () => {
    const s = await signupEmail();
    const r1 = await call('POST', '/auth/refresh', { body: { refreshToken: s.res.body.tokens.refreshToken } });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(s.res.body.tokens.refreshToken);
    expect((await call('GET', '/me', { token: r1.body.accessToken })).status).toBe(200);
    const r2 = await call('POST', '/auth/refresh', { body: { refreshToken: r1.body.refreshToken } });
    expect(r2.status).toBe(200);
  });

  it('TOKEN THEFT: replaying a used refresh token revokes the whole session', async () => {
    const s = await signupEmail();
    const stolen = s.res.body.tokens.refreshToken;

    // Legitimate app refreshes first…
    const legit = await call('POST', '/auth/refresh', { body: { refreshToken: stolen } });
    expect(legit.status).toBe(200);

    // …then the attacker replays the stolen (already used) token.
    const attack = await call('POST', '/auth/refresh', { body: { refreshToken: stolen } });
    expect(attack).toMatchObject({ status: 401, body: { code: 'AUTH_REFRESH_REUSED' } });

    // The whole token family is dead: the legit app's new tokens stop working too.
    expect((await call('POST', '/auth/refresh', { body: { refreshToken: legit.body.refreshToken } })).status).toBe(401);
    expect(await call('GET', '/me', { token: legit.body.accessToken })).toMatchObject({ status: 401, body: { code: 'AUTH_SESSION_REVOKED' } });

    const audit = await h.prisma.auditLog.findFirst({ where: { action: 'auth.refresh_reuse_detected', actorId: s.res.body.user.id } });
    expect(audit).not.toBeNull();
  });

  it('lets exactly one of two concurrent refreshes win', async () => {
    const s = await signupEmail();
    const [a, b] = await Promise.all([
      call('POST', '/auth/refresh', { body: { refreshToken: s.res.body.tokens.refreshToken } }),
      call('POST', '/auth/refresh', { body: { refreshToken: s.res.body.tokens.refreshToken } }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 401]);
  });

  it('rejects unknown tokens', async () => {
    expect(await call('POST', '/auth/refresh', { body: { refreshToken: randomBytes(32).toString('base64url') } })).toMatchObject({ status: 401, body: { code: 'AUTH_REFRESH_INVALID' } });
  });
});

// ------------------------------------------------------------------ sessions & logout

describe('sessions and logout', () => {
  it('logout kills the access token immediately and the refresh token', async () => {
    const s = await signupEmail();
    const t = s.res.body.tokens;
    expect((await call('POST', '/auth/logout', { token: t.accessToken })).status).toBe(204);
    expect(await call('GET', '/me', { token: t.accessToken })).toMatchObject({ status: 401, body: { code: 'AUTH_SESSION_REVOKED' } });
    expect((await call('POST', '/auth/refresh', { body: { refreshToken: t.refreshToken } })).status).toBe(401);
  });

  it('lists devices, revokes one, and cannot touch another user’s sessions', async () => {
    const s = await signupEmail();
    const phone = s.res.body.tokens;
    const laptop = (await call('POST', '/auth/login', { body: { identifier: s.email, password: GOOD_PASSWORD }, headers: { 'x-client-platform': 'web', 'x-device-name': 'Chrome <script>' } })).body.tokens;

    const list = await call('GET', '/auth/sessions', { token: phone.accessToken });
    expect(list.body).toHaveLength(2);
    expect(list.body.filter((x: Json) => x.current)).toHaveLength(1);
    const web = list.body.find((x: Json) => x.platform === 'WEB');
    expect(web.deviceName).toBe('Chrome script'); // sanitized
    expect(web).not.toHaveProperty('ipHash');

    expect((await call('DELETE', `/auth/sessions/${web.id}`, { token: phone.accessToken })).status).toBe(204);
    expect((await call('GET', '/me', { token: laptop.accessToken })).status).toBe(401);
    expect((await call('GET', '/me', { token: phone.accessToken })).status).toBe(200);

    const other = await signupEmail();
    const otherSession = (await call('GET', '/auth/sessions', { token: other.res.body.tokens.accessToken })).body[0].id;
    expect((await call('DELETE', `/auth/sessions/${otherSession}`, { token: phone.accessToken })).status).toBe(404);
    expect((await call('GET', '/me', { token: other.res.body.tokens.accessToken })).status).toBe(200);
  });

  it('logout-all signs out every device', async () => {
    const s = await signupEmail();
    const second = (await call('POST', '/auth/login', { body: { identifier: s.email, password: GOOD_PASSWORD } })).body.tokens;
    const r = await call('POST', '/auth/logout-all', { token: s.res.body.tokens.accessToken });
    expect(r.body.signedOut).toBe(2);
    expect((await call('GET', '/me', { token: second.accessToken })).status).toBe(401);
    expect((await call('GET', '/me', { token: s.res.body.tokens.accessToken })).status).toBe(401);
  });
});

// ------------------------------------------------------------------ one-time-code login

describe('sign-in with a one-time code', () => {
  it('only sends codes to verified contacts, without revealing which accounts exist', async () => {
    const unverified = await signupEmail();
    const before = h.mail.sent.length;
    const r = await call('POST', '/auth/code/request', { body: { identifier: unverified.email } });
    expect(r.status).toBe(202);
    const unknown = await call('POST', '/auth/code/request', { body: { identifier: `ghost.${Date.now()}@example.com` } });
    expect(unknown.status).toBe(202);
    expect(Object.keys(unknown.body)).toEqual(Object.keys(r.body));
    expect(h.mail.sent.length).toBe(before); // nothing sent for unverified or unknown
  });

  it('signs in with a valid code; codes are single-use', async () => {
    const s = await verifiedEmailUser();
    const req = await call('POST', '/auth/code/request', { body: { identifier: s.username } });
    expect(req.body.sentTo).toMatch(/@example\.com$/);
    const code = lastCode(h, s.email);
    const ok = await call('POST', '/auth/code/verify', { body: { identifier: s.username, code } });
    expect(ok.status).toBe(200);
    expect(ok.body.user.id).toBe(s.res.body.user.id);
    expect(await call('POST', '/auth/code/verify', { body: { identifier: s.username, code } })).toMatchObject({ status: 400, body: { code: 'OTP_INVALID' } });
  });

  it('enforces a resend cooldown and locks a code after 5 wrong attempts', async () => {
    const s = await verifiedEmailUser();
    await call('POST', '/auth/code/request', { body: { identifier: s.email } });
    const again = await call('POST', '/auth/code/request', { body: { identifier: s.email } });
    expect(again).toMatchObject({ status: 429, body: { code: 'OTP_COOLDOWN' } });
    expect(Number(again.headers['retry-after'])).toBeGreaterThan(0);

    const code = lastCode(h, s.email);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 4; i >= 0; i--) {
      const r = await call('POST', '/auth/code/verify', { body: { identifier: s.email, code: wrong } });
      expect(r.body).toMatchObject({ code: 'OTP_INVALID', details: { attemptsRemaining: i } });
    }
    const locked = await call('POST', '/auth/code/verify', { body: { identifier: s.email, code } });
    expect(locked.body.code).toBe('OTP_TOO_MANY_ATTEMPTS');
  });

  it('rejects expired codes', async () => {
    const s = await verifiedEmailUser();
    await call('POST', '/auth/code/request', { body: { identifier: s.email } });
    const code = lastCode(h, s.email);
    await h.prisma.verificationCode.updateMany({ where: { target: s.email, purpose: 'LOGIN_OTP' }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call('POST', '/auth/code/verify', { body: { identifier: s.email, code } })).body.code).toBe('OTP_EXPIRED');
  });
});

// ------------------------------------------------------------------ password reset & change

describe('password reset', () => {
  it('resets with an emailed code, signs out every device, and the code is single-use', async () => {
    const s = await signupEmail(); // unverified email can still recover the account
    const other = (await call('POST', '/auth/login', { body: { identifier: s.email, password: GOOD_PASSWORD } })).body.tokens;

    const f = await call('POST', '/auth/password/forgot', { body: { identifier: s.username } });
    expect(f.status).toBe(202);
    await new Promise((r) => setTimeout(r, 50)); // delivery is fire-and-forget
    const code = lastCode(h, s.email);

    const newPassword = 'brand-new-signal-77';
    expect((await call('POST', '/auth/password/reset', { body: { identifier: s.username, code, newPassword } })).status).toBe(204);
    expect((await call('GET', '/me', { token: other.accessToken })).status).toBe(401);
    expect((await call('POST', '/auth/login', { body: { identifier: s.email, password: GOOD_PASSWORD } })).status).toBe(401);
    const login = await call('POST', '/auth/login', { body: { identifier: s.email, password: newPassword } });
    expect(login.status).toBe(200);
    expect(login.body.user.emailVerified).toBe(true); // proving possession of the inbox verifies it
    expect((await call('POST', '/auth/password/reset', { body: { identifier: s.username, code, newPassword: 'another-signal-88' } })).body.code).toBe('OTP_INVALID');
  });

  it('answers identically for unknown accounts and sends nothing', async () => {
    const before = h.mail.sent.length + h.sms.sent.length;
    const r = await call('POST', '/auth/password/forgot', { body: { identifier: `ghost.${Date.now()}@example.com` } });
    expect(r.status).toBe(202);
    expect(r.body.sentTo).toMatch(/@example\.com$/);
    await new Promise((res) => setTimeout(res, 50));
    expect(h.mail.sent.length + h.sms.sent.length).toBe(before);
  });
});

describe('password change', () => {
  it('requires the current password and signs out other devices only', async () => {
    const s = await signupEmail();
    const other = (await call('POST', '/auth/login', { body: { identifier: s.email, password: GOOD_PASSWORD } })).body.tokens;
    const token = s.res.body.tokens.accessToken;
    expect((await call('POST', '/auth/password/change', { token, body: { currentPassword: 'wrong-password-x', newPassword: 'fresh-signal-2027' } })).status).toBe(401);
    expect((await call('POST', '/auth/password/change', { token, body: { currentPassword: GOOD_PASSWORD, newPassword: BREACHED_PASSWORD } })).body.code).toBe('PASSWORD_BREACHED');
    const ok = await call('POST', '/auth/password/change', { token, body: { currentPassword: GOOD_PASSWORD, newPassword: 'fresh-signal-2027' } });
    expect(ok.body).toEqual({ otherSessionsSignedOut: 1 });
    expect((await call('GET', '/me', { token })).status).toBe(200);
    expect((await call('GET', '/me', { token: other.accessToken })).status).toBe(401);
  });
});

// ------------------------------------------------------------------ account deletion

describe('account deletion', () => {
  it('re-authenticates, signs out, can be cancelled by signing in, then purges after the grace period', async () => {
    const s = await signupEmail();
    const token = s.res.body.tokens.accessToken;
    expect((await call('POST', '/me/delete', { token, body: { password: 'wrong-password-x' } })).status).toBe(401);
    const del = await call('POST', '/me/delete', { token, body: { password: GOOD_PASSWORD } });
    expect(del.status).toBe(202);
    const days = (Date.parse(del.body.scheduledFor) - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    expect((await call('GET', '/me', { token })).status).toBe(401);

    // Signing in during the grace period restores the account.
    const back = await call('POST', '/auth/login', { body: { identifier: s.email, password: GOOD_PASSWORD } });
    expect(back.body.restored).toBe(true);
    const row = await h.prisma.user.findUniqueOrThrow({ where: { id: s.res.body.user.id } });
    expect(row).toMatchObject({ status: 'ACTIVE', deletionScheduledAt: null });

    // Delete again and run the purge as if 31 days passed.
    await call('POST', '/me/delete', { token: back.body.tokens.accessToken, body: { password: GOOD_PASSWORD } });
    const purge = await h.app.get(AccountService).purgeDue(new Date(Date.now() + 31 * 86_400_000));
    expect(purge.purged).toBeGreaterThanOrEqual(1);
    expect(await h.prisma.user.findUnique({ where: { id: s.res.body.user.id } })).toBeNull();
    expect(await h.prisma.session.count({ where: { userId: s.res.body.user.id } })).toBe(0);
    expect((await call('POST', '/auth/login', { body: { identifier: s.email, password: GOOD_PASSWORD } })).status).toBe(401);
    expect(await h.prisma.auditLog.findFirst({ where: { action: 'account.purged', entityId: s.res.body.user.id } })).not.toBeNull();
  });

  it('accepts an emailed code instead of a password', async () => {
    const s = await verifiedEmailUser();
    const token = s.res.body.tokens.accessToken;
    expect((await call('POST', '/me/delete/code', { token })).status).toBe(202);
    const code = lastCode(h, s.email);
    expect((await call('POST', '/me/delete', { token, body: { code } })).status).toBe(202);
  });
});

// ------------------------------------------------------------------ Google & Apple

describe('Google sign-in', () => {
  it('creates an account, then signs the same Google user back in', async () => {
    const sub = `test-g-${Date.now()}`;
    const idToken = await h.google.sign({ sub, email: `g.${sub}@example.com`, email_verified: true, name: 'Gita Rao' });
    const first = await call('POST', '/auth/oauth/google', { body: { idToken } });
    expect(first.status).toBe(200);
    expect(first.body.user).toMatchObject({ displayName: 'Gita Rao', emailVerified: true, hasPassword: false, needsProfileCompletion: true });
    expect(first.body.user.username).toMatch(/^gitarao/);

    // Age gate for social sign-ups.
    const token = first.body.tokens.accessToken;
    expect((await call('POST', '/me/complete-profile', { token, body: { dateOfBirth: '2020-01-01' } })).status).toBe(400);
    const done = await call('POST', '/me/complete-profile', { token, body: { dateOfBirth: DOB } });
    expect(done.body.needsProfileCompletion).toBe(false);

    const again = await call('POST', '/auth/oauth/google', { body: { idToken: await h.google.sign({ sub, email: `g.${sub}@example.com`, email_verified: true }) } });
    expect(again.body.user.id).toBe(first.body.user.id);
  });

  it('links to an existing account only when both sides verified the email', async () => {
    const s = await verifiedEmailUser();
    const sub = `test-g-link-${Date.now()}`;
    const r = await call('POST', '/auth/oauth/google', { body: { idToken: await h.google.sign({ sub, email: s.email, email_verified: true }) } });
    expect(r.body.user.id).toBe(s.res.body.user.id);
  });

  it('does not let an unverified pre-registration capture a Google-verified email', async () => {
    const attacker = await signupEmail(); // claims the victim's email, never verifies it
    const sub = `test-g-victim-${Date.now()}`;
    const r = await call('POST', '/auth/oauth/google', { body: { idToken: await h.google.sign({ sub, email: attacker.email, email_verified: true, name: 'Victim' }) } });
    expect(r.status).toBe(200);
    expect(r.body.user.id).not.toBe(attacker.res.body.user.id);
    expect(r.body.user.email).toBe(attacker.email);
    const attackerRow = await h.prisma.user.findUniqueOrThrow({ where: { id: attacker.res.body.user.id } });
    expect(attackerRow.email).toBeNull();
  });

  it('rejects tokens for another app, from another issuer, or expired', async () => {
    const claims = { sub: `test-g-bad-${Date.now()}`, email_verified: true };
    for (const idToken of [
      await h.google.sign(claims, { aud: 'someone-elses-app.apps.googleusercontent.com' }),
      await h.google.sign(claims, { iss: 'https://evil.example.com' }),
      await h.google.sign(claims, { expSec: -60 }),
    ]) {
      expect(await call('POST', '/auth/oauth/google', { body: { idToken } })).toMatchObject({ status: 401, body: { code: 'AUTH_SOCIAL_INVALID' } });
    }
  });
});

describe('Apple sign-in', () => {
  it('verifies the nonce and accepts Apple’s string email_verified', async () => {
    const nonce = randomBytes(16).toString('hex');
    const sub = `test-a-${Date.now()}`;
    const identityToken = await h.apple.sign({ sub, email: `a.${sub}@example.com`, email_verified: 'true', nonce: createHash('sha256').update(nonce).digest('hex') }, { aud: APPLE_BUNDLE_ID });
    const ok = await call('POST', '/auth/oauth/apple', { body: { identityToken, nonce, fullName: 'Arjun Mehta' } });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ displayName: 'Arjun Mehta', emailVerified: true });

    const replay = await call('POST', '/auth/oauth/apple', { body: { identityToken, nonce: randomBytes(16).toString('hex') } });
    expect(replay).toMatchObject({ status: 401, body: { code: 'AUTH_SOCIAL_INVALID' } });
  });
});
