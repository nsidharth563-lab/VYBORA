export const APP_NAME = 'VYBORA';
export const TAGLINE = 'Connect. Create. Discover.';

export const LIMITS = {
  usernameMin: 3,
  usernameMax: 30,
  displayNameMax: 50,
  bioMax: 160,
  captionMax: 2200,
  commentMax: 1000,
  hashtagsPerPost: 30,
  carouselMaxItems: 10,
  reelMaxDurationMs: 180_000,
  storyMaxDurationMs: 60_000,
  storyLifetimeMs: 24 * 60 * 60 * 1000,
  pageSizeDefault: 20,
  pageSizeMax: 50,
} as const;

/** Usernames that cannot be registered (routes, brand, staff impersonation). */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'api',
  'app',
  'explore',
  'help',
  'login',
  'logout',
  'me',
  'messages',
  'moderator',
  'notifications',
  'reels',
  'root',
  'settings',
  'signup',
  'staff',
  'support',
  'system',
  'vybora',
  'www',
]);
