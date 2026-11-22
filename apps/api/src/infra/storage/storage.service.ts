import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.js';

export interface HeadResult {
  size: number;
  contentType: string | null;
}

/**
 * S3-compatible object storage (AWS S3 in production, MinIO locally).
 *  - `uploads` bucket: private, client PUTs originals via presigned URLs.
 *  - `media` bucket: processed renditions, served via CDN.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('StorageService');
  private readonly s3: S3Client;
  /** Signs URLs against the public endpoint so phones on the LAN can reach it. */
  private readonly presigner: S3Client;
  readonly buckets: { uploads: string; media: string };

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    const base = {
      region: config.S3_REGION,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY },
      // Only add the checksum headers S3 requires; presigned PUTs from phones can't compute CRC32.
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
    };
    this.s3 = new S3Client({ ...base, ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}) });
    const publicEndpoint = config.S3_PUBLIC_ENDPOINT ?? config.S3_ENDPOINT;
    this.presigner = new S3Client({ ...base, ...(publicEndpoint ? { endpoint: publicEndpoint } : {}) });
    this.buckets = { uploads: config.S3_BUCKET_UPLOADS, media: config.S3_BUCKET_MEDIA };
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.S3_CREATE_BUCKETS) return;
    for (const bucket of Object.values(this.buckets)) {
      try {
        await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
        this.logger.log(`created bucket ${bucket}`);
      }
    }
    // Local dev only: media bucket readable without signing (production: CloudFront OAC).
    await this.s3
      .send(
        new PutBucketPolicyCommand({
          Bucket: this.buckets.media,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{ Effect: 'Allow', Principal: '*', Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${this.buckets.media}/*`] }],
          }),
        }),
      )
      .catch((e: Error) => this.logger.warn(`media bucket policy not set: ${e.message}`));
  }

  /** Presigned PUT bound to exact content type and length — the client can't swap in something else. */
  async presignPut(key: string, contentType: string, contentLength: number, expiresInSec = 600): Promise<string> {
    return getSignedUrl(this.presigner, new PutObjectCommand({ Bucket: this.buckets.uploads, Key: key, ContentType: contentType, ContentLength: contentLength }), {
      expiresIn: expiresInSec,
      signableHeaders: new Set(['content-type', 'content-length']),
    });
  }

  async head(bucket: string, key: string): Promise<HeadResult | null> {
    try {
      const r = await this.s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType ?? null };
    } catch (e) {
      if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404 || (e as Error).name === 'NotFound') return null;
      throw e;
    }
  }

  async getBuffer(bucket: string, key: string, maxBytes: number): Promise<Buffer> {
    const r = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of r.Body as Readable) {
      total += (chunk as Buffer).length;
      if (total > maxBytes) throw new Error('object exceeds size limit');
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }

  async put(bucket: string, key: string, body: Buffer, contentType: string, cacheControl = 'public, max-age=31536000, immutable'): Promise<void> {
    await this.s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }));
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch((e: Error) => this.logger.warn(`delete ${key}: ${e.message}`));
  }

  /** Public URL of a processed rendition. */
  publicUrl(key: string): string {
    return `${this.config.CDN_BASE_URL.replace(/\/$/, '')}/${key}`;
  }
}
