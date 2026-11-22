import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/api-exception.filter.js';
import { AuditService } from '../../common/audit.service.js';
import type { ClientContext } from '../../common/client-context.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import type { UserRole } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { sha256, TokenService } from './token.service.js';

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}

interface Principal {
  id: string;
  tokenVersion: number;
  role: UserRole;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  }

  /** New device session + first token pair. */
  async start(user: Principal, ctx: ClientContext): Promise<TokenPair & { sessionId: string }> {
    const refresh = this.tokens.newRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        deviceName: ctx.deviceName,
        platform: ctx.platform,
        appVersion: ctx.appVersion,
        ipCountry: ctx.ipCountry,
        ipHash: ctx.ipHash,
        userAgent: ctx.userAgent,
        refreshTokens: { create: { tokenHash: refresh.hash, expiresAt: this.refreshExpiry() } },
      },
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
    const access = await this.tokens.signAccess({ sub: user.id, sid: session.id, ver: user.tokenVersion, role: user.role });
    return { sessionId: session.id, accessToken: access.token, accessTokenExpiresAt: access.expiresAt.toISOString(), refreshToken: refresh.raw };
  }

  /**
   * Rotates a refresh token. Each token works exactly once; presenting an
   * already-rotated token means it was copied — the whole session is revoked
   * (OAuth 2.0 Security BCP refresh-token reuse detection).
   */
  async rotate(rawToken: string, ctx: ClientContext): Promise<TokenPair> {
    const invalid = () => new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_REFRESH_INVALID', 'Please sign in again.');
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { session: { include: { user: { select: { id: true, tokenVersion: true, role: true, status: true, suspendedUntil: true } } } } },
    });
    if (!row || row.revokedAt || row.session.revokedAt) throw invalid();

    if (row.rotatedAt) {
      await this.revoke(row.sessionId, 'refresh_reuse');
      await this.audit.log('auth.refresh_reuse_detected', { actorId: row.session.userId, entityType: 'session', entityId: row.sessionId, ctx });
      throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_REFRESH_REUSED', 'For your security you were signed out. Please sign in again.');
    }
    if (row.expiresAt < new Date()) throw invalid();

    const user = row.session.user;
    if (user.status === 'SUSPENDED' && (!user.suspendedUntil || user.suspendedUntil > new Date())) {
      throw new AppException(HttpStatus.FORBIDDEN, 'AUTH_ACCOUNT_SUSPENDED', 'This account is suspended.');
    }
    if (user.status !== 'ACTIVE' && user.status !== 'SUSPENDED') throw invalid();

    const next = this.tokens.newRefreshToken();
    await this.prisma.$transaction(async (tx) => {
      // Conditional update wins exactly once even if two refreshes race.
      const claimed = await tx.refreshToken.updateMany({ where: { id: row.id, rotatedAt: null }, data: { rotatedAt: new Date() } });
      if (claimed.count !== 1) throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_REFRESH_REUSED', 'For your security you were signed out. Please sign in again.');
      const created = await tx.refreshToken.create({ data: { sessionId: row.sessionId, tokenHash: next.hash, expiresAt: this.refreshExpiry() } });
      await tx.refreshToken.update({ where: { id: row.id }, data: { replacedById: created.id } });
      await tx.session.update({
        where: { id: row.sessionId },
        data: { lastSeenAt: new Date(), ...(ctx.appVersion ? { appVersion: ctx.appVersion } : {}), ...(ctx.ipCountry ? { ipCountry: ctx.ipCountry } : {}) },
      });
    });
    const access = await this.tokens.signAccess({ sub: user.id, sid: row.sessionId, ver: user.tokenVersion, role: user.role });
    return { accessToken: access.token, accessTokenExpiresAt: access.expiresAt.toISOString(), refreshToken: next.raw };
  }

  async revoke(sessionId: string, _reason = 'logout'): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: now } }),
      this.prisma.refreshToken.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: now } }),
      this.prisma.pushToken.deleteMany({ where: { sessionId } }),
    ]);
  }

  /** Signs out every device (optionally keeping the current one). */
  async revokeAll(userId: string, exceptSessionId?: string): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      select: { id: true },
    });
    for (const s of sessions) await this.revoke(s.id, 'revoke_all');
    return sessions.length;
  }

  list(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, deviceName: true, platform: true, appVersion: true, ipCountry: true, createdAt: true, lastSeenAt: true },
    });
  }
}
