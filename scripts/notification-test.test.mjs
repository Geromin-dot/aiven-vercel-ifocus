import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = (await readFile(new URL('../src/lib/timerNotifications.js', import.meta.url), 'utf8')).replaceAll('export ', '');
function harness({ record = true, fail = false } = {}) {
  let notifications = [];
  const shown = [];
  const Notification = function () {};
  Notification.permission = 'granted';
  const registration = { active: {}, getNotifications: async ({ tag } = {}) => notifications.filter(item => !tag || item.tag === tag),
    showNotification: async (title, options) => {
      if (fail) throw new Error('Notifications blocked');
      shown.push({ title, options });
      const notification = { tag: options.tag, close: () => { notifications = notifications.filter(item => item !== notification); } };
      if (record) notifications.push(notification);
    } };
  const context = vm.createContext({ window: { Notification }, Notification, setTimeout, clearTimeout,
    navigator: { serviceWorker: { register: async () => registration } } });
  vm.runInContext(source + '\nglobalThis.send = sendTestNotification;', context);
  return { send: () => context.send('Timer test'), shown, Notification };
}

test('each test uses a new persistent tag and verifies notification registration', async () => {
  const h = harness();
  const first = await h.send(), second = await h.send();
  assert.equal(first.registered, true);
  assert.equal(second.registered, true);
  assert.notEqual(first.tag, second.tag);
  assert.equal(h.shown[0].options.requireInteraction, true);
  assert.equal(h.shown[0].options.silent, false);
});

test('browser acceptance without a registered notification is not reported as verified delivery', async () => {
  const result = await harness({ record: false }).send();
  assert.equal(result.accepted, true);
  assert.equal(result.registered, false);
});

test('blocked and rejected tests report failure', async () => {
  const blocked = harness();
  blocked.Notification.permission = 'denied';
  assert.equal((await blocked.send()).accepted, false);
  assert.equal((await harness({ fail: true }).send()).accepted, false);
});
