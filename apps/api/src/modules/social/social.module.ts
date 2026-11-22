import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GraphService } from './graph.service.js';
import { ProfileService } from './profile.service.js';
import { MeSocialController, UsersController } from './social.controller.js';
import { VisibilityService } from './visibility.service.js';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, MeSocialController],
  providers: [VisibilityService, GraphService, ProfileService],
  exports: [VisibilityService, GraphService],
})
export class SocialModule {}
