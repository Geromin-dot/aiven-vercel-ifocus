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
