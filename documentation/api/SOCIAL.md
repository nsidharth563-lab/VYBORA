# Profiles, Social Graph & Media

Implemented in Phase 4. Code: `apps/api/src/modules/social`, `apps/api/src/modules/media`,
`apps/api/src/infra/{storage,queue}`; app screens in `apps/mobile/src/app` (`u/[username]`,
`edit-profile`, `follow-requests`, `close-friends`, `blocked`, Explore search).

## Visibility policy (`VisibilityService`)

One service decides what a viewer may see; every read path calls it.

| Rule | Behaviour |
|---|---|
| Target blocked the viewer | Profile responds **404 "doesn't exist"** — the blocked side can't tell it was blocked |
| Viewer blocked the target | Minimal profile (so they can unblock); no content, no lists |
| Public account | Profile, posts and lists visible to everyone not blocked |
| Private account | Profile header visible; posts and follower/following lists only for **accepted** followers |
| Item audience | `PUBLIC` → anyone who can see content · `FOLLOWERS` → accepted followers · `CLOSE_FRIENDS` → accepted followers on the owner's close-friends list · `SUBSCRIBERS` / `COMMUNITY` → denied until Phases 13 / 11 |
| Inactive accounts | Pending deletion, deleted, deactivated → 404 |

`test/e2e/social.e2e-spec.ts` checks the full matrix (2 account types × 7 viewer
relationships × item audiences) against both the service and the HTTP responses.

## Endpoints (`/v1`, all authenticated)

| Method & path | Notes |
|---|---|
| `GET /users/search?q=` | Name or @username prefix; blocked users excluded both ways; exact handle first |
| `GET /users/:username` | `ProfileView` incl. `canViewContent` and the viewer relationship |
| `GET /users/:id/followers` · `/following` | Keyset-paginated (`cursor`, `limit` ≤ 50), newest first |
| `POST` / `DELETE /users/:id/follow` | Follow (instant for public, `PENDING` request for private) / unfollow or cancel request |
| `POST` / `DELETE /users/:id/block` · `/restrict` · `/mute` | Safety controls (restrict & mute are invisible to the other person) |
| `PATCH /me/profile` | `displayName, username, bio, website, isPrivate, avatarMediaId, coverMediaId` |
| `GET /me/follow-requests` · `POST /me/follow-requests/:id/accept` · `DELETE /me/follow-requests/:id` | Requests inbox |
| `DELETE /me/followers/:id` | Remove a follower |
| `GET /me/close-friends` · `PUT` / `DELETE /me/close-friends/:id` | Close friends list |
| `GET /me/blocked` | Blocked accounts |
| `POST /media/uploads` | `{purpose: avatar|cover, mimeType, sizeBytes}` → presigned PUT ticket |
| `POST /media/:id/complete` · `GET /media/:id` | Queue processing / poll status (owner only) |

Graph rules: follower/following counters change in the **same transaction** as the
follow row (race-safe; duplicate concurrent follows count once). Blocking removes
follows and close-friend links in both directions. Switching a private account to public
approves every pending request. Follows are rate-limited (200/hour). `FOLLOW`,
`FOLLOW_REQUEST` and `FOLLOW_ACCEPTED` notification rows are written (delivered in Phase 12).

## Media pipeline

```
app ── POST /media/uploads ──▶ API: asset PENDING_UPLOAD + presigned PUT (type & length signed, 10 min)
app ── PUT bytes ───────────▶ S3 `uploads` (private)
app ── POST /complete ──────▶ API: HEAD object, size must match → UPLOADED → BullMQ `media` job
worker (dist/worker.js) ─────▶ sniff format · 50 MP bomb guard · apply EXIF rotation · strip ALL metadata
                               · WebP renditions + blurhash → S3 `media` → READY · delete original
app ── GET /media/:id ──────▶ READY → PATCH /me/profile { avatarMediaId }
```

| Purpose | Renditions |
|---|---|
| Avatar | `sm` 160×160, `lg` 480×480 |
| Cover | `sm` 750×250, `lg` 1500×500 |

Only JPEG, PNG and WebP are accepted (checked from the bytes, not the declared type);
SVG, GIF, HEIC and non-images are rejected and the asset marked `FAILED`. The phone picker
re-encodes HEIC to JPEG. Originals are never served.

**Local storage:** `docker compose` runs MinIO. Without Docker, any S3-compatible server
works (`S3_ENDPOINT`); this repo's tests were also run against the `moto` S3 emulator.
Set `S3_PUBLIC_ENDPOINT` to your computer's LAN address when uploading from a phone.

## Verified
- API: 92 tests (media pipeline against S3, social graph against Postgres + Redis).
- App: 62 tests (search → follow, private requests, block/mute/restrict/close friends,
  requests inbox, followers list, edit profile with photo upload, upload helper).
- Browser walkthrough against the real API + S3: search → follow (server count checked) →
  private request → approval → content visible → avatar upload through the full pipeline
  (480 px WebP loaded from storage) → block (blocked side receives 404) → dark mode.
  This run found a real bug — the API's CORS config allowed only GET/HEAD/POST, so every
  browser PATCH/PUT/DELETE failed. Fixed, with a regression test.
