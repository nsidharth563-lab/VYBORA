import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiError } from '@vybora/types';

/** Machine-readable error with a stable `code` for clients. */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message, status);
  }
}

const DEFAULT_CODES: Partial<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
};

/**
 * Converts every error into the uniform ApiError envelope.
 * 5xx errors are reported to Sentry and never leak internal messages.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();
    const body = toApiError(exception, String(req.id));

    if (body.statusCode >= 500) {
      Sentry.captureException(exception, { tags: { requestId: body.requestId } });
      this.logger.error(
        { err: exception, reqId: req.id, method: req.method, url: req.url },
        'unhandled error',
      );
    }
    void reply.status(body.statusCode).send(body);
  }
}

export function toApiError(exception: unknown, requestId: string): ApiError {
  if (exception instanceof AppException) {
    return {
      statusCode: exception.getStatus(),
      code: exception.code,
      message: exception.message,
      ...(exception.details ? { details: exception.details } : {}),
      requestId,
    };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse();
    const message =
      typeof res === 'string'
        ? res
        : typeof (res as { message?: unknown }).message === 'string'
          ? (res as { message: string }).message
          : exception.message;
    const issues = typeof res === 'object' ? (res as { issues?: unknown }).issues : undefined;
    return {
      statusCode: status,
      code: DEFAULT_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
      message: status >= 500 ? 'Something went wrong. Please try again.' : message,
      ...(issues ? { details: { issues } } : {}),
      requestId,
    };
  }
  // Fastify-level errors (malformed JSON, body too large) carry statusCode.
  const fastifyStatus = (exception as { statusCode?: unknown })?.statusCode;
  if (typeof fastifyStatus === 'number' && fastifyStatus >= 400 && fastifyStatus < 500) {
    return {
      statusCode: fastifyStatus,
      code: DEFAULT_CODES[fastifyStatus] ?? 'BAD_REQUEST',
      message: (exception as Error).message,
      requestId,
    };
  }
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong. Please try again.',
    requestId,
  };
}
