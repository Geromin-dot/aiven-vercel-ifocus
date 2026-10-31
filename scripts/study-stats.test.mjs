import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/studyStats.js', import.meta.url), 'utf8');
const { formatFocusMinutes, sessionMinutes } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('67 minutes displays as 1h 7m on both focus cards', () => {
  assert.equal(formatFocusMinutes(67), '1h 7m');
  assert.equal(formatFocusMinutes(60), '1h 0m');
  assert.equal(formatFocusMinutes(59), '59m');
});

test('study totals retain seconds until the final display rounding', () => {
  const total = [{ durationSeconds: 61 }, { durationSeconds: 61 }, { durationSeconds: 3898 }].reduce((sum, session) => sum + sessionMinutes(session), 0);
  assert.equal(total, 67);
  assert.equal(formatFocusMinutes(total), '1h 7m');
});

test('long minute sessions are not mistaken for seconds', () => {
  assert.equal(sessionMinutes({ duration: 240 }), 240);
  assert.equal(sessionMinutes({ duration: 240, durationUnit: 'seconds' }), 4);
  assert.equal(sessionMinutes({ duration: 7, durationSeconds: 420 }), 7);
});
