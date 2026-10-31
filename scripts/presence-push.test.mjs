import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const policySource = await readFile(new URL('../src/lib/presencePushPolicy.js', import.meta.url), 'utf8');
const policyUrl = moduleUrl(policySource);
const { planPresencePush, validatePushSubscription } = await import(policyUrl);
const serviceSource = (await readFile(new URL('../src/lib/presencePushService.js', import.meta.url), 'utf8'))
  .replace("'./presencePushPolicy.js'", JSON.stringify(policyUrl));
const { createPresencePushService, jobToken, verifyJobToken } = await import(moduleUrl(serviceSource));

const start = 1_000_000;
const state = (overrides = {}) => ({ timerSessionId: 'focus-session', isRunning: true, isFocus: true,
  totalTime: 900, timeLeft: 900, targetEndTime: start + 900000, lastPresenceCheckElapsed: 0,
  activePresenceIntervalSeconds: 180, ...overrides });

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(clause => matches(row, clause));
    if (value && typeof value === 'object' && 'lt' in value) return Number(row[key]) < Number(value.lt);
    return row[key] === value;
  });
}

function harness() {
  let saved = null;
  let now = start;
  let failSend = null;
  let failPublish = false;
  const published = [];
  const sent = [];
  const deleted = [];
  const user = { status: 'ACTIVE', currentSessionId: 'login-1' };
  const subscription = { id: 'sub-1', user, endpoint: 'https://web.push.apple.com/test' };
  const db = {
    $transaction: async callback => callback(db),
    presencePushJob: {
      findUnique: async args => saved ? { ...saved, ...(args.include ? { subscription } : {}) } : null,
      update: async ({ data }) => { saved = { ...saved, ...data }; return saved; },
      upsert: async ({ create, update }) => { saved = saved ? { ...saved, ...update } : create; return saved; },
      updateMany: async ({ where, data }) => {
        if (!saved || !matches(saved, where)) return { count: 0 };
        saved = { ...saved, ...data };
        return { count: 1 };
      },
    },
    pushSubscription: { deleteMany: async args => { deleted.push(args); saved = null; return { count: 1 }; } },
  };
  const service = createPresencePushService({ db, now: () => now,
    publish: async job => { if (failPublish) throw new Error('scheduler unavailable'); published.push({ ...job }); },
    send: async (sub, payload) => { if (failSend) throw failSend; sent.push({ sub, payload }); },
  });
  return { service, published, sent, deleted, user, job: () => saved,
    time: value => { now = value; }, failSend: error => { failSend = error; }, failPublish: value => { failPublish = value; },
    sync: (timer = state(), version = start, prefs = {}) => service.sync('sub-1', timer, prefs, version, 'login-1'),
    deliver: () => service.deliver('sub-1', saved.generation),
  };
}

test('schedules the exact first presence deadline and paused reading', () => {
  const plan = planPresencePush(state(), {}, start);
  assert.equal(Number(plan.dueAt), start + 180000);
  assert.equal(plan.remainingSeconds, 720);
  assert.equal(plan.checkId, 'focus-session:720');
  const legacy = planPresencePush(state({ timeLeft: 700 }), {}, start);
  assert.equal(legacy.remainingSeconds, 700);
  assert.equal(Number(legacy.dueAt), start + 180000);
});

test('pause, break, disabled presence, and final interval do not schedule alerts', () => {
  for (const timer of [state({ isRunning: false }), state({ isFocus: false }), state({ presencePaused: true }), state({ breakGatePending: true }), state({ lastPresenceCheckElapsed: 720 })]) {
    assert.equal(planPresencePush(timer, {}, start), null);
  }
  assert.equal(planPresencePush(state(), { activePresenceEnabled: false }, start), null);
  assert.throws(() => planPresencePush(state({ totalTime: Infinity }), {}, start), /Invalid timer/);
  assert.throws(() => planPresencePush(state({ targetEndTime: start + 86400000 }), {}, start), /Invalid timer/);
});

test('subscription validation rejects private hosts, credentials, ports and invalid keys', () => {
  const valid = { endpoint: 'https://web.push.apple.com/token', keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) } };
  assert.equal(validatePushSubscription(valid), true);
  for (const endpoint of ['http://web.push.apple.com/token', 'https://127.0.0.1/test', 'https://web.push.apple.com.attacker.test/token', 'https://user@web.push.apple.com/token', 'https://web.push.apple.com:8443/token']) {
    assert.equal(validatePushSubscription({ ...valid, endpoint }), false);
  }
  assert.equal(validatePushSubscription({ ...valid, keys: {} }), false);
});

