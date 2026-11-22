import { randomInt } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { maskIdentifier, parseIdentifier, type ParsedIdentifier } from '@vybora/shared';
import type { AuthResponse, CodeSentResponse } from '@vybora/types';
import type { z } from 'zod';
import type { signupSchema } from '@vybora/shared';
import { AppException } from '../../common/api-exception.filter.js';
import { AuditService } from '../../common/audit.service.js';
import type { ClientContext } from '../../common/client-context.js';
import { RateLimitService } from '../../common/rate-limit.service.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { Prisma, type User, type VerificationChannel } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { OtpService } from './otp.service.js';
import { PasswordService } from './password.service.js';
import { SessionService, type TokenPair } from './session.service.js';
import type { SocialProfile } from './social-auth.service.js';
import { sha256 } from './token.service.js';
import { UserPresenter, WITH_MEDIA } from './user-view.js';

export const LIMITS = {
  signupIp: { name: 'signup:ip', limit: 10, windowSec: 3600 },
  loginIp: { name: 'login:ip', limit: 30, windowSec: 900 },
  loginAccount: { name: 'login:acct', limit: 8, windowSec: 900 },
  codeIp: { name: 'code:ip', limit: 15, windowSec: 3600 },
  refreshIp: { name: 'refresh:ip', limit: 120, windowSec: 900 },
} as const;

type SignupInput = z.output<typeof signupSchema>;

interface ResolvedAccount {
  user: User;
  channel: VerificationChannel;
  target: string;
  verified: boolean;
}

