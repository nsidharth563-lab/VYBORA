import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/api-exception.filter.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import type { VerificationChannel, VerificationPurpose } from '../../generated/prisma/client.js';
import { Mailer } from '../../infra/mailer/mailer.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SmsSender } from '../../infra/sms/sms.js';

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60_000;
export const OTP_MAX_PER_HOUR = 5;

const COPY: Record<VerificationPurpose, { subject: string; line: string }> = {
  VERIFY_EMAIL: { subject: 'Verify your email', line: 'Use this code to verify your email for VYBORA' },
  VERIFY_PHONE: { subject: 'Verify your phone', line: 'Your VYBORA verification code' },
  LOGIN_OTP: { subject: 'Your sign-in code', line: 'Use this code to sign in to VYBORA' },
  PASSWORD_RESET: { subject: 'Reset your password', line: 'Use this code to reset your VYBORA password' },
  ACCOUNT_DELETION: { subject: 'Confirm account deletion', line: 'Use this code to confirm deleting your VYBORA account' },
  CHANGE_EMAIL: { subject: 'Confirm your new email', line: 'Use this code to confirm your new email for VYBORA' },
  CHANGE_PHONE: { subject: 'Confirm your new phone', line: 'Your VYBORA confirmation code' },
};

export interface IssueOtp {
  channel: VerificationChannel;
  /** Normalized email or E.164 phone. */
  target: string;
  purpose: VerificationPurpose;
  userId?: string | null;
}

/**
 * One-time codes: 6 digits, HMAC-peppered at rest, 10-minute expiry,
 * 5 attempts, 60 s resend cooldown and 5 per hour per target+purpose.
 * Only the newest code for a target+purpose is ever valid.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger('OtpService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: Mailer,
    private readonly sms: SmsSender,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private digest(target: string, purpose: string, code: string): string {
    return createHmac('sha256', this.config.OTP_PEPPER).update(`${purpose}:${target}:${code}`).digest('hex');
  }

  async issue(o: IssueOtp): Promise<{ expiresAt: Date }> {
    const since = new Date(Date.now() - 60 * 60_000);
    const recent = await this.prisma.verificationCode.findMany({
      where: { target: o.target, purpose: o.purpose, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const last = recent[0];
    if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - last.createdAt.getTime())) / 1000);
      throw new AppException(HttpStatus.TOO_MANY_REQUESTS, 'OTP_COOLDOWN', `Please wait ${retryAfterSec}s before requesting a new code.`, { retryAfterSec });
    }
    if (recent.length >= OTP_MAX_PER_HOUR) {
      throw new AppException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many codes requested. Try again in an hour.', { retryAfterSec: 3600 });
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    await this.prisma.$transaction([
      // Supersede older codes for the same target+purpose.
      this.prisma.verificationCode.updateMany({
        where: { target: o.target, purpose: o.purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.verificationCode.create({
        data: { channel: o.channel, target: o.target, purpose: o.purpose, userId: o.userId ?? null, codeHash: this.digest(o.target, o.purpose, code), expiresAt },
      }),
    ]);
    await this.deliver(o, code);
    return { expiresAt };
  }

  private async deliver(o: IssueOtp, code: string): Promise<void> {
    const { subject, line } = COPY[o.purpose];
    if (o.channel === 'SMS') {
      // Android SMS Retriever / iOS one-time-code autofill friendly format.
      await this.sms.send(o.target, `${code} is your VYBORA code. ${line.replace('Use this code to ', 'It lets you ')}. Expires in 10 minutes. Never share it.`);
      return;
    }
    await this.mailer.send({
      to: o.target,
      subject: `${subject}: ${code}`,
      text: `${line}:\n\n${code}\n\nThe code expires in 10 minutes. If you didn't ask for it, you can ignore this email — nobody can sign in without the code.\n\n— VYBORA · Connect. Create. Discover.`,
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0A0A0F">
<p style="font-size:20px;font-weight:700;letter-spacing:1px;margin:0 0 16px">VYBORA</p>
<p style="margin:0 0 16px">${line}:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px;color:#6D28D9">${code}</p>
<p style="color:#53536A;font-size:14px;margin:0">The code expires in 10 minutes. If you didn't ask for it, you can ignore this email — nobody can sign in without the code.</p>
</div>`,
    });
  }

  /**
   * Fire-and-forget variant for flows that must not reveal whether an account
   * exists (forgot password, code sign-in): callers return the same response
   * either way and delivery errors are logged, not surfaced.
   */
  issueQuietly(o: IssueOtp): void {
    this.issue(o).catch((e: unknown) => {
      if (!(e instanceof AppException)) this.logger.error({ err: e }, 'OTP delivery failed');
    });
  }

  /** Consumes the newest valid code. Throws OTP_INVALID / OTP_EXPIRED / OTP_TOO_MANY_ATTEMPTS. */
  async verify(target: string, purpose: VerificationPurpose, code: string): Promise<{ userId: string | null }> {
    const row = await this.prisma.verificationCode.findFirst({
      where: { target, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const invalid = (remaining?: number) =>
      new AppException(HttpStatus.BAD_REQUEST, 'OTP_INVALID', "That code isn't right.", remaining === undefined ? undefined : { attemptsRemaining: remaining });
    if (!row) throw invalid();
    if (row.expiresAt < new Date()) throw new AppException(HttpStatus.BAD_REQUEST, 'OTP_EXPIRED', 'That code has expired. Request a new one.');
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'OTP_TOO_MANY_ATTEMPTS', 'Too many wrong attempts. Request a new code.');
    }
    const expected = Buffer.from(row.codeHash, 'hex');
    const actual = Buffer.from(this.digest(target, purpose, code), 'hex');
    if (!timingSafeEqual(expected, actual)) {
      const updated = await this.prisma.verificationCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } }, select: { attempts: true } });
      throw invalid(Math.max(0, OTP_MAX_ATTEMPTS - updated.attempts));
    }
    // Conditional consume: two concurrent requests can't both use the same code.
    const { count } = await this.prisma.verificationCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (count !== 1) throw invalid();
    return { userId: row.userId };
  }
}
