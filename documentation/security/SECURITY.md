# Security & Privacy Design

Baseline: OWASP ASVS Level 2 for API and admin; OWASP MASVS L1 for mobile
(L2 controls for auth/session storage).

## Threats → controls

Status: authentication controls below are **implemented and tested** as of Phase 3 (see [AUTH.md](../api/AUTH.md)); content, upload and payment controls arrive with their phases.

| Threat | Controls |
|---|---|
| Credential stuffing / brute force | ✅ argon2id hashing; per-IP + per-account rate limits (lockout with Retry-After); breached-password check (HIBP k-anonymity). *Planned:* new-device login alerts |
| Token theft | ✅ 15-min JWT access tokens; refresh tokens opaque, hashed, rotated, reuse ⇒ session revoked; refresh token in Keychain/Keystore (`expo-secure-store`), access token in memory only |
| OTP / SMS abuse | ✅ HMAC-hashed codes, 10-min expiry, 5 attempts, 60 s cooldown, 5/hour per destination, per-IP limits. *Planned:* SMS country allow-list, SMS-pumping detection |
| Account enumeration | ✅ identical responses (and constant-work hashing) for login, code sign-in and forgot-password. Trade-off: sign-up reports a taken email/phone, mitigated by the sign-up rate limit |
| IDOR / privacy leaks | single `VisibilityPolicy` for every content read; explicit response serializers; authorization tests per endpoint |
| Injection | Prisma parameterized queries; no string-built SQL (raw queries only via tagged templates); zod validation |
| XSS (admin / web) | React escaping, strict CSP, no `dangerouslySetInnerHTML` on user content, sanitized link previews |
| Malicious uploads | presigned URLs scoped to key + content-type + max size; server-side magic-byte check; re-encode all images/videos (strips EXIF/GPS and payloads); quarantine status; never serve originals |
| Abuse / spam | rate limits on follow/like/comment/DM; new-account restrictions; hidden words; spam scoring; message requests for non-followers |
| Payment fraud | webhook-only fulfillment with signature verification; idempotency keys; ledger invariants; payout review & holds; KYC via provider |
| Admin misuse | staff RBAC, mandatory TOTP, IP allow-list option, every mutation in `audit_logs`, least-privilege roles |
| Secrets exposure | secrets only in server env / AWS Secrets Manager; `EXPO_PUBLIC_*` treated as public; `.env` git-ignored; secret scanning in CI |
| Data at rest | RDS + S3 encryption (KMS); private buckets; CloudFront signed URLs for private/paid media |
| Data in transit | TLS 1.2+ everywhere, HSTS |

## End-to-end encryption (messaging)
- Protocol: **Signal Protocol** (X3DH/PQXDH + Double Ratchet) for 1:1; Sender
  Keys (or MLS, RFC 9420) for groups. Implemented via **libsignal** (audited,
  Rust core) through a native module — no custom cryptography.
- Server stores only public identity/prekeys and opaque per-device ciphertext
  (schema: `e2ee_devices`, `e2ee_one_time_prekeys`, `message_envelopes`).
- Attachments encrypted client-side (AES-256-GCM key inside the encrypted
  message); uploaded blob is opaque (`media_assets.isEncrypted`).
- Trade-offs disclosed in-app: E2EE chats can't be searched server-side, AI
  features don't run on them, and moderation relies on user reports (reporter
  submits the decrypted messages).
- Enabled by default only after an **independent cryptographic review**.

## Privacy & GDPR
- Data export: `data_export_requests` → worker builds ZIP (profile, posts,
  comments, messages the user sent, payments) → signed URL valid 7 days.
- Account deletion: immediate deactivation, 30-day grace, then purge job
  (cascades personal data; financial records retained as legally required, de-identified).
- Consent: analytics, personalized ads and location each have explicit,
  revocable flags in `user_settings`; location is never inferred from IP for discovery.
- Data minimisation: IPs stored only as salted hashes / country codes.

## Legal / platform obligations (pre-launch checklist)
CSAM hash-matching & mandatory reporting · India IT Rules 2021 (grievance
officer, takedown SLAs) · EU DSA notice-and-action & transparency · age gate
13+ (18+ for monetization) · App Store / Play data-safety disclosures.
