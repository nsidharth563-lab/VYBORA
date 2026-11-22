import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { SentryModule } from '@sentry/nestjs/setup';
import type { AppConfig } from './config/config.js';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { MailerModule } from './infra/mailer/mailer.module.js';
import { SmsModule } from './infra/sms/sms.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
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
        MailerModule,
        SmsModule,
        ScheduleModule.forRoot(),
        AuthModule,
        HealthModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
    };
  }
}
