import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { MediaView, UploadTicket } from '@vybora/types';
import { MAX_IMAGE_BYTES } from '@vybora/shared';
import { AppException } from '../../common/api-exception.filter.js';
import type { MediaAsset, MediaPurpose } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { QueueService } from '../../infra/queue/queue.service.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { ImageRejected, processImage, type ImagePurpose } from './image-processor.js';

const PURPOSES: Record<'avatar' | 'cover', MediaPurpose> = { avatar: 'AVATAR', cover: 'COVER' };
const UPLOAD_URL_TTL_SEC = 600;

@Injectable()
export class MediaService {
  private readonly logger = new Logger('MediaService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly queues: QueueService,
  ) {}

  /** Step 1: reserve an asset and hand back a presigned PUT bound to type + size. */
  async createUpload(ownerId: string, input: { purpose: 'avatar' | 'cover'; mimeType: string; sizeBytes: number }): Promise<UploadTicket> {
    const pending = await this.prisma.mediaAsset.count({ where: { ownerId, status: 'PENDING_UPLOAD', createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (pending >= 20) throw new AppException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many unfinished uploads. Try again later.', { retryAfterSec: 600 });

    const asset = await this.prisma.mediaAsset.create({
      data: { ownerId, kind: 'IMAGE', purpose: PURPOSES[input.purpose], mimeType: input.mimeType, sizeBytes: BigInt(input.sizeBytes), storageKey: `tmp/${crypto.randomUUID()}` },
    });
    const key = `u/${ownerId}/${asset.id}`;
    await this.prisma.mediaAsset.update({ where: { id: asset.id }, data: { storageKey: key } });
    const uploadUrl = await this.storage.presignPut(key, input.mimeType, input.sizeBytes, UPLOAD_URL_TTL_SEC);
    return {
      mediaId: asset.id,
      uploadUrl,
      uploadHeaders: { 'content-type': input.mimeType },
      expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SEC * 1000).toISOString(),
    };
  }

  /** Step 2: client says the PUT finished; we check the object and queue processing. */
  async complete(ownerId: string, mediaId: string): Promise<MediaView> {
    const asset = await this.owned(ownerId, mediaId);
    if (asset.status !== 'PENDING_UPLOAD') return this.view(asset); // idempotent
    const head = await this.storage.head(this.storage.buckets.uploads, asset.storageKey);
    if (!head) throw new AppException(HttpStatus.CONFLICT, 'UPLOAD_MISSING', "We didn't receive the file. Please try uploading again.");
    if (head.size !== Number(asset.sizeBytes) || head.size > MAX_IMAGE_BYTES) {
      await this.fail(asset, 'size mismatch');
      throw new AppException(HttpStatus.BAD_REQUEST, 'UPLOAD_INVALID', 'The uploaded file did not match what was declared.');
    }
    const updated = await this.prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: 'UPLOADED' } });
    try {
      // jobId = media id → completing twice can't queue it twice (BullMQ ids can't contain ':').
      await this.queues.add('media', 'process', { mediaId: asset.id }, `process-${asset.id}`);
    } catch (e) {
      await this.prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: 'PENDING_UPLOAD' } });
      throw e;
    }
    return this.view(updated);
  }

  async get(ownerId: string, mediaId: string): Promise<MediaView> {
    return this.view(await this.owned(ownerId, mediaId));
  }

  /** Worker: validate, re-encode, publish renditions, delete the original. */
  async process(mediaId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!asset || asset.status === 'READY' || asset.status === 'FAILED') return;
    await this.prisma.mediaAsset.update({ where: { id: mediaId }, data: { status: 'PROCESSING' } });
    try {
      const input = await this.storage.getBuffer(this.storage.buckets.uploads, asset.storageKey, MAX_IMAGE_BYTES);
      const result = await processImage(input, asset.purpose as ImagePurpose);
      const variants: Record<string, string> = {};
      for (const o of result.outputs) {
        const key = `m/${asset.id}/${o.name}.webp`;
        await this.storage.put(this.storage.buckets.media, key, o.body, 'image/webp');
        variants[o.name] = key;
      }
      await this.prisma.mediaAsset.update({
        where: { id: mediaId },
        data: { status: 'READY', width: result.width, height: result.height, blurhash: result.blurhash, sha256: result.sha256, variants, mimeType: 'image/webp' },
      });
      await this.storage.delete(this.storage.buckets.uploads, asset.storageKey);
    } catch (e) {
      if (e instanceof ImageRejected) {
        await this.fail(asset, e.message);
        await this.storage.delete(this.storage.buckets.uploads, asset.storageKey);
        return; // don't retry a bad file
      }
      await this.prisma.mediaAsset.update({ where: { id: mediaId }, data: { status: 'UPLOADED' } });
      throw e; // transient (storage/network) — BullMQ retries
    }
  }

  private async fail(asset: MediaAsset, reason: string) {
    await this.prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: 'FAILED', failureReason: reason.slice(0, 200) } });
  }

  private async owned(ownerId: string, mediaId: string): Promise<MediaAsset> {
    const a = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!a || a.ownerId !== ownerId || a.deletedAt) throw new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Media not found.');
    return a;
  }

  urls(asset: Pick<MediaAsset, 'status' | 'variants'> | null | undefined): Record<string, string> {
    if (!asset || asset.status !== 'READY' || !asset.variants) return {};
    return Object.fromEntries(Object.entries(asset.variants as Record<string, string>).map(([k, key]) => [k, this.storage.publicUrl(key)]));
  }

  view(a: MediaAsset): MediaView {
    return { id: a.id, status: a.status, urls: this.urls(a), blurhash: a.blurhash, width: a.width, height: a.height, failureReason: a.status === 'FAILED' ? a.failureReason : null };
  }
}
