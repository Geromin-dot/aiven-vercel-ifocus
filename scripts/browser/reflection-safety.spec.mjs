import { test, expect } from '@playwright/test';
import { accountFixture } from './account-fixture.mjs';

test('safety support appears immediately without AI calls, task reordering, or timer changes', async ({ page, context }) => {
  const account = await accountFixture(context, true, { tasks: [{ id: 'science', text: 'Science', priority: 'medium' }] });
  let coachCalls = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/ai/coach') coachCalls++; });
  await page.goto('/dashboard');
  await expect(page.locator('.todo-text')).toHaveText(['Science']);
  const before = await page.evaluate(() => ({ timer: localStorage.getItem('ifocus_custom_timer'), adjusted: localStorage.getItem('ifocus_ai_adjusted_active') }));
  await page.locator('.journal-textarea').fill('I want to die');
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your safety comes first' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('mental health professional, school counselor, or doctor');
  await expect(dialog).toContainText('Are you safe right now?');
  await expect(dialog.getByText('Continue to Focus Session', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('FOCUS CADENCE', { exact: true })).toHaveCount(0);
  expect(coachCalls).toBe(0);
  expect(account.savedOrder()).toEqual([]);
  expect(await page.evaluate(() => ({ timer: localStorage.getItem('ifocus_custom_timer'), adjusted: localStorage.getItem('ifocus_ai_adjusted_active') }))).toEqual(before);
});

test('a health question receives a professional referral without crisis language or timer recommendations', async ({ page, context }) => {
  await accountFixture(context, true, { coachResponse: { supportOnly: true, supportKind: 'health' } });
  await page.goto('/dashboard');
  await page.locator('.journal-textarea').fill('Does my typing mean I have ADHD?');
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Health questions need professional advice' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('qualified healthcare professional');
  await expect(dialog).not.toContainText('emergency');
  await expect(dialog).not.toContainText('ADHD');
  await expect(dialog.getByText('Continue to Focus Session', { exact: true })).toHaveCount(0);
});

test('crisis contacts show every supplied number and remain usable on a phone', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await accountFixture(context);
  await page.goto('/dashboard');
  await page.locator('.journal-textarea').fill('I feel worthless.');
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'You deserve support and a pause' });
  await expect(dialog).toBeVisible();
  const contacts = dialog.getByRole('group', { name: 'Philippines support contacts' });
  await expect(contacts.getByRole('link')).toHaveCount(5);
  for (const [label, href] of [
    ['Philippines: NCMH Crisis Hotline 1553 (24/7)', 'tel:+631553?oai_link_source=model_response_hotline'],
    ['Nationwide: 1800-1888-1553', 'tel:180018881553'],
    ['SMART / TNT: 0919-057-1553', 'tel:09190571553'],
    ['GLOBE / TM: 0917-899-8727', 'tel:09178998727'],
    ['GLOBE / TM: 0966-351-4518', 'tel:09663514518'],
  ]) await expect(contacts.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(dialog).not.toContainText('Continue to Focus Session');
});

for (const [text, title, contact] of [
  ['I have completed three 25-minute focus sessions today. I feel mentally tired, and I am having trouble absorbing what I read. I still have two tasks left.', 'Take a break from studying', null],
  ['48 hours no sleep. Give me a 120 minute session.', 'Rest and basic needs come first', null],
  ['Dpako uminom ng tubig buong araw', 'Rest and basic needs come first', null],
  ['Bleeding ako pero exam muna.', 'Pause studying and get medical help', 'Philippines: Emergency 911'],
  ['Someone is threatening me if I stop studying.', 'Your immediate safety comes first', 'Philippines: Emergency 911'],
  ['I feel worthless.', 'You deserve support and a pause', 'Philippines: NCMH Crisis Hotline 1553 (24/7)'],
]) test(`unsafe reflection receives support without a study plan: ${text}`, async ({ page, context }) => {
  const account = await accountFixture(context, true, { tasks: [{ id: 'science', text: 'Science', priority: 'medium' }] });
  let calls = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/ai/coach') calls++; });
  await page.goto('/dashboard');
  await page.locator('.journal-textarea').fill(text);
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText('Continue to Focus Session');
  await expect(dialog).not.toContainText('FOCUS CADENCE');
  if (contact) await expect(dialog.getByRole('link', { name: contact, exact: true })).toHaveAttribute('href', /tel:/);
  expect(calls).toBe(0);
  expect(account.savedOrder()).toEqual([]);
});

test('pending analysis shows an animated status then a semantic rest response without a study plan', async ({ page, context }) => {
  const account = await accountFixture(context, true, { tasks: [{ id: 'writing', text: 'Writing', priority: 'medium' }] });
  let heldRequest;
  await context.route('**/api/ai/coach', route => { heldRequest = route; });
  await page.goto('/dashboard');
  await page.locator('.journal-textarea').fill('My brain feels like a sponge that cannot hold another drop today.');
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  await expect(page.locator('.reflection-waiting')).toHaveText('Analyzing your reflection');
  await expect(page.locator('.reflection-waiting-dots i')).toHaveCount(3);
  await expect(page.locator('button[aria-busy="true"]')).toBeDisabled();
  await expect.poll(() => Boolean(heldRequest)).toBe(true);
  await heldRequest.fulfill({ json: { safetyConcern: 'rest', actionPlan: 'Start Writing now.', workMinutes: 15 } });
  const dialog = page.getByRole('dialog', { name: 'Take a break from studying' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('choose to stop for today');
  await expect(dialog).not.toContainText('Start Writing now');
  await expect(dialog).not.toContainText('Continue to Focus Session');
  await expect(page.locator('.reflection-waiting')).toHaveCount(0);
  expect(account.savedOrder()).toEqual([]);
});

test('support pauses a running timer and closing the dialog does not restart it', async ({ page, context }) => {
  await accountFixture(context);
  await page.goto('/dashboard');
  await page.evaluate(() => {
    const timer = { isRunning: true, isFocus: true, timeLeft: 1500, totalTime: 1500,
      timerSessionId: 'safety-test-session', sessionCount: 1, customSessions: 4,
      lastPresenceElapsed: 0, lastPresenceRemaining: 1500, lastPresenceCheckElapsed: 0,
      targetEndTime: Date.now() + 1500000, timerPreset: 'Pomodoro', updatedAt: Date.now() };
    localStorage.setItem('ifocus_timer_state', JSON.stringify(timer));
    window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: timer }));
  });
  await page.locator('.journal-textarea').fill('I am bleeding but I must finish studying.');
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Pause studying and get medical help' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ifocus_timer_state')).isRunning)).toBe(false);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ifocus_timer_state')).isRunning)).toBe(false);
});
