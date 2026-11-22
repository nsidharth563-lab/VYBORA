import { createHash } from 'node:crypto';
import { encode } from 'blurhash';
import sharp, { type Metadata } from 'sharp';

export type ImagePurpose = 'AVATAR' | 'COVER';

interface Rendition {
  name: string;
  width: number;
  height: number;
}

/** Output sizes per purpose. Everything is re-encoded to WebP. */
export const RENDITIONS: Record<ImagePurpose, Rendition[]> = {
  AVATAR: [
    { name: 'sm', width: 160, height: 160 },
    { name: 'lg', width: 480, height: 480 },
  ],
  COVER: [
    { name: 'sm', width: 750, height: 250 },
    { name: 'lg', width: 1500, height: 500 },
  ],
};

export const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
/** Decompression-bomb guard: refuse anything over 50 MP before decoding pixels. */
export const MAX_INPUT_PIXELS = 50_000_000;

export class ImageRejected extends Error {}

export interface ProcessedImage {
  width: number;
  height: number;
  blurhash: string;
  sha256: string;
  outputs: { name: string; body: Buffer; width: number; height: number }[];
}

/**
 * Validates and re-encodes an uploaded image:
 *  - format is sniffed from the bytes (the client's MIME type is not trusted)
 *  - pixel limit stops decompression bombs
 *  - EXIF orientation applied, then ALL metadata dropped (GPS, camera serials…)
 *  - originals are never served; only these renditions are published
 */
export async function processImage(input: Buffer, purpose: ImagePurpose): Promise<ProcessedImage> {
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new ImageRejected('not a readable image');
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new ImageRejected(`unsupported format: ${meta.format ?? 'unknown'}`);
  if (!meta.width || !meta.height) throw new ImageRejected('image has no dimensions');
  if (meta.width * meta.height > MAX_INPUT_PIXELS) throw new ImageRejected('image is too large');

  const base = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate(); // applies EXIF orientation
  const outputs = [];
  for (const r of RENDITIONS[purpose]) {
    const { data, info } = await base()
      .resize(r.width, r.height, { fit: 'cover', position: sharp.strategy.attention, withoutEnlargement: false })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    outputs.push({ name: r.name, body: data, width: info.width, height: info.height });
  }

  const small = await base().resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(small.data), small.info.width, small.info.height, 4, 3);
  const oriented = await base().metadata();
  const swap = (meta.orientation ?? 1) >= 5;

  return {
    width: swap ? (oriented.height ?? meta.height) : (oriented.width ?? meta.width),
    height: swap ? (oriented.width ?? meta.width) : (oriented.height ?? meta.height),
    blurhash,
    sha256: createHash('sha256').update(input).digest('hex'),
    outputs,
  };
}
