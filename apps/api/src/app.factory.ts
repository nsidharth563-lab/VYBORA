import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/config.js';
import { createPino, PinoNestLogger } from './common/logger.js';

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;

/** Builds the HTTP app. Shared by main.ts and the e2e tests so both run identical wiring. */
export async function createApp(config: AppConfig): Promise<NestFastifyApplication> {
  const logger = createPino(config);
  const adapter = new FastifyAdapter({
    loggerInstance: logger,
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 1024 * 1024, // 1 MB JSON — media goes straight to S3, never through the API
    // Accept a caller's request id only if well-formed; otherwise mint one.
    genReqId: (req: IncomingMessage) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
    },
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(config), adapter, {
    logger: new PinoNestLogger(logger),
    bufferLogs: false,
  });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  await app.register(helmet, {
    // JSON API: no HTML is served, so lock CSP down completely.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  app.enableCors({
    origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : false,
    credentials: true,
    exposedHeaders: ['x-request-id', 'retry-after'],
  });
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  return app;
}
