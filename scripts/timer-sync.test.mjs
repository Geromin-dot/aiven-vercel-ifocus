import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const timerSource = await readFile(new URL('../src/lib/timerState.js', import.meta.url), 'utf8');
const timerUrl = `data:text/javascript;base64,${Buffer.from(timerSource).toString('base64')}`;
const recoverySource = await readFile(new URL('../src/lib/recoveryState.js', import.meta.url), 'utf8');
const recoveryUrl = `data:text/javascript;base64,${Buffer.from(recoverySource).toString('base64')}`;
const signalUrl = `data:text/javascript;base64,${Buffer.from(await readFile(new URL('../src/lib/coachSignals.js', import.meta.url), 'utf8')).toString('base64')}`;
const reflectionJournalUrl = `data:text/javascript;base64,${Buffer.from(await readFile(new URL('../src/lib/reflectionJournal.js', import.meta.url), 'utf8')).toString('base64')}`;
const syncSource = (await readFile(new URL('../src/lib/telemetrySync.js', import.meta.url), 'utf8'))
  .replace("'./timerState'", JSON.stringify(timerUrl))
  .replace("'./recoveryState'", JSON.stringify(recoveryUrl))
  .replace("'./coachSignals'", JSON.stringify(signalUrl))
  .replace("'./reflectionJournal'", JSON.stringify(reflectionJournalUrl));
let moduleNumber = 0;

test('saving waits for timer checkpoints and stops if the checkpoint failed', async () => {
  const source = await readFile(new URL('../src/lib/verifiedStudyClient.js', import.meta.url), 'utf8');
  const { syncTimerCheckpoint, saveVerifiedStudySession } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const requests = [];
  let finishCheckpoint;
  globalThis.fetch = async url => {
    requests.push(url);
    return new Promise(resolve => { finishCheckpoint = resolve; });
  };
  const checkpoint = syncTimerCheckpoint({ timerSessionId: 'session-1', isRunning: true });
  const rejectedCheckpoint = assert.rejects(checkpoint, /checkpoint/);
  const save = saveVerifiedStudySession({ timerSessionId: 'session-1', duration: 120 });
  const rejectedSave = assert.rejects(save, /checkpoint/);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, ['/api/user/telemetry']);
  finishCheckpoint({ ok: false });
  await Promise.all([rejectedCheckpoint, rejectedSave]);
  assert.deepEqual(requests, ['/api/user/telemetry']);
});

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
  const syncModule = await import(`data:text/javascript;base64,${Buffer.from(`${syncSource}\n// ${moduleNumber++}`).toString('base64')}`);
  await syncModule.reconcileCloudTelemetry();
  return { storage, events, requests };
}

test('a cloud response in flight cannot reactivate a deactivated BreakGate deck', async () => {
  const deck = { id: 'old-deck', userId: 'student-1' };
  const { storage, requests } = await setup({}, { activeBreakGateDeck: deck, activeBreakGateDeckUpdatedAt: 100 }, local => {
    local.set('ifocus_breakgate_deck_updated_at_student-1', '200');
  });
  assert.equal(storage.has('ifocus_active_breakgate_deck'), false);
  const write = requests.find(request => request.options?.method === 'POST');
  assert.equal(JSON.parse(write.options.body).telemetryState.activeBreakGateDeck, null);
});

test('an unversioned cloud deck cannot restore a previously cleared local selection', async () => {
  const { storage } = await setup({}, { activeBreakGateDeck: { id: 'old-deck', userId: 'student-1' } });
  assert.equal(storage.has('ifocus_active_breakgate_deck'), false);
});

test('a stale cloud response cannot reactivate an AI timer adjustment cleared in flight', async () => {
  const { storage, requests } = await setup({}, {
    aiAdjustedTimer: true, aiAdjustedDetails: { title: 'Earlier strategy' }, aiAdjustedUpdatedAt: 100,
  }, local => local.set('ifocus_ai_adjusted_updated_at', '200'));
  assert.equal(storage.has('ifocus_ai_adjusted_active'), false);
  assert.equal(storage.has('ifocus_ai_adjusted_details'), false);
  const write = requests.find(request => request.options?.method === 'POST');
  const telemetry = JSON.parse(write.options.body).telemetryState;
  assert.equal(telemetry.aiAdjustedTimer, false);
  assert.equal(telemetry.aiAdjustedDetails, null);
  assert.equal(telemetry.aiAdjustedUpdatedAt, 200);
});

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

