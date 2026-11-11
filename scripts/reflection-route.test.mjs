import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const plans = await import(moduleUrl(await readFile(new URL('../src/lib/reflectionPlan.js', import.meta.url), 'utf8')));
const input = await import(moduleUrl(await readFile(new URL('../src/lib/reflectionInput.js', import.meta.url), 'utf8')));
const verification = await import(moduleUrl(await readFile(new URL('../src/lib/aiVerification.js', import.meta.url), 'utf8')));
const route = await readFile(new URL('../src/app/api/ai/coach/route.js', import.meta.url), 'utf8');
const flashcardRoute = await readFile(new URL('../src/app/api/ai/flashcards/route.js', import.meta.url), 'utf8');
function endpoint(callGemini, session = { user: { id: 'student', verificationStatus: 'VERIFIED' } }, source = route) {
  const context = vm.createContext({ ...plans, ...input, ...verification, callGemini, getServerSession: async () => session, authOptions: {},
    console: { warn() {} }, NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) },
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/gm, '').replace('export const maxDuration', 'const maxDuration').replace('export async function POST', 'async function POST') + '\nglobalThis.post = POST;', context);
  return body => context.post({ text: async () => JSON.stringify(body), json: async () => body });
}
const tasks = [{ id: 'a', text: 'Review anatomy', priority: 'Low' }, { id: 'b', text: 'Solve physiology', priority: 'High' }];

test('safety disclosures return professional support immediately without calling the provider', async () => {
  const post = endpoint(async () => assert.fail('explicit safety language must not wait for the provider'));
  for (const text of ['I want to die', 'suicidal', 'Gusto ko nang mamatay']) {
    const result = await post({ text, tasks });
    assert.equal(result.status, 200);
    assert.equal(result.data.supportOnly, true);
    assert.equal(result.data.orderedIds, undefined);
  }
});

test('health and safety risks bypass the provider even when it is unavailable', async () => {
  const post = endpoint(async () => assert.fail('a detected risk must not call the provider'));
  for (const text of ['48 hours no sleep', 'Bleeding ako pero pinapag aral parin ako',
    'Dpako uminom ng tubig buong araw', 'Hindi pa ako nakakain buong araw',
    'I took too many pills', 'I feel dizzy', 'Someone is threatening me',
    'I want to hurt my classmate', 'Everyone would be better off without me',
    'I feel worthless', 'How can I stay awake for 72 hours?']) {
    const result = await post({ text, tasks });
    assert.equal(result.status, 200, text);
    assert.equal(result.data.supportOnly, true, text);
    assert.equal(result.data.workMinutes, undefined);
    assert.equal(result.data.orderedIds, undefined);
  }
});

test('semantic flags handle indirect risks and discard unsafe provider text', async () => {
  for (const safetyConcern of ['physical', 'wellbeing', 'danger', 'medical', 'emotional', 'rest']) {
    const post = endpoint(async () => ({ safetyConcern, actionPlan: 'Keep studying!', workMinutes: 120 }));
    const result = await post({ text: 'A situation only the semantic check recognizes', tasks });
    assert.equal(result.data.supportKind, safetyConcern);
    assert.equal(result.data.supportOnly, true);
    assert.doesNotMatch(result.data.actionPlan, /Keep studying/);
    assert.equal(result.data.workMinutes, undefined);
  }
});

test('provider-detected indirect safety language uses the same support-only response', async () => {
  const post = endpoint(async options => {
    assert.match(options.parts[0].text, /not a clinician or therapist/);
    assert.match(options.parts[0].text, /You may acknowledge feelings the student explicitly reports, including anxiety/);
    return { supportOnly: true };
  });
  const result = await post({ text: 'I will not be here tomorrow and cannot keep myself safe', tasks });
  assert.equal(result.data.supportOnly, true);
  assert.match(result.data.actionPlan, /professional/);
  assert.equal(result.data.workMinutes, undefined);
});

