import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

function worker() {
  const handlers = new Map();
  const notifications = [];
  const messages = [];
  const timers = [];
  const self = {
    addEventListener: (type, handler) => handlers.set(type, handler),
    registration: {
      getNotifications: async () => [],
      showNotification: async (title, options) => notifications.push({ title, ...options }),
    },
    clients: { matchAll: async () => [{ postMessage: message => messages.push(message) }] },
  };
  runInNewContext(source, { self, URL, console,
    setTimeout: callback => { const timer = { callback }; timers.push(timer); return timer; },
    clearTimeout: timer => { timer.cancelled = true; },
  });
  const dispatch = data => {
    let pending;
    handlers.get('message')({ data, waitUntil: promise => { pending = promise; } });
    return pending;
  };
  return { dispatch, notifications, messages, timers };
}

test('background check stays attached to its event and identifies the correct timer session', async () => {
  const sw = worker();
  const pending = sw.dispatch({ type: 'SCHEDULE_BACKGROUND_PRESENCE_CHECK', delayMs: 5000, remainingSeconds: 840, timerSessionId: 'phone-session' });
  assert.ok(pending instanceof Promise || typeof pending?.then === 'function');
  await sw.timers[0].callback();
  await pending;
  assert.equal(sw.notifications.length, 1);
  assert.match(sw.notifications[0].body, /14m 00s/);
  assert.equal(sw.notifications[0].data.timerSessionId, 'phone-session');
  assert.equal(sw.messages[0].type, 'IFOCUS_PRESENCE_DUE');
});

test('returning to the app cancels a pending background check', async () => {
  const sw = worker();
  const pending = sw.dispatch({ type: 'SCHEDULE_BACKGROUND_PRESENCE_CHECK', delayMs: 5000, remainingSeconds: 840 });
  sw.dispatch({ type: 'CANCEL_BACKGROUND_PRESENCE_CHECK' });
  await pending;
  assert.equal(sw.timers[0].cancelled, true);
  assert.equal(sw.notifications.length, 0);
});
