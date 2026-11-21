# Third-Party Services & Dependencies

Every external service sits behind an interface in `apps/api/src/infra/*` with
a local/mock adapter, so the whole stack runs offline for development and tests.

## Accounts you will need (in order of when they're needed)

| Service | Purpose | Needed by | Local substitute | Notes |
|---|---|---|---|---|
| **GitHub** | Code, CI (Actions) | Phase 1 | — | |
| **Expo / EAS** | Builds, OTA updates, submissions | Phase 1 | Expo Go / dev client | Free tier OK early |
| **Sentry** | Crash & error monitoring (app + API) | Phase 1 | disabled if DSN empty | |
| **Apple Developer Program** | Sign in with Apple, TestFlight, APNs key | Phase 3 | — | US$99/yr; Apple Sign-In required on iOS if Google login offered |
| **Google Cloud / Firebase** | Google OAuth clients, FCM | Phase 3 / 12 | — | FCM also delivers to iOS via APNs key |
| **Email: Amazon SES** (or Resend) | Verification, reset, notices | Phase 3 | Mailpit (docker) | Needs domain + SPF/DKIM/DMARC |
| **SMS: MSG91** (India, DLT-registered) **+ Twilio Verify** (intl) | Phone OTP | Phase 3 | console adapter | India requires DLT template registration; enable SMS-pumping protection |
| **AWS** | S3, CloudFront, RDS Postgres, ElastiCache, ECS Fargate, SES | Phase 4 (S3), deploy | MinIO, Postgres, Redis (docker) | |
| **OpenAI** | Text, vision, image generation, speech-to-text, moderation | Phase 9 | `mock` provider | Keys server-side only |
| **Background removal / enhancement** | AI photo tools | Phase 9 | mock | OpenAI image edit, or a dedicated API — chosen in Phase 9 on quality/cost |
| **Licensed music provider** | Catalogue + streaming rights | Phase 10 | mock catalogue | **Contract required** — see REQUIREMENTS_ANALYSIS §5.3 |
| **Stripe** (+ Connect) | International payments & creator payouts | Phase 13 | Stripe test mode + CLI webhook forwarding | Connect availability varies by country |
| **Razorpay** (+ Route / RazorpayX) | India payments (UPI, cards), payouts | Phase 13 | test mode | |
| **Apple IAP / Google Play Billing** (via RevenueCat or direct) | Digital goods on mobile | Phase 13 | sandbox | Required by store rules — decision §5.1 |
| **PostHog** | Product analytics, feature flags | Phase 1+ | disabled if key empty | Respect analytics consent flag |
| **Content moderation / CSAM hash matching** | Safety | Phase 15 (before public launch) | — | e.g. PhotoDNA (Microsoft) / Thorn Safer; legal obligation |

## Key libraries

**Mobile:** expo, expo-router, react-native-reanimated, react-native-gesture-handler,
@shopify/flash-list, expo-video, expo-image, expo-camera, expo-av/expo-audio,
expo-secure-store, react-native-mmkv, @tanstack/react-query, zustand, nativewind,
socket.io-client, @sentry/react-native, posthog-react-native, @stripe/stripe-react-native,
react-native-razorpay, expo-apple-authentication, @react-native-google-signin/google-signin,
@react-native-firebase/messaging (or expo-notifications w/ FCM).

**API:** @nestjs/* (core, platform-fastify, websockets, throttler, schedule), prisma +
@prisma/adapter-pg, ioredis, bullmq, socket.io + @socket.io/redis-adapter, zod (shared
validation), argon2, jose (JWT, Apple/Google ID-token verification), @aws-sdk/client-s3 +
s3-request-presigner, sharp, fluent-ffmpeg (system ffmpeg), firebase-admin, openai,
stripe, razorpay, nodemailer, pino, @sentry/node, posthog-node.

**Admin:** next, react, tailwindcss, @tanstack/react-table, recharts, zod.

**Tooling:** pnpm workspaces, turborepo, TypeScript 5.9 (TS 7 native compiler adopted
once Expo/Nest tooling supports it), ESLint, Prettier, Vitest/node:test, Supertest,
Maestro (mobile E2E), k6 (load), Playwright (admin E2E).

Exact versions are pinned when each app is scaffolded (Phase 1) and verified to
install and build together.
