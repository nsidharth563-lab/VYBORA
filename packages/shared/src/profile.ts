import { z } from 'zod';
import { LIMITS } from './constants.js';
import { usernameSchema } from './auth.js';

/** Accepts "example.com" or "https://example.com/x"; stores a normalized https URL. */
export const websiteSchema = z
  .string()
  .trim()
  .max(100, 'Keep it under 100 characters.')
  .transform((v, ctx) => {
    if (!v) return null;
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(withScheme);
      if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) throw new Error();
      return u.toString().replace(/\/$/, '');
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid website, e.g. vybora.app' });
      return z.NEVER;
    }
  });

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Enter your name.').max(LIMITS.displayNameMax).optional(),
    username: usernameSchema.optional(),
    bio: z
      .string()
      .max(LIMITS.bioMax, `Keep your bio under ${LIMITS.bioMax} characters.`)
      .transform((v) => v.trim() || null)
      .optional(),
    website: websiteSchema.optional(),
    isPrivate: z.boolean().optional(),
    avatarMediaId: z.uuid().nullable().optional(),
    coverMediaId: z.uuid().nullable().optional(),
  })
  .strict();

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export const createUploadSchema = z
  .object({
    purpose: z.enum(['avatar', 'cover']),
    mimeType: z.enum(IMAGE_MIME_TYPES, 'Use a JPEG, PNG or WebP image.'),
    sizeBytes: z.number().int().positive().max(MAX_IMAGE_BYTES, 'Images must be 15 MB or smaller.'),
  })
  .strict();

export const userSearchSchema = z.object({ q: z.string().trim().min(1).max(50) });
