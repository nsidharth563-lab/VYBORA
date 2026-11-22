import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/app.factory.js';
import { loadConfig } from '../../src/config/config.js';

/** Boots the real app (real Postgres + Redis from DATABASE_URL / REDIS_URL). */
describe('API (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp(loadConfig({ ...process.env, CORS_ORIGINS: 'http://allowed.test', LOG_LEVEL: 'silent' }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  const inject = (opts: Parameters<NestFastifyApplication['inject']>[0]) => app.inject(opts);

  it('GET /v1/health → liveness', async () => {
    const res = await inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'vybora-api' });
  });

  it('GET /v1/health/ready → database and redis up', async () => {
    const res = await inject({ method: 'GET', url: '/v1/health/ready' });
    expect(res.json()).toMatchObject({ status: 'ok', checks: { database: { status: 'up' }, redis: { status: 'up' } } });
    expect(res.statusCode).toBe(200);
  });

  it('unknown route → ApiError envelope with request id', async () => {
    const res = await inject({ method: 'GET', url: '/v1/does-not-exist' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(body.requestId).toBe(res.headers['x-request-id']);
  });

  it('propagates a well-formed x-request-id and replaces a malicious one', async () => {
    const ok = await inject({ method: 'GET', url: '/v1/health', headers: { 'x-request-id': 'client-abc-12345' } });
    expect(ok.headers['x-request-id']).toBe('client-abc-12345');
    const bad = await inject({ method: 'GET', url: '/v1/health', headers: { 'x-request-id': '<script>alert(1)</script>' } });
    expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets security headers', async () => {
    const res = await inject({ method: 'GET', url: '/v1/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS allows configured origins only', async () => {
    const allowed = await inject({ method: 'OPTIONS', url: '/v1/health', headers: { origin: 'http://allowed.test', 'access-control-request-method': 'GET' } });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://allowed.test');
    const denied = await inject({ method: 'OPTIONS', url: '/v1/health', headers: { origin: 'http://evil.test', 'access-control-request-method': 'GET' } });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('CORS preflight allows every method and header the app uses (browser clients)', async () => {
    for (const method of ['PATCH', 'PUT', 'DELETE']) {
      const res = await inject({
        method: 'OPTIONS',
        url: '/v1/me/profile',
        headers: { origin: 'http://allowed.test', 'access-control-request-method': method, 'access-control-request-headers': 'authorization,content-type,x-client-platform' },
      });
      expect(res.statusCode).toBe(204);
      expect(String(res.headers['access-control-allow-methods'])).toContain(method);
      expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain('x-client-platform');
    }
  });

  it('malformed JSON → 400 envelope, not 500', async () => {
    const res = await inject({ method: 'POST', url: '/v1/health', headers: { 'content-type': 'application/json' }, payload: '{bad' });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(res.json()).toHaveProperty('requestId');
  });
});
