import sharp from 'sharp';
import { cleanTestUsers, createHarness, DOB, GOOD_PASSWORD, type Harness, uniq } from './harness.js';

let h: Harness;
let token: string;

beforeAll(async () => {
  h = await createHarness();
  await cleanTestUsers(h.prisma);
});
afterAll(async () => {
  await cleanTestUsers(h.prisma);
  await h.close();
});
beforeEach(async () => {
  await h.redis.client.flushdb();
  const u = uniq();
  const r = await h.app.inject({ method: 'POST', url: '/v1/auth/signup', payload: { email: u.email, password: GOOD_PASSWORD, username: u.username, displayName: 'Media Tester', dateOfBirth: DOB } });
  token = r.json().tokens.accessToken;
});

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(method: 'GET' | 'POST', url: string, body?: unknown) {
  const r = await h.app.inject({ method, url: `/v1${url}`, payload: body as Json, headers: { authorization: `Bearer ${token}` } });
  return { status: r.statusCode, body: r.json() as Json };
}

async function upload(bytes: Buffer, mimeType: string, purpose: 'avatar' | 'cover' = 'avatar', declaredSize = bytes.length) {
  const ticket = await call('POST', '/media/uploads', { purpose, mimeType, sizeBytes: declaredSize });
  expect(ticket.status).toBe(201);
  const put = await fetch(ticket.body.uploadUrl, { method: 'PUT', headers: ticket.body.uploadHeaders, body: new Uint8Array(bytes) });
  return { ticket: ticket.body, put };
}

async function waitFor(mediaId: string, statuses: string[]): Promise<Json> {
  for (let i = 0; i < 100; i++) {
    const r = await call('GET', `/media/${mediaId}`);
    if (statuses.includes(r.body.status)) return r.body;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error(`media ${mediaId} never reached ${statuses.join('/')}`);
}

describe('media uploads', () => {
  it('presigned upload → complete → worker publishes WebP renditions and deletes the original', async () => {
    const jpeg = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#6D28D9' } }).jpeg().withExif({ IFD0: { Make: 'SecretCam' } }).toBuffer();
    const { ticket, put } = await upload(jpeg, 'image/jpeg');
    expect(put.status).toBe(200);
    expect(ticket.uploadUrl).toContain('X-Amz-Signature');

    const done = await call('POST', `/media/${ticket.mediaId}/complete`);
    expect(done.status).toBe(202);
    expect(done.body.status).toBe('UPLOADED');

    const ready = await waitFor(ticket.mediaId, ['READY', 'FAILED']);
    expect(ready).toMatchObject({ status: 'READY', width: 900, height: 600 });
    expect(Object.keys(ready.urls).sort()).toEqual(['lg', 'sm']);
    expect(ready.blurhash).toBeTruthy();

    const row = await h.prisma.mediaAsset.findUniqueOrThrow({ where: { id: ticket.mediaId } });
    const variants = row.variants as Record<string, string>;
    const sm = await h.storage.getBuffer(h.storage.buckets.media, variants.sm!, 5_000_000);
    const meta = await sharp(sm).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 160, height: 160 });
    expect(meta.exif).toBeUndefined();
    expect(await h.storage.head(h.storage.buckets.uploads, row.storageKey)).toBeNull(); // original removed
  });

  it('rejects files that are not real images (content sniffed, MIME type ignored)', async () => {
    const fake = Buffer.from('<?php system($_GET["c"]); ?>'.padEnd(2000, ' '));
    const { ticket } = await upload(fake, 'image/png');
    await call('POST', `/media/${ticket.mediaId}/complete`);
    const failed = await waitFor(ticket.mediaId, ['READY', 'FAILED']);
    expect(failed).toMatchObject({ status: 'FAILED', failureReason: 'not a readable image', urls: {} });
  });

  it('detects a size different from what was declared', async () => {
    const png = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#000' } }).png().toBuffer();
    const ticket = await call('POST', '/media/uploads', { purpose: 'avatar', mimeType: 'image/png', sizeBytes: png.length + 500 });
    // Real S3/MinIO reject this PUT (content-length is signed); either way the server re-checks on complete.
    await fetch(ticket.body.uploadUrl, { method: 'PUT', headers: ticket.body.uploadHeaders, body: new Uint8Array(png) }).catch(() => undefined);
    const done = await call('POST', `/media/${ticket.body.mediaId}/complete`);
    expect(done.status).toBeGreaterThanOrEqual(400);
    expect(['UPLOAD_INVALID', 'UPLOAD_MISSING']).toContain(done.body.code);
  });

  it('refuses to complete an upload that never arrived, and hides other users’ media', async () => {
    const ticket = await call('POST', '/media/uploads', { purpose: 'cover', mimeType: 'image/webp', sizeBytes: 1234 });
    expect((await call('POST', `/media/${ticket.body.mediaId}/complete`)).body.code).toBe('UPLOAD_MISSING');

    const other = uniq();
    const r = await h.app.inject({ method: 'POST', url: '/v1/auth/signup', payload: { email: other.email, password: GOOD_PASSWORD, username: other.username, displayName: 'Other', dateOfBirth: DOB } });
    const otherToken = r.json().tokens.accessToken;
    const peek = await h.app.inject({ method: 'GET', url: `/v1/media/${ticket.body.mediaId}`, headers: { authorization: `Bearer ${otherToken}` } });
    expect(peek.statusCode).toBe(404);
  });

  it('validates the upload request', async () => {
    expect((await call('POST', '/media/uploads', { purpose: 'avatar', mimeType: 'image/svg+xml', sizeBytes: 10 })).body.code).toBe('VALIDATION_FAILED');
    expect((await call('POST', '/media/uploads', { purpose: 'avatar', mimeType: 'image/png', sizeBytes: 20 * 1024 * 1024 })).body.code).toBe('VALIDATION_FAILED');
    expect((await call('POST', '/media/uploads', { purpose: 'post', mimeType: 'image/png', sizeBytes: 10 })).body.code).toBe('VALIDATION_FAILED');
  });
});
