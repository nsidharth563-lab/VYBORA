import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUsername,
  validatePassword,
  extractHashtags,
  extractMentions,
  encodeCursor,
  decodeCursor,
} from './index.js';

test('validateUsername', () => {
  assert.equal(validateUsername('Nova.Creates'), null);
  assert.equal(validateUsername('ab'), 'too_short');
  assert.equal(validateUsername('a'.repeat(31)), 'too_long');
  assert.equal(validateUsername('bad name'), 'invalid_chars');
  assert.equal(validateUsername('.lead'), 'invalid_chars');
  assert.equal(validateUsername('dou..ble'), 'invalid_chars');
  assert.equal(validateUsername('Admin'), 'reserved');
});

test('validatePassword', () => {
  assert.equal(validatePassword('short'), 'too_short');
  assert.equal(validatePassword('aaaaaaaaaaaa'), 'too_weak');
  assert.equal(validatePassword('correct horse battery'), null);
});

test('extractHashtags / extractMentions', () => {
  assert.deepEqual(extractHashtags('Sunset #Goa #goa #travel_2026 no#tag'), ['goa', 'travel_2026']);
  assert.deepEqual(extractHashtags('#संगीत vibes'), ['संगीत']);
  assert.deepEqual(extractMentions('hi @Nova.creates and @dj_kay'), ['nova.creates', 'dj_kay']);
});

test('cursor round-trip and tamper resistance', () => {
  const c = encodeCursor({ k: '2026-11-21T10:00:00.000Z', id: 'abc' });
  assert.deepEqual(decodeCursor(c), { k: '2026-11-21T10:00:00.000Z', id: 'abc' });
  assert.equal(decodeCursor('not-a-cursor'), null);
  assert.equal(decodeCursor(encodeCursor({ k: 1, id: 'x' }).slice(0, 5)), null);
  assert.equal(decodeCursor(undefined), null);
});
