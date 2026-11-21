import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';

type CheckResult = { status: 'up' | 'down'; latencyMs: number; error?: string };

async function timed(fn: () => Promise<void>, timeoutMs = 2000): Promise<CheckResult> {
  const start = performance.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs).unref()),
    ]);
    return { status: 'up', latencyMs: Math.round(performance.now() - start) };
  } catch (e) {
    return { status: 'down', latencyMs: Math.round(performance.now() - start), error: (e as Error).message };
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Liveness: the process is up. Never touches dependencies. */
  @Get()
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', service: 'vybora-api', release: this.config.RELEASE ?? 'dev' };
  }

  /** Readiness: dependencies reachable. Load balancer routes traffic only when 200. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    const [database, redis] = await Promise.all([timed(() => this.prisma.ping()), timed(() => this.redis.ping())]);
    const ok = database.status === 'up' && redis.status === 'up';
    reply.status(ok ? 200 : 503);
    // Error details only outside production (avoid leaking infra info).
    const strip = (c: CheckResult) =>
      this.config.NODE_ENV === 'production' ? { status: c.status, latencyMs: c.latencyMs } : c;
    return { status: ok ? 'ok' : 'degraded', checks: { database: strip(database), redis: strip(redis) } };
  }
}
