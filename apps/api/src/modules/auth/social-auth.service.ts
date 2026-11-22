import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AppException } from '../../common/api-exception.filter.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';

export interface SocialProfile {
  provider: 'GOOGLE' | 'APPLE';
  /** Stable provider subject id. */
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export const OAUTH_KEYS = Symbol('OAUTH_KEYS');
export interface OAuthKeys {
  google: JWTVerifyGetKey;
  apple: JWTVerifyGetKey;
}

/** Production key sets (cached and rotated by jose). Tests inject local keys instead. */
export const remoteOAuthKeys = (): OAuthKeys => ({
  google: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),
  apple: createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),
});

const rejected = () => new AppException(HttpStatus.UNAUTHORIZED, 'AUTH_SOCIAL_INVALID', "We couldn't verify that sign-in. Please try again.");
const notConfigured = (p: string) => new AppException(HttpStatus.SERVICE_UNAVAILABLE, 'AUTH_PROVIDER_UNAVAILABLE', `${p} sign-in isn't available yet.`);

/**
 * Verifies identity tokens issued to the app by Google / Apple: signature
 * (provider JWKS), issuer, audience (our client ids), expiry, and for Apple
 * the nonce that binds the token to this sign-in attempt.
 */
@Injectable()
export class SocialAuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(OAUTH_KEYS) private readonly keys: OAuthKeys,
  ) {}

  async verifyGoogle(idToken: string): Promise<SocialProfile> {
    if (!this.config.GOOGLE_OAUTH_CLIENT_IDS.length) throw notConfigured('Google');
    try {
      const { payload } = await jwtVerify(idToken, this.keys.google, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: this.config.GOOGLE_OAUTH_CLIENT_IDS,
        algorithms: ['RS256'],
      });
      if (typeof payload.sub !== 'string') throw rejected();
      return {
        provider: 'GOOGLE',
        sub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
        emailVerified: payload.email_verified === true,
        name: typeof payload.name === 'string' ? payload.name : null,
      };
    } catch (e) {
      if (e instanceof AppException) throw e;
      throw rejected();
    }
  }

  async verifyApple(identityToken: string, rawNonce: string, fullName?: string): Promise<SocialProfile> {
    const audience = [this.config.APPLE_BUNDLE_ID, this.config.APPLE_SERVICE_ID].filter((v): v is string => !!v);
    if (!audience.length) throw notConfigured('Apple');
    try {
      const { payload } = await jwtVerify(identityToken, this.keys.apple, {
        issuer: 'https://appleid.apple.com',
        audience,
        algorithms: ['RS256'],
      });
      const expectedNonce = createHash('sha256').update(rawNonce).digest('hex');
      if (typeof payload.sub !== 'string' || payload.nonce !== expectedNonce) throw rejected();
      const verified = payload.email_verified === true || payload.email_verified === 'true';
      return {
        provider: 'APPLE',
        sub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
        emailVerified: verified,
        // Apple sends the name only to the app, only on first sign-in.
        name: fullName?.trim() || null,
      };
    } catch (e) {
      if (e instanceof AppException) throw e;
      throw rejected();
    }
  }
}
