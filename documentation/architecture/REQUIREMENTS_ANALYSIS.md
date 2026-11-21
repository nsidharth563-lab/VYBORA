# VYBORA — Requirements Analysis

> Status: **approved 2026-11-21** · decisions recorded in §7

## 1. What we are building

A single consumer app that merges five product categories that normally live in
separate companies: a photo/social graph, short-form video, ephemeral stories,
real-time messaging and a creator economy — plus music, communities and an AI
creation suite. Plus a staff admin dashboard and the backend behind both.

The scope is roughly equivalent to **8–10 independent products**. The plan
below treats it that way: one shared platform (identity, media, graph,
notifications, moderation, payments ledger) and feature modules built on top,
shipped in phases that are each usable on their own.

## 2. Requirements by domain

| # | Domain | Core (MVP) | Extended | Hard parts |
|---|--------|-----------|----------|-----------|
| 3 | Auth | email/phone + password, OTP, verify, refresh rotation, sessions, logout, delete | Google, Apple, passkeys later | Apple Sign-In is **mandatory** on iOS if Google is offered (App Store 4.8); SMS cost & fraud (SMS pumping) |
| 4 | Profiles | profile CRUD, follow, private accounts, requests, block | restrict, mute, verification | Privacy checks must be enforced on *every* read path |
| 5 | Feed | following feed, likes, comments, replies, saves, report | recommended, trending | Fan-out strategy; ranking that's explainable now, ML-ready later |
| 6 | Stories | photo/video/text, 24h, viewers, reactions/replies, close friends | highlights, polls, questions, stickers, music | Sticker editor UX; story tray ordering |
| 7 | Reels | vertical player, autoplay, preload, like/comment/share | trim, filters, effects, duet, remix, music | **Video pipeline** (transcode → HLS), player memory on low-end Android |
| 8 | AI Studio | caption, hashtags, bio, translation, reel ideas | enhance, bg removal, image gen, voice-to-caption, calendar | Cost control, abuse/NSFW generation, provider swap |
| 9 | Messaging | 1:1, groups, text/media/voice, receipts, typing, reactions, edit/delete | E2EE, calls | **E2EE on React Native** (see §5), multi-device |
| 10 | Music | licensed catalogue search, attach to reels/stories, playlists | lyrics, artist profiles, collab playlists | **Licensing** — not an engineering problem; blocks launch of the feature |
| 11 | Communities | public/private, posts, roles, chat | events, discovery by interest | Moderation delegated to community mods |
| 12 | Monetization | tips, subscriptions, ledger, earnings, payouts | gifts, PPV, promotions, brand marketplace | KYC, tax (GST/VAT/1099), **app-store in-app purchase rules** (see §5) |
| 13 | Notifications | in-app + push, preferences | aggregation, digest | Fan-out volume, quiet hours |
| 14 | Search | users, hashtags, posts | music, communities, local (consented) | Relevance, multilingual (Indic scripts) |
| 15 | Admin | users, reports, suspension, audit log | revenue, campaigns, system health | Staff RBAC + MFA, audit everything |
| 16 | Security | rate limits, validation, upload safety, GDPR export/delete | spam ML, CSAM hash-matching | **Legal obligations** (CSAM reporting, IT Rules 2021 in India, DSA in EU) |

## 3. Non-functional requirements

- **Low bandwidth first** (India / emerging markets): adaptive HLS (240p→1080p),
  AVIF/WebP images with blurhash placeholders, cursor pagination, request
  coalescing, offline queue for posts & messages.
- **Low-end Android**: ≤ 3 video players mounted at once, FlashList everywhere,
  Hermes, no heavy JS work on scroll.
- **Startup**: cold start < 2.5 s on mid-range Android — lazy routes, cached
  feed page rendered before network.
- **API**: p95 < 200 ms for reads at launch scale; all list endpoints indexed &
  keyset-paginated.
- **Scale strategy**: modular monolith + separately scalable worker pools; split
  services only when a module's load or team ownership demands it.

## 4. Things I recommend NOT doing (or deferring)

| Item | Recommendation | Why |
|------|---------------|-----|
| Microservices from day one | **No** — modular monolith | Prompt itself says avoid premature microservices; module boundaries make later extraction cheap |
| Voice/video calling | Defer (already optional) | Needs TURN infra + WebRTC/LiveKit; separate module |
| Live streaming | Not in scope | Virtual gifts are designed to work on posts/reels/DMs now and on live later |
| ML recommender | Phase 2 of ranking | Need interaction data first; v1 is transparent weighted rules |
| Custom crypto | **Never** | Signal Protocol / MLS via audited libraries only |

