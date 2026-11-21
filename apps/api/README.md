# @vybora/api

NestJS 12 (ESM) on Fastify · Prisma 7 (PostgreSQL) · Redis (ioredis) · pino logs · Sentry.
Modular monolith: REST under `/v1` now; WebSocket gateway and BullMQ workers are added
by the phases that need them (media in Phase 4/5, messaging in Phase 8).

## Run

```bash
cp .env.example .env      # works as-is against `pnpm infra:up`
pnpm db:migrate           # apply migrations
pnpm dev                  # http://localhost:4000/v1/health
```

| Endpoint | Purpose |
|---|---|
| `GET /v1/health` | Liveness (no dependency calls) |
| `GET /v1/health/ready` | Readiness — Postgres & Redis checks, 503 when degraded |

| Script | What it does |
|---|---|
| `pnpm test` | Vitest: unit specs (`src/**/*.spec.ts`) + e2e (`test/e2e`, needs Postgres + Redis) |
| `pnpm test:db` | Schema smoke test (rolled-back transaction) |
| `pnpm build` / `pnpm start` | Compile to `dist/` / run compiled server |
| `pnpm typecheck` / `pnpm lint` | `tsc --noEmit` / ESLint |
| `pnpm db:generate` · `db:migrate` · `db:deploy` · `db:studio` | Prisma |

## What's in place (Phase 1)
- **Config** (`src/config`): zod-validated env, fail-fast boot; secrets mandatory in production, dev defaults locally.
- **Errors** (`src/common/api-exception.filter.ts`): every error → `{ statusCode, code, message, details?, requestId }`; 5xx messages never leak internals and are sent to Sentry.
- **Request IDs**: accepts a well-formed `x-request-id`, otherwise generates one; echoed in responses and logs.
- **Security headers** (helmet, locked-down CSP), **CORS** allow-list, 1 MB body limit.
- **Logging**: structured pino JSON with credential redaction; pretty output in development.
- **Infra modules**: `PrismaService` (driver adapter `@prisma/adapter-pg`), `RedisService`.

## Conventions
- ESM: relative imports end in `.js`.
- Constructor-injected classes must be **value** imports (not `import type`) — Nest DI relies on decorator metadata.
- Validation: zod schemas shared via `@vybora/shared` (from Phase 3).
