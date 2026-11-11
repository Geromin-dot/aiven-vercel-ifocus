import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/coachResilience.js', import.meta.url), 'utf8');
const { getBreakGateGuidance } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const now = new Date(2026, 10, 12, 12);
const skip = { status: 'skipped', timestamp: now.toISOString() };

test('one to four BreakGate skips offer written review advice without a timer suggestion', () => {
  for (let count = 1; count <= 4; count++) {
    const result = getBreakGateGuidance(Array(count).fill(skip), now);
    assert.equal(result.skipped, count);
    assert.equal(result.canTurnOff, false);
    assert.match(result.message, /reviewing a few flashcards/);
    assert.doesNotMatch(result.message, /minutes|rhythm|turning off/);
  }
});

test('only skips from today count toward the five-skip BreakGate suggestion', () => {
  const earlier = { ...skip, timestamp: new Date(2026, 10, 11, 23, 59).toISOString() };
  const completed = { ...skip, status: 'completed' };
  const events = [earlier, completed, ...Array(4).fill(skip)];
  assert.equal(getBreakGateGuidance(events, now).canTurnOff, false);
  const result = getBreakGateGuidance([...events, skip], now);
  assert.equal(result.skipped, 5);
  assert.equal(result.completed, 1);
  assert.equal(result.canTurnOff, true);
  assert.match(result.message, /turning off BreakGate/);
});

test('the notice fires at multiples of five even after the saved history rolls over', () => {
  for (const count of [4, 5, 6, 9, 10, 11, 15, 50, 51, 55]) {
    const events = Array.from({ length: count }, (_, index) => ({ ...skip, dailySkipNumber: index + 1 })).slice(-50);
    const result = getBreakGateGuidance(events, now);
    assert.equal(result.skipped, count);
    assert.equal(result.shouldNotify, count % 5 === 0);
  }
});