test('callbacks require a valid signature bound to both device and job generation', () => {
  const token = `Bearer ${jobToken('secret', 'sub-1', 'generation-1')}`;
  assert.equal(verifyJobToken('secret', 'sub-1', 'generation-1', token), true);
  assert.equal(verifyJobToken('secret', 'sub-2', 'generation-1', token), false);
  assert.equal(verifyJobToken('secret', 'sub-1', 'generation-2', token), false);
  assert.equal(verifyJobToken('secret', 'sub-1', 'generation-1', 'bad'), false);
  assert.equal(verifyJobToken(undefined, 'sub-1', 'generation-1', token), false);
});

test('checkpoint heartbeats do not enqueue the same alert repeatedly', async () => {
  const h = harness();
  await h.sync();
  assert.equal((await h.sync(state(), start + 1000)).scheduled, true);
  assert.equal(h.published.length, 1);
});

test('manual pause invalidates the queued generation and stale running requests cannot revive it', async () => {
  const h = harness();
  await h.sync();
  const generation = h.job().generation;
  await h.sync(state({ isRunning: false }), start + 2000);
  await h.sync(state(), start + 1000);
  assert.equal(h.job().status, 'CANCELLED');
  assert.equal((await h.service.deliver('sub-1', generation)).skipped, true);
  assert.equal(h.sent.length, 0);
});

test('Continue schedules the next check without adding time and ignores an old callback', async () => {
  const h = harness();
  await h.sync();
  const old = h.job().generation;
  h.time(start + 180000);
  await h.sync(state({ isRunning: false, presencePaused: true, timeLeft: 720 }), start + 180000);
  await h.sync(state({ timeLeft: 720, lastPresenceCheckElapsed: 180 }), start + 180001);
  assert.equal(h.job().remainingSeconds, 540);
  assert.equal(Number(h.job().dueAt), start + 360000);
  assert.equal((await h.service.deliver('sub-1', old)).skipped, true);
  h.time(start + 360000);
  await h.deliver();
  assert.match(h.sent[0].payload.body, /9:00/);
});

test('new focus session invalidates callbacks for the previous focus session', async () => {
  const h = harness();
  await h.sync();
  const old = h.job().generation;
  await h.sync(state({ timerSessionId: 'new-session' }), start + 1000);
  assert.equal((await h.service.deliver('sub-1', old)).skipped, true);
});

test('signout, replaced login, suspended account and very late jobs never send', async () => {
  for (const account of [{ currentSessionId: null }, { currentSessionId: 'login-2' }, { status: 'SUSPENDED' }, {}]) {
    const h = harness();
    await h.sync();
    Object.assign(h.user, account);
    h.time(start + 180000 + (Object.keys(account).length ? 0 : 16 * 60000));
    assert.equal((await h.deliver()).skipped, true);
    assert.equal(h.sent.length, 0);
  }
});

test('a delivered job is not sent again when QStash retries it', async () => {
  const h = harness();
  await h.sync();
  h.time(start + 180000);
  assert.equal((await h.deliver()).delivered, true);
  assert.equal((await h.deliver()).skipped, true);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].payload.data.presenceCheckId, 'focus-session:720');
});

test('early callbacks and simultaneous deliveries are retried instead of acknowledged', async () => {
  const h = harness();
  await h.sync();
  await assert.rejects(h.deliver(), /not due/);
  h.time(start + 180000);
  const delivered = h.deliver();
  await assert.rejects(h.deliver(), /already in progress/);
  await delivered;
});

test('temporary provider failures release the delivery lease for retry', async () => {
  const h = harness();
  await h.sync();
  h.time(start + 180000);
  h.failSend(new Error('temporary timeout'));
  await assert.rejects(h.deliver(), /timeout/);
  assert.equal(h.job().leaseUntil, null);
  assert.equal(h.job().status, 'PENDING');
  h.failSend(null);
  assert.equal((await h.deliver()).delivered, true);
});

test('expired push endpoints are removed', async () => {
  const h = harness();
  await h.sync();
  h.time(start + 180000);
  h.failSend(Object.assign(new Error('gone'), { statusCode: 410 }));
  assert.equal((await h.deliver()).expired, true);
  assert.equal(h.deleted.length, 1);
});

test('a failed QStash publish is retried by the next heartbeat with the same generation', async () => {
  const h = harness();
  h.failPublish(true);
  await assert.rejects(h.sync(), /scheduler/);
  const generation = h.job().generation;
  h.failPublish(false);
  await h.sync(state(), start + 1000);
  assert.equal(h.published.length, 1);
  assert.equal(h.published[0].generation, generation);
});
