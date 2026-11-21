/**
 * Sentry must initialise before any other module is imported so it can
 * instrument them. Imported first by main.ts. No-op when SENTRY_DSN is empty.
 */
import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}
