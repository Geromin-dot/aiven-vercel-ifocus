import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/sessionVerification.js', import.meta.url), 'utf8');
const { createSessionVerifier } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const reply = (status, data) => ({ status, json: async () => data });

test('real concurrent logins and account holds still trigger protection', async () => {
  for (const [status, data, reason] of [[401, { conflict: true }, 'CONCURRENT_LOGIN'], [403, { onHold: true }, 'ACCOUNT_ON_HOLD']]) {
    const conflicts = [];
    const watcher = createSessionVerifier(reason => conflicts.push(reason), async () => reply(status, data));
    await watcher.verify();
    assert.deepEqual(conflicts, [reason]);
  }
});

test('a response from the previous session cannot stop a new session', async () => {
  let resolve;
  let signal;
  const conflicts = [];
  const watcher = createSessionVerifier(reason => conflicts.push(reason), (_, options) => {
    signal = options.signal;
    return new Promise(done => { resolve = done; });
  });
  const pending = watcher.verify();
  watcher.dispose();
  assert.equal(signal.aborted, true);
  resolve(reply(401, { conflict: true }));
  await pending;
  assert.deepEqual(conflicts, []);
});

test('a session change during response parsing cannot show an old conflict', async () => {
  let resolve;
  const conflicts = [];
  const watcher = createSessionVerifier(reason => conflicts.push(reason), async () => ({
    status: 401, json: () => new Promise(done => { resolve = done; }),
  }));
  const pending = watcher.verify();
  await Promise.resolve();
  watcher.dispose();
  resolve({ conflict: true });
  await pending;
  assert.deepEqual(conflicts, []);
});

test('focus and visibility checks share an in-flight request; network failures are not conflicts', async () => {
  let calls = 0;
  let resolve;
  const watcher = createSessionVerifier(() => assert.fail('network failure is not a conflict'), () => {
    calls++;
    return new Promise(done => { resolve = done; });
  });
  const first = watcher.verify();
  await watcher.verify();
  assert.equal(calls, 1);
  resolve(reply(200, { active: true }));
  await first;
  const offline = createSessionVerifier(() => assert.fail('offline'), async () => { throw new Error('Offline'); });
  await offline.verify();
});
