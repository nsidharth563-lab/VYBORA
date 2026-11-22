import sharp from 'sharp';
import { ImageRejected, processImage } from './image-processor.js';

async function jpegWithGps(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#8B5CF6' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'SecretCam', Model: 'Serial-1234' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '12/1 58/1 0/1' } })
    .toBuffer();
}

describe('processImage', () => {
  it('produces WebP renditions at exact sizes with a blurhash', async () => {
    const out = await processImage(await jpegWithGps(1200, 900), 'AVATAR');
    expect(out.outputs.map((o) => [o.name, o.width, o.height])).toEqual([
      ['sm', 160, 160],
      ['lg', 480, 480],
    ]);
    for (const o of out.outputs) expect((await sharp(o.body).metadata()).format).toBe('webp');
    expect(out.blurhash).toMatch(/^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{6,}$/);
    expect(out).toMatchObject({ width: 1200, height: 900 });
    expect(out.sha256).toHaveLength(64);
  });

  it('strips EXIF (GPS, camera) from every rendition', async () => {
    const input = await jpegWithGps(800, 800);
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await processImage(input, 'COVER');
    for (const o of out.outputs) {
      const m = await sharp(o.body).metadata();
      expect(m.exif).toBeUndefined();
      expect(o.body.includes(Buffer.from('SecretCam'))).toBe(false);
    }
    expect(out.outputs.map((o) => [o.width, o.height])).toEqual([
      [750, 250],
      [1500, 500],
    ]);
  });

  it('rejects non-images, disallowed formats and decompression bombs', async () => {
    await expect(processImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'AVATAR')).rejects.toBeInstanceOf(ImageRejected);
    await expect(processImage(Buffer.from('#!/bin/sh\nrm -rf /'), 'AVATAR')).rejects.toBeInstanceOf(ImageRejected);
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).gif().toBuffer();
    await expect(processImage(gif, 'AVATAR')).rejects.toThrow(/unsupported format: gif/);
    // 10000 x 6000 = 60 MP header — refused before decoding pixels.
    const bomb = await sharp({ create: { width: 10000, height: 6000, channels: 3, background: '#000' } }).png({ compressionLevel: 9 }).toBuffer();
    await expect(processImage(bomb, 'AVATAR')).rejects.toBeInstanceOf(ImageRejected);
  });

  it('applies EXIF orientation before cropping', async () => {
    const portraitStoredLandscape = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#f00' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const out = await processImage(portraitStoredLandscape, 'AVATAR');
    expect(out).toMatchObject({ width: 200, height: 400 });
  });
});
