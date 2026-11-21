import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';
import type { AppConfig } from './config/config.js';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        SentryModule.forRoot(),
        ConfigModule.forRoot(config),
        PrismaModule,
        RedisModule,
        HealthModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
    };
  }
}
