import { createHmac } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { DevicePlatform } from '../generated/prisma/client.js';

export interface ClientContext {
  /** HMAC of the client IP — lets us rate-limit/audit without storing raw IPs. */
  ipHash: string;
  ipCountry: string | null;
  userAgent: string | null;
  platform: DevicePlatform | null;
  deviceName: string | null;
  appVersion: string | null;
  requestId: string;
}

const PLATFORMS: Record<string, DevicePlatform> = { ios: 'IOS', android: 'ANDROID', web: 'WEB' };
const clean = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim() ? v.replace(/[^\p{L}\p{N} ._'’()\-/:;,]/gu, '').trim().slice(0, max) || null : null;

/**
 * Builds the client context from a request. `x-client-*` headers are set by
 * the VYBORA app; they're informational (shown in the sessions list), never trusted for auth.
 */
export function clientContext(req: FastifyRequest, ipSecret: string, trustProxy: boolean): ClientContext {
  const h = req.headers;
  const country = trustProxy ? (h['cloudfront-viewer-country'] ?? h['cf-ipcountry']) : undefined;
  return {
    ipHash: createHmac('sha256', ipSecret).update(req.ip ?? '').digest('hex').slice(0, 32),
    ipCountry: typeof country === 'string' && /^[A-Z]{2}$/.test(country) ? country : null,
    userAgent: clean(h['user-agent'], 200),
    platform: PLATFORMS[String(h['x-client-platform'] ?? '').toLowerCase()] ?? null,
    deviceName: clean(h['x-device-name'], 64),
    appVersion: clean(h['x-app-version'], 32),
    requestId: String(req.id),
  };
}
