import type { LoggerService } from '@nestjs/common';
import { pino, type Logger as Pino } from 'pino';
import type { AppConfig } from '../config/config.js';

/** Structured JSON logs; pretty output in local development. */
export function createPino(config: AppConfig): Pino {
  return pino({
    level: config.LOG_LEVEL,
    base: { service: 'vybora-api', env: config.NODE_ENV },
    // Never log credentials or tokens, even by accident.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'headers.authorization',
        '*.password',
        '*.refreshToken',
        '*.accessToken',
        '*.otp',
        '*.code',
      ],
      censor: '[redacted]',
    },
    ...(config.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
      : {}),
  });
}

/** Routes Nest's internal logs into the same pino instance. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly pino: Pino) {}
  private write(level: 'info' | 'error' | 'warn' | 'debug' | 'trace', message: unknown, rest: unknown[]) {
    const context = typeof rest.at(-1) === 'string' ? (rest.at(-1) as string) : undefined;
    if (message && typeof message === 'object') {
      const { msg, ...obj } = message as Record<string, unknown> & { msg?: string };
      this.pino[level]({ context, ...obj }, (rest.length > 1 ? (rest[0] as string) : msg) ?? '');
    } else {
      this.pino[level]({ context }, String(message));
    }
  }
  log(message: unknown, ...rest: unknown[]) { this.write('info', message, rest); }
  error(message: unknown, ...rest: unknown[]) { this.write('error', message, rest); }
  warn(message: unknown, ...rest: unknown[]) { this.write('warn', message, rest); }
  debug(message: unknown, ...rest: unknown[]) { this.write('debug', message, rest); }
  verbose(message: unknown, ...rest: unknown[]) { this.write('trace', message, rest); }
}
