import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { updateProfileSchema, userSearchSchema } from '@vybora/shared';
import type { CursorPage, FollowStatus, MeUser, ProfileView, UserListItem } from '@vybora/types';
import type { z } from 'zod';
import { type AuthContext, CurrentAuth } from '../../common/auth/auth.decorators.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { GraphService } from './graph.service.js';
import { ProfileService } from './profile.service.js';

const uuid = new ParseUUIDPipe();
const limitOf = (l?: string) => (l ? Number.parseInt(l, 10) || undefined : undefined);

@Controller('users')
export class UsersController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly graph: GraphService,
  ) {}

  @Get('search')
  search(@CurrentAuth() a: AuthContext, @Query(new ZodPipe(userSearchSchema)) q: z.output<typeof userSearchSchema>): Promise<UserListItem[]> {
    return this.profiles.search(a.userId, q.q);
  }

  @Get(':username')
  profile(@CurrentAuth() a: AuthContext, @Param('username') username: string): Promise<ProfileView> {
    return this.profiles.byUsername(a.userId, username);
  }

  @Get(':id/followers')
  followers(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string): Promise<CursorPage<UserListItem>> {
    return this.graph.list(a.userId, id, 'followers', cursor, limitOf(limit));
  }

  @Get(':id/following')
  following(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string): Promise<CursorPage<UserListItem>> {
    return this.graph.list(a.userId, id, 'following', cursor, limitOf(limit));
  }

  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  follow(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string): Promise<{ following: FollowStatus }> {
    return this.graph.follow(a.userId, id);
  }

  @Delete(':id/follow')
  unfollow(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    return this.graph.unfollow(a.userId, id);
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  async block(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.block(a.userId, id);
  }

  @Delete(':id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblock(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.unblock(a.userId, id);
  }

  @Post(':id/restrict')
  @HttpCode(HttpStatus.NO_CONTENT)
  async restrict(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.setRestricted(a.userId, id, true);
  }

  @Delete(':id/restrict')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unrestrict(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.setRestricted(a.userId, id, false);
  }

  @Post(':id/mute')
  @HttpCode(HttpStatus.NO_CONTENT)
  async mute(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.setMuted(a.userId, id, true);
  }

  @Delete(':id/mute')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unmute(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.setMuted(a.userId, id, false);
  }
}

@Controller('me')
export class MeSocialController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly graph: GraphService,
  ) {}

  @Patch('profile')
  update(@CurrentAuth() a: AuthContext, @Body(new ZodPipe(updateProfileSchema)) body: z.output<typeof updateProfileSchema>): Promise<MeUser> {
    return this.profiles.update(a.userId, body);
  }

  @Get('follow-requests')
  requests(@CurrentAuth() a: AuthContext, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.graph.pendingRequests(a.userId, cursor, limitOf(limit));
  }

  @Post('follow-requests/:id/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  async accept(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.acceptRequest(a.userId, id);
  }

  @Delete('follow-requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async decline(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.declineRequest(a.userId, id);
  }

  @Delete('followers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFollower(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.removeFollower(a.userId, id);
  }

  @Get('close-friends')
  closeFriends(@CurrentAuth() a: AuthContext): Promise<UserListItem[]> {
    return this.graph.closeFriends(a.userId);
  }

  @Put('close-friends/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async addCloseFriend(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.setCloseFriend(a.userId, id, true);
  }

  @Delete('close-friends/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCloseFriend(@CurrentAuth() a: AuthContext, @Param('id', uuid) id: string) {
    await this.graph.setCloseFriend(a.userId, id, false);
  }

  @Get('blocked')
  blocked(@CurrentAuth() a: AuthContext): Promise<UserListItem[]> {
    return this.graph.blocked(a.userId);
  }
}
