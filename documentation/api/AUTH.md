# Authentication & Accounts

Implemented in Phase 3. Code: `apps/api/src/modules/auth`, shared request rules in
`packages/shared/src/auth.ts`, app screens in `apps/mobile/src/app`.

## Tokens

| Token | Format | Lifetime | Stored |
|---|---|---|---|
| Access | HS256 JWT `{sub, sid, ver, role}`, `iss=vybora-api`, `aud=vybora-app` | 15 min | App memory only |
| Refresh | 256-bit random, opaque | 30 days, **single use** | Server: SHA-256 only. App: iOS Keychain / Android Keystore (`expo-secure-store`) |

- Every authenticated request also checks the session row, the user's `tokenVersion`
  and account status, so logout, "sign out everywhere", password reset and suspension
  take effect **immediately**, not at token expiry.
- **Rotation + reuse detection:** each refresh returns a new pair. Presenting an
  already-used refresh token means it was copied → the whole session is revoked
  (`AUTH_REFRESH_REUSED`) and audited. Concurrent refreshes are race-safe (conditional update).
- The app refreshes once on `AUTH_TOKEN_EXPIRED` (single-flight for concurrent requests)
  and replays the request; any other 401 signs it out locally.

## Endpoints (`/v1`)

Public:

| Method & path | Body | Result |
|---|---|---|
| `POST /auth/signup` | `{email | phone, password, username, displayName, dateOfBirth}` | 201 `AuthResponse` + verification code sent |
| `GET /auth/username-available?username=` | — | `{username, available, reason?}` |
| `POST /auth/login` | `{identifier, password}` (email, phone or username) | 200 `AuthResponse` (`restored: true` if a pending deletion was cancelled) |
| `POST /auth/code/request` | `{identifier}` | 202 `{sentTo}` — only to **verified** contacts; same response for unknown accounts |
| `POST /auth/code/verify` | `{identifier, code}` | 200 `AuthResponse` |
| `POST /auth/password/forgot` | `{identifier}` | 202 `{sentTo}` — same response for unknown accounts |
| `POST /auth/password/reset` | `{identifier, code, newPassword}` | 204; signs out every device; verifies the contact used |
| `POST /auth/refresh` | `{refreshToken}` | 200 new token pair |
| `POST /auth/oauth/google` | `{idToken}` | 200 `AuthResponse` |
| `POST /auth/oauth/apple` | `{identityToken, nonce, fullName?}` | 200 `AuthResponse` |

Authenticated:

| Method & path | Result |
|---|---|
| `GET /me` | Own account (`MeUser`) — the only response that contains email/phone |
| `POST /me/verify/send` `{channel}` · `POST /me/verify` `{channel, code}` | Verify email / phone |
| `POST /me/complete-profile` `{dateOfBirth, username?}` | Age gate for Apple/Google sign-ups |
| `POST /auth/logout` · `POST /auth/logout-all` | Revoke this / every session |
| `GET /auth/sessions` · `DELETE /auth/sessions/:id` | Devices list (current flagged) / sign one out |
| `POST /auth/password/change` `{currentPassword, newPassword}` | Signs out other devices |
| `POST /me/delete/code` · `POST /me/delete` `{password | code}` | Schedule deletion (re-authentication required) |

## One-time codes
6 digits · HMAC-SHA256 with a server pepper at rest · 10-minute expiry · 5 attempts ·
60 s resend cooldown · 5 per hour per destination+purpose · only the newest code is valid ·
single use (race-safe). SMS text starts with the code for iOS/Android autofill.

## Rate limits (Redis, shared by all instances)
| Bucket | Limit |
|---|---|
| Sign-up per IP | 10 / hour |
| Login per IP | 30 / 15 min |
| Login per account (lockout) | 8 failures / 15 min (reset on success) |
| Code / reset requests per IP | 15 / hour |
| Refresh per IP | 120 / 15 min |

429 responses carry `code: RATE_LIMITED` (or `OTP_COOLDOWN`) and a `Retry-After` header.

## Google & Apple
The app obtains an ID token from the provider; the API verifies signature (provider
JWKS), issuer, audience (our client ids), expiry, and for Apple the nonce
(`sha256(rawNonce)`). Account linking:
1. Known provider id → sign in.
2. Provider-verified email matching a **verified** VYBORA email → link and sign in.
3. Provider-verified email matching an **unverified** VYBORA claim → the unverified
   claim is released and a new account is created (prevents pre-registration takeover).
4. Otherwise → new account with a generated username; `needsProfileCompletion` until
   the user enters a date of birth (13+).

**Status:** server side complete and tested. Mobile: Sign in with Apple is wired
(iOS only, hidden elsewhere). The Google button is **not shown yet** — it needs your
Google OAuth client ids and a development build with the native Google Sign-In SDK.

## Account deletion
Requires password or an emailed/SMS code → account deactivated, every session revoked,
erasure scheduled after `ACCOUNT_DELETION_GRACE_DAYS` (30). Signing in during the grace
period cancels it. An hourly job erases due accounts; cascades remove the user's data;
payments keep a de-identified row for legal retention. Purge of users who still own a
community is deferred until ownership transfer exists (Phase 11) and is logged.

## Enumeration resistance
Login failures, code sign-in requests and password-reset requests respond identically
whether or not the account exists (password hashing runs against a dummy hash for unknown
users). **Trade-off:** sign-up reports `EMAIL_TAKEN` / `PHONE_TAKEN` so people can recover
their account; this is mitigated by the sign-up rate limit.

## Error codes
`VALIDATION_FAILED`, `AUTH_REQUIRED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED`,
`AUTH_TOKEN_INVALID`, `AUTH_SESSION_REVOKED`, `AUTH_REFRESH_INVALID`, `AUTH_REFRESH_REUSED`,
`AUTH_ACCOUNT_SUSPENDED`, `AUTH_SOCIAL_INVALID`, `AUTH_PROVIDER_UNAVAILABLE`,
`USERNAME_TAKEN`, `EMAIL_TAKEN`, `PHONE_TAKEN`, `PASSWORD_BREACHED`, `OTP_INVALID`,
`OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`, `OTP_COOLDOWN`, `RATE_LIMITED`, `NO_PASSWORD`,
`NO_CONTACT`, `NO_VERIFIED_CONTACT`, `ALREADY_VERIFIED`.

## Tests
- `apps/api/test/e2e/auth.e2e-spec.ts` — 31 integration tests (real Postgres + Redis),
  including refresh-token theft, concurrent refresh races, lockout, enumeration,
  Google/Apple token forgery cases. The theft/race tests were verified to fail when
  reuse detection is removed.
- `apps/mobile/src/__tests__/navigation.test.tsx` — every screen flow against an
  in-memory fake of this API.
- A browser walkthrough of the web build against the real API (sign-up → emailed code →
  verify → sessions → reload restores session → logout → wrong password → login →
  second device via one-time code) passed with no console errors.
