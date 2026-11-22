# VYBORA — Development Roadmap

> Status: **approved 2026-11-21**. Durations assume one full-time senior
> engineer working with Claude Code; they are planning estimates, not promises.

Each phase ends with: tests passing, docs updated, a demoable build, and an
honest status report (what's done, what's partial, what's next).

| Phase | Name | Key deliverables | Exit criteria | Est. |
|---|---|---|---|---|
| **0** | **Foundation** ✅ *(this PR)* | Requirements analysis, architecture, DB schema + initial migration, monorepo, tokens, local infra | Schema validates & migrates; smoke test & unit tests pass | done |
| **1** | **App skeletons & tooling** ✅ | Expo app (Router, tabs, theming, fonts), NestJS app (config, health, Prisma, Redis, logging, Sentry, error envelope), ESLint, CI (GitHub Actions: lint/typecheck/test + Postgres service) | `pnpm dev` runs API + app; CI green | done |
| **2** | **Design system** ✅ | Tokens with automated WCAG AA contrast tests; mobile components in `apps/mobile/src/ui`: Text, Icon, Button, IconButton, TextField, Avatar (+story rings), Badge, Chip, Card, ListItem, SwitchRow, Segmented, Tabs, Skeleton, Spinner, Sheet, Toast, EmptyState; live gallery screen | Gallery in both themes; a11y roles/labels/states tested | done |
| **3** | **Authentication** ✅ | Email/phone signup, OTP (email + SMS adapters), verify, login, refresh rotation + reuse detection, Google & Apple, forgot/reset, sessions list & revoke, logout, account deletion (grace period), rate limits | Integration tests for every flow incl. token reuse attack; screens wired | done (Google button on mobile awaits client ids) |
| **4** | **Profiles & graph** ✅ | Profile view/edit, avatar/cover upload (presigned S3 + image worker), follow/unfollow, private accounts & requests, block/restrict/mute, close friends, VisibilityPolicy | Policy test matrix (block × private × follow state) | done |
| 5 | Feed | Photo/video/carousel posts, media pipeline (sharp + FFmpeg HLS), likes, comments & replies, saves & collections, share-to-DM stub, report, following/recommended/trending feeds, ranking v1, hashtag/mention parsing | Feed p95 < 200 ms on seeded 100k-post DB; offline cache | 3 wk |
| 6 | Stories | Create (photo/video/text), stickers (poll, question, quiz, slider, mention, link, music), audience (close friends/custom), viewers, reactions, replies→DM, 24h expiry job, archive, highlights | Expiry job tested; tray ordering | 2 wk |
| 7 | Reels | Vertical pager, preload ±1, player pool, captions (WebVTT), trim, filters (GL shaders), music attach, duet & remix with attribution, trending reels, hashtag pages | 60 fps scroll on mid-range Android; ≤ 3 players mounted | 3 wk |
| 8 | Messaging | REST + WS gateway, 1:1 & group, text/image/video/voice/file, reactions, reply, forward, edit, delete (me/everyone), receipts, typing, presence, message requests, push for offline | Multi-node WS test with Redis adapter | 2.5 wk |
| 8b | E2EE for 1:1 DMs | Native libsignal module (iOS/Android), key upload/claim, PQXDH, multi-device fan-out, safety numbers | **External crypto review before enabling by default** | 3–4 wk |
| 9 | AI Studio | AiProvider + OpenAI + mock adapters, quotas & cost tracking, caption, hashtags, bio, translation, reel ideas, calendar, voice-to-caption (speech-to-text), enhance, background removal, image generation (with safety filter), video assist | Each tool works end-to-end with mock and real provider; abuse limits tested | 2.5 wk |
| 10 | Music | MusicProvider interface, Originals upload & licence capture, catalogue search, trending, playlists (collaborative), artist profiles & follow, music in reels/stories, lyrics (only where licensed) | Licence scope enforced (region, clip length) | 2 wk |
| 11 | Communities | Create/join (public/private + approval), roles, moderators, posts & announcements, chat channels, events + RSVP, interest discovery | Role permission matrix tests | 2 wk |
| 12 | Notifications & search | Notification centre, aggregation, preferences, FCM; search (users, posts, reels, hashtags, music, communities), trending searches, consented local discovery | Preference matrix tests; search relevance fixtures (incl. Hindi/Tamil) | 1.5 wk |
| 13 | Monetization | Creator onboarding/KYC (Stripe Connect / RazorpayX), tiers & subscriptions, tips, gifts, PPV unlock, promotions, brand marketplace, ledger + earnings dashboard, payouts, webhooks; IAP path per decision §5.1 | Ledger always balances (property test); webhook replay/idempotency tests | 3.5 wk |
| 14 | Admin dashboard | Next.js app, staff auth + TOTP, RBAC, analytics, users/creators, moderation queues, reports, suspensions, verification, subscriptions & payments, revenue, campaigns, system health, audit logs | Every mutation audited; RBAC tests | 3 wk |
| 15 | Security & moderation hardening | Spam heuristics, image/video moderation provider, CSAM hash matching, hidden words, GDPR export & purge jobs, ledger DB trigger, pen-test checklist, dependency audit | OWASP ASVS L2 checklist reviewed | 2 wk |
| 16 | Testing, performance & release | E2E (Maestro), load tests (k6), bundle/startup profiling, EAS builds, store listings, privacy labels, deployment (Terraform), runbooks | Store submission checklist complete | 2 wk |

**Total ≈ 9–10 months** for the full scope. A credible **public beta** (Phases
1–8 + 12 + minimal admin/moderation from 14–15) is ≈ 4–5 months.

## Dependencies between phases

```
1 → 2 → 3 → 4 → 5 ─┬→ 6
                   ├→ 7 → 10
                   ├→ 8 → 8b
                   ├→ 9
                   ├→ 11
                   └→ 12 → 13 → 14 → 15 → 16
```
Moderation basics (report + takedown) ship with Phase 5, not Phase 15 — no
user-generated content goes live without a way to remove it.
