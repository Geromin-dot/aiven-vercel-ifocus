import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/lib/reflectionPlan.js', import.meta.url), 'utf8');
const { generateCognitiveFallback, normalizeReflectionPlan, applyReflectionTaskOrder, generateSafetySupport } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const tasks = [
  { id: 'hard', text: 'Solve physiology problems', priority: 'High' },
  { id: 'easy', text: 'Review anatomy terms', priority: 'Low' },
  { id: 'medium', text: 'Read biology notes', priority: 'Medium' },
];

const anatomyReflection = 'My anatomy quiz is tomorrow. I struggle most with the cardiovascular system, while the terminology review feels easier. I feel nervous and would like to start with the easier task before tackling practice questions.';
const anatomyTasks = [
  { id: 'practice', text: 'Answer cardiovascular practice questions', priority: 'High' },
  { id: 'terms', text: 'Review anatomy terminology', priority: 'Low' },
  { id: 'cardio', text: 'Review the cardiovascular system', priority: 'Medium' },
];

test('nervousness and easier-first wording retain a safe personalized anatomy response', () => {
  const actionPlan = 'You are anxious about your anatomy quiz tomorrow. Start with Review anatomy terminology, then tackle cardiovascular practice questions when ready.';
  const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['terms', 'cardio', 'practice'],
    taskPreference: { evidence: 'start with the easier task', priorityOrder: ['low'] }, actionPlan }, anatomyReflection, anatomyTasks);
  assert.equal(result.responseSource, 'ai');
  assert.equal(result.actionPlan, actionPlan);
  assert.equal(result.state, 'Stressed');
  assert.equal(result.orderedIds[0], 'terms');
  assert.deepEqual(normalizeReflectionPlan(result, anatomyReflection, anatomyTasks), result);
});

test('offline nervous easier-first reflection gets a gentler plan with the actual easier task', () => {
  const result = generateCognitiveFallback(anatomyReflection, anatomyTasks);
  assert.equal(result.state, 'Stressed');
  assert.equal(result.workMinutes, 15);
  assert.equal(result.orderedIds[0], 'terms');
  assert.match(result.actionPlan, /feeling nervous/);
});

test('an unrelated Writing task is not presented as anatomy review in fallback', () => {
  const unrelatedTasks = [{ id: 'writing', text: 'Writing', priority: 'High' }];
  const result = generateCognitiveFallback(anatomyReflection, unrelatedTasks);
  assert.match(result.actionPlan, /anatomy quiz tomorrow/);
  assert.match(result.actionPlan, /easier review/);
  assert.match(result.actionPlan, /Add a matching task/);
  assert.doesNotMatch(result.actionPlan, /Start with “Writing”/);
  assert.deepEqual(result.orderedIds, ['writing']);
});

test('valid anatomy coaching without saved anatomy tasks is retained rather than rejected for an empty order', () => {
  const unrelated = [{ id: 'writing', text: 'Writing', priority: 'High' }, { id: 'project', text: 'Project', priority: 'Low' }];
  const actionPlan = 'You are anxious about your anatomy quiz tomorrow. Begin with terminology, then try a cardiovascular practice question. Add these topics to your task list; your saved Writing and Project tasks are separate.';
  const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: [], actionPlan }, anatomyReflection, unrelated);
  assert.equal(result.responseSource, 'ai');
  assert.equal(result.actionPlan, actionPlan);
  assert.deepEqual(result.orderedIds, ['writing', 'project']);
  assert.deepEqual(normalizeReflectionPlan(result, anatomyReflection, unrelated), result);
});

test('an anatomy reflection cannot be redirected to unrelated Writing by AI prose', () => {
  const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['writing'], actionPlan: 'Start with your Writing task.' },
    anatomyReflection, [{ id: 'writing', text: 'Writing', priority: 'High' }]);
  assert.equal(result.responseSource, 'fallback');
  assert.ok(result.validationIssues.includes('unrelated_task_advice'));
  assert.match(result.actionPlan, /anatomy quiz tomorrow/);
  assert.doesNotMatch(result.actionPlan, /Start with your Writing/);
});

