import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const load = async path => import(`data:text/javascript;base64,${Buffer.from(await read(path)).toString('base64')}`);
const { detectDeviceType, summarizeDevices } = await load('src/lib/deviceContext.js');
const { reflectionRhythm, normalizeReflectionPlan, generateSafetySupport } = await load('src/lib/reflectionPlan.js');
const { advanceFocusClock } = await load('src/lib/focusClock.js');

test('a focus session retains its starting device when another device resumes it', () => {
  const state = { timerSessionId: 'device-test-session', isRunning: true, isFocus: true, deviceType: 'mobile', totalTime: 1500, timeLeft: 1500, updatedAt: 1000 };
  const started = advanceFocusClock({}, state, {}, 'login', 1000);
  assert.equal(started.sessions[0].deviceType, 'mobile');
  const resumed = advanceFocusClock(started, { ...state, deviceType: 'pc', updatedAt: 2000 }, {}, 'login', 2000);
  assert.equal(resumed.sessions[0].deviceType, 'mobile');
});

test('device categories include tablet desktop mode and retain unknown historical sessions', () => {
  assert.equal(detectDeviceType('Windows NT 10.0'), 'pc');
  assert.equal(detectDeviceType('Macintosh'), 'pc');
  assert.equal(detectDeviceType('Android'), 'mobile');
  assert.equal(detectDeviceType('Macintosh', '', 5), 'mobile');
  assert.equal(detectDeviceType('', '?1'), 'mobile');
  assert.equal(detectDeviceType(), 'unknown');
  const summary = summarizeDevices([{ deviceType: 'pc', durationSeconds: 90 }, { deviceType: 'mobile', duration: 3 },
    { durationSeconds: 60 }, { verification: 'pending', duration: 50 }]);
  assert.deepEqual(summary, { pc: { count: 1, minutes: 1.5 }, mobile: { count: 1, minutes: 3 }, unknown: { count: 1, minutes: 1 } });
});

test('all four pacing outcomes preserve student cycles and reject conflicting model timers', () => {
  for (const [state, focus, rest] of [['Stressed', 12, 3], ['Distracted', 25, 5], ['Engaged', 35, 10], ['Motivated', 50, 10]]) {
    assert.deepEqual(reflectionRhythm('', state, 4), { workMinutes: focus, breakMinutes: rest, targetSessions: 4 });
    const plan = normalizeReflectionPlan({ state, orderedIds: [], workMinutes: 999, actionPlan: 'Study for 999 minutes.' }, 'Help me study for my exam', [], 4);
    assert.equal(plan.workMinutes, focus);
    assert.equal(plan.targetSessions, 4);
    assert.equal(plan.responseSource, 'fallback');
    assert.doesNotMatch(plan.actionPlan, /999/);
  }
  assert.deepEqual(reflectionRhythm('30 minutes focus, 7 minute break and 3 sessions', 'Engaged', 5), { workMinutes: 30, breakMinutes: 7, targetSessions: 3 });
  assert.equal(reflectionRhythm('7 minute break', 'Engaged').workMinutes, 35);
  assert.equal(generateSafetySupport('I am exhausted and need to rest').supportKind, 'rest');
});

test('equal effort remains stable even if model silently reverses all High tasks', () => {
  const tasks = [{ id: 'a', text: 'Anatomy', priority: 'High' }, { id: 'b', text: 'Biology', priority: 'High' }];
  const plan = normalizeReflectionPlan({ state: 'Engaged', orderedIds: ['b', 'a'], actionPlan: 'Start with Biology.' }, 'Help me study for my exam', tasks);
  assert.deepEqual(plan.orderedIds, ['a', 'b']);
  assert.doesNotMatch(plan.actionPlan, /Start with Biology/);
});

test('gender endpoint requires authentication, validates choices, and refuses replacing a saved choice', async () => {
  const source = await read('src/app/api/user/gender/route.js');
  const identities = await load('src/lib/genderIdentity.js');
  let saved = null;
  let session = { user: { id: 'test-student' } };
  const context = vm.createContext({ ...identities, authOptions: {}, getServerSession: async () => session,
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) },
    prisma: { user: { updateMany: async ({ where, data }) => {
      assert.deepEqual(JSON.parse(JSON.stringify(where)), { id: 'test-student', genderIdentity: null });
      if (saved) return { count: 0 };
      saved = data.genderIdentity; return { count: 1 };
    } } },
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('export async function POST', 'async function POST') + '\nglobalThis.post = POST;', context);
  const post = genderIdentity => context.post({ json: async () => ({ genderIdentity }) });
  assert.equal((await post('invalid')).status, 400);
  const results = await Promise.all([post('Woman'), post('Man')]);
  assert.deepEqual(results.map(result => result.status), [200, 409]);
  assert.equal(saved, 'Woman');
  assert.equal((await post('Prefer not to say')).status, 409);
  session = null;
  assert.equal((await post('Woman')).status, 401);
});

test('daily allowance changes day at Philippine midnight and uses conditional atomic upsert', async () => {
  const source = await read('src/lib/aiDailyUsage.js');
  const calls = [];
  const context = vm.createContext({ prisma: { $queryRaw: async (strings, ...values) => {
    calls.push({ sql: strings.join('?'), values }); return [{ count: 3 }];
  } } });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '') + '\nglobalThis.day=aiUsageDay;globalThis.reserve=reserveDailyAIRequest;', context);
  assert.equal(context.day(Date.parse('2026-11-22T15:59:59Z')), '2026-11-22');
  assert.equal(context.day(Date.parse('2026-11-22T16:00:00Z')), '2026-11-23');
  const reflection = await context.reserve('student', 'reflection');
  const flashcards = await context.reserve('student', 'flashcards');
  assert.equal(reflection.limit, 10);
  assert.equal(flashcards.limit, 3);
  assert.match(calls[0].sql, /ON CONFLICT/);
  assert.match(calls[0].sql, /WHERE "AiDailyUsage"\."count" < /);
  await assert.rejects(context.reserve('student', 'unknown'), /Unknown AI feature/);
});
