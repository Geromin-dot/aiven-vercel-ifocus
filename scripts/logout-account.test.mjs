import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (await readFile(new URL('../src/lib/logoutAccount.js', import.meta.url), 'utf8'))
  .replace("import { signOut } from 'next-auth/react';", 'const signOut = (...args) => globalThis.logoutTestSignOut(...args);');
let instance = 0;
const load = () => import(`data:text/javascript;base64,${Buffer.from(source + `\n// test ${++instance}`).toString('base64')}`);
function storageWith(values) {
  const map = new Map(Object.entries(values));
  return { get length() { return map.size; }, key: index => [...map.keys()][index], getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}

test('logout clears cached profiles, reflections, and study data while retaining general preferences', async () => {
  const { clearPrivateCache } = await load();
  const storage = storageWith({ ifocus_user_name: 'Private Name', ifocus_journal_history_Student: 'private reflection',
    ifocus_telemetry_insight_Student: 'private insight', ifocus_session_history: 'private history',
    ifocus_timer_state: 'private session', ifocus_timer_preferences: 'preferences', unrelated: 'keep' });
  clearPrivateCache(storage);
  assert.equal(storage.getItem('ifocus_user_name'), null);
  assert.equal(storage.getItem('ifocus_journal_history_Student'), null);
  assert.equal(storage.getItem('ifocus_telemetry_insight_Student'), null);
  assert.equal(storage.getItem('ifocus_session_history'), null);
  assert.equal(storage.getItem('ifocus_timer_state'), null);
  assert.equal(storage.getItem('ifocus_timer_preferences'), 'preferences');
  assert.equal(storage.getItem('unrelated'), 'keep');
});

test('logout hides private UI before the request and replaces history only after the server session is cleared', async () => {
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  const events = [];
  let calls = 0;
  globalThis.window = { dispatchEvent: event => events.push(event.type), location: { replace: path => events.push(`replace:${path}`) } };
  globalThis.localStorage = storageWith({ ifocus_user_name: 'Private Name' });
  globalThis.logoutTestSignOut = async options => { calls++; assert.equal(options.redirect, false); };
  globalThis.fetch = async () => ({ ok: true, json: async () => null });
  try {
    const { logoutAccount } = await load();
    await Promise.all([logoutAccount(), logoutAccount()]);
    assert.equal(calls, 1);
    assert.equal(events[0], 'ifocus_logout_started');
    assert.equal(events.at(-1), 'replace:/login');
    assert.equal(localStorage.getItem('ifocus_user_name'), null);
  } finally { Object.assign(globalThis, previous); delete globalThis.logoutTestSignOut; }
});

test('a failed logout keeps private content hidden and offers retry without falsely reporting success', async () => {
  const previous = { window: globalThis.window, localStorage: globalThis.localStorage, fetch: globalThis.fetch };
  const events = [];
  globalThis.window = { dispatchEvent: event => events.push(event.type), location: { replace: () => assert.fail('logout did not finish') } };
  globalThis.localStorage = storageWith({ ifocus_user_name: 'Private Name' });
  globalThis.logoutTestSignOut = async () => {};
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ user: { id: 'still-signed-in' } }) });
  try {
    const { logoutAccount } = await load();
    assert.equal(await logoutAccount(), false);
    assert.equal(events.at(-1), 'ifocus_logout_failed');
  } finally { Object.assign(globalThis, previous); delete globalThis.logoutTestSignOut; }
});
