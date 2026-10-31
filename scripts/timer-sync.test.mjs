import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const timerSource = await readFile(new URL('../src/lib/timerState.js', import.meta.url), 'utf8');
const timerUrl = `data:text/javascript;base64,${Buffer.from(timerSource).toString('base64')}`;
const syncSource = (await readFile(new URL('../src/lib/telemetrySync.js', import.meta.url), 'utf8'))
  .replace("'./timerState'", JSON.stringify(timerUrl));
let moduleNumber = 0;

async function setup(local, cloud, beforeResponse = () => {}) {
  const storage = new Map(Object.entries({ ifocus_timer_device_id: 'phone', ...local }));
  const events = [];
  const requests = [];
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  globalThis.window = { dispatchEvent: event => events.push(event) };
  globalThis.CustomEvent = class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (!options) beforeResponse(storage);
    return { ok: true, json: async () => ({ userId: 'student-1', telemetryState: cloud, timerPreferences: {} }) };
  };
  const module = await import(`data:text/javascript;base64,${Buffer.from(`${syncSource}\n// ${moduleNumber++}`).toString('base64')}`);
  await module.reconcileCloudTelemetry();
  return { storage, events, requests };
}

test('a stale cloud countdown cannot roll back a local presence pause', async () => {
  const local = { deviceId: 'phone', timeLeft: 720, totalTime: 900, isRunning: false, presencePaused: true, updatedAt: 200 };
  const { storage, events } = await setup({ ifocus_timer_state: JSON.stringify(local) }, {
    activeTimerState: { ...local, timeLeft: 840, isRunning: true, presencePaused: false, updatedAt: 100, targetEndTime: Date.now() + 840000 },
  });
  assert.deepEqual(JSON.parse(storage.get('ifocus_timer_state')), local);
  assert.equal(events.some(event => event.type === 'ifocus_timer_sync'), false);
});

test('a pause made during an in-flight request remains authoritative', async () => {
  const pause = { deviceId: 'phone', timeLeft: 827, totalTime: 900, isRunning: false, updatedAt: 300 };
  const { storage } = await setup({ ifocus_timer_state: JSON.stringify({ ...pause, isRunning: true }) }, {
    activeTimerState: { ...pause, timeLeft: 900, isRunning: true, updatedAt: 100 },
  }, storage => storage.set('ifocus_timer_state', JSON.stringify(pause)));
  assert.deepEqual(JSON.parse(storage.get('ifocus_timer_state')), pause);
});

test('PC to phone handoff offers the recorded 10 minutes without starting a countdown', async () => {
  const { storage, events, requests } = await setup({}, {
    activeTimerState: { deviceId: 'pc', timerSessionId: 'pc-session', isFocus: true, isRunning: true,
      totalTime: 900, timeLeft: 300, updatedAt: 1000000, targetEndTime: 1000001 },
  });
  const recovered = JSON.parse(storage.get('ifocus_interrupted_session_student-1'));
  assert.equal(recovered.duration, 600);
  assert.equal(recovered.id, 'pc-session');
  assert.equal(storage.has('ifocus_timer_state'), false);
  assert.equal(events.some(event => event.type === 'ifocus_timer_sync'), false);
  assert.equal(requests.length, 1);
});

test('saved or discarded sessions do not reappear from an old checkpoint', async () => {
  const { storage } = await setup({}, {
    activeTimerState: { deviceId: 'pc', timerSessionId: 'resolved', isFocus: true, totalTime: 900, timeLeft: 300 },
    resolvedTimerSessions: ['resolved'],
  });
  assert.equal(storage.has('ifocus_interrupted_session_student-1'), false);
});

test('recovery save retries use one unique study-session record', async () => {
  const records = new Map();
  const prisma = {
    user: { findUnique: async () => ({ id: 'student-1' }) },
    deck: { findFirst: async () => ({ id: 'deck-1' }) },
    studySession: { upsert: async args => {
      if (!records.has(args.where.id)) records.set(args.where.id, args.create);
      return records.get(args.where.id);
    } },
  };
  const route = (await readFile(new URL('../src/app/api/study-sessions/route.js', import.meta.url), 'utf8'))
    .replace(/import \{ NextResponse \}[^;]+;/, 'const NextResponse = { json: (body, options = {}) => ({ body, status: options.status || 200 }) };')
    .replace(/import \{ getServerSession \}[^;]+;/, 'const getServerSession = async () => ({ user: { id: "student-1" } });')
    .replace(/import \{ authOptions \}[^;]+;/, 'const authOptions = {};')
    .replace(/import \{ prisma \}[^;]+;/, 'const prisma = globalThis.__timerTestPrisma;');
  globalThis.__timerTestPrisma = prisma;
  const { POST } = await import(`data:text/javascript;base64,${Buffer.from(route).toString('base64')}`);
  const request = () => ({ json: async () => ({ duration: 600, recoveryId: 'pc-session' }) });
  const first = await POST(request());
  const retry = await POST(request());
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(records.size, 1);
  assert.equal(first.body.session.duration, 600);
  delete globalThis.__timerTestPrisma;
});
