import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/focusClock.js', import.meta.url), 'utf8');
const { advanceFocusClock, verifiedFocusSeconds, resolveFocusClock, recoverableFocusSessions } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const start = 1000000;
const timer = (changes = {}) => ({ timerSessionId: 'session-1', isRunning: true, isFocus: true, totalTime: 900, updatedAt: start, lastPresenceCheckElapsed: 0, ...changes });
const advance = (clock, state, seconds) => advanceFocusClock(clock, { ...state, updatedAt: start + seconds * 1000 }, { activePresenceInterval: 1 }, 'login-1', start + seconds * 1000);

test('recovery saves one verified minute when the browser requests 63 seconds', () => {
  const clock = advance({}, timer(), 0);
  assert.equal(verifiedFocusSeconds(clock.sessions[0], 63, true, start + 63000).duration, 60);
  assert.throws(() => verifiedFocusSeconds(clock.sessions[0], 63, false, start + 63000), /exceeds/);
});

test('a device clock ahead of the server can start tracking without creating extra time', () => {
  const clock = advanceFocusClock({}, timer({ updatedAt: start + 3600000 }),
    { activePresenceEnabled: false }, 'login-1', start);
  assert.equal(clock.sessions.length, 1);
  assert.throws(() => verifiedFocusSeconds(clock.sessions[0], 120, false, start), /exceeds/);
  assert.equal(verifiedFocusSeconds(clock.sessions[0], 120, false, start + 120000).duration, 120);
  assert.deepEqual(recoverableFocusSessions(clock, start + 120000), [{ id: 'session-1', duration: 120 }]);
});

test('recovery popup eligibility starts at 60 complete verified seconds', () => {
  const clock = advance({}, timer(), 0);
  assert.deepEqual(recoverableFocusSessions(clock, start + 59000), []);
  assert.deepEqual(recoverableFocusSessions(clock, start + 59999), []);
  assert.throws(() => verifiedFocusSeconds(clock.sessions[0], 60, true, start + 59999), /at least one/);
  assert.deepEqual(recoverableFocusSessions(clock, start + 60000), [{ id: 'session-1', duration: 60 }]);
  assert.deepEqual(recoverableFocusSessions(clock, start + 63000), [{ id: 'session-1', duration: 60 }]);
  clock.sessions[0].claimedId = 'saved-1';
  assert.deepEqual(recoverableFocusSessions(clock, start + 63000), []);
  delete clock.sessions[0].claimedId;
  clock.sessions[0].discarded = true;
  assert.deepEqual(recoverableFocusSessions(clock, start + 63000), []);
});

test('invented durations and browser timestamps cannot create elapsed time', () => {
  assert.throws(() => verifiedFocusSeconds(null, 900), /server-verified/);
  const clock = advance({}, timer({ timeLeft: 0, targetEndTime: 1 }), 0);
  assert.throws(() => verifiedFocusSeconds(clock.sessions[0], 900, false, start), /exceeds/);
  assert.equal(verifiedFocusSeconds(clock.sessions[0], 30, false, start + 30000).duration, 30);
});

test('a missed presence check caps time even after hours offline', () => {
  const clock = advance({}, timer(), 0);
  assert.equal(verifiedFocusSeconds(clock.sessions[0], 60, true, start + 3600000).duration, 60);
  assert.throws(() => verifiedFocusSeconds(clock.sessions[0], 900, false, start + 3600000), /exceeds/);
});

test('a stale running heartbeat cannot bypass presence; Continue can resume it', () => {
  let clock = advance({}, timer(), 0);
  clock = advance(clock, timer(), 90);
  assert.equal(clock.sessions[0].elapsedMs, 60000);
  assert.equal(clock.sessions[0].runningSince, null);
  clock = advance(clock, timer({ lastPresenceCheckElapsed: 60 }), 100);
  assert.equal(verifiedFocusSeconds(clock.sessions[0], 90, false, start + 130000).duration, 90);
});

test('manual pauses stop the server clock; resume preserves elapsed time', () => {
  let clock = advance({}, timer(), 0);
  clock = advance(clock, timer({ isRunning: false }), 20);
  assert.equal(verifiedFocusSeconds(clock.sessions[0], 20, false, start + 600000).duration, 20);
  clock = advance(clock, timer(), 700);
  assert.equal(verifiedFocusSeconds(clock.sessions[0], 30, false, start + 710000).duration, 30);
});

test('parallel browser sessions cannot earn overlapping time', () => {
  let clock = advance({}, timer(), 0);
  clock = advance(clock, timer({ timerSessionId: 'session-2' }), 20);
  const first = clock.sessions.find(x => x.id === 'session-1');
  assert.equal(verifiedFocusSeconds(first, 20, false, start + 600000).duration, 20);
  assert.equal(first.runningSince, null);
});

test('discarded sessions cannot later be claimed and old requests cannot undo a pause', () => {
  let clock = advance({}, timer(), 0);
  clock = advance(clock, timer({ isRunning: false }), 30);
  const stale = advanceFocusClock(clock, timer(), {}, 'login-1', start + 40000);
  assert.equal(stale, clock);
  clock = resolveFocusClock(clock, ['session-1'], start + 40000);
  assert.throws(() => verifiedFocusSeconds(clock.sessions[0], 30, false, start + 50000), /server-verified/);
});

test('claimed sessions remain frozen and an old login cannot resume a timer', () => {
  let clock = advance({}, timer(), 0);
  clock = advance(clock, timer({ isRunning: false }), 30);
  const otherLogin = advanceFocusClock(clock, timer({ updatedAt: start + 40000 }), {}, 'login-2', start + 40000);
  assert.equal(otherLogin.sessions[0].runningSince, null);
  clock.sessions[0].claimedId = 'saved-1';
  clock = advance(clock, timer(), 50);
  assert.equal(clock.sessions[0].runningSince, null);
});
