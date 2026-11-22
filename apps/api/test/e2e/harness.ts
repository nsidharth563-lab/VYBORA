import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { createHash } from 'node:crypto';
import { AppModule } from '../../src/app.module.js';
import { configureApp, createAdapter } from '../../src/app.factory.js';
import { createPino, PinoNestLogger } from '../../src/common/logger.js';
import { loadConfig, type AppConfig } from '../../src/config/config.js';
import { Mailer, type MailMessage } from '../../src/infra/mailer/mailer.js';
import { PrismaService } from '../../src/infra/prisma/prisma.service.js';
import { RedisService } from '../../src/infra/redis/redis.service.js';
import { SmsSender } from '../../src/infra/sms/sms.js';
import { OAUTH_KEYS } from '../../src/modules/auth/social-auth.service.js';

export class CaptureMailer extends Mailer {
  sent: MailMessage[] = [];
  async send(m: MailMessage) {
    this.sent.push(m);
  }
}
export class CaptureSms extends SmsSender {
  sent: { to: string; body: string }[] = [];
  async send(to: string, body: string) {
    this.sent.push({ to, body });
  }
}

/** A password that the fake breach API reports as pwned. */
export const BREACHED_PASSWORD = 'password1234!';
const breachedSha1 = createHash('sha1').update(BREACHED_PASSWORD).digest('hex').toUpperCase();

/** Fake HIBP range API: only BREACHED_PASSWORD is known. */
const fakeFetch = (async (url: string | URL) => {
  const prefix = String(url).split('/').pop();
  const body = prefix === breachedSha1.slice(0, 5) ? `${breachedSha1.slice(5)}:42\r\n0000000000000000000000000000000000A:0` : '0000000000000000000000000000000000A:0';
  return new Response(body, { status: 200 });
}) as typeof fetch;

export interface TestIdP {
  sign(claims: Record<string, unknown>, opts?: { iss?: string; aud?: string; expSec?: number }): Promise<string>;
}

async function makeIdP(defaultIss: string, defaultAud: string): Promise<{ idp: TestIdP; jwk: JWK }> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: `kid-${defaultIss.length}`, alg: 'RS256', use: 'sig' };
  return {
    jwk,
    idp: {
      sign: (claims, opts = {}) =>
        new SignJWT(claims)
          .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
          .setIssuer(opts.iss ?? defaultIss)
          .setAudience(opts.aud ?? defaultAud)
          .setIssuedAt()
          .setExpirationTime(Math.floor(Date.now() / 1000) + (opts.expSec ?? 600))
          .sign(privateKey),
    },
  };
}

export const GOOGLE_CLIENT_ID = 'test-web.apps.googleusercontent.com';
export const APPLE_BUNDLE_ID = 'com.vybora.app';

export interface Harness {
  app: NestFastifyApplication;
  config: AppConfig;
  mail: CaptureMailer;
  sms: CaptureSms;
  prisma: PrismaService;
  redis: RedisService;
  google: TestIdP;
  apple: TestIdP;
  close(): Promise<void>;
}

export async function createHarness(env: Record<string, string> = {}): Promise<Harness> {
  const config = loadConfig({
    ...process.env,
    LOG_LEVEL: 'silent',
    // Isolated Redis DB so tests can flush rate-limit counters freely.
    REDIS_URL: (process.env.REDIS_URL ?? 'redis://localhost:6379').replace(/\/\d+$/, '') + '/15',
    PWNED_PASSWORD_CHECK: 'true',
    GOOGLE_OAUTH_CLIENT_IDS: GOOGLE_CLIENT_ID,
    APPLE_BUNDLE_ID,
    ...env,
  });
  const mail = new CaptureMailer();
  const sms = new CaptureSms();
  const g = await makeIdP('https://accounts.google.com', GOOGLE_CLIENT_ID);
  const a = await makeIdP('https://appleid.apple.com', APPLE_BUNDLE_ID);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] })
    .overrideProvider(Mailer)
    .useValue(mail)
    .overrideProvider(SmsSender)
    .useValue(sms)
    .overrideProvider('FETCH')
    .useValue(fakeFetch)
    .overrideProvider(OAUTH_KEYS)
    .useValue({ google: createLocalJWKSet({ keys: [g.jwk] }), apple: createLocalJWKSet({ keys: [a.jwk] }) })
    .compile();

  const logger = createPino(config);
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(config, logger), { logger: new PinoNestLogger(logger) });
  await configureApp(app, config);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return {
    app,
    config,
    mail,
    sms,
    prisma: app.get(PrismaService),
    redis: app.get(RedisService),
    google: g.idp,
    apple: a.idp,
    close: () => app.close(),
  };
}

/** Removes users created by earlier test runs (example.com emails, u_ usernames, test- social ids). */
export async function cleanTestUsers(prisma: PrismaService): Promise<void> {
  await prisma.user.deleteMany({
    where: {
      OR: [
        { username: { startsWith: 'u_' } },
        { email: { endsWith: '@example.com' } },
        { oauthAccounts: { some: { providerUserId: { startsWith: 'test-' } } } },
        { phone: { startsWith: '+1415555' } },
      ],
    },
  });
}

/** Pulls the 6-digit code out of the last email/SMS sent to `to`. */
export function lastCode(h: Harness, to: string): string {
  const mail = [...h.mail.sent].reverse().find((m) => m.to === to);
  const sms = [...h.sms.sent].reverse().find((m) => m.to === to);
  const text = mail?.text ?? sms?.body;
  const code = text?.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`no code sent to ${to}`);
  return code;
}

let n = 0;
/** Unique, valid sign-up identities per test run. */
export function uniq() {
  n++;
  const tag = `${Date.now().toString(36)}${n}`;
  // 415-555-01xx numbers are reserved for fiction but valid for libphonenumber.
  const phone = `+1415555${(1000 + n).toString()}`;
  return { tag, email: `user.${tag}@example.com`, username: `u_${tag}`.slice(0, 30), phone };
}

export const GOOD_PASSWORD = 'violet-signal-2026';
export const DOB = '1999-04-12';
