import type { CursorPage, FollowStatus, MediaView, MeUser, ProfileView, UploadTicket, UserListItem } from '@vybora/types';
import { api } from './api';

export interface ProfilePatch {
  displayName?: string;
  username?: string;
  bio?: string;
  website?: string;
  isPrivate?: boolean;
  avatarMediaId?: string | null;
  coverMediaId?: string | null;
}

/** Typed wrappers for profiles, the social graph and media uploads. */
export const socialApi = {
  profile: (username: string) => api.get<ProfileView>(`/v1/users/${encodeURIComponent(username)}`),
  search: (q: string, signal?: AbortSignal) => api.get<UserListItem[]>('/v1/users/search', { query: { q }, signal }),
  followers: (userId: string, cursor?: string) => api.get<CursorPage<UserListItem>>(`/v1/users/${userId}/followers`, { query: { cursor } }),
  following: (userId: string, cursor?: string) => api.get<CursorPage<UserListItem>>(`/v1/users/${userId}/following`, { query: { cursor } }),

  follow: (userId: string) => api.post<{ following: FollowStatus }>(`/v1/users/${userId}/follow`),
  unfollow: (userId: string) => api.del<{ following: null }>(`/v1/users/${userId}/follow`),
  setBlocked: (userId: string, on: boolean) => (on ? api.post<void>(`/v1/users/${userId}/block`) : api.del<void>(`/v1/users/${userId}/block`)),
  setRestricted: (userId: string, on: boolean) => (on ? api.post<void>(`/v1/users/${userId}/restrict`) : api.del<void>(`/v1/users/${userId}/restrict`)),
  setMuted: (userId: string, on: boolean) => (on ? api.post<void>(`/v1/users/${userId}/mute`) : api.del<void>(`/v1/users/${userId}/mute`)),
  setCloseFriend: (userId: string, on: boolean) => (on ? api.put<void>(`/v1/me/close-friends/${userId}`) : api.del<void>(`/v1/me/close-friends/${userId}`)),

  updateProfile: (patch: ProfilePatch) => api.patch<MeUser>('/v1/me/profile', patch),
  requests: (cursor?: string) => api.get<CursorPage<UserListItem>>('/v1/me/follow-requests', { query: { cursor } }),
  acceptRequest: (userId: string) => api.post<void>(`/v1/me/follow-requests/${userId}/accept`),
  declineRequest: (userId: string) => api.del<void>(`/v1/me/follow-requests/${userId}`),
  removeFollower: (userId: string) => api.del<void>(`/v1/me/followers/${userId}`),
  closeFriends: () => api.get<UserListItem[]>('/v1/me/close-friends'),
  blocked: () => api.get<UserListItem[]>('/v1/me/blocked'),

  createUpload: (purpose: 'avatar' | 'cover', mimeType: string, sizeBytes: number) =>
    api.post<UploadTicket>('/v1/media/uploads', { purpose, mimeType, sizeBytes }),
  completeUpload: (mediaId: string) => api.post<MediaView>(`/v1/media/${mediaId}/complete`),
  media: (mediaId: string) => api.get<MediaView>(`/v1/media/${mediaId}`),
};
