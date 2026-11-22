import { HttpStatus, Injectable } from '@nestjs/common';
import type { CursorPage, FollowStatus, UserListItem } from '@vybora/types';
import { decodeCursor, encodeCursor, LIMITS as APP_LIMITS } from '@vybora/shared';
import { AppException } from '../../common/api-exception.filter.js';
import { RateLimitService } from '../../common/rate-limit.service.js';
import type { NotificationType, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { UserPresenter, WITH_AVATAR } from '../auth/user-view.js';
import { VisibilityService } from './visibility.service.js';

type Tx = Prisma.TransactionClient;
const notFound = () => new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'User not found.');

@Injectable()
export class GraphService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly present: UserPresenter,
    private readonly limits: RateLimitService,
  ) {}

  private async target(viewerId: string, targetId: string) {
    if (viewerId === targetId) throw new AppException(HttpStatus.BAD_REQUEST, 'SELF_ACTION', "You can't do that to yourself.");
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw notFound();
    const rel = await this.visibility.relationship(viewerId, targetId);
    if (!this.visibility.canSeeProfile(user, rel)) throw notFound();
    return { user, rel };
  }

  private async notify(tx: Tx, recipientId: string, actorId: string, type: NotificationType) {
    await tx.notification.create({ data: { recipientId, actorId, type, entityType: 'user', entityId: actorId, groupKey: `${type}:${actorId}` } });
  }

  private async counts(tx: Tx, followerId: string, followingId: string, delta: 1 | -1) {
    await tx.user.update({ where: { id: followerId }, data: { followingCount: { increment: delta } } });
    await tx.user.update({ where: { id: followingId }, data: { followerCount: { increment: delta } } });
  }

  // ------------------------------------------------------------------ follow

  async follow(viewerId: string, targetId: string): Promise<{ following: FollowStatus }> {
    const { user, rel } = await this.target(viewerId, targetId);
    if (rel.blocked) throw new AppException(HttpStatus.CONFLICT, 'BLOCKED', 'Unblock this account to follow it.');
    if (rel.following) return { following: rel.following };
    await this.limits.hit({ name: 'follow:user', limit: 200, windowSec: 3600 }, viewerId);
    const status: FollowStatus = user.isPrivate ? 'PENDING' : 'ACCEPTED';
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.follow.create({ data: { followerId: viewerId, followingId: targetId, status, acceptedAt: status === 'ACCEPTED' ? new Date() : null } });
        if (status === 'ACCEPTED') await this.counts(tx, viewerId, targetId, 1);
        await this.notify(tx, targetId, viewerId, status === 'ACCEPTED' ? 'FOLLOW' : 'FOLLOW_REQUEST');
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return { following: (await this.visibility.relationship(viewerId, targetId)).following ?? status };
      throw e;
    }
    return { following: status };
  }

  /** Unfollow, or cancel a pending request. */
  async unfollow(viewerId: string, targetId: string): Promise<{ following: null }> {
    await this.prisma.$transaction(async (tx) => {
      const f = await tx.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: targetId } } });
      if (!f) return;
      await tx.follow.delete({ where: { followerId_followingId: { followerId: viewerId, followingId: targetId } } });
      if (f.status === 'ACCEPTED') await this.counts(tx, viewerId, targetId, -1);
    });
    return { following: null };
  }

  async acceptRequest(meId: string, requesterId: string): Promise<void> {
    const ok = await this.prisma.$transaction(async (tx) => {
      const r = await tx.follow.updateMany({
        where: { followerId: requesterId, followingId: meId, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (r.count !== 1) return false;
      await this.counts(tx, requesterId, meId, 1);
      await this.notify(tx, requesterId, meId, 'FOLLOW_ACCEPTED');
      return true;
    });
    if (!ok) throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Request not found.');
  }

  async declineRequest(meId: string, requesterId: string): Promise<void> {
    await this.prisma.follow.deleteMany({ where: { followerId: requesterId, followingId: meId, status: 'PENDING' } });
  }

  async removeFollower(meId: string, followerId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.follow.deleteMany({ where: { followerId, followingId: meId, status: 'ACCEPTED' } });
      if (r.count === 1) await this.counts(tx, followerId, meId, -1);
    });
  }

  /** Called when an account goes public: every pending request becomes a follow. */
  async acceptAllPending(meId: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.follow.findMany({ where: { followingId: meId, status: 'PENDING' }, select: { followerId: true } });
      if (!pending.length) return 0;
      await tx.follow.updateMany({ where: { followingId: meId, status: 'PENDING' }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      await tx.user.update({ where: { id: meId }, data: { followerCount: { increment: pending.length } } });
      await tx.user.updateMany({ where: { id: { in: pending.map((p) => p.followerId) } }, data: { followingCount: { increment: 1 } } });
      return pending.length;
    });
  }

  // ------------------------------------------------------------------ block / restrict / mute / close friends

  /** Blocking severs the relationship both ways: follows, requests and close-friend entries. */
  async block(meId: string, targetId: string): Promise<void> {
    if (meId === targetId) throw new AppException(HttpStatus.BAD_REQUEST, 'SELF_ACTION', "You can't block yourself.");
    if (!(await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }))) throw notFound();
    await this.prisma.$transaction(async (tx) => {
      await tx.block.upsert({ where: { blockerId_blockedId: { blockerId: meId, blockedId: targetId } }, create: { blockerId: meId, blockedId: targetId }, update: {} });
      for (const [a, b] of [
        [meId, targetId],
        [targetId, meId],
      ] as const) {
        const f = await tx.follow.findUnique({ where: { followerId_followingId: { followerId: a, followingId: b } } });
        if (f) {
          await tx.follow.delete({ where: { followerId_followingId: { followerId: a, followingId: b } } });
          if (f.status === 'ACCEPTED') await this.counts(tx, a, b, -1);
        }
      }
      await tx.closeFriend.deleteMany({ where: { OR: [{ ownerId: meId, friendId: targetId }, { ownerId: targetId, friendId: meId }] } });
    });
  }

  async unblock(meId: string, targetId: string): Promise<void> {
    await this.prisma.block.deleteMany({ where: { blockerId: meId, blockedId: targetId } });
  }

  async setRestricted(meId: string, targetId: string, on: boolean): Promise<void> {
    if (on) {
      await this.target(meId, targetId);
      await this.prisma.restrict.upsert({ where: { restricterId_restrictedId: { restricterId: meId, restrictedId: targetId } }, create: { restricterId: meId, restrictedId: targetId }, update: {} });
    } else await this.prisma.restrict.deleteMany({ where: { restricterId: meId, restrictedId: targetId } });
  }

  async setMuted(meId: string, targetId: string, on: boolean): Promise<void> {
    if (on) {
      await this.target(meId, targetId);
      await this.prisma.mute.upsert({ where: { muterId_mutedId: { muterId: meId, mutedId: targetId } }, create: { muterId: meId, mutedId: targetId }, update: {} });
    } else await this.prisma.mute.deleteMany({ where: { muterId: meId, mutedId: targetId } });
  }

  async setCloseFriend(meId: string, friendId: string, on: boolean): Promise<void> {
    if (on) {
      const { rel } = await this.target(meId, friendId);
      if (rel.blocked) throw new AppException(HttpStatus.CONFLICT, 'BLOCKED', 'Unblock this account first.');
      await this.prisma.closeFriend.upsert({ where: { ownerId_friendId: { ownerId: meId, friendId } }, create: { ownerId: meId, friendId }, update: {} });
    } else await this.prisma.closeFriend.deleteMany({ where: { ownerId: meId, friendId } });
  }

  // ------------------------------------------------------------------ lists

  private async decorate(viewerId: string, users: Parameters<UserPresenter['publicUser']>[0][]): Promise<UserListItem[]> {
    const ids = users.map((u) => u.id);
    const [out, inc] = await Promise.all([
      this.prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: ids } }, select: { followingId: true, status: true } }),
      this.prisma.follow.findMany({ where: { followingId: viewerId, followerId: { in: ids }, status: 'ACCEPTED' }, select: { followerId: true } }),
    ]);
    const outMap = new Map(out.map((f) => [f.followingId, f.status]));
    const incSet = new Set(inc.map((f) => f.followerId));
    return users.map((u) => ({
      ...this.present.publicUser(u),
      displayName: u.displayName,
      viewer: { isSelf: u.id === viewerId, following: outMap.get(u.id) ?? null, followsYou: incSet.has(u.id) },
    }));
  }

  private page(limit?: number) {
    return Math.min(Math.max(limit ?? APP_LIMITS.pageSizeDefault, 1), APP_LIMITS.pageSizeMax);
  }

  /** Followers / following of `userId`, newest first, keyset-paginated, blocked users removed. */
  async list(viewerId: string, userId: string, direction: 'followers' | 'following', cursor?: string, limit?: number): Promise<CursorPage<UserListItem>> {
    const owner = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!owner) throw notFound();
    const rel = await this.visibility.relationship(viewerId, userId);
    if (!this.visibility.canSeeProfile(owner, rel)) throw notFound();
    if (rel.blocked) throw new AppException(HttpStatus.FORBIDDEN, 'BLOCKED', 'You blocked this account. Unblock it to see their followers.');
    if (!this.visibility.canSeeContent(owner, rel)) throw new AppException(HttpStatus.FORBIDDEN, 'PRIVATE_ACCOUNT', 'This account is private.');
    return this.listFollows(viewerId, direction === 'followers' ? { followingId: userId, status: 'ACCEPTED' } : { followerId: userId, status: 'ACCEPTED' }, direction === 'followers' ? 'follower' : 'following', cursor, limit);
  }

  async pendingRequests(meId: string, cursor?: string, limit?: number): Promise<CursorPage<UserListItem>> {
    return this.listFollows(meId, { followingId: meId, status: 'PENDING' }, 'follower', cursor, limit);
  }

  private async listFollows(viewerId: string, where: Prisma.FollowWhereInput, side: 'follower' | 'following', cursor?: string, limit?: number): Promise<CursorPage<UserListItem>> {
    const take = this.page(limit);
    const c = decodeCursor(cursor);
    const hidden = await this.visibility.hiddenUserIds(viewerId);
    const otherKey = side === 'follower' ? 'followerId' : 'followingId';
    const rows = await this.prisma.follow.findMany({
      where: {
        ...where,
        [otherKey]: { notIn: [...hidden] },
        [side]: { status: 'ACTIVE' },
        ...(c ? { OR: [{ createdAt: { lt: new Date(String(c.k)) } }, { createdAt: new Date(String(c.k)), [otherKey]: { lt: c.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { [otherKey]: 'desc' }],
      take: take + 1,
      include: { [side]: { include: WITH_AVATAR } },
    });
    const more = rows.length > take;
    const slice = rows.slice(0, take) as unknown as (Record<string, unknown> & { createdAt: Date })[];
    const users = slice.map((r) => r[side] as Parameters<UserPresenter['publicUser']>[0]);
    const last = slice.at(-1);
    return {
      items: await this.decorate(viewerId, users),
      nextCursor: more && last ? encodeCursor({ k: last.createdAt.toISOString(), id: String(last[otherKey]) }) : null,
    };
  }

  async closeFriends(meId: string): Promise<UserListItem[]> {
    const rows = await this.prisma.closeFriend.findMany({ where: { ownerId: meId, friend: { status: 'ACTIVE' } }, include: { friend: { include: WITH_AVATAR } }, orderBy: { createdAt: 'desc' }, take: 500 });
    return this.decorate(meId, rows.map((r) => r.friend));
  }

  async blocked(meId: string): Promise<UserListItem[]> {
    const rows = await this.prisma.block.findMany({ where: { blockerId: meId }, include: { blocked: { include: WITH_AVATAR } }, orderBy: { createdAt: 'desc' }, take: 500 });
    return this.decorate(meId, rows.map((r) => r.blocked));
  }
}