test('allowing reported nervousness still rejects a clinical diagnosis', () => {
  const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['terms', 'cardio', 'practice'],
    actionPlan: 'You have an anxiety disorder.' }, anatomyReflection, anatomyTasks);
  assert.equal(result.responseSource, 'fallback');
  assert.ok(result.validationIssues.includes('unsupported_health_advice'));
});

test('explicit safety disclosures bypass study plans in English and Tagalog, including offline fallback', () => {
  for (const text of ['I want to die', 'I wanna die', 'I want to kill myself', 'I am suicidal', 'suicidal', 'I don’t want to live', 'Gusto ko nang mamatay', 'Ayoko nang mabuhay', 'Papatayin ko ang sarili ko']) {
    for (const result of [generateCognitiveFallback(text, tasks), normalizeReflectionPlan({ state: 'Motivated', actionPlan: 'Start studying.' }, text, tasks)]) {
      assert.equal(result.supportOnly, true, text);
      assert.match(result.actionPlan, /mental health professional, school counselor, or doctor/);
      assert.match(result.actionPlan, /emergency services/);
      assert.equal(result.orderedIds, undefined);
      assert.equal(result.workMinutes, undefined);
      assert.equal(result.state, undefined);
    }
  }
});

test('clearly negated and academic references do not become safety disclosures', () => {
  for (const text of ['I do not want to die', "I don't want to hurt myself", 'I am not suicidal', 'I am studying suicide prevention for class', 'Ayoko mamatay']) {
    assert.equal(generateSafetySupport(text), null, text);
  }
});

test('diagnoses and unsupported health claims are replaced with ordinary study guidance', () => {
  for (const actionPlan of ['Your anxiety is causing this.', 'You are depressed.', 'You have an anxiety disorder.',
    'You have ADHD.', 'You have insomnia.', 'You have diabetes.', 'You are dehydrated.', 'You are perfectly healthy.',
    'You have a neurological syndrome.', 'You are diagnosed with something.', 'May ADHD ka.']) {
    const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['easy', 'medium', 'hard'], actionPlan }, 'I feel stressed about studying', tasks);
    assert.equal(result.responseSource, 'fallback');
    assert.doesNotMatch(result.actionPlan, /anxiety|anxious|depress|disorder|ADHD|insomnia|diabetes|dehydrat|healthy/i);
    assert.match(result.actionPlan, /Review anatomy/);
  }
});

test('self-reported anxiety can be acknowledged without asserting a diagnosis', () => {
  const actionPlan = 'You mentioned feeling anxious about your exams. Start with Review anatomy terms and one manageable study goal.';
  const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['easy', 'medium', 'hard'], actionPlan }, 'I feel anxious about exams', tasks);
  assert.equal(result.responseSource, 'ai');
  assert.equal(result.actionPlan, actionPlan);
});

test('health assessment requests get a professional referral without diagnoses or a crisis assumption', () => {
  for (const text of ['Do I have ADHD?', 'Do I have diabetes?', 'May sakit ba ako?']) {
    const result = normalizeReflectionPlan({ healthSupport: true }, text, tasks);
    assert.equal(result.supportKind, 'health');
    assert.equal(result.supportOnly, true);
    assert.match(result.actionPlan, /qualified healthcare professional/);
    assert.doesNotMatch(result.actionPlan, /ADHD|diabet|emergency|suicid/);
    assert.equal(result.workMinutes, undefined);
    assert.deepEqual(normalizeReflectionPlan(result, text, tasks), result);
  }
});

