import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

function worker(existing = [], windows = []) {
  const handlers = new Map();
  const notifications = [];
  const messages = [];
  const timers = [];
  const opened = [];
  const self = {
    location: { origin: 'https://ifocus.test' },
    addEventListener: (type, handler) => handlers.set(type, handler),
    registration: {
      getNotifications: async () => existing,
      showNotification: async (title, options) => notifications.push({ title, ...options }),
    },
    clients: { matchAll: async () => windows.length ? windows : [{ postMessage: message => messages.push(message) }], openWindow: async url => opened.push(url) },
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
  const click = async (action, data) => {
    let pending;
    handlers.get('notificationclick')({ action, notification: { data, close() {} }, waitUntil: promise => { pending = promise; } });
    await pending;
  };
  const push = async payload => {
    let pending;
    handlers.get('push')({ data: { json: () => payload }, waitUntil: promise => { pending = promise; } });
    await pending;
  };
  return { dispatch, click, push, notifications, messages, timers, opened };
}

test('background check stays attached to its event and identifies the correct timer session', async () => {
  const sw = worker();
  const pending = sw.dispatch({ type: 'SCHEDULE_BACKGROUND_PRESENCE_CHECK', delayMs: 5000, remainingSeconds: 840, timerSessionId: 'phone-session' });
  assert.ok(pending instanceof Promise || typeof pending?.then === 'function');
  await sw.timers[0].callback();
  await pending;
  assert.equal(sw.notifications.length, 1);
  assert.match(sw.notifications[0].body, /14:00/);
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


test('an old notification cannot suppress the next presence check', async () => {
  const sw = worker([{ data: { presenceCheckId: 'session:840' } }]);
  const pending = sw.dispatch({ type: 'SCHEDULE_BACKGROUND_PRESENCE_CHECK', remainingSeconds: 780, timerSessionId: 'session' });
  await sw.timers[0].callback();
  await pending;
  assert.equal(sw.notifications.length, 1);
  assert.equal(sw.notifications[0].data.presenceCheckId, 'session:780');
  assert.deepEqual(Array.from(sw.notifications[0].actions, action => action.title), ['Pause', 'Continue']);
  assert.equal(sw.notifications[0].renotify, true);
});

test('the same check from the page and worker is delivered once', async () => {
  const sw = worker([{ data: { presenceCheckId: 'session:840' } }]);
  const pending = sw.dispatch({ type: 'SCHEDULE_BACKGROUND_PRESENCE_CHECK', remainingSeconds: 840, timerSessionId: 'session' });
  await sw.timers[0].callback();
  await pending;
  assert.equal(sw.notifications.length, 0);
});

for (const action of ['resume', 'pause', '']) {
  test(`notification ${action || 'body tap'} preserves the action when opening a closed app`, async () => {
    const sw = worker();
    await sw.click(action, { timerSessionId: 'phone-session', presenceCheckId: 'phone-session:720' });
    const url = new URL(sw.opened[0]);
    assert.equal(url.pathname, '/dashboard');
    assert.equal(url.searchParams.get('presenceAction'), action || 'open');
    assert.equal(url.searchParams.get('timerSessionId'), 'phone-session');
    assert.equal(url.searchParams.get('presenceCheckId'), 'phone-session:720');
  });
}

test('a body tap opens presence controls in an existing app without resuming', async () => {
  const messages = [];
  let focused = false;
  const sw = worker([], [{ url: 'https://ifocus.test/settings', postMessage: message => messages.push(message), focus: async () => { focused = true; } }]);
  await sw.click('', { timerSessionId: 'phone-session', presenceCheckId: 'phone-session:720' });
  assert.equal(messages[0].type, 'IFOCUS_OPEN_PRESENCE');
  assert.equal(messages[0].presenceCheckId, 'phone-session:720');
  assert.equal(focused, true);
});


test('server push displays the paused timer with both actions and informs the open app', async () => {
  const sw = worker();
  await sw.push({ type: 'IFOCUS_PRESENCE_PUSH', title: 'Presence', body: 'Timer paused at 12:00', timestamp: 1234,
    data: { timerSessionId: 'session', presenceCheckId: 'session:720' } });
  assert.equal(sw.notifications.length, 1);
  assert.equal(sw.notifications[0].timestamp, 1234);
  assert.deepEqual(Array.from(sw.notifications[0].actions, action => action.action), ['pause', 'resume']);
  assert.equal(sw.messages[0].type, 'IFOCUS_PRESENCE_DUE');
  assert.equal(sw.messages[0].presenceCheckId, 'session:720');
});

test('server retry replaces the existing notification without another renotify', async () => {
  const sw = worker([{ data: { presenceCheckId: 'session:720' } }]);
  await sw.push({ type: 'IFOCUS_PRESENCE_PUSH', data: { timerSessionId: 'session', presenceCheckId: 'session:720' } });
  assert.equal(sw.notifications.length, 1);
  assert.equal(sw.notifications[0].renotify, false);
});

test('test and empty pushes still display a notification without presence actions', async () => {
  for (const payload of [{ type: 'IFOCUS_PUSH_TEST', title: 'Test push', body: 'Connected' }, null]) {
    const sw = worker();
    await sw.push(payload);
    assert.equal(sw.notifications.length, 1);
    assert.equal(sw.notifications[0].actions, undefined);
    assert.equal(sw.messages.length, 0);
  }
});
