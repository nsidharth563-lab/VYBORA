import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { createUploadSchema } from '@vybora/shared';
import type { MediaView, UploadTicket } from '@vybora/types';
import type { z } from 'zod';
import { type AuthContext, CurrentAuth } from '../../common/auth/auth.decorators.js';
import { RateLimitService } from '../../common/rate-limit.service.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { MediaService } from './media.service.js';

@Controller('media')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly limits: RateLimitService,
  ) {}

  @Post('uploads')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(createUploadSchema)) body: z.output<typeof createUploadSchema>): Promise<UploadTicket> {
    await this.limits.hit({ name: 'upload:user', limit: 60, windowSec: 3600 }, a.userId);
    return this.media.createUpload(a.userId, body);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.ACCEPTED)
  complete(@CurrentAuth() a: AuthContext, @Param('id', new ParseUUIDPipe()) id: string): Promise<MediaView> {
    return this.media.complete(a.userId, id);
  }

  @Get(':id')
  get(@CurrentAuth() a: AuthContext, @Param('id', new ParseUUIDPipe()) id: string): Promise<MediaView> {
    return this.media.get(a.userId, id);
  }
}
