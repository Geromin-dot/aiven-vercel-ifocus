import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const load = async path => import(`data:text/javascript;base64,${Buffer.from(await read(path)).toString('base64')}`);
const { reflectionRhythm, normalizeReflectionPlan, generateSafetySupport } = await load('src/lib/reflectionPlan.js');
const { isStudyDevice, studyDeviceLabel } = await load('src/lib/studyDevice.js');

test('device preferences allow Mobile, PC/Desktop or Both and do not infer a missing value', () => {
  for (const value of ['mobile', 'pc', 'both']) assert.equal(isStudyDevice(value), true);
  assert.equal(isStudyDevice('tablet'), false);
  assert.equal(studyDeviceLabel('pc'), 'PC/Desktop');
  assert.equal(studyDeviceLabel(null), 'Not selected');
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

test('sex endpoint requires authentication, validates choices, and refuses replacing a saved choice', async () => {
  const source = await read('src/app/api/user/sex/route.js');
  const identities = await load('src/lib/sex.js');
  let saved = null;
  let session = { user: { id: 'test-student' } };
  const context = vm.createContext({ ...identities, authOptions: {}, getServerSession: async () => session,
    NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) },
    prisma: { user: { updateMany: async ({ where, data }) => {
      assert.deepEqual(JSON.parse(JSON.stringify(where)), { id: 'test-student', sex: null });
      if (saved) return { count: 0 };
      saved = data.sex; return { count: 1 };
    } } },
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('export async function POST', 'async function POST') + '\nglobalThis.post = POST;', context);
  const post = sex => context.post({ json: async () => ({ sex }) });
  assert.equal((await post('invalid')).status, 400);
  const results = await Promise.all([post('Male'), post('Female')]);
  assert.deepEqual(results.map(result => result.status), [200, 409]);
  assert.equal(saved, 'Male');
  assert.equal((await post('Female')).status, 409);
  session = null;
  assert.equal((await post('Male')).status, 401);
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
