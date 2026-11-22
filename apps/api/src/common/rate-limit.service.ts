import { HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../infra/redis/redis.service.js';
import { AppException } from './api-exception.filter.js';

export interface RateLimitRule {
  /** Logical bucket name, e.g. "login:ip". */
  name: string;
  limit: number;
  windowSec: number;
}

/**
 * Fixed-window counters in Redis (shared by every API instance).
 * Keys are hashed by the caller when they contain identifiers.
 */
@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  /** Counts one hit; throws 429 RATE_LIMITED (with retryAfterSec) when over the limit. */
  async hit(rule: RateLimitRule, subject: string): Promise<void> {
    const key = `rl:${rule.name}:${subject}`;
    const [[, count], [, ttl]] = (await this.redis.client
      .multi()
      .incr(key)
      .expire(key, rule.windowSec, 'NX')
      .ttl(key)
      .exec()) as [[null, number], [null, number], [null, number]];
    if (count > rule.limit) {
      const retryAfterSec = ttl > 0 ? ttl : rule.windowSec;
      throw new AppException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many attempts. Please wait and try again.', { retryAfterSec });
    }
  }

  async reset(rule: RateLimitRule, subject: string): Promise<void> {
    await this.redis.client.del(`rl:${rule.name}:${subject}`);
  }
}
