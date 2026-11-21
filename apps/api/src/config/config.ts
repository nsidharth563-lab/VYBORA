import { z } from 'zod';

/**
 * Environment contract for the API. Parsed once at boot; the process refuses
 * to start on invalid config (fail fast > fail at 3am on first use).
 * Secrets have no defaults in production.
 */
const devOnlyDefault = <T extends z.ZodType>(schema: T, dev: z.input<T>) => ({ schema, dev });

const csv = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );

const secrets = {
  JWT_ACCESS_SECRET: devOnlyDefault(z.string().min(32), 'dev-only-insecure-access-secret-change-me-0000'),
  OTP_PEPPER: devOnlyDefault(z.string().min(16), 'dev-only-otp-pepper-0000'),
};

const base = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  API_PUBLIC_URL: z.url().default('http://localhost:4000'),
  CORS_ORIGINS: csv,
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().startsWith('postgres'),
  REDIS_URL: z.string().startsWith('redis').default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  OTP_PEPPER: z.string().optional(),

  SENTRY_DSN: z.string().optional().transform((v) => v || undefined),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  RELEASE: z.string().optional(),
});

export type AppConfig = Omit<z.output<typeof base>, keyof typeof secrets> & {
  [K in keyof typeof secrets]: string;
};

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = base.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  const cfg = parsed.data as Record<string, unknown>;
  const isProd = parsed.data.NODE_ENV === 'production';
  const problems: string[] = [];

  for (const [key, { schema, dev }] of Object.entries(secrets)) {
    const provided = typeof cfg[key] === 'string' && cfg[key] !== '' ? cfg[key] : undefined; // empty = unset
    const value = provided ?? (isProd ? undefined : dev);
    const check = schema.safeParse(value);
    if (!check.success) {
      problems.push(`${key}: ${isProd ? 'required in production, ' : ''}${check.error.issues[0]?.message}`);
    } else {
      cfg[key] = check.data;
    }
  }
  if (isProd && parsed.data.CORS_ORIGINS.includes('*')) {
    problems.push('CORS_ORIGINS: wildcard is not allowed in production');
  }
  if (problems.length) throw new ConfigError(`Invalid environment:\n${problems.join('\n')}`);
  return cfg as AppConfig;
}

/** DI token for the parsed config object. */
export const APP_CONFIG = Symbol('APP_CONFIG');
