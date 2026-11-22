import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { MediaWorker } from './media.worker.js';

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [MediaService, MediaWorker],
  exports: [MediaService, MediaWorker],
})
export class MediaModule {}
