import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/lib/reflectionPlan.js', import.meta.url), 'utf8');
const { generateCognitiveFallback, normalizeReflectionPlan, applyReflectionTaskOrder } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const tasks = [
  { id: 'hard', text: 'Solve physiology problems', priority: 'High' },
  { id: 'easy', text: 'Review anatomy terms', priority: 'Low' },
  { id: 'medium', text: 'Read biology notes', priority: 'Medium' },
];

test('fallback adapts English and Tagalog reflections with task-specific advice', () => {
  for (const text of ['I feel stressed about my exams', 'Pagod ako at nahihirapan mag aral']) {
    const result = generateCognitiveFallback(text, tasks);
    assert.equal(result.state, 'Stressed');
    assert.deepEqual(result.orderedIds, ['easy', 'medium', 'hard']);
    assert.match(result.actionPlan, /Review anatomy terms/);
    assert.equal(result.workMinutes, 15);
    assert.equal(result.responseSource, 'fallback');
  }
  const motivated = generateCognitiveFallback('I am energetic and ready to study', [...tasks].reverse());
  assert.equal(motivated.orderedIds[0], 'hard');
  assert.equal(motivated.workMinutes, 50);
});

test('a named subject takes precedence and requested rhythm is honored', () => {
  const result = generateCognitiveFallback('Ready ako pero unahin biology, 30 mins and 3 sessions', tasks);
  assert.equal(result.orderedIds[0], 'medium');
  assert.equal(result.workMinutes, 30);
  assert.equal(result.targetSessions, 3);
});

test('missing or malformed model order cannot drop tasks or introduce unknown IDs', () => {
  const missing = normalizeReflectionPlan({ state: 'Stressed', actionPlan: 'Take one small step.' }, 'Stressed ako', tasks);
  assert.deepEqual(missing.orderedIds, ['easy', 'medium', 'hard']);
  const invalid = normalizeReflectionPlan({ state: 'Distracted', orderedIds: ['medium', 'medium', 'unknown'],
    workMinutes: -20, targetSessions: 99 }, 'I feel distracted', tasks);
  assert.deepEqual(invalid.orderedIds, ['medium', 'easy', 'hard']);
  assert.equal(invalid.workMinutes, 20);
  assert.equal(invalid.targetSessions, 3);
});

test('applying task order keeps every task once and completed tasks at the end', () => {
  const done = { id: 'done', text: 'Finished', completed: true };
  const ordered = applyReflectionTaskOrder([done, ...tasks], ['easy', 'easy', 'unknown']);
  assert.deepEqual(ordered.map(task => task.id), ['easy', 'hard', 'medium', 'done']);
  assert.equal(tasks[0].id, 'hard');
});
