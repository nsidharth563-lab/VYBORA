/**
 * @vybora/types — contracts shared by mobile, admin and api.
 *
 * Database enums live in Prisma (apps/api/prisma/schema.prisma). The values
 * that cross the API boundary are mirrored here as string-literal unions so
 * clients never import server code. A CI check (added in Phase 3) will assert
 * these stay in sync with the Prisma enums.
 */

export type ID = string;
export type ISODateString = string;

/** Cursor pagination used by every list endpoint. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorQuery {
  cursor?: string;
  limit?: number;
}

/** Uniform error envelope returned by the API. */
export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export type UserRole = 'USER' | 'STAFF';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'PENDING_DELETION' | 'DELETED';
export type PostType = 'PHOTO' | 'VIDEO' | 'CAROUSEL' | 'REEL' | 'TEXT';
export type Visibility = 'PUBLIC' | 'FOLLOWERS' | 'CLOSE_FRIENDS' | 'COMMUNITY' | 'SUBSCRIBERS';
export type StoryType = 'PHOTO' | 'VIDEO' | 'TEXT';
export type StoryAudience = 'PUBLIC' | 'FOLLOWERS' | 'CLOSE_FRIENDS' | 'CUSTOM';
export type FollowStatus = 'ACCEPTED' | 'PENDING';
export type FeedKind = 'following' | 'recommended' | 'trending';

/** Public profile shape — never contains email, phone or other private fields. */
export interface PublicUser {
  id: ID;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  isPrivate: boolean;
}

export interface ProfileView extends PublicUser {
  bio: string | null;
  website: string | null;
  coverUrl: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  /** Relationship of the viewer to this profile. */
  viewer: {
    following: FollowStatus | null;
    followsYou: boolean;
    blocked: boolean;
    isSelf: boolean;
  };
}

export interface AuthTokens {
  accessToken: string;
  /** Opaque, rotated on every refresh. Stored in SecureStore on device. */
  refreshToken: string;
  accessTokenExpiresAt: ISODateString;
}

/** The signed-in user's own account (never returned for other users). */
export interface MeUser extends PublicUser {
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  hasPassword: boolean;
  bio: string | null;
  createdAt: ISODateString;
  /** True for social sign-ups that still need a date of birth (age gate). */
  needsProfileCompletion: boolean;
}

export interface AuthResponse {
  user: MeUser;
  tokens: AuthTokens;
  /** Signing in during the deletion grace period cancels the deletion. */
  restored?: boolean;
  /** Where a verification code was sent after sign-up (masked). */
  verification?: { channel: 'email' | 'phone'; sentTo: string };
}

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  platform: 'IOS' | 'ANDROID' | 'WEB' | null;
  appVersion: string | null;
  ipCountry: string | null;
  createdAt: ISODateString;
  lastSeenAt: ISODateString;
  current: boolean;
}

export interface CodeSentResponse {
  /** Masked destination, e.g. "no••@example.com". */
  sentTo: string;
}
