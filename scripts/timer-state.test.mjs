import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/timerState.js', import.meta.url), 'utf8');
const { remainingTime, settlePresence, confirmPresence, toggleTimerState, recoveryFromCheckpoint } =
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const start = 1000000;
const session = (interval = 180) => ({ isRunning: true, isFocus: true, totalTime: 900,
  timeLeft: 900, targetEndTime: start + 900000, lastPresenceCheckElapsed: 0,
  activePresenceIntervalSeconds: interval, timerSessionId: 'session-1', updatedAt: start });

test('3-minute presence check freezes at 12:00 and Continue never returns to 14:00', () => {
  const paused = settlePresence(session(), {}, start + 180000);
  assert.equal(paused.timeLeft, 720);
  assert.equal(paused.targetEndTime, null);
  assert.equal(remainingTime(paused, start + 600000), 720);
  const resumed = confirmPresence(paused, start + 600000);
  assert.equal(resumed.timeLeft, 720);
  assert.equal(resumed.lastPresenceCheckElapsed, 180);
  assert.equal(remainingTime(resumed, start + 613000), 707);
  assert.equal(settlePresence(resumed, {}, start + 613000), resumed);
});

test('manual pause/play at 13:47 preserves progress and does not trigger presence early', () => {
  const paused = toggleTimerState(session(), {}, start + 73000);
  assert.equal(paused.timeLeft, 827);
  assert.equal(paused.isRunning, false);
  const resumed = toggleTimerState(paused, {}, start + 300000);
  assert.equal(resumed.timeLeft, 827);
  assert.equal(resumed.lastPresenceCheckElapsed, 0);
  assert.equal(settlePresence(resumed, {}, start + 301000), resumed);
  assert.equal(settlePresence(resumed, {}, start + 407000).timeLeft, 720);
});

test('background at 14:05 freezes at the FIRST one-minute check even after long suspension', () => {
  const hidden = { ...session(60), timeLeft: 845 };
  const paused = settlePresence(hidden, {}, start + 500000);
  assert.equal(paused.timeLeft, 840);
  assert.equal(paused.isRunning, false);
  assert.equal(paused.presencePaused, true);
  assert.equal(remainingTime(paused, start + 9000000), 840);
});

test('repeated presence confirmations and manual pauses never add time', () => {
  let state = session(60);
  let now = start;
  for (let round = 0; round < 8; round++) {
    now += 60000;
    state = settlePresence(state, {}, now);
    assert.equal(state.timeLeft, 900 - (round + 1) * 60);
    now += 120000; // No time is counted while waiting for confirmation.
    state = confirmPresence(state, now);
    state = toggleTimerState(state, {}, now);
    now += 50000;
    state = toggleTimerState(state, {}, now);
    assert.equal(state.presencePaused, false);
  }
});

test('late notification actions cannot resume a manually paused or reset timer', () => {
  const paused = toggleTimerState(session(), {}, start + 30000);
  assert.equal(confirmPresence(paused, start + 40000), paused);
});

test('Stay paused preserves exact seconds and the next presence baseline', () => {
  const paused = settlePresence(session(60), {}, start + 60000);
  const stopped = confirmPresence(paused, start + 500000, false);
  const resumed = toggleTimerState(stopped, {}, start + 600000);
  assert.equal(resumed.timeLeft, 840);
  assert.equal(resumed.lastPresenceCheckElapsed, 60);
  assert.equal(settlePresence(resumed, {}, start + 601000), resumed);
});

test('presence cannot override a disabled check, break, or completed focus interval', () => {
  const state = session(60);
  assert.equal(settlePresence(state, { activePresenceEnabled: false }, start + 70000), state);
  const rest = { ...state, isFocus: false };
  assert.equal(settlePresence(rest, {}, start + 70000), rest);
  const short = { ...state, totalTime: 60, timeLeft: 60, targetEndTime: start + 60000 };
  assert.equal(settlePresence(short, {}, start + 61000), short);
});

test('cross-device recovery uses saved work, never elapsed wall time or a live countdown', () => {
  const checkpoint = { ...session(), timeLeft: 300 };
  assert.equal(recoveryFromCheckpoint(checkpoint).duration, 600);
  assert.equal(recoveryFromCheckpoint(checkpoint).id, 'session-1');
  assert.equal(recoveryFromCheckpoint({ ...checkpoint, recoveryResolved: true }), null);
  assert.equal(recoveryFromCheckpoint({ ...checkpoint, isFocus: false }), null);
  assert.equal(recoveryFromCheckpoint(session()), null);
});
