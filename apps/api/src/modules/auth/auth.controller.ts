import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import {
  appleSignInSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  googleSignInSchema,
  loginSchema,
  otpLoginSchema,
  otpRequestSchema,
  refreshSchema,
  resetPasswordSchema,
  signupSchema,
  usernameSchema,
} from '@vybora/shared';
import type { AuthResponse, CodeSentResponse, SessionInfo } from '@vybora/types';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { AppException } from '../../common/api-exception.filter.js';
import { type AuthContext, CurrentAuth, Public } from '../../common/auth/auth.decorators.js';
import { clientContext } from '../../common/client-context.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { AccountService } from './account.service.js';
import { AuthService } from './auth.service.js';
import { SessionService, type TokenPair } from './session.service.js';
import { SocialAuthService } from './social-auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly account: AccountService,
    private readonly sessions: SessionService,
    private readonly social: SocialAuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private ctx(req: FastifyRequest) {
    return clientContext(req, this.config.IP_HASH_SECRET, this.config.TRUST_PROXY);
  }

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body(new ZodPipe(signupSchema)) body: z.output<typeof signupSchema>, @Req() req: FastifyRequest): Promise<AuthResponse> {
    return this.auth.signup(body, this.ctx(req));
  }

  @Public()
  @Get('username-available')
  async usernameAvailable(@Query('username') raw: string | undefined) {
    const r = usernameSchema.safeParse(raw ?? '');
    if (!r.success) return { username: raw ?? '', available: false, reason: r.error.issues[0]?.message };
    return { username: r.data, available: await this.auth.usernameAvailable(r.data) };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodPipe(loginSchema)) body: z.output<typeof loginSchema>, @Req() req: FastifyRequest): Promise<AuthResponse> {
    return this.auth.login(body.identifier, body.password, this.ctx(req));
  }

  @Public()
  @Post('code/request')
  @HttpCode(HttpStatus.ACCEPTED)
  requestCode(@Body(new ZodPipe(otpRequestSchema)) body: z.output<typeof otpRequestSchema>, @Req() req: FastifyRequest): Promise<CodeSentResponse> {
    return this.auth.requestLoginCode(body.identifier, this.ctx(req));
  }

  @Public()
  @Post('code/verify')
  @HttpCode(HttpStatus.OK)
  verifyCode(@Body(new ZodPipe(otpLoginSchema)) body: z.output<typeof otpLoginSchema>, @Req() req: FastifyRequest): Promise<AuthResponse> {
    return this.auth.loginWithCode(body.identifier, body.code, this.ctx(req));
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  forgot(@Body(new ZodPipe(forgotPasswordSchema)) body: z.output<typeof forgotPasswordSchema>, @Req() req: FastifyRequest): Promise<CodeSentResponse> {
    return this.auth.forgotPassword(body.identifier, this.ctx(req));
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reset(@Body(new ZodPipe(resetPasswordSchema)) body: z.output<typeof resetPasswordSchema>, @Req() req: FastifyRequest): Promise<void> {
    await this.auth.resetPassword(body.identifier, body.code, body.newPassword, this.ctx(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodPipe(refreshSchema)) body: z.output<typeof refreshSchema>, @Req() req: FastifyRequest): Promise<TokenPair> {
    return this.auth.refresh(body.refreshToken, this.ctx(req));
  }

  @Public()
  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  async google(@Body(new ZodPipe(googleSignInSchema)) body: z.output<typeof googleSignInSchema>, @Req() req: FastifyRequest): Promise<AuthResponse> {
    return this.auth.socialSignIn(await this.social.verifyGoogle(body.idToken), this.ctx(req));
  }

  @Public()
  @Post('oauth/apple')
  @HttpCode(HttpStatus.OK)
  async apple(@Body(new ZodPipe(appleSignInSchema)) body: z.output<typeof appleSignInSchema>, @Req() req: FastifyRequest): Promise<AuthResponse> {
    return this.auth.socialSignIn(await this.social.verifyApple(body.identityToken, body.nonce, body.fullName), this.ctx(req));
  }

  // ---- authenticated

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentAuth() a: AuthContext): Promise<void> {
    await this.sessions.revoke(a.sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentAuth() a: AuthContext) {
    return { signedOut: await this.sessions.revokeAll(a.userId) };
  }

  @Get('sessions')
  async listSessions(@CurrentAuth() a: AuthContext): Promise<SessionInfo[]> {
    const rows = await this.sessions.list(a.userId);
    return rows.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), current: s.id === a.sessionId }));
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(@CurrentAuth() a: AuthContext, @Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    const mine = (await this.sessions.list(a.userId)).some((s) => s.id === id);
    if (!mine) throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Session not found.');
    await this.sessions.revoke(id);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(changePasswordSchema)) body: z.output<typeof changePasswordSchema>, @Req() req: FastifyRequest) {
    return this.account.changePassword(a.userId, a.sessionId, body.currentPassword, body.newPassword, this.ctx(req));
  }
}
