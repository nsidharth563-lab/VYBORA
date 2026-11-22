import type { AuthResponse, CodeSentResponse, MeUser, SessionInfo } from '@vybora/types';
import type { SignupInput } from '@vybora/shared';
import { api } from './api';

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}

const anon = { anonymous: true } as const;

/** Typed wrappers for /v1/auth and /v1/me. */
export const authApi = {
  signup: (b: SignupInput) => api.post<AuthResponse>('/v1/auth/signup', b, anon),
  login: (identifier: string, password: string) => api.post<AuthResponse>('/v1/auth/login', { identifier, password }, anon),
  usernameAvailable: (username: string, signal?: AbortSignal) =>
    api.get<{ username: string; available: boolean; reason?: string }>('/v1/auth/username-available', { query: { username }, signal, ...anon }),
  requestLoginCode: (identifier: string) => api.post<CodeSentResponse>('/v1/auth/code/request', { identifier }, anon),
  loginWithCode: (identifier: string, code: string) => api.post<AuthResponse>('/v1/auth/code/verify', { identifier, code }, anon),
  forgotPassword: (identifier: string) => api.post<CodeSentResponse>('/v1/auth/password/forgot', { identifier }, anon),
  resetPassword: (identifier: string, code: string, newPassword: string) =>
    api.post<void>('/v1/auth/password/reset', { identifier, code, newPassword }, anon),
  refresh: (refreshToken: string) => api.post<TokenPair>('/v1/auth/refresh', { refreshToken }, anon),
  apple: (identityToken: string, nonce: string, fullName?: string) =>
    api.post<AuthResponse>('/v1/auth/oauth/apple', { identityToken, nonce, ...(fullName ? { fullName } : {}) }, anon),
  google: (idToken: string) => api.post<AuthResponse>('/v1/auth/oauth/google', { idToken }, anon),

  logout: () => api.post<void>('/v1/auth/logout'),
  logoutAll: () => api.post<{ signedOut: number }>('/v1/auth/logout-all'),
  sessions: () => api.get<SessionInfo[]>('/v1/auth/sessions'),
  revokeSession: (id: string) => api.del<void>(`/v1/auth/sessions/${id}`),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ otherSessionsSignedOut: number }>('/v1/auth/password/change', { currentPassword, newPassword }),

  me: () => api.get<MeUser>('/v1/me'),
  sendVerification: (channel: 'email' | 'phone') => api.post<CodeSentResponse>('/v1/me/verify/send', { channel }),
  verifyContact: (channel: 'email' | 'phone', code: string) => api.post<MeUser>('/v1/me/verify', { channel, code }),
  completeProfile: (dateOfBirth: string, username?: string) => api.post<MeUser>('/v1/me/complete-profile', { dateOfBirth, ...(username ? { username } : {}) }),
  deletionCode: () => api.post<CodeSentResponse>('/v1/me/delete/code'),
  deleteAccount: (proof: { password?: string; code?: string }) => api.post<{ scheduledFor: string }>('/v1/me/delete', proof),
};
