import { Injectable } from '@nestjs/common';
import type { MeUser, PublicUser } from '@vybora/types';
import type { MediaAsset, User } from '../../generated/prisma/client.js';
import { StorageService } from '../../infra/storage/storage.service.js';

type Media = Pick<MediaAsset, 'status' | 'variants' | 'blurhash'> | null | undefined;
export type UserWithMedia = User & { avatar?: Media; cover?: Media };

/** Prisma `include` that every presenter call needs. */
export const WITH_MEDIA = {
  avatar: { select: { status: true, variants: true, blurhash: true } },
  cover: { select: { status: true, variants: true, blurhash: true } },
} as const;
export const WITH_AVATAR = { avatar: WITH_MEDIA.avatar } as const;

/**
 * The only place User rows become API shapes. Public shapes can't include
 * email/phone/birth date because those fields are never copied here.
 */
@Injectable()
export class UserPresenter {
  constructor(private readonly storage: StorageService) {}

  mediaUrl(m: Media, variant: string): string | null {
    if (!m || m.status !== 'READY' || !m.variants) return null;
    const key = (m.variants as Record<string, string>)[variant];
    return key ? this.storage.publicUrl(key) : null;
  }

  publicUser(u: Pick<User, 'id' | 'username' | 'displayName' | 'isVerified' | 'isPrivate'> & { avatar?: Media }): PublicUser {
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: this.mediaUrl(u.avatar, 'lg'),
      avatarBlurhash: u.avatar?.status === 'READY' ? u.avatar.blurhash : null,
      isVerified: u.isVerified,
      isPrivate: u.isPrivate,
    };
  }

  me(u: UserWithMedia): MeUser {
    return {
      ...this.publicUser(u),
      coverUrl: this.mediaUrl(u.cover, 'lg'),
      website: u.website,
      followerCount: u.followerCount,
      followingCount: u.followingCount,
      postCount: u.postCount,
      email: u.email,
      emailVerified: !!u.emailVerifiedAt,
      phone: u.phone,
      phoneVerified: !!u.phoneVerifiedAt,
      hasPassword: !!u.passwordHash,
      bio: u.bio,
      createdAt: u.createdAt.toISOString(),
      needsProfileCompletion: !u.dateOfBirth,
    };
  }
}
