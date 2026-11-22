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
  /** Placeholder shown while the avatar loads (blurhash). */
  avatarBlurhash?: string | null;
  isVerified: boolean;
  isPrivate: boolean;
}

export interface Relationship {
  isSelf: boolean;
  /** Viewer → profile: ACCEPTED, PENDING (request sent) or null. */
  following: FollowStatus | null;
  /** Profile → viewer (accepted follow). */
  followsYou: boolean;
  /** Profile has asked to follow the viewer (pending request). */
  requestedYou: boolean;
  blocked: boolean;
  restricted: boolean;
  muted: boolean;
  closeFriend: boolean;
}

export interface ProfileView extends PublicUser {
  bio: string | null;
  website: string | null;
  coverUrl: string | null;
  coverBlurhash?: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  /** False for private accounts the viewer doesn't follow: lists and posts are hidden. */
  canViewContent: boolean;
  viewer: Relationship;
}

/** Row in follower / following / request / block lists. */
export interface UserListItem extends PublicUser {
  displayName: string;
  viewer: Pick<Relationship, 'isSelf' | 'following' | 'followsYou'>;
}

export type MediaStatus = 'PENDING_UPLOAD' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED' | 'QUARANTINED';

export interface UploadTicket {
  mediaId: string;
  /** Presigned PUT URL — upload the bytes directly to storage. */
  uploadUrl: string;
  /** Headers that must be sent with the PUT (they're part of the signature). */
  uploadHeaders: Record<string, string>;
  expiresAt: ISODateString;
}

export interface MediaView {
  id: string;
  status: MediaStatus;
  urls: Record<string, string>;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  failureReason?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  /** Opaque, rotated on every refresh. Stored in SecureStore on device. */
  refreshToken: string;
  accessTokenExpiresAt: ISODateString;
}

/** The signed-in user's own account (never returned for other users). */
export interface MeUser extends PublicUser {
  coverUrl?: string | null;
  website?: string | null;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
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