test('fallback adapts English and Tagalog reflections with task-specific advice', () => {
  for (const text of ['I feel stressed about my exams', 'Kinakabahan ako sa exam']) {
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

test('medium task preferences need not use the literal words start or first', () => {
  for (const text of ['I am stressed, I prefer medium tasks', 'I am stressed but I want to work on medium tasks',
    'Stressed ako, gusto ko ng medium tasks', 'I am stressed, medium priority before the high tasks']) {
    const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['science', 'it', 'archi', 'fil', 'medtech'],
      actionPlan: 'Start with Science.' }, text, screenshotTasks);
    assert.deepEqual(result.orderedIds.slice(0, 2), ['science', 'fil'], text);
    assert.equal(result.state, 'Stressed');
    assert.equal(result.workMinutes, 15);
  }
});

test('the reported stressed-only reflection cannot leave low effort behind medium and high tasks', () => {
  const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['science', 'it', 'archi', 'fil', 'medtech'],
    actionPlan: 'Start with Science to keep things comfortable.' }, 'I feel stressed', screenshotTasks);
  assert.deepEqual(result.orderedIds, ['medtech', 'science', 'fil', 'it', 'archi']);
  assert.match(result.actionPlan, /Start with “Medtech”/);
});

test('low first then IDK keeps the requested first group and uses a sensible order for the rest', () => {
  const result = generateCognitiveFallback('I feel stressed. I want to start with low then IDK', screenshotTasks);
  assert.deepEqual(result.orderedIds, ['medtech', 'science', 'fil', 'it', 'archi']);
});

test('the coach may choose unspecified follow-up tasks without losing valid personalized advice', () => {
  const text = 'I want to start with low then IDK';
  const actionPlan = 'Start with Medtech, then build up through the medium tasks at a comfortable pace.';
  const result = normalizeReflectionPlan({ state: 'Engaged', orderedIds: ['medtech', 'science', 'fil', 'it', 'archi'],
    taskPreference: { evidence: text, priorityOrder: ['low'] }, actionPlan }, text, screenshotTasks);
  assert.equal(result.responseSource, 'ai');
  assert.equal(result.actionPlan, actionPlan);
  assert.equal(result.orderedIds[0], 'medtech');
});

test('semantic preferences work without fixed keywords and survive server/client normalization', () => {
  const text = 'Ang bigat ng araw ko. Pwede yung pinakagaan muna para makausad?';
  const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['medtech', 'science', 'fil', 'it', 'archi'],
    taskPreference: { evidence: 'Pwede yung pinakagaan muna para makausad?', priorityOrder: ['low'] },
    actionPlan: 'Start with Medtech and one small study goal.' }, text, screenshotTasks);
  assert.equal(result.responseSource, 'ai');
  assert.equal(result.orderedIds[0], 'medtech');
  assert.deepEqual(normalizeReflectionPlan(result, text, screenshotTasks), result);
});

test('semantic intent can defer a named task instead of promoting every task mentioned', () => {
  const text = 'Stressed ako. Ayoko muna ng Science, sa dulo na siya.';
  const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['science', 'it', 'archi', 'fil', 'medtech'],
    taskPreference: { evidence: 'Ayoko muna ng Science, sa dulo na siya.', deferredTaskIds: ['science'] },
    actionPlan: 'Start with Science.' }, text, screenshotTasks);
  assert.deepEqual(result.orderedIds, ['medtech', 'fil', 'it', 'archi', 'science']);
  assert.match(result.actionPlan, /Start with “Medtech”/);
});

test('invented preference evidence cannot override mood defaults', () => {
  const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['it', 'archi', 'science', 'fil', 'medtech'],
    taskPreference: { evidence: 'Start with high', priorityOrder: ['high'] }, actionPlan: 'Start with IT.' }, 'I feel stressed', screenshotTasks);
  assert.equal(result.orderedIds[0], 'medtech');
  assert.equal(result.taskPreference, undefined);
});

test('a category preference cannot invent named tasks to pin or defer', () => {
  const text = 'I feel stressed. Pwede yung pinakagaan muna?';
  const result = normalizeReflectionPlan({ state: 'Stressed', orderedIds: ['medtech', 'science', 'fil', 'it', 'archi'],
    taskPreference: { evidence: 'Pwede yung pinakagaan muna?', priorityOrder: ['low'], taskIds: ['fil'], deferredTaskIds: ['science'] },
    actionPlan: 'Start with Medtech and one manageable goal.' }, text, screenshotTasks);
  assert.equal(result.responseSource, 'ai');
  assert.deepEqual(result.taskPreference.taskIds, []);
  assert.deepEqual(result.taskPreference.deferredTaskIds, []);
});
