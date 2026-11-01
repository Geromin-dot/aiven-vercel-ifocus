import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/coachSignals.js', import.meta.url), 'utf8');
const { latestCoachSignal, currentCoachResilience, clearIdleOnActivity, formatCoachInsight } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const start = Date.parse('2026-11-01T01:00:00Z');
const signal = (state, offset, extra = {}) => ({ state, timestamp: new Date(start + offset).toISOString(), ...extra });

test('a live cadence label becomes a full explanation and action plan', () => {
  const current = signal('Stressed', 2000, { reason: 'High Friction', source: 'keystroke_cadence' });
  const insight = formatCoachInsight(current);
  assert.match(insight.reason, /recent typing.*corrections/);
  assert.notEqual(insight.reason, 'High Friction');
  assert.match(insight.actionPlan, /manageable task/);
  assert.equal(insight.steps.length, 3);
  assert.equal(insight.timestamp, current.timestamp);
  assert.equal(insight.isIntervention, true);
});

test('the latest detailed coach response is kept intact', () => {
  const current = signal('Stressed', 2000, { reason: 'Your latest reflection describes pressure about an exam.',
    actionPlan: 'Start with the first practice question, then review your reasoning.' });
  const insight = formatCoachInsight(current);
  assert.equal(insight.reason, current.reason);
  assert.equal(insight.actionPlan, current.actionPlan);
});

test('energetic reflections keep their AI reply and receive study steps rather than stress reset steps', () => {
  const insight = formatCoachInsight(signal('Motivated', 2000, { text: 'I am energetic',
    aiReply: { message: 'Use your energy for the next priority task.' } }));
  assert.equal(insight.actionPlan, 'Use your energy for the next priority task.');
  assert.equal(insight.isIntervention, false);
  assert.equal(insight.protocolTitle, 'Next Study Steps');
  assert.match(insight.steps[0], /priority task/);
});

test('idle signals get kickstart steps and fatigue gets its own explanation', () => {
  const idle = formatCoachInsight(signal('Idle', 2000));
  assert.equal(idle.protocolTitle, 'Focus Kickstart Steps');
  assert.match(idle.steps[0], /small task/);
  const fatigue = formatCoachInsight(signal('Fatigued', 2000, { reason: 'Hesitant' }));
  assert.match(fatigue.reason, /tiredness/);
  assert.match(fatigue.actionPlan, /lighter task/);
  assert.equal(formatCoachInsight(null), null);
});

test('new reflections and keyboard friction supersede old AFK regardless of source order', () => {
  const idle = signal('idle', 0);
  const stress = signal('Stressed', 1000, { source: 'reflection_submission' });
  const keyboard = signal('Stressed', 2000, { source: 'keystroke_anomaly' });
  assert.equal(latestCoachSignal([idle, stress]), stress);
  assert.equal(latestCoachSignal([idle, keyboard, stress]), keyboard);
  assert.equal(latestCoachSignal([stress, keyboard, idle]), keyboard);
});

test('returned activity invalidates AFK, while a new idle period remains valid', () => {
  assert.equal(latestCoachSignal([signal('idle', 0)], { lastActivity: start + 1000 }), null);
  const idle = signal('idle', 2000);
  assert.equal(latestCoachSignal([idle], { lastActivity: start + 1000 }), idle);
});

test('invalid, prior-day, and pre-recovery signals cannot become current', () => {
  assert.equal(latestCoachSignal([{ state: 'idle', timestamp: 'invalid' }, signal('Stressed', 0)], { since: start + 1 }), null);
});

test('stress overrides earlier BreakGate deductions without deleting history', () => {
  const events = [{ status: 'skipped', timestamp: start }];
  const result = currentCoachResilience({ signal: signal('Stressed', 1000), events, isStress: true });
  assert.equal(result.staminaPct, 65);
  assert.equal(result.skippedEvents, 0);
  assert.match(result.subtext, /latest interaction indicates strain/);
  assert.equal(events.length, 1);
});

test('stress affects resilience even when the BreakGate list is empty', () => {
  assert.equal(currentCoachResilience({ signal: signal('Stressed', 1000), events: [], isStress: true }).staminaPct, 65);
});

test('newer positive reflection replaces old stress and skips; future skips still count', () => {
  const events = [{ status: 'skipped', timestamp: start }];
  assert.equal(currentCoachResilience({ signal: signal('Motivated', 1000), events }).staminaPct, 100);
  events.push({ status: 'skipped', timestamp: start + 2000 });
  assert.equal(currentCoachResilience({ signal: signal('Motivated', 1000), events }).staminaPct, 80);
  assert.equal(currentCoachResilience({ signal: signal('Stressed', 1000), events, isStress: true }).staminaPct, 45);
});

test('an energetic reflection replaces even a zero-resilience history as the current baseline', () => {
  const events = Array.from({ length: 6 }, (_, index) => ({ status: 'skipped', timestamp: start + index * 100 }));
  assert.equal(currentCoachResilience({ events }).staminaPct, 0);
  const energetic = signal('Motivated', 1000, { text: 'I am energetic', source: 'reflection_submission' });
  const current = currentCoachResilience({ signal: energetic, events });
  assert.equal(current.staminaPct, 100);
  assert.equal(current.skippedEvents, 0);
  assert.equal(events.length, 6);
});

test('returning from AFK clears every idle alias and publishes resumed activity once', () => {
  const values = new Map(['ifocus_latest_telemetry', 'ifocus_active_idle_alert',
    'ifocus_telemetry_insight_Student', 'ifocus_telemetry_insight_anonymous'].map(key => [key, JSON.stringify(signal('idle', 0))]));
  const storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const resumed = clearIdleOnActivity(storage, 'Student', start + 1000);
  assert.equal(resumed.state, 'Engaged');
  assert.equal(values.has('ifocus_active_idle_alert'), false);
  assert.equal(JSON.parse(values.get('ifocus_telemetry_insight_anonymous')).state, 'Engaged');
  assert.equal(clearIdleOnActivity(storage, 'Student', start + 2000), null);
  values.set('ifocus_active_idle_alert', JSON.stringify(signal('idle', 0)));
  values.set('ifocus_latest_telemetry', JSON.stringify(signal('Stressed', 1500)));
  assert.equal(clearIdleOnActivity(storage, 'Student', start + 2000).state, 'Stressed');
});
