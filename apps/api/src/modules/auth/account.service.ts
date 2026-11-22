import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { maskIdentifier } from '@vybora/shared';
import type { CodeSentResponse, MeUser } from '@vybora/types';
import { AppException } from '../../common/api-exception.filter.js';
import { AuditService } from '../../common/audit.service.js';
import type { ClientContext } from '../../common/client-context.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { Prisma, type User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { OtpService } from './otp.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { UserPresenter, WITH_MEDIA } from './user-view.js';

type Channel = 'email' | 'phone';

@Injectable()
export class AccountService {
  private readonly logger = new Logger('AccountService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly present: UserPresenter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private async user(userId: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  async me(userId: string): Promise<MeUser> {
    return this.present.me(await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: WITH_MEDIA }));
  }

  // ---------------------------------------------------------------- contact verification

  async sendVerification(userId: string, channel: Channel): Promise<CodeSentResponse> {
    const u = await this.user(userId);
    const target = channel === 'email' ? u.email : u.phone;
    if (!target) throw new AppException(HttpStatus.BAD_REQUEST, 'NO_CONTACT', `Add a${channel === 'email' ? 'n email' : ' phone number'} first.`);
    if (channel === 'email' ? u.emailVerifiedAt : u.phoneVerifiedAt) {
      throw new AppException(HttpStatus.CONFLICT, 'ALREADY_VERIFIED', 'Already verified.');
    }
    await this.otp.issue({ channel: channel === 'email' ? 'EMAIL' : 'SMS', target, purpose: channel === 'email' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE', userId });
    return { sentTo: maskIdentifier({ kind: channel, value: target }) };
  }

  async verifyContact(userId: string, channel: Channel, code: string, ctx: ClientContext): Promise<MeUser> {
    const u = await this.user(userId);
    const target = channel === 'email' ? u.email : u.phone;
    if (!target) throw new AppException(HttpStatus.BAD_REQUEST, 'NO_CONTACT', 'Nothing to verify.');
    await this.otp.verify(target, channel === 'email' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE', code);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: channel === 'email' ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
      include: WITH_MEDIA,
    });
    await this.audit.log(`account.${channel}_verified`, { actorId: userId, ctx });
    return this.present.me(updated);
  }

  // ---------------------------------------------------------------- profile completion (age gate for social sign-ups)

  async completeProfile(userId: string, input: { dateOfBirth: string; username?: string }): Promise<MeUser> {
    try {
      const u = await this.prisma.user.update({
        where: { id: userId },
        data: { dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`), ...(input.username ? { username: input.username } : {}) },
        include: WITH_MEDIA,
      });
      return this.present.me(u);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppException(HttpStatus.CONFLICT, 'USERNAME_TAKEN', 'That username is taken.', { field: 'username' });
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------- password change

  async changePassword(userId: string, sessionId: string, current: string, next: string, ctx: ClientContext): Promise<{ otherSessionsSignedOut: number }> {
    const u = await this.user(userId);
    if (!u.passwordHash) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'NO_PASSWORD', 'Your account uses Google or Apple sign-in. Use "Forgot password" to add a password.');
    }
    if (!(await this.passwords.verify(u.passwordHash, current))) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_INVALID_CREDENTIALS', 'Your current password is incorrect.', { field: 'currentPassword' });
    }
    await this.passwords.assertNotBreached(next);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.passwords.hash(next) } });
    const n = await this.sessions.revokeAll(userId, sessionId);
    await this.audit.log('auth.password_changed', { actorId: userId, ctx, metadata: { otherSessionsSignedOut: n } });
    return { otherSessionsSignedOut: n };
  }

  // ---------------------------------------------------------------- deletion (GDPR erasure with grace period)

  private deletionContact(u: User): { channel: 'EMAIL' | 'SMS'; target: string } | null {
    if (u.email && u.emailVerifiedAt) return { channel: 'EMAIL', target: u.email };
    if (u.phone && u.phoneVerifiedAt) return { channel: 'SMS', target: u.phone };
    return null;
  }

  async requestDeletionCode(userId: string): Promise<CodeSentResponse> {
    const u = await this.user(userId);
    const c = this.deletionContact(u);
    if (!c) throw new AppException(HttpStatus.BAD_REQUEST, 'NO_VERIFIED_CONTACT', 'Verify your email or phone first, or confirm with your password.');
    await this.otp.issue({ ...c, purpose: 'ACCOUNT_DELETION', userId });
    return { sentTo: maskIdentifier({ kind: c.channel === 'EMAIL' ? 'email' : 'phone', value: c.target }) };
  }

  /** Re-authenticates, then deactivates immediately and schedules erasure after the grace period. */
  async requestDeletion(userId: string, proof: { password?: string; code?: string }, ctx: ClientContext): Promise<{ scheduledFor: string }> {
    const u = await this.user(userId);
    if (proof.password) {
      if (!u.passwordHash || !(await this.passwords.verify(u.passwordHash, proof.password))) {
        throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_INVALID_CREDENTIALS', 'Incorrect password.', { field: 'password' });
      }
    } else {
      const c = this.deletionContact(u);
      if (!c || !proof.code) throw new AppException(HttpStatus.BAD_REQUEST, 'OTP_INVALID', "That code isn't right.");
      await this.otp.verify(c.target, 'ACCOUNT_DELETION', proof.code);
    }
    const scheduledFor = new Date(Date.now() + this.config.ACCOUNT_DELETION_GRACE_DAYS * 86_400_000);
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'PENDING_DELETION', deletionRequestedAt: new Date(), deletionScheduledAt: scheduledFor, tokenVersion: { increment: 1 } },
    });
    await this.sessions.revokeAll(userId);
    await this.audit.log('account.deletion_requested', { actorId: userId, ctx, metadata: { scheduledFor: scheduledFor.toISOString() } });
    return { scheduledFor: scheduledFor.toISOString() };
  }

  /**
   * Erases accounts whose grace period has ended. Deleting the user row cascades
   * to their content, sessions, messages-as-member etc.; financial records keep
   * the payment row with the user reference nulled (legal retention, de-identified).
   * Idempotent — safe if several API instances run it.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'account-purge', disabled: process.env.NODE_ENV === 'test' })
  async purgeDue(now = new Date()): Promise<{ purged: number; failed: number }> {
    const due = await this.prisma.user.findMany({
      where: { status: 'PENDING_DELETION', deletionScheduledAt: { lte: now } },
      select: { id: true },
      take: 500,
    });
    let purged = 0;
    let failed = 0;
    for (const { id } of due) {
      try {
        await this.prisma.user.delete({ where: { id } });
        await this.audit.log('account.purged', { actorType: 'SYSTEM', entityType: 'user', entityId: id });
        purged++;
      } catch (e) {
        // e.g. still owns a community (Restrict FK) — ownership transfer handled in Phase 11.
        failed++;
        this.logger.error({ err: e, userId: id }, 'account purge failed');
      }
    }
    return { purged, failed };
  }
}
