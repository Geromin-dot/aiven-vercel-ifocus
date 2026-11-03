import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/lib/changedSync.js', import.meta.url), 'utf8');
const { createChangedSync } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('repeated timer events share one request and unchanged successful states do not send again', async () => {
  let calls = 0;
  let complete;
  const send = createChangedSync(() => {
    calls++;
    return new Promise(resolve => { complete = resolve; });
  });
  const first = send('running', {});
  assert.equal(send('running', {}), first);
  await new Promise(resolve => setImmediate(resolve));
  complete({ scheduled: true });
  await first;
  await send('running', {});
  assert.equal(calls, 1);
});

test('Start, Pause, and Resume stay in order even during slow requests', async () => {
  const sent = [];
  const send = createChangedSync(async payload => { sent.push(payload); return { scheduled: true }; });
  await Promise.all([send('run', 'Start'), send('pause', 'Pause'), send('run', 'Resume')]);
  assert.deepEqual(sent, ['Start', 'Pause', 'Resume']);
});

test('failures remain retryable and subscription changes force a fresh sync', async () => {
  let calls = 0;
  const send = createChangedSync(async () => {
    if (++calls === 1) throw new Error('Offline');
    return { scheduled: true };
  });
  await assert.rejects(send('run', {}), /Offline/);
  await send('run', {});
  await send('run', {});
  assert.equal(calls, 2);
  await send('run', {}, true);
  assert.equal(calls, 3);
});
