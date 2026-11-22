import { Injectable } from '@nestjs/common';
import type { Relationship } from '@vybora/types';
import type { User, Visibility } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

type Target = Pick<User, 'id' | 'isPrivate' | 'status'>;

export interface FullRelationship extends Relationship {
  /** Target blocked the viewer (never revealed to the viewer). */
  blockedByTarget: boolean;
}

/**
 * The single answer to "can viewer V see X?". Every read path for profiles,
 * lists, posts, stories and comments goes through here, so privacy rules
 * can't be forgotten in one endpoint.
 */
@Injectable()
export class VisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async relationship(viewerId: string | null, targetId: string): Promise<FullRelationship> {
    const none: FullRelationship = {
      isSelf: false,
      following: null,
      followsYou: false,
      requestedYou: false,
      blocked: false,
      blockedByTarget: false,
      restricted: false,
      muted: false,
      closeFriend: false,
    };
    if (!viewerId) return none;
    if (viewerId === targetId) return { ...none, isSelf: true };
    const [out, inc, blocks, restrict, mute, close] = await Promise.all([
      this.prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: targetId } }, select: { status: true } }),
      this.prisma.follow.findUnique({ where: { followerId_followingId: { followerId: targetId, followingId: viewerId } }, select: { status: true } }),
      this.prisma.block.findMany({
        where: { OR: [{ blockerId: viewerId, blockedId: targetId }, { blockerId: targetId, blockedId: viewerId }] },
        select: { blockerId: true },
      }),
      this.prisma.restrict.findUnique({ where: { restricterId_restrictedId: { restricterId: viewerId, restrictedId: targetId } }, select: { createdAt: true } }),
      this.prisma.mute.findUnique({ where: { muterId_mutedId: { muterId: viewerId, mutedId: targetId } }, select: { createdAt: true } }),
      this.prisma.closeFriend.findUnique({ where: { ownerId_friendId: { ownerId: viewerId, friendId: targetId } }, select: { createdAt: true } }),
    ]);
    return {
      isSelf: false,
      following: out?.status ?? null,
      followsYou: inc?.status === 'ACCEPTED',
      requestedYou: inc?.status === 'PENDING',
      blocked: blocks.some((b) => b.blockerId === viewerId),
      blockedByTarget: blocks.some((b) => b.blockerId === targetId),
      restricted: !!restrict,
      muted: !!mute,
      closeFriend: !!close,
    };
  }

  /**
   * Profile exists for this viewer at all. If the target blocked the viewer it
   * looks like the account doesn't exist; if the viewer blocked the target they
   * still see a minimal profile so they can unblock (content stays hidden).
   */
  canSeeProfile(target: Target, rel: FullRelationship): boolean {
    if (rel.isSelf) return true;
    if (target.status !== 'ACTIVE' && target.status !== 'SUSPENDED') return false;
    return !rel.blockedByTarget;
  }

  /** Posts, reels, follower lists: public accounts to everyone; private ones to accepted followers. Never across a block. */
  canSeeContent(target: Target, rel: FullRelationship): boolean {
    if (!this.canSeeProfile(target, rel) || rel.blocked) return false;
    return rel.isSelf || !target.isPrivate || rel.following === 'ACCEPTED';
  }

  /**
   * One item (post/story) with its own audience. `ownerCloseFriendOfViewer`
   * = the owner has the viewer on their close-friends list.
   */
  canSeeItem(owner: Target, rel: FullRelationship, visibility: Visibility, ownerCloseFriendOfViewer: boolean): boolean {
    if (rel.isSelf) return true;
    if (!this.canSeeContent(owner, rel)) return false;
    switch (visibility) {
      case 'PUBLIC':
        return true;
      case 'FOLLOWERS':
        return rel.following === 'ACCEPTED';
      case 'CLOSE_FRIENDS':
        return rel.following === 'ACCEPTED' && ownerCloseFriendOfViewer;
      case 'SUBSCRIBERS': // creator subscriptions — Phase 13
      case 'COMMUNITY': // community membership — Phase 11
      default:
        return false;
    }
  }

  /** Users hidden from `viewerId` in lists and search (blocked either way). */
  async hiddenUserIds(viewerId: string): Promise<Set<string>> {
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    });
    return new Set(rows.map((r) => (r.blockerId === viewerId ? r.blockedId : r.blockerId)));
  }
}
