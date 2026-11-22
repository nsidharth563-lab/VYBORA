import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppException } from './api-exception.filter.js';

/**
 * Validates and normalizes a request body with a shared zod schema
 * (from @vybora/shared, the same one the app uses for its forms).
 * Unknown fields are rejected by the schemas' .strict().
 */
@Injectable()
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const r = this.schema.safeParse(value ?? {});
    if (r.success) return r.data;
    throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', r.error.issues[0]?.message ?? 'Invalid request', {
      issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
}