const invalidCredentials = () =>
  new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_INVALID_CREDENTIALS', "That login didn't work. Check your details and try again.");

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly otp: OtpService,
    private readonly limits: RateLimitService,
    private readonly audit: AuditService,
    private readonly present: UserPresenter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ---------------------------------------------------------------- helpers

  private async findByIdentifier(id: ParsedIdentifier): Promise<User | null> {
    const where = id.kind === 'email' ? { email: id.value } : id.kind === 'phone' ? { phone: id.value } : { username: id.value };
    return this.prisma.user.findUnique({ where });
  }

  /** Picks the contact a code goes to: the one typed, or for usernames the best verified contact. */
  private async resolveAccount(identifier: string): Promise<{ parsed: ParsedIdentifier | null; account: ResolvedAccount | null }> {
    const parsed = parseIdentifier(identifier);
    if (!parsed) return { parsed, account: null };
    const user = await this.findByIdentifier(parsed);
    if (!user || user.status === 'DELETED') return { parsed, account: null };
    const email = user.email ? { channel: 'EMAIL' as const, target: user.email, verified: !!user.emailVerifiedAt } : null;
    const phone = user.phone ? { channel: 'SMS' as const, target: user.phone, verified: !!user.phoneVerifiedAt } : null;
    const pick =
      parsed.kind === 'email' ? email : parsed.kind === 'phone' ? phone : [email, phone].find((c) => c?.verified) ?? email ?? phone;
    return { parsed, account: pick ? { user, ...pick } : null };
  }

  private async completeLogin(user: User, ctx: ClientContext, method: string): Promise<AuthResponse> {
    if (user.status === 'SUSPENDED' && (!user.suspendedUntil || user.suspendedUntil > new Date())) {
      throw new AppException(HttpStatus.FORBIDDEN, 'AUTH_ACCOUNT_SUSPENDED', 'This account is suspended.');
    }
    if (user.status === 'DELETED' || user.status === 'DEACTIVATED') throw invalidCredentials();
    let restored = false;
    if (user.status === 'PENDING_DELETION') {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', deletionRequestedAt: null, deletionScheduledAt: null },
      });
      restored = true;
      await this.audit.log('account.deletion_cancelled', { actorId: user.id, ctx });
    }
    const tokens = await this.sessions.start(user, ctx);
    await this.audit.log('auth.login', { actorId: user.id, entityType: 'session', entityId: tokens.sessionId, ctx, metadata: { method } });
    const full = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: WITH_MEDIA });
    return { user: this.present.me(full), tokens: pickTokens(tokens), ...(restored ? { restored } : {}) };
  }

  // ---------------------------------------------------------------- sign-up

  async signup(input: SignupInput, ctx: ClientContext): Promise<AuthResponse> {
    await this.limits.hit(LIMITS.signupIp, ctx.ipHash);
    const taken = await this.prisma.user.findFirst({
      where: { OR: [{ username: input.username }, ...(input.email ? [{ email: input.email }] : []), ...(input.phone ? [{ phone: input.phone }] : [])] },
      select: { username: true, email: true, phone: true },
    });
    if (taken) throw conflictFor(taken, input);
    await this.passwords.assertNotBreached(input.password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email ?? null,
          phone: input.phone ?? null,
          username: input.username,
          displayName: input.displayName,
          dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`),
          passwordHash: await this.passwords.hash(input.password),
          settings: { create: {} },
        },
      });
    } catch (e) {
      // Lost a race with a concurrent sign-up for the same handle.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflictFor(null, input, e.meta);
      throw e;
    }
    await this.audit.log('auth.signup', { actorId: user.id, ctx, metadata: { via: input.email ? 'email' : 'phone' } });

    const channel: VerificationChannel = input.email ? 'EMAIL' : 'SMS';
    const target = (input.email ?? input.phone)!;
    this.otp.issueQuietly({ channel, target, purpose: input.email ? 'VERIFY_EMAIL' : 'VERIFY_PHONE', userId: user.id });

    const res = await this.completeLogin(user, ctx, 'password');
    return {
      ...res,
      verification: { channel: input.email ? 'email' : 'phone', sentTo: maskIdentifier({ kind: input.email ? 'email' : 'phone', value: target }) },
    };
  }

  async usernameAvailable(username: string): Promise<boolean> {
    return !(await this.prisma.user.findUnique({ where: { username }, select: { id: true } }));
  }

  // ---------------------------------------------------------------- password login

  async login(identifier: string, password: string, ctx: ClientContext): Promise<AuthResponse> {
    await this.limits.hit(LIMITS.loginIp, ctx.ipHash);
    const parsed = parseIdentifier(identifier);
    const acctKey = sha256(parsed?.value ?? identifier.toLowerCase());
    await this.limits.hit(LIMITS.loginAccount, acctKey);

    const user = parsed ? await this.findByIdentifier(parsed) : null;
    const ok = await this.passwords.verify(user?.passwordHash, password); // constant work even without a user
    if (!user || !ok || user.status === 'DELETED') {
      await this.audit.log('auth.login_failed', { actorId: user?.id ?? null, ctx });
      throw invalidCredentials();
    }
    await this.limits.reset(LIMITS.loginAccount, acctKey);
    return this.completeLogin(user, ctx, 'password');
  }

  // ---------------------------------------------------------------- one-time-code login

  async requestLoginCode(identifier: string, ctx: ClientContext): Promise<CodeSentResponse> {
    await this.limits.hit(LIMITS.codeIp, ctx.ipHash);
    const { parsed, account } = await this.resolveAccount(identifier);
    if (!parsed) throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Enter a valid email, phone or username.');
    // Codes only go to verified contacts; unknown accounts get the same response (no enumeration).
    if (account?.verified) {
      await this.otp.issue({ channel: account.channel, target: account.target, purpose: 'LOGIN_OTP', userId: account.user.id });
      return { sentTo: maskIdentifier({ kind: account.channel === 'EMAIL' ? 'email' : 'phone', value: account.target }) };
    }
    return { sentTo: maskIdentifier(parsed) };
  }

  async loginWithCode(identifier: string, code: string, ctx: ClientContext): Promise<AuthResponse> {
    await this.limits.hit(LIMITS.codeIp, ctx.ipHash);
    const { account } = await this.resolveAccount(identifier);
    if (!account?.verified) throw new AppException(HttpStatus.BAD_REQUEST, 'OTP_INVALID', "That code isn't right.");
    await this.otp.verify(account.target, 'LOGIN_OTP', code);
    return this.completeLogin(account.user, ctx, 'code');
  }

  // ---------------------------------------------------------------- password reset

  async forgotPassword(identifier: string, ctx: ClientContext): Promise<CodeSentResponse> {
    await this.limits.hit(LIMITS.codeIp, ctx.ipHash);
    const { parsed, account } = await this.resolveAccount(identifier);
    if (!parsed) throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Enter a valid email, phone or username.');
    if (account) {
      // Quietly: response and timing don't depend on whether the account exists.
      this.otp.issueQuietly({ channel: account.channel, target: account.target, purpose: 'PASSWORD_RESET', userId: account.user.id });
      return { sentTo: maskIdentifier({ kind: account.channel === 'EMAIL' ? 'email' : 'phone', value: account.target }) };
    }
    return { sentTo: maskIdentifier(parsed) };
  }

  async resetPassword(identifier: string, code: string, newPassword: string, ctx: ClientContext): Promise<void> {
    await this.limits.hit(LIMITS.codeIp, ctx.ipHash);
    const { account } = await this.resolveAccount(identifier);
    if (!account) throw new AppException(HttpStatus.BAD_REQUEST, 'OTP_INVALID', "That code isn't right.");
    await this.otp.verify(account.target, 'PASSWORD_RESET', code);
    await this.passwords.assertNotBreached(newPassword);
    const now = new Date();
    await this.prisma.user.update({
      where: { id: account.user.id },
      data: {
        passwordHash: await this.passwords.hash(newPassword),
        tokenVersion: { increment: 1 },
        // Receiving the code proves the user controls this contact.
        ...(account.channel === 'EMAIL' ? { emailVerifiedAt: account.user.emailVerifiedAt ?? now } : { phoneVerifiedAt: account.user.phoneVerifiedAt ?? now }),
      },
    });
    const revoked = await this.sessions.revokeAll(account.user.id);
    await this.audit.log('auth.password_reset', { actorId: account.user.id, ctx, metadata: { sessionsRevoked: revoked } });
  }

  // ---------------------------------------------------------------- tokens

  async refresh(refreshToken: string, ctx: ClientContext): Promise<TokenPair> {
    await this.limits.hit(LIMITS.refreshIp, ctx.ipHash);
    return this.sessions.rotate(refreshToken, ctx);
  }

  // ---------------------------------------------------------------- Google / Apple

  async socialSignIn(profile: SocialProfile, ctx: ClientContext): Promise<AuthResponse> {
    await this.limits.hit(LIMITS.loginIp, ctx.ipHash);
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider: profile.provider, providerUserId: profile.sub } },
      include: { user: true },
    });
    if (linked) return this.completeLogin(linked.user, ctx, profile.provider.toLowerCase());

    const verifiedEmail = profile.email && profile.emailVerified ? profile.email : null;
    if (verifiedEmail) {
      const existing = await this.prisma.user.findUnique({ where: { email: verifiedEmail } });
      if (existing?.emailVerifiedAt) {
        // Same verified email on both sides → same person: link and sign in.
        await this.prisma.oAuthAccount.create({ data: { userId: existing.id, provider: profile.provider, providerUserId: profile.sub, email: verifiedEmail } });
        await this.audit.log('auth.social_linked', { actorId: existing.id, ctx, metadata: { provider: profile.provider } });
        return this.completeLogin(existing, ctx, profile.provider.toLowerCase());
      }
      if (existing) {
        // An *unverified* claim on this email must not capture the provider-verified owner
        // (pre-registration takeover). The verified owner wins; the unverified claim is released.
        await this.prisma.user.update({ where: { id: existing.id }, data: { email: null } });
        await this.audit.log('auth.unverified_email_released', { actorType: 'SYSTEM', entityType: 'user', entityId: existing.id, ctx });
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email: verifiedEmail,
        emailVerifiedAt: verifiedEmail ? new Date() : null,
        username: await this.generateUsername(profile.name ?? verifiedEmail?.split('@')[0] ?? 'vybora'),
        displayName: (profile.name ?? verifiedEmail?.split('@')[0] ?? 'VYBORA member').slice(0, 50),
        settings: { create: {} },
        oauthAccounts: { create: { provider: profile.provider, providerUserId: profile.sub, email: profile.email } },
      },
    });
    await this.audit.log('auth.signup', { actorId: user.id, ctx, metadata: { via: profile.provider.toLowerCase() } });
    return this.completeLogin(user, ctx, profile.provider.toLowerCase());
  }

  private async generateUsername(seed: string): Promise<string> {
    const base =
      seed
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^a-z0-9._]/g, '')
        .replace(/^\.+|\.+$/g, '')
        .replace(/\.{2,}/g, '.')
        .slice(0, 20) || 'vybora';
    for (let i = 0; i < 6; i++) {
      const candidate = `${base.length < 3 ? `${base}user` : base}${i === 0 ? '' : randomInt(100, 99_999)}`;
      if (await this.usernameAvailable(candidate)) return candidate;
    }
    return `user${randomInt(1_000_000, 9_999_999)}`;
  }
}

function pickTokens(t: TokenPair): TokenPair {
  return { accessToken: t.accessToken, accessTokenExpiresAt: t.accessTokenExpiresAt, refreshToken: t.refreshToken };
}

function conflictFor(
  taken: { username: string; email: string | null; phone: string | null } | null,
  input: SignupInput,
  meta?: Record<string, unknown>,
): AppException {
  const target = JSON.stringify(meta ?? {});
  if (taken ? taken.username === input.username : target.includes('username')) {
    return new AppException(HttpStatus.CONFLICT, 'USERNAME_TAKEN', 'That username is taken.', { field: 'username' });
  }
  if (taken ? !!input.email && taken.email === input.email : target.includes('email')) {
    return new AppException(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'An account with this email already exists. Try logging in.', { field: 'email' });
  }
  return new AppException(HttpStatus.CONFLICT, 'PHONE_TAKEN', 'An account with this phone number already exists. Try logging in.', { field: 'phone' });
}