## 5. Risks & decisions that need your input

These change the plan materially. My recommendation is in **bold**.

1. **In-app purchase rules.** Apple & Google require their own billing for
   *digital goods consumed in the app* — which can include subscriptions to
   creators, virtual gifts and paid content. Stripe/Razorpay for these flows
   inside the iOS app risks rejection. Options: (a) IAP for gifts/coins &
   subscriptions on mobile, Stripe/Razorpay on web + for payouts; (b) web
   checkout only, with the external-link entitlements where available (US, EU,
   some regions). **Recommend (a): a "coins" model bought via IAP
   (RevenueCat-style abstraction), ledger-tracked, with Stripe Connect /
   RazorpayX for creator payouts and web purchases.** The ledger in the schema
   supports either.
2. **End-to-end encryption.** Signal's official `libsignal` has no supported
   React Native binding. Options: (a) build a native module over libsignal's
   Rust core (iOS + Android) — most correct, ~3–4 weeks of specialist work,
   plus an external security review; (b) Matrix `vodozemac` (Olm/Megolm, audited)
   via Rust/uniffi bindings; (c) ship messaging with TLS + encryption at rest
   first, add E2EE as its own milestone. **Recommend (c) then (a)**: messaging
   lands in Phase 7 with the E2EE-ready schema (already included), and E2EE for
   1:1 DMs ships in Phase 7b. E2EE also means *no server-side moderation or AI
   on those messages* — that's an accepted trade-off, reporting works by the
   reporter forwarding decrypted content.
3. **Music licensing.** No engineering work makes unlicensed music legal. The
   module is built against a `MusicProvider` interface with (i) a "VYBORA
   Originals" provider where rights holders upload & grant licences, and (ii) a
   slot for a licensed catalogue (e.g. a UGC-licensing music API or label
   deals). **Recommend launching with Originals + royalty-free library; add a
   commercial catalogue when a contract exists.**
4. **Legal/compliance before public launch** (not code, but blocks launch):
   privacy policy & ToS, India IT Rules 2021 (grievance officer, 24/36h takedown
   SLAs), EU DSA notice-and-action, COPPA/age gating (13+; 18+ for monetization),
   CSAM detection & NCMEC reporting (PhotoDNA or similar), GST/tax handling for
   creator earnings.
5. **Hosting choice.** **Recommend AWS** (S3/CloudFront named in the brief):
   ECS Fargate for API/workers, RDS PostgreSQL, ElastiCache Redis,
   MediaConvert *or* self-run FFmpeg workers (start with FFmpeg on Fargate —
   cheaper at low volume, as the brief specifies).
6. **Search engine.** **Recommend PostgreSQL full-text + `pg_trgm` at launch**,
   behind a `SearchIndex` interface; move to OpenSearch/Meilisearch when query
   volume or relevance needs justify it.

## 6. Definition of "done" for each feature

A feature is reported complete only when: API endpoint(s) implemented with
validation and authorization; unit + integration tests pass; mobile screen
wired to the real API (no dead buttons); error/empty/loading states exist;
documentation updated. Anything short of that is reported as partial, with
what's missing.

## 7. Decision record (approved 2026-11-21)

| # | Decision | Consequence for the build |
|---|---|---|
| D1 | **Mobile digital goods via App Store / Play billing** ("coins", subscriptions); Stripe + Razorpay for web purchases and creator payouts (Stripe Connect / RazorpayX) | Phase 13 adds an `IAP` payment provider (receipt/server-notification verification) alongside Stripe & Razorpay; all three feed the same ledger |
| D2 | **Messaging ships with TLS + encryption at rest first; E2EE for 1:1 DMs follows as Phase 8b** via a native libsignal module, enabled by default only after an external crypto review | Phase 8 uses `isE2ee = false`; schema already supports envelopes |
| D3 | **Music launches with VYBORA Originals + a royalty-free library**; commercial catalogue only under contract | Phase 10 builds two providers + adapter slot |
| D4 | **AWS hosting** (ECS Fargate, RDS, ElastiCache, S3, CloudFront, SES) | Terraform in Phase 16 |
| D5 | Postgres full-text + `pg_trgm` search at launch | Phase 5/12 migrations |
