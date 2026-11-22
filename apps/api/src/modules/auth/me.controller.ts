import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { completeProfileSchema, deleteAccountSchema, sendVerificationSchema, verifyContactSchema } from '@vybora/shared';
import type { CodeSentResponse, MeUser } from '@vybora/types';
import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { type AuthContext, CurrentAuth } from '../../common/auth/auth.decorators.js';
import { clientContext } from '../../common/client-context.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';
import { AccountService } from './account.service.js';

/** The signed-in user's own account. */
@Controller('me')
export class MeController {
  constructor(
    private readonly account: AccountService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  me(@CurrentAuth() a: AuthContext): Promise<MeUser> {
    return this.account.me(a.userId);
  }

  @Post('verify/send')
  @HttpCode(HttpStatus.ACCEPTED)
  sendVerification(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(sendVerificationSchema)) b: z.output<typeof sendVerificationSchema>): Promise<CodeSentResponse> {
    return this.account.sendVerification(a.userId, b.channel);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(verifyContactSchema)) b: z.output<typeof verifyContactSchema>, @Req() req: FastifyRequest): Promise<MeUser> {
    return this.account.verifyContact(a.userId, b.channel, b.code, clientContext(req, this.config.IP_HASH_SECRET, this.config.TRUST_PROXY));
  }

  @Post('complete-profile')
  @HttpCode(HttpStatus.OK)
  completeProfile(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(completeProfileSchema)) b: z.output<typeof completeProfileSchema>): Promise<MeUser> {
    return this.account.completeProfile(a.userId, b);
  }

  @Post('delete/code')
  @HttpCode(HttpStatus.ACCEPTED)
  deletionCode(@CurrentAuth() a: AuthContext): Promise<CodeSentResponse> {
    return this.account.requestDeletionCode(a.userId);
  }

  @Post('delete')
  @HttpCode(HttpStatus.ACCEPTED)
  delete(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(deleteAccountSchema)) b: z.output<typeof deleteAccountSchema>, @Req() req: FastifyRequest) {
    return this.account.requestDeletion(a.userId, b, clientContext(req, this.config.IP_HASH_SECRET, this.config.TRUST_PROXY));
  }
}
