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
  assert.deepEqual(invalid.orderedIds, ['easy', 'medium', 'hard']);
  assert.equal(invalid.workMinutes, 20);
  assert.equal(invalid.targetSessions, 3);
});

test('applying task order keeps every task once and completed tasks at the end', () => {
  const done = { id: 'done', text: 'Finished', completed: true };
  const ordered = applyReflectionTaskOrder([done, ...tasks], ['easy', 'easy', 'unknown']);
  assert.deepEqual(ordered.map(task => task.id), ['easy', 'hard', 'medium', 'done']);
  assert.equal(tasks[0].id, 'hard');
});

const screenshotTasks = [
  { id: 'it', text: 'IT Module 10', priority: 'high' }, { id: 'archi', text: 'Archi', priority: 'high' },
  { id: 'science', text: 'Science', priority: 'medium' }, { id: 'fil', text: 'Fil', priority: 'medium' },
  { id: 'medtech', text: 'Medtech', priority: 'low' },
];
const preference = 'I want to start with medium first then idk if low or high?';

test('the reported medium-first request overrides default high-first order and does not invent motivation', () => {
  const result = normalizeReflectionPlan({ state: 'Motivated', orderedIds: ['it', 'archi', 'science', 'fil', 'medtech'],
    workMinutes: 50, breakMinutes: 10, actionPlan: 'You are full of positive energy.' }, preference, screenshotTasks);
  assert.deepEqual(result.orderedIds, ['science', 'fil', 'it', 'archi', 'medtech']);
  assert.equal(result.state, 'Engaged');
  assert.equal(result.workMinutes, 25);
  assert.equal(result.breakMinutes, 5);
  assert.doesNotMatch(result.actionPlan, /positive energy/);
});

test('task names returned instead of IDs are resolved, ordered, and retained as AI guidance', () => {
  const result = normalizeReflectionPlan({ state: 'Engaged', orderedIds: ['Science', 'Fil', 'IT Module 10', 'Archi', 'Medtech'],
    actionPlan: 'Start with Science to build momentum.' }, preference, screenshotTasks);
  assert.deepEqual(result.orderedIds, ['science', 'fil', 'it', 'archi', 'medtech']);
  assert.equal(result.responseSource, 'ai');
  assert.match(result.actionPlan, /Science/);
});

test('advice contradicting an explicit preference is replaced along with its order', () => {
  const result = normalizeReflectionPlan({ state: 'Engaged', orderedIds: ['archi', 'it', 'fil', 'science', 'medtech'],
    actionPlan: 'Start with Archi first.' }, preference, screenshotTasks);
  assert.equal(result.responseSource, 'fallback');
  assert.deepEqual(result.orderedIds, ['science', 'fil', 'it', 'archi', 'medtech']);
  assert.match(result.actionPlan, /Start with “Science”/);
  assert.doesNotMatch(result.actionPlan, /Archi first/);
});

test('explicit category sequences are respected and Med is not mistaken for medium', () => {
  const tasks = [...screenshotTasks, { id: 'med', text: 'Med', priority: 'low' }];
  const result = generateCognitiveFallback('Start with medium first, then low, then high.', tasks);
  assert.deepEqual(result.orderedIds, ['science', 'fil', 'medtech', 'med', 'it', 'archi']);
});
