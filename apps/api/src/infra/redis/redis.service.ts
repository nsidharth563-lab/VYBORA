import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';

/**
 * Shared Redis connection for cache, rate limits and presence.
 * BullMQ gets its own connections (it requires maxRetriesPerRequest = null).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new Redis(config.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
      connectionName: 'vybora-api',
    });
    this.client.on('error', (err: Error) => this.logger.warn(`redis error: ${err.message}`));
  }

  async ping(): Promise<void> {
    const res = await this.client.ping();
    if (res !== 'PONG') throw new Error(`unexpected PING reply: ${res}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => this.client.disconnect());
  }
}