test('health assessment requests receive a non-diagnostic professional referral', async () => {
  const post = endpoint(async options => {
    assert.match(options.parts[0].text, /ALL mental and physical health conditions/);
    assert.match(options.parts[0].text, /Never infer an unreported feeling or confirm, invent, suggest, or rule out a diagnosis/);
    return { healthSupport: true };
  });
  const result = await post({ text: 'Does my typing mean I have ADHD?', tasks });
  assert.equal(result.data.supportKind, 'health');
  assert.match(result.data.actionPlan, /qualified healthcare professional/);
  assert.equal(result.data.state, undefined);
});

test('provider failure still gives a task-specific plan with an explicit fallback status', async () => {
  const post = endpoint(async () => { throw new Error('Provider quota exhausted'); });
  const result = await post({ text: 'Kinakabahan ako, unahin anatomy please', tasks });
  assert.equal(result.status, 200);
  assert.equal(result.data.responseSource, 'fallback');
  assert.equal(result.data.orderedIds[0], 'a');
  assert.match(result.data.actionPlan, /Review anatomy/);
});

test('valid repeated reflections are accepted without a new app cooldown or cached response', async () => {
  let calls = 0;
  const post = endpoint(async options => {
    calls++;
    assert.equal(options.cache, false);
    assert.equal(options.maxRetries, 0);
    assert.equal(options.totalTimeoutMs, 45000);
    assert.ok(options.timeoutMs >= 15000, 'backup models need time to produce detailed guidance');
    assert.match(options.parts[0].text, /60-90 words/);
    assert.match(options.parts[0].text, /Previous advice/);
    return { state: 'Motivated', orderedIds: ['b', 'b', 'unknown'], actionPlan: `Specific advice ${calls}` };
  });
  const first = await post({ text: 'I am ready to study physiology', tasks, recentAdvice: ['Earlier advice'] });
  const second = await post({ text: 'I am ready to study physiology', tasks });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.notEqual(first.data.actionPlan, second.data.actionPlan);
  assert.deepEqual(second.data.orderedIds, ['b', 'a']);
});

test('invalid reflections require context instead of inventing a successful AI result', async () => {
  const post = endpoint(async () => assert.fail('invalid input must not call the provider'));
  assert.equal((await post({ text: 'hi', tasks: null })).status, 422);
});

test('signed-out users cannot invoke the AI Coach', async () => {
  const post = endpoint(async () => assert.fail('signed-out requests must not reach the AI provider'), null);
  assert.equal((await post({ text: 'I am ready to study', tasks })).status, 401);
});

test('both AI endpoints reject pending, rejected, and missing verification before invoking AI', async () => {
  for (const source of [route, flashcardRoute]) {
    for (const verificationStatus of ['PENDING', 'REJECTED', undefined]) {
      const post = endpoint(async () => assert.fail('Unverified accounts must never reach the AI provider'),
        { user: { id: 'student', verificationStatus } }, source);
      const result = await post({ type: 'text', text: 'Study notes on anatomy', tasks });
      assert.equal(result.status, 403);
      assert.equal(result.data.error, verification.AI_VERIFICATION_MESSAGE);
    }
  }
});

test('unclear and personal stress hold study planning even when the provider is unavailable', async () => {
  const post = endpoint(async () => { throw new Error('Provider unavailable'); });
  for (const [text, expected] of [
    ['Stressed ako', 'clarify'],
    ['Stressed ako dahil may problema sa bahay, pero may exam ako bukas', 'personal'],
  ]) {
    const result = await post({ text, tasks });
    assert.equal(result.data.stressContext, expected);
    assert.equal(result.data.orderedIds, undefined);
    assert.equal(result.data.workMinutes, undefined);
    assert.equal(plans.normalizeReflectionPlan(result.data, text, tasks).stressContext, expected);
  }
  const academic = await post({ text: 'Stressed ako sa exam bukas', tasks });
  assert.equal(academic.data.state, 'Stressed');
  assert.equal(academic.data.workMinutes, 15);
});

test('a model-detected safety concern takes precedence over clarification', async () => {
  const post = endpoint(async () => ({ safetyConcern: 'emotional', stressContext: 'clarify' }));
  const result = await post({ text: 'Stressed ako', tasks });
  assert.equal(result.data.supportKind, 'emotional');
  assert.equal(result.data.stressContext, undefined);
});