test('a new reflection during a cloud request cannot be overwritten by old AFK data', async () => {
  const idle = { state: 'idle', timestamp: new Date(Date.now() - 60_000).toISOString(), reason: 'Inactivity detected' };
  const stress = { state: 'Stressed', timestamp: new Date().toISOString(), source: 'reflection_submission' };
  const { storage } = await setup({ ifocus_latest_telemetry: JSON.stringify(idle) },
    { latestTelemetry: idle, insightData: idle, activeIdleAlert: idle }, values => {
      values.set('ifocus_latest_telemetry', JSON.stringify(stress));
    });
  assert.equal(JSON.parse(storage.get('ifocus_latest_telemetry')).state, 'Stressed');
  assert.equal(JSON.parse(storage.get('ifocus_telemetry_insight_anonymous')).state, 'Stressed');
  assert.equal(storage.has('ifocus_active_idle_alert'), false);
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

test('verified focus without a deck saves one study-session record across retries', async () => {
  const clockSource = await readFile(new URL('../src/lib/focusClock.js', import.meta.url), 'utf8');
  const clockUrl = `data:text/javascript;base64,${Buffer.from(clockSource).toString('base64')}`;
  const source = (await readFile(new URL('../src/lib/focusRecording.js', import.meta.url), 'utf8')).replace("'./focusClock.js'", JSON.stringify(clockUrl));
  const { recordVerifiedFocus } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const records = new Map();
  let telemetryState=JSON.stringify({focusClock:{sessions:[{id:'pc-session',elapsedMs:600000,plannedMs:900000,runningSince:null}]}});
  const tx={user:{findUnique:async()=>({telemetryState}),update:async({data})=>{telemetryState=data.telemetryState;}},
    studySession:{findFirst:async({where})=>records.get(where.id)||null,
      create:async({data})=>{records.set(data.id,data);return data;}}};
  const input={timerSessionId:'pc-session',recoveryId:'pc-session',duration:600};
  const first=await recordVerifiedFocus(tx,'student-1',input,1000000);
  const retry=await recordVerifiedFocus(tx,'student-1',input,1000001);
  assert.equal(first.id,retry.id);assert.equal(records.size,1);assert.equal(first.duration,600);
  assert.equal(first.deckId,null);
});

test('a cloud discard clears an already cached phone prompt and persists the resolution', async () => {
  const { storage, events } = await setup({ 'ifocus_interrupted_session_student-1': JSON.stringify({id:'resolved',duration:420}) }, {
    activeTimerState: {deviceId:'pc',timerSessionId:'resolved',isFocus:true,totalTime:900,timeLeft:480},
    resolvedTimerSessions:['resolved'],
  });
  assert.equal(storage.has('ifocus_interrupted_session_student-1'),false);
  assert.deepEqual(JSON.parse(storage.get('ifocus_resolved_timer_sessions_student-1')),['resolved']);
  assert.equal(events.some(event=>event.type==='ifocus_recovery_resolved'),true);
});

test('a stale cloud response cannot re-offer a session already discarded locally', async () => {
  const {storage}=await setup({'ifocus_resolved_timer_sessions_student-1':'["resolved"]'}, {
    activeTimerState:{deviceId:'pc',timerSessionId:'resolved',isFocus:true,totalTime:900,timeLeft:480},
    resolvedTimerSessions:[],
  });
  assert.equal(storage.has('ifocus_interrupted_session_student-1'),false);
});

test('less than a minute of checkpoint progress is never offered for recovery', async () => {
  const {storage}=await setup({}, {activeTimerState:{deviceId:'pc',timerSessionId:'short',isFocus:true,totalTime:900,timeLeft:841}});
  assert.equal(storage.has('ifocus_interrupted_session_student-1'),false);
});


test('telemetry sync retries a conflict and preserves newer timer decisions over stale payloads', async () => {
  const newSignal = { state: 'Stressed', timestamp: '2026-11-01T01:01:00Z' };
  const oldSignal = { state: 'idle', timestamp: '2026-11-01T01:00:00Z' };
  let row = { telemetryState: JSON.stringify({
    resolvedTimerSessions: ['pc-discard'], latestTelemetry: newSignal,
    aiAdjustedTimer: false, aiAdjustedDetails: null, aiAdjustedUpdatedAt: 200,
  }), timerPreferences: '{}' };
  let attempts = 0;
  globalThis.__recoveryTestDb = {
    $transaction: async (callback, options) => {
      assert.equal(options.isolationLevel, 'Serializable');
      if (attempts++ === 0) throw Object.assign(new Error('serialization conflict'), {code:'P2034'});
      return callback({user:{findUnique:async()=>row,update:async({data})=>{row={...row,...data};return row;}}});
    },
  };
  const route = (await readFile(new URL('../src/app/api/user/telemetry/route.js', import.meta.url), 'utf8'))
    .replace(/import \{ NextResponse \}[^;]+;/, 'const NextResponse={json:(body,options={})=>({body,status:options.status||200})};')
    .replace(/import \{ getServerSession \}[^;]+;/, 'const getServerSession=async()=>({user:{id:"student-1"}});')
    .replace(/import \{ authOptions \}[^;]+;/, 'const authOptions={};')
    .replace(/import \{ prisma \}[^;]+;/, 'const prisma=globalThis.__recoveryTestDb;')
    .replace("'../../../../lib/recoveryState'", JSON.stringify(recoveryUrl))
    .replace("'../../../../lib/reflectionJournal'", JSON.stringify(reflectionJournalUrl))
    .replace("'../../../../lib/focusClock'", JSON.stringify(`data:text/javascript;base64,${Buffer.from(await readFile(new URL('../src/lib/focusClock.js', import.meta.url), 'utf8')).toString('base64')}`));
  const {POST}=await import(`data:text/javascript;base64,${Buffer.from(route).toString('base64')}`);
  for(const resolvedTimerSessions of [null, [], ['phone-save']]) {
    const result=await POST({json:async()=>({telemetryState:{
      resolvedTimerSessions, latestTelemetry: oldSignal, activeTimerState: { updatedAt: 200 },
      aiAdjustedTimer: true, aiAdjustedDetails: { title: 'Earlier strategy' }, aiAdjustedUpdatedAt: 100,
    }})});
    assert.equal(result.status,200);
    assert.ok(JSON.parse(row.telemetryState).resolvedTimerSessions.includes('pc-discard'));
    assert.equal(JSON.parse(row.telemetryState).latestTelemetry.state, 'Stressed');
    assert.equal(JSON.parse(row.telemetryState).aiAdjustedTimer, false);
    assert.equal(JSON.parse(row.telemetryState).aiAdjustedDetails, null);
  }
  assert.deepEqual(JSON.parse(row.telemetryState).resolvedTimerSessions,['pc-discard','phone-save']);
  delete globalThis.__recoveryTestDb;
});

test('reflection retention expires at 48 hours and an older device cannot revive an expired entry', async () => {
  const { mergeReflections, pruneReflectionTelemetry, REFLECTION_RETENTION_MS } = await import(reflectionJournalUrl);
  const now = Date.UTC(2026, 10, 9);
  const expired = { id: 'expired', date: new Date(now - REFLECTION_RETENTION_MS).toISOString() };
  const recent = { id: 'recent', date: new Date(now - 1000).toISOString() };
  assert.deepEqual(mergeReflections([expired], [expired, recent], now), [recent]);
  assert.deepEqual(mergeReflections([expired], [{ ...expired, date: recent.date }], now), []);
  const expiredSignal = { source: 'reflection_submission', timestamp: expired.date };
  assert.deepEqual(pruneReflectionTelemetry({
    journalHistory: [expired, recent], latestTelemetry: expiredSignal,
    aiAdjustedDetails: { reflectionText: 'private', message: 'old advice', sessions: 2 }, focusClock: { preserve: true },
  }, now), { journalHistory: [recent], latestTelemetry: null, aiAdjustedDetails: { sessions: 2 }, focusClock: { preserve: true } });
});
