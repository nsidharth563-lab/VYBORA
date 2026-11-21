# @vybora/api

NestJS modular monolith: REST (`/v1`), WebSocket gateway (Socket.IO + Redis adapter),
and BullMQ workers (media, notifications, AI, payments, ranking) — same codebase,
different entrypoints, scaled independently.

**Status:** Database schema + initial migration are in place and tested.
NestJS application code begins in Phase 1/3.

```bash
cp .env.example .env
pnpm db:migrate      # apply migrations to local Postgres
pnpm db:generate     # generate typed Prisma client into src/generated (git-ignored)
pnpm test:db         # schema smoke test (runs in a rolled-back transaction)
pnpm db:studio       # browse data
```

Planned module layout:

```
src/
  main.ts            HTTP + WS entrypoint
  worker.ts          BullMQ worker entrypoint
  common/            guards (JWT, RBAC), interceptors, filters, pipes, rate limiting
  infra/             prisma, redis, storage (S3), queue, mailer, sms, push, ai, payments
  modules/
    auth  users  graph  media  posts  feed  stories  reels  comments
    messaging  music  communities  monetization  notifications
    search  ai-studio  moderation  admin  privacy
```
