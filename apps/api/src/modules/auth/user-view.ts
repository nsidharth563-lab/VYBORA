import type { MeUser } from '@vybora/types';
import type { User } from '../../generated/prisma/client.js';

/** The only place a User row becomes the private "me" shape. */
export function toMe(u: User): MeUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: null, // media pipeline arrives in Phase 4
    isVerified: u.isVerified,
    isPrivate: u.isPrivate,
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
