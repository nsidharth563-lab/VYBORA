import * as ImagePicker from 'expo-image-picker';
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from '@vybora/shared';
import type { MediaView } from '@vybora/types';
import { ApiRequestError } from './api';
import { socialApi } from './social-api';

export type ImagePurpose = 'avatar' | 'cover';

export class UploadError extends Error {}

/** Opens the photo library with a crop step matching the purpose. Returns null if cancelled. */
export async function pickImage(purpose: ImagePurpose): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') {
    throw new UploadError('Allow photo access in Settings to choose a picture.');
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: purpose === 'avatar' ? [1, 1] : [3, 1],
    quality: 0.85, // re-encoded to JPEG: also converts HEIC from iPhones
    exif: false,
  });
  return res.canceled ? null : (res.assets[0] ?? null);
}

/**
 * Uploads straight to storage with a presigned URL (the API never proxies
 * bytes), then waits for the worker to publish the processed renditions.
 */
export async function uploadImage(
  purpose: ImagePurpose,
  asset: Pick<ImagePicker.ImagePickerAsset, 'uri' | 'mimeType'>,
  opts: { fetchImpl?: typeof fetch; pollMs?: number; timeoutMs?: number } = {},
): Promise<MediaView> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const blob = await (await fetchImpl(asset.uri)).blob();
  const type = (asset.mimeType ?? blob.type ?? 'image/jpeg').toLowerCase();
  const mimeType = (IMAGE_MIME_TYPES as readonly string[]).includes(type) ? type : 'image/jpeg';
  if (blob.size > MAX_IMAGE_BYTES) throw new UploadError('That image is over 15 MB. Choose a smaller one.');

  const ticket = await socialApi.createUpload(purpose, mimeType, blob.size);
  const put = await fetchImpl(ticket.uploadUrl, { method: 'PUT', headers: ticket.uploadHeaders, body: blob });
  if (!put.ok) throw new UploadError(`Upload failed (${put.status}). Please try again.`);

  let media = await socialApi.completeUpload(ticket.mediaId);
  const deadline = Date.now() + (opts.timeoutMs ?? 45_000);
  while (media.status !== 'READY') {
    if (media.status === 'FAILED') throw new UploadError("We couldn't use that image. Try a different photo.");
    if (Date.now() > deadline) throw new UploadError('Processing is taking longer than usual. Please try again.');
    await new Promise((r) => setTimeout(r, opts.pollMs ?? 600));
    try {
      media = await socialApi.media(ticket.mediaId);
    } catch (e) {
      if (!(e instanceof ApiRequestError && e.isNetwork)) throw e;
    }
  }
  return media;
}
