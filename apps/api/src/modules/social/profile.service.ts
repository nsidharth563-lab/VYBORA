import { HttpStatus, Injectable } from '@nestjs/common';
import type { MeUser, ProfileView, UserListItem } from '@vybora/types';
import { AppException } from '../../common/api-exception.filter.js';
import { AuditService } from '../../common/audit.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { UserPresenter, WITH_AVATAR, WITH_MEDIA } from '../auth/user-view.js';
import { GraphService } from './graph.service.js';
import { VisibilityService } from './visibility.service.js';

export interface ProfilePatch {
  displayName?: string;
  username?: string;
  bio?: string | null;
  website?: string | null;
  isPrivate?: boolean;
  avatarMediaId?: string | null;
  coverMediaId?: string | null;
}

const notFound = () => new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "This account doesn't exist.");

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    private readonly graph: GraphService,
    private readonly present: UserPresenter,
    private readonly audit: AuditService,
  ) {}

  async byUsername(viewerId: string, username: string): Promise<ProfileView> {
    const u = await this.prisma.user.findUnique({ where: { username: username.toLowerCase() }, include: WITH_MEDIA });
    if (!u) throw notFound();
    const rel = await this.visibility.relationship(viewerId, u.id);
    // Blocks either way look exactly like "doesn't exist" — never reveal who blocked whom.
    if (!this.visibility.canSeeProfile(u, rel)) throw notFound();
    const { blockedByTarget: _hidden, ...viewer } = rel;
    return {
      ...this.present.publicUser(u),
      bio: u.bio,
      website: u.website,
      coverUrl: this.present.mediaUrl(u.cover, 'lg'),
      coverBlurhash: u.cover?.status === 'READY' ? u.cover.blurhash : null,
      followerCount: u.followerCount,
      followingCount: u.followingCount,
      postCount: u.postCount,
      canViewContent: this.visibility.canSeeContent(u, rel),
      viewer,
    };
  }

  private async assertMedia(userId: string, mediaId: string, purpose: 'AVATAR' | 'COVER') {
    const m = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId }, select: { ownerId: true, purpose: true, status: true, deletedAt: true } });
    if (!m || m.ownerId !== userId || m.deletedAt || m.purpose !== purpose || m.status === 'FAILED' || m.status === 'PENDING_UPLOAD') {
      throw new AppException(HttpStatus.BAD_REQUEST, 'MEDIA_INVALID', 'That image is not available. Please upload it again.', {
        field: purpose === 'AVATAR' ? 'avatarMediaId' : 'coverMediaId',
      });
    }
  }

  async update(userId: string, patch: ProfilePatch): Promise<MeUser> {
    if (patch.avatarMediaId) await this.assertMedia(userId, patch.avatarMediaId, 'AVATAR');
    if (patch.coverMediaId) await this.assertMedia(userId, patch.coverMediaId, 'COVER');
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { isPrivate: true, username: true } });
    let user;
    try {
      user = await this.prisma.user.update({ where: { id: userId }, data: patch, include: WITH_MEDIA });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppException(HttpStatus.CONFLICT, 'USERNAME_TAKEN', 'That username is taken.', { field: 'username' });
      }
      throw e;
    }
    if (before.isPrivate && patch.isPrivate === false) {
      const accepted = await this.graph.acceptAllPending(userId);
      if (accepted) user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: WITH_MEDIA });
    }
    if (patch.username && patch.username !== before.username) {
      await this.audit.log('profile.username_changed', { actorId: userId, metadata: { from: before.username, to: patch.username } });
    }
    return this.present.me(user);
  }

  /**
   * People search: exact username first, then prefix matches on username and
   * display name; blocked accounts excluded both ways. Full search engine: Phase 12.
   */
  async search(viewerId: string, q: string): Promise<UserListItem[]> {
    const term = q.trim().replace(/^@/, '').toLowerCase();
    if (!term) return [];
    const hidden = await this.visibility.hiddenUserIds(viewerId);
    const rows = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        id: { notIn: [...hidden] },
        OR: [{ username: { startsWith: term } }, { displayName: { contains: term, mode: 'insensitive' } }],
      },
      include: WITH_AVATAR,
      orderBy: [{ isVerified: 'desc' }, { followerCount: 'desc' }, { username: 'asc' }],
      take: 20,
    });
    rows.sort((a, b) => Number(b.username === term) - Number(a.username === term));
    const out = await this.prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: rows.map((r) => r.id) } }, select: { followingId: true, status: true } });
    const status = new Map(out.map((f) => [f.followingId, f.status]));
    return rows.map((u) => ({
      ...this.present.publicUser(u),
      displayName: u.displayName,
      viewer: { isSelf: u.id === viewerId, following: status.get(u.id) ?? null, followsYou: false },
    }));
  }
}
