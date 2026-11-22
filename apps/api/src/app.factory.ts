import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import type { Logger as Pino } from 'pino';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/config.js';
import { createPino, PinoNestLogger } from './common/logger.js';

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;

export function createAdapter(config: AppConfig, logger: Pino): FastifyAdapter {
  return new FastifyAdapter({
    loggerInstance: logger,
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 1024 * 1024, // 1 MB JSON — media goes straight to S3, never through the API
    // Accept a caller's request id only if well-formed; otherwise mint one.
    genReqId: (req: IncomingMessage) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
    },
  });
}

/** HTTP-level wiring shared by production and tests (headers, CORS, prefix, request ids). */
export async function configureApp(app: NestFastifyApplication, config: AppConfig): Promise<NestFastifyApplication> {
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
    // @fastify/cors only allows GET/HEAD/POST by default — browsers need the rest too.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', 'x-request-id', 'x-client-platform', 'x-device-name', 'x-app-version'],
    maxAge: 600,
    credentials: true,
    exposedHeaders: ['x-request-id', 'retry-after'],
  });
  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  return app;
}

export async function createApp(config: AppConfig): Promise<NestFastifyApplication> {
  const logger = createPino(config);
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(config), createAdapter(config, logger), {
    logger: new PinoNestLogger(logger),
    bufferLogs: false,
  });
  return configureApp(app, config);
}
