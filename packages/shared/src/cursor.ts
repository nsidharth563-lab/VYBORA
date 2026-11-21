/**
 * Opaque keyset-pagination cursors. Encodes (sortKey, id) so that ties on the
 * sort key are broken deterministically. Base64url so it is URL-safe.
 */
export interface CursorPayload {
  k: string | number;
  id: string;
}

const toB64Url = (s: string) =>
  btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromB64Url = (s: string) =>
  decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

export function encodeCursor(p: CursorPayload): string {
  return toB64Url(JSON.stringify(p));
}

export function decodeCursor(cursor: string | undefined | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    const v = JSON.parse(fromB64Url(cursor)) as unknown;
    if (
      v &&
      typeof v === 'object' &&
      'id' in v &&
      'k' in v &&
      typeof (v as CursorPayload).id === 'string' &&
      ['string', 'number'].includes(typeof (v as CursorPayload).k)
    ) {
      return v as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}
