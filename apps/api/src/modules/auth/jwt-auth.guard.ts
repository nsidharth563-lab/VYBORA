import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AppException } from '../../common/api-exception.filter.js';
import { IS_PUBLIC } from '../../common/auth/auth.decorators.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { TokenService } from './token.service.js';

/**
 * Global guard: every route requires a valid access token unless @Public().
 * Besides the JWT itself it checks the session and the user's token version,
 * so logout, "log out everywhere", password changes and suspensions take
 * effect immediately — not when the 15-minute token expires.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', 'Please sign in.');
    }
    const claims = await this.tokens.verifyAccess(header.slice(7));
    const session = await this.prisma.session.findUnique({
      where: { id: claims.sid },
      select: { userId: true, revokedAt: true, user: { select: { tokenVersion: true, status: true, role: true, suspendedUntil: true } } },
    });
    if (!session || session.revokedAt || session.userId !== claims.sub || session.user.tokenVersion !== claims.ver) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_SESSION_REVOKED', 'You were signed out. Please sign in again.');
    }
    if (session.user.status === 'SUSPENDED' && (!session.user.suspendedUntil || session.user.suspendedUntil > new Date())) {
      throw new AppException(HttpStatus.FORBIDDEN, 'AUTH_ACCOUNT_SUSPENDED', 'This account is suspended.');
    }
    if (session.user.status !== 'ACTIVE' && session.user.status !== 'SUSPENDED') {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_SESSION_REVOKED', 'You were signed out. Please sign in again.');
    }
    req.auth = { userId: claims.sub, sessionId: claims.sid, role: session.user.role };
    return true;
  }
}
