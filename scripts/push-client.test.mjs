import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const changeUrl = moduleUrl(await readFile(new URL('../src/lib/changedSync.js', import.meta.url), 'utf8'));
const source = (await readFile(new URL('../src/lib/pushNotifications.js', import.meta.url), 'utf8'))
  .replace("import { getTimerDeviceId } from './timerState';", "const getTimerDeviceId = () => 'device-test';")
  .replace("'./changedSync'", JSON.stringify(changeUrl));

test('countdown ticks do not reschedule notifications; pause, resume, preferences and new login do', async () => {
  const previousFetch = globalThis.fetch;
  const previousStorage = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const sent = [];
  globalThis.fetch = async (_, options) => {
    sent.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ configured: true, subscribed: true, scheduled: true }) };
  };
  try {
    const { pushCheckpoint } = await import(moduleUrl(source));
    const timer = { deviceId: 'device-test', userId: 'student', timerSessionId: 'focus-1', isRunning: true,
      isFocus: true, totalTime: 900, timeLeft: 900, targetEndTime: Date.now() + 900000, lastPresenceCheckElapsed: 0 };
    await pushCheckpoint(timer, { sessionId: 'login-1' });
    await pushCheckpoint({ ...timer, timeLeft: 870, updatedAt: Date.now() }, { sessionId: 'login-1' });
    assert.equal(sent.length, 1);
    await pushCheckpoint({ ...timer, isRunning: false }, { sessionId: 'login-1' });
    await pushCheckpoint({ ...timer, targetEndTime: timer.targetEndTime + 30000 }, { sessionId: 'login-1' });
    assert.equal(sent.length, 3);
    storage.set('ifocus_timer_preferences', JSON.stringify({ activePresenceEnabled: false }));
    await pushCheckpoint(timer, { sessionId: 'login-1' });
    assert.equal(sent.length, 4);
    assert.equal(sent[3].preferences.activePresenceEnabled, false);
    await pushCheckpoint(timer, { sessionId: 'login-2' });
    assert.equal(sent.length, 5);
    assert.ok(sent[4].version > sent[0].version);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
  }
});
