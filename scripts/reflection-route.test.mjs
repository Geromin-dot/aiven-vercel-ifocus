import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const plans = await import(moduleUrl(await readFile(new URL('../src/lib/reflectionPlan.js', import.meta.url), 'utf8')));
const input = await import(moduleUrl(await readFile(new URL('../src/lib/reflectionInput.js', import.meta.url), 'utf8')));
const route = await readFile(new URL('../src/app/api/ai/coach/route.js', import.meta.url), 'utf8');
function endpoint(callGemini) {
  const context = vm.createContext({ ...plans, ...input, callGemini,
    console: { warn() {} }, NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) },
  });
  vm.runInContext(route.replace(/^import .*;\r?\n/gm, '').replace('export async function POST', 'async function POST') + '\nglobalThis.post = POST;', context);
  return body => context.post({ text: async () => JSON.stringify(body) });
}
const tasks = [{ id: 'a', text: 'Review anatomy', priority: 'Low' }, { id: 'b', text: 'Solve physiology', priority: 'High' }];

test('provider failure still gives a task-specific plan with an explicit fallback status', async () => {
  const post = endpoint(async () => { throw new Error('Provider quota exhausted'); });
  const result = await post({ text: 'Pagod ako, unahin anatomy please', tasks });
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
    assert.equal(options.totalTimeoutMs, 12000);
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
