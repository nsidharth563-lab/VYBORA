import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserRole } from '../../generated/prisma/client.js';

export interface AuthContext {
  userId: string;
  sessionId: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export const IS_PUBLIC = 'vybora:isPublic';
/** Route needs no access token. Everything else is authenticated by default. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Injects the authenticated caller ({ userId, sessionId, role }). */
export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<FastifyRequest>();
  if (!req.auth) throw new Error('CurrentAuth used on a public route');
  return req.auth;
});
