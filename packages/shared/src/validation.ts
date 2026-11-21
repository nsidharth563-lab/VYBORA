import { LIMITS, RESERVED_USERNAMES } from './constants.js';

const USERNAME_RE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]+$/;

/** Usernames are stored lowercase; validation runs on the normalized value. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export type UsernameProblem = 'too_short' | 'too_long' | 'invalid_chars' | 'reserved';

export function validateUsername(input: string): UsernameProblem | null {
  const u = normalizeUsername(input);
  if (u.length < LIMITS.usernameMin) return 'too_short';
  if (u.length > LIMITS.usernameMax) return 'too_long';
  if (!USERNAME_RE.test(u)) return 'invalid_chars';
  if (RESERVED_USERNAMES.has(u)) return 'reserved';
  return null;
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export type PasswordProblem = 'too_short' | 'too_long' | 'too_weak';

/**
 * NIST 800-63B style: length over composition rules. Breached-password checks
 * (k-anonymity HIBP range API) happen server-side in the auth module.
 */
export function validatePassword(pw: string): PasswordProblem | null {
  if (pw.length < 10) return 'too_short';
  if (pw.length > 128) return 'too_long';
  if (new Set(pw).size < 5) return 'too_weak';
  return null;
}

/** Extracts #hashtags from a caption: lowercase, deduplicated, capped. */
export function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  for (const m of text.matchAll(/(?:^|\s)#([\p{L}\p{M}\p{N}_]{1,64})/gu)) {
    tags.add(m[1]!.toLowerCase());
    if (tags.size >= LIMITS.hashtagsPerPost) break;
  }
  return [...tags];
}

/** Extracts @mentions using the same character rules as usernames. */
export function extractMentions(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:^|\s)@([a-z0-9._]{3,30})/gi)) out.add(m[1]!.toLowerCase());
  return [...out];
}
