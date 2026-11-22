import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { errors, jwtVerify, SignJWT } from 'jose';
import { AppException } from '../../common/api-exception.filter.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import type { UserRole } from '../../generated/prisma/client.js';

export interface AccessClaims {
  sub: string;
  sid: string;
  /** users.tokenVersion at issue time — bumping it invalidates all access tokens. */
  ver: number;
  role: UserRole;
}

const ISSUER = 'vybora-api';
const AUDIENCE = 'vybora-app';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.key = new TextEncoder().encode(config.JWT_ACCESS_SECRET);
  }

  async signAccess(c: AccessClaims): Promise<{ token: string; expiresAt: Date }> {
    const token = await new SignJWT({ sid: c.sid, ver: c.ver, role: c.role })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(c.sub)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(this.config.JWT_ACCESS_TTL)
      .sign(this.key);
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { exp: number };
    return { token, expiresAt: new Date(exp * 1000) };
  }

  /** Verifies signature, issuer, audience and expiry. Throws 401 with a code the app can act on. */
  async verifyAccess(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || typeof payload.ver !== 'number') throw new Error('claims');
      return { sub: payload.sub, sid: payload.sid, ver: payload.ver, role: payload.role as UserRole };
    } catch (e) {
      if (e instanceof errors.JWTExpired) {
        throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_TOKEN_EXPIRED', 'Your session needs refreshing.');
      }
      throw new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_TOKEN_INVALID', 'Please sign in again.');
    }
  }

  /** Opaque refresh token (256 bits). Only its SHA-256 is stored. */
  newRefreshToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: sha256(raw) };
  }
}
