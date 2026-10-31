import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = (await readFile(new URL('../src/lib/timerNotifications.js', import.meta.url), 'utf8')).replaceAll('export ', '');
function delivery({ existing = [], show, desktop = false } = {}) {
  const shown = [];
  const Notification = function (title, options) {
    assert.equal(options.actions, undefined);
    shown.push({ title, ...options });
  };
  Notification.permission = 'granted';
  const context = { window: { Notification }, Notification, console,
    navigator: desktop ? {} : { serviceWorker: { getRegistration: async () => ({
      getNotifications: async () => existing,
      showNotification: show || (async (title, options) => shown.push({ title, ...options })),
    }) } },
  };
  runInNewContext(`${source}\nglobalThis.send = sendSystemNotification;`, context);
  return { send: state => context.send('Presence', '12:00 remaining', 'ifocus-presence', [{ action: 'pause', title: 'Pause' }, { action: 'resume', title: 'Continue' }], state), shown };
}

test('page replaces an earlier check and includes exact session, reading, and timestamp', async () => {
  const { send, shown } = delivery({ existing: [{ data: { presenceCheckId: 'session:840' } }] });
  assert.equal(await send({ timerSessionId: 'session', timeLeft: 720 }), true);
  assert.equal(shown[0].data.presenceCheckId, 'session:720');
  assert.equal(shown[0].data.timerSessionId, 'session');
  assert.match(shown[0].body, /12:00/);
  assert.ok(shown[0].timestamp > 0);
  assert.equal(shown[0].renotify, true);
});

test('page deduplicates an already delivered check and concurrent calls', async () => {
  const state = { timerSessionId: 'session', timeLeft: 720 };
  const same = delivery({ existing: [{ data: { presenceCheckId: 'session:720' } }] });
  await same.send(state);
  assert.equal(same.shown.length, 0);
  const concurrent = delivery();
  await Promise.all([concurrent.send(state), concurrent.send(state)]);
  assert.equal(concurrent.shown.length, 1);
});

test('unsupported notification options retry with a basic notification', async () => {
  const calls = [];
  const { send } = delivery({ show: async (title, options) => {
    calls.push(options);
    if (options.actions) { const error = new Error('unsupported'); error.name = 'TypeError'; throw error; }
  } });
  assert.equal(await send({ timerSessionId: 'session', timeLeft: 720 }), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].actions, undefined);
});

test('desktop fallback never passes unsupported actions to the constructor', async () => {
  const { send, shown } = delivery({ desktop: true });
  assert.equal(await send({ timerSessionId: 'session', timeLeft: 720 }), true);
  assert.equal(shown.length, 1);
});
