import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { normalizeEmail, normalizeUsername } from './validation.js';

export type IdentifierKind = 'email' | 'phone' | 'username';
export interface ParsedIdentifier {
  kind: IdentifierKind;
  /** Normalized value: lowercase email, E.164 phone, lowercase username. */
  value: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalizes a phone number to E.164 or returns null. `defaultCountry` lets users omit the +code. */
export function normalizePhone(input: string, defaultCountry?: CountryCode): string | null {
  const p = parsePhoneNumberFromString(input.trim(), defaultCountry);
  return p && p.isValid() ? p.number : null;
}

export function isEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim());
}

/**
 * Classifies a login identifier typed into a single field
 * ("Email, phone or username").
 */
export function parseIdentifier(input: string, defaultCountry?: CountryCode): ParsedIdentifier | null {
  const raw = input.trim();
  if (!raw) return null;
  if (raw.includes('@')) return isEmail(raw) ? { kind: 'email', value: normalizeEmail(raw) } : null;
  if (/^\+?[\d\s().-]{6,20}$/.test(raw)) {
    const phone = normalizePhone(raw, defaultCountry);
    return phone ? { kind: 'phone', value: phone } : null;
  }
  return { kind: 'username', value: normalizeUsername(raw) };
}

/** Masks for display in "we sent a code to …" messages. */
export function maskIdentifier(id: ParsedIdentifier): string {
  if (id.kind === 'email') {
    const [user, domain] = id.value.split('@') as [string, string];
    return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
  }
  if (id.kind === 'phone') return `${id.value.slice(0, 3)}${'•'.repeat(Math.max(1, id.value.length - 5))}${id.value.slice(-2)}`;
  return id.value;
}
