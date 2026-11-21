import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { AppException, toApiError } from './api-exception.filter.js';

describe('toApiError', () => {
  it('maps AppException with code and details', () => {
    const e = new AppException(HttpStatus.CONFLICT, 'USERNAME_TAKEN', 'That username is taken', { field: 'username' });
    expect(toApiError(e, 'r1')).toEqual({
      statusCode: 409,
      code: 'USERNAME_TAKEN',
      message: 'That username is taken',
      details: { field: 'username' },
      requestId: 'r1',
    });
  });

  it('maps built-in HttpExceptions to default codes', () => {
    expect(toApiError(new NotFoundException('nope'), 'r2')).toMatchObject({ statusCode: 404, code: 'NOT_FOUND', message: 'nope' });
    expect(toApiError(new BadRequestException(), 'r3')).toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
  });

  it('hides internal error messages', () => {
    const out = toApiError(new Error('connection string postgres://secret@db leaked'), 'r4');
    expect(out).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', requestId: 'r4' });
  });

  it('passes through fastify client errors (e.g. malformed JSON)', () => {
    const fe = Object.assign(new Error('Body is not valid JSON'), { statusCode: 400 });
    expect(toApiError(fe, 'r5')).toMatchObject({ statusCode: 400, code: 'BAD_REQUEST' });
  });
});
