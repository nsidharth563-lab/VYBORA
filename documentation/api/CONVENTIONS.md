# API Conventions

- Base path `/v1`. Breaking changes ⇒ `/v2` alongside; deprecations announced via `Deprecation` header.
- JSON, camelCase. Timestamps ISO-8601 UTC. Money `{ amountMinor, currency }`.
- Auth: `Authorization: Bearer <accessToken>`. Refresh via `POST /v1/auth/refresh` with the opaque refresh token.
- **Pagination:** `?cursor=&limit=` → `{ items, nextCursor }` (keyset, see `@vybora/shared` cursor helpers). Max `limit` 50.
- **Idempotency:** all money-moving and content-creating POSTs accept `Idempotency-Key`; messages use `clientMessageId`.
- **Errors:** `{ statusCode, code, message, details?, requestId }` — `code` is a stable machine string (`AUTH_INVALID_CREDENTIALS`, `RATE_LIMITED`, …). Never leak stack traces or whether an email exists (login/forgot-password return identical responses).
- **Validation:** zod schemas at the edge; unknown fields rejected.
- **Rate limits:** per-IP and per-user token buckets in Redis; `429` with `Retry-After`.
- **Public vs private fields:** responses are built with explicit serializers (`PublicUser`, `ProfileView` in `@vybora/types`). Email, phone, DOB, IP data, settings are only ever returned to the owner.
- **Docs:** OpenAPI generated from controllers at `/v1/docs` (non-production) and exported to `documentation/api/openapi.json` in CI.

## WebSocket events (namespace `/rt`)
Client → server: `message:send`, `message:read`, `typing:start|stop`, `presence:subscribe`.
Server → client: `message:new|updated|deleted`, `message:reaction`, `receipt:read`, `typing`, `presence`, `notification:new`, `counter:update`.
Every client event is acked with `{ ok, error? }`; auth via access token in the handshake, re-validated on token refresh.
