# VYBORA

**Connect. Create. Discover.**

A next-generation social platform: social feed, short video (Reels), stories,
music, communities, real-time messaging, an AI creation studio and a creator
economy — for Android, iOS and (later) Web.

> **Project status — Phase 0 (Foundation) complete; awaiting approval to start Phase 1.**
> What exists today: requirements analysis, architecture, roadmap, the full
> PostgreSQL schema with an applied & tested initial migration, the monorepo
> skeleton, shared packages (types, validation helpers, design tokens) and
> local infrastructure. **No mobile, admin or API application code yet** —
> those are scaffolded starting in Phase 1. See the [roadmap](documentation/architecture/ROADMAP.md).

## Documentation

| Doc | What's inside |
|---|---|
| [Requirements analysis](documentation/architecture/REQUIREMENTS_ANALYSIS.md) | Scope, NFRs, risks, **decisions needing your input** |
| [Architecture](documentation/architecture/ARCHITECTURE.md) | System diagram, key decisions, module map, core flows, scaling path |
| [Roadmap](documentation/architecture/ROADMAP.md) | 16 phases with deliverables, exit criteria and estimates |
| [Third-party services](documentation/architecture/THIRD_PARTY_SERVICES.md) | Accounts to create, libraries, local substitutes |
| [Database schema](documentation/database/SCHEMA.md) | ERDs, conventions, indexes, planned migrations |
| [Feed ranking](documentation/architecture/RANKING.md) · [Music licensing](documentation/architecture/MUSIC_LICENSING.md) | Domain designs |
| [API conventions](documentation/api/CONVENTIONS.md) | REST/WS conventions, errors, pagination |
| [Security](documentation/security/SECURITY.md) | Threat model, E2EE plan, GDPR |
| [Deployment](infrastructure/deployment/README.md) | AWS target architecture |

## Repository layout

```
vybora/
├── apps/
│   ├── api/        NestJS API + workers   — Prisma schema & migrations (ready), app code from Phase 1
│   ├── mobile/     Expo React Native app  — reserved, scaffolded in Phase 1
│   └── admin/      Next.js admin          — reserved, scaffolded in Phase 14
├── packages/
│   ├── types/      API contracts shared by all apps
│   ├── shared/     validation (username, password, hashtags, mentions), cursor pagination, constants
│   ├── ui/         design tokens: palette, light/dark themes, gradients, type, spacing, motion
│   └── config/     shared tsconfig
├── infrastructure/
│   ├── docker/     docker-compose: Postgres, Redis, MinIO (S3), Mailpit
│   └── deployment/ production deployment plan
└── documentation/  architecture · database · api · security
```

Tooling: **pnpm workspaces + Turborepo**, TypeScript 5.9, Node ≥ 22.12.

## Running locally

### Prerequisites
- Node.js 22 LTS (`nvm use`), pnpm 10 (`corepack enable`)
- Docker Desktop (or any Docker engine with Compose v2)
- From Phase 1: Xcode (iOS simulator, macOS only) and/or Android Studio, plus the Expo dev client

### 1. Install
```bash
pnpm install
```

### 2. Start infrastructure
```bash
pnpm infra:up
```
| Service | URL | Credentials |
|---|---|---|
| PostgreSQL | `localhost:5432` | `vybora` / `vybora`, db `vybora` |
| Redis | `localhost:6379` | — |
| MinIO (S3) | API `localhost:9000`, console http://localhost:9001 | `vybora` / `vybora-dev-secret` |
| Mailpit | http://localhost:8025 (SMTP `1025`) | — |

> No Docker? Any local PostgreSQL 16+ and Redis 7+ work — create a `vybora`
> user/database and point `DATABASE_URL` at it.

### 3. Configure & migrate the database
```bash
cp apps/api/.env.example apps/api/.env
pnpm db:migrate        # applies prisma/migrations
pnpm db:generate       # typed Prisma client → apps/api/src/generated (git-ignored)
```

### 4. Verify
```bash
pnpm build                              # builds packages/*
pnpm test                               # unit tests (packages/shared)
pnpm --filter @vybora/api test:db       # schema smoke test against your Postgres
pnpm --filter @vybora/api db:studio     # browse the database
```

### Stop
```bash
pnpm infra:down        # add -v via docker compose to wipe volumes
```

## Security notes
- Only `.env.example` files are committed; real `.env` files are git-ignored.
- Anything prefixed `EXPO_PUBLIC_` / `NEXT_PUBLIC_` ends up in client bundles — never put secrets there.
- AI, payment, SMS and storage keys live only on the API server.

## Brand
Original VYBORA identity: the **"signal" gradient** (indigo → violet → coral)
represents *connect → create → discover*. Display type: Sora; text: Inter.
Tokens in [`packages/ui`](packages/ui/src/index.ts).
