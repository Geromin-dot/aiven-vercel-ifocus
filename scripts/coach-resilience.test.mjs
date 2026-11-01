import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/coachResilience.js', import.meta.url), 'utf8');
const { adaptCoachToResilience } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const baseline = {
  cognitiveState: { title: 'High Energy / Driven', status: 'Peak' },
  recommendedRhythm: { title: '50m Work / 10m Gate' },
  staminaPct: 100,
  skippedEvents: 0,
};

test('healthy resilience preserves energetic reflection and deep work rhythm', () => {
  const result = adaptCoachToResilience(baseline);
  assert.equal(result.cognitiveState, baseline.cognitiveState);
  assert.equal(result.recommendedRhythm, baseline.recommendedRhythm);
  assert.equal(result.recoveryNeeded, false);
  assert.equal(result.pacingNeeded, false);
});

test('skips progressively reduce the rhythm even with high energy or a long custom timer', () => {
  for (const [skippedEvents, staminaPct, minutes] of [[1, 80, 25], [2, 60, 20], [3, 40, 15], [6, 0, 15]]) {
    const result = adaptCoachToResilience({ ...baseline, skippedEvents, staminaPct });
    assert.equal(result.recommendedRhythm.title, `${minutes}m Work / 5m Gate`);
    assert.notEqual(result.cognitiveState.status, 'Peak');
    assert.equal(result.recoveryNeeded, skippedEvents >= 3);
  }
});

test('zero resilience replaces default optimal state with recovery needed', () => {
  const result = adaptCoachToResilience({ ...baseline, cognitiveState: { title: 'In the Zone' }, staminaPct: 0, skippedEvents: 6 });
  assert.equal(result.cognitiveState.title, 'Recovery Needed');
  assert.match(result.recommendedRhythm.subtext, /5m recovery break first/);
});

test('stress and idle signals remain visible alongside recovery evidence', () => {
  for (const title of ['High Tension / Stress', 'Task Hesitation / Idle', 'Mental Fatigue']) {
    const result = adaptCoachToResilience({ ...baseline, cognitiveState: { title }, preserveState: true, staminaPct: 0, skippedEvents: 6 });
    assert.equal(result.cognitiveState.title, title);
    assert.equal(result.cognitiveState.status, 'Rest Needed');
    assert.equal(result.recoveryNeeded, true);
  }
});

test('protective pacing keeps an already shorter interval', () => {
  const result = adaptCoachToResilience({ ...baseline, recommendedRhythm: { title: '10m Work / 5m Gate' }, staminaPct: 60, skippedEvents: 2 });
  assert.equal(result.recommendedRhythm.title, '10m Work / 5m Gate');
});

test('restored resilience removes recovery restrictions', () => {
  assert.equal(adaptCoachToResilience({ ...baseline, staminaPct: 0, skippedEvents: 6 }).recoveryNeeded, true);
  const recovered = adaptCoachToResilience(baseline);
  assert.equal(recovered.recoveryNeeded, false);
  assert.equal(recovered.cognitiveState.title, 'High Energy / Driven');
});

test('current stress status and explanation are preserved instead of an older pacing advisory', () => {
  const cognitiveState = { title: 'High Tension / Stress', status: 'Tension', color: '#dc2626',
    dotColor: '#dc2626', subtext: 'Stress noted in your reflection.' };
  const recommendedRhythm = { title: '15m Work / 5m Gate', subtext: 'Lighter focus blocks for current stress.' };
  const result = adaptCoachToResilience({ cognitiveState, recommendedRhythm,
    staminaPct: 65, skippedEvents: 0, preserveState: true });
  assert.deepEqual(result.cognitiveState, cognitiveState);
  assert.equal(result.recommendedRhythm.subtext, recommendedRhythm.subtext);
});
