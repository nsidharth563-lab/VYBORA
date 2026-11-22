import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditService } from '../../common/audit.service.js';
import { RateLimitService } from '../../common/rate-limit.service.js';
import { AccountService } from './account.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { MeController } from './me.controller.js';
import { OtpService } from './otp.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { OAUTH_KEYS, remoteOAuthKeys, SocialAuthService } from './social-auth.service.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    AccountService,
    SessionService,
    TokenService,
    PasswordService,
    OtpService,
    SocialAuthService,
    RateLimitService,
    AuditService,
    { provide: 'FETCH', useFactory: () => globalThis.fetch },
    { provide: OAUTH_KEYS, useFactory: remoteOAuthKeys },
    // Every route is authenticated unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [TokenService, SessionService, RateLimitService, AuditService],
})
export class AuthModule {}
