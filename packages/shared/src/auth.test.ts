import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ageOn, appleSignInSchema, changePasswordSchema, deleteAccountSchema, loginSchema, maskIdentifier,
  normalizePhone, otpCodeSchema, parseIdentifier, signupSchema,
} from './index.js';

const adultDob = '1998-05-20';

test('signup: email path normalizes and validates', () => {
  const r = signupSchema.safeParse({ email: ' Nova@Example.COM ', password: 'correct horse battery', username: 'Nova.Creates', displayName: ' Nova ', dateOfBirth: adultDob });
  assert.ok(r.success, JSON.stringify(r.error?.issues));
  assert.equal(r.data.email, 'nova@example.com');
  assert.equal(r.data.username, 'nova.creates');
  assert.equal(r.data.displayName, 'Nova');
});

test('signup: phone path normalizes to E.164', () => {
  const r = signupSchema.safeParse({ phone: '+91 98765 43210', password: 'correct horse battery', username: 'raj', displayName: 'Raj', dateOfBirth: adultDob });
  assert.ok(r.success, JSON.stringify(r.error?.issues));
  assert.equal(r.data.phone, '+919876543210');
});

test('signup: rejects both/neither identifiers, weak password, reserved username, under-13, unknown fields', () => {
  const base = { password: 'correct horse battery', username: 'raj', displayName: 'Raj', dateOfBirth: adultDob };
  assert.equal(signupSchema.safeParse(base).success, false);
  assert.equal(signupSchema.safeParse({ ...base, email: 'a@b.co', phone: '+14155550123' }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, email: 'a@b.co', password: 'short' }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, email: 'a@b.co', username: 'admin' }).success, false);
  const kid = new Date();
  kid.setUTCFullYear(kid.getUTCFullYear() - 12);
  assert.equal(signupSchema.safeParse({ ...base, email: 'a@b.co', dateOfBirth: kid.toISOString().slice(0, 10) }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, email: 'a@b.co', role: 'STAFF' }).success, false, 'mass-assignment blocked');
});

test('ageOn handles birthdays precisely', () => {
  const now = new Date('2026-11-22T00:00:00Z');
  assert.equal(ageOn(new Date('2013-11-22T00:00:00Z'), now), 13);
  assert.equal(ageOn(new Date('2013-11-23T00:00:00Z'), now), 12);
});

test('parseIdentifier classifies email / phone / username', () => {
  assert.deepEqual(parseIdentifier(' Nova@Example.com '), { kind: 'email', value: 'nova@example.com' });
  assert.deepEqual(parseIdentifier('+1 (415) 555-0123'), { kind: 'phone', value: '+14155550123' });
  assert.deepEqual(parseIdentifier('98765 43210', 'IN'), { kind: 'phone', value: '+919876543210' });
  assert.deepEqual(parseIdentifier('Nova.Creates'), { kind: 'username', value: 'nova.creates' });
  assert.equal(parseIdentifier('bad@'), null);
  assert.deepEqual(parseIdentifier('12345'), { kind: 'username', value: '12345' }, 'too short to be a phone');
  assert.equal(normalizePhone('not a phone'), null);
});

test('maskIdentifier hides most of the value', () => {
  assert.equal(maskIdentifier({ kind: 'email', value: 'nova@example.com' }), 'no••@example.com');
  assert.equal(maskIdentifier({ kind: 'phone', value: '+919876543210' }), '+91••••••••10');
});

test('other schemas', () => {
  assert.equal(otpCodeSchema.safeParse('123456').success, true);
  assert.equal(otpCodeSchema.safeParse('12345a').success, false);
  assert.equal(loginSchema.safeParse({ identifier: 'nova', password: 'x' }).success, true);
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'correct horse battery', newPassword: 'correct horse battery' }).success, false);
  assert.equal(deleteAccountSchema.safeParse({}).success, false);
  assert.equal(deleteAccountSchema.safeParse({ code: '123456' }).success, true);
  assert.equal(appleSignInSchema.safeParse({ identityToken: 'x'.repeat(30), nonce: 'short' }).success, false);
});
