import type { z } from 'zod';
import { ApiRequestError } from './api';

/** Client-side validation with the shared schema → { field: message }. */
export function zodFieldErrors<S extends z.ZodType>(schema: S, value: unknown): { data?: z.output<S>; errors: Record<string, string> } {
  const r = schema.safeParse(value);
  if (r.success) return { data: r.data, errors: {} };
  const errors: Record<string, string> = {};
  for (const i of r.error.issues) {
    const key = i.path.join('.') || '_form';
    errors[key] ??= i.message;
  }
  return { errors };
}

/** Human message for any thrown error (network, rate limit, server). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) {
    if (e.code === 'RATE_LIMITED' || e.code === 'OTP_COOLDOWN') {
      const s = Number(e.details?.retryAfterSec);
      return Number.isFinite(s) && s > 0 ? `${e.message} (${s > 90 ? `${Math.ceil(s / 60)} min` : `${s}s`})` : e.message;
    }
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

/** Inserts dashes while typing a YYYY-MM-DD date. */
export function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('-');
}
