import { test, expect } from '@playwright/test';
import { accountFixture } from './account-fixture.mjs';

const tasks = [
  { id: 'it', text: 'IT Module 10', priority: 'high' }, { id: 'archi', text: 'Archi', priority: 'high' },
  { id: 'science', text: 'Science', priority: 'medium' }, { id: 'fil', text: 'Fil', priority: 'medium' },
  { id: 'medtech', text: 'Medtech', priority: 'low' },
];
const coachResponse = { state: 'Engaged', orderedIds: ['Science', 'Fil', 'IT Module 10', 'Archi', 'Medtech'],
  targetSessions: 4, workMinutes: 25, breakMinutes: 5, responseSource: 'ai',
  actionPlan: 'Start with Science and Fil because you asked for medium tasks first. Use a concrete study goal before tackling the higher-priority tasks. Try 25-minute blocks with 5-minute breaks.' };
const expected = ['Science', 'Fil', 'IT Module 10', 'Archi', 'Medtech'];
async function submit(page, text = 'I want to start with medium first then idk if low or high?') {
  await page.goto('/dashboard');
  await expect(page.locator('.todo-text')).toHaveCount(5);
  await page.locator('.journal-textarea').fill(text);
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
}

test('medium-first advice matches the visible task list, persisted IDs, and order after reload', async ({ page, context }) => {
  const account = await accountFixture(context, true, { tasks, coachResponse });
  await submit(page);
  await expect(page.getByRole('dialog', { name: 'AI Coach adaptation' })).toBeVisible();
  await expect(page.locator('.todo-text')).toHaveText(expected);
  await expect.poll(() => account.savedOrder()).toEqual(['science', 'fil', 'it', 'archi', 'medtech']);
  await page.reload();
  await expect(page.locator('.todo-text')).toHaveText(expected);
});

test('failed task-order saves are visible and retry persists the current order', async ({ page, context }) => {
  const account = await accountFixture(context, true, { tasks, coachResponse, orderFailure: true });
  await submit(page);
  const dialog = page.getByRole('dialog', { name: 'AI Coach adaptation' });
  await expect(dialog).toContainText('could not be saved');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Order not saved', { exact: true })).toBeVisible();
  account.setOrderFailure(false);
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByText('Cloud Synced', { exact: true })).toBeVisible();
  expect(account.savedOrder()).toEqual(['science', 'fil', 'it', 'archi', 'medtech']);
});

test('a stressed student preferring medium tasks gets both medium tasks before other priorities', async ({ page, context }) => {
  const account = await accountFixture(context, true, { tasks, coachResponse: {
    state: 'Stressed', workMinutes: 15, breakMinutes: 5, targetSessions: 2,
    orderedIds: ['science', 'it', 'archi', 'fil', 'medtech'], actionPlan: 'Start with Science to keep things comfortable.' } });
  await submit(page, 'I am stressed but I want to work on medium tasks');
  await expect(page.getByRole('dialog', { name: 'AI Coach adaptation' })).toContainText('15m Focus / 5m Rest');
  await expect(page.locator('.todo-text')).toHaveText(['Science', 'Fil', 'Medtech', 'IT Module 10', 'Archi']);
  await expect.poll(() => account.savedOrder()).toEqual(['science', 'fil', 'medtech', 'it', 'archi']);
  await page.reload();
  await expect(page.locator('.todo-text')).toHaveText(['Science', 'Fil', 'Medtech', 'IT Module 10', 'Archi']);
});

test('stressed-only reflection corrects the reported partial order and persists low-medium-high groups', async ({ page, context }) => {
  const account = await accountFixture(context, true, { tasks, coachResponse: {
    state: 'Stressed', workMinutes: 15, breakMinutes: 5, targetSessions: 2,
    orderedIds: ['science', 'it', 'archi', 'fil', 'medtech'], actionPlan: 'Start with Science to keep things comfortable.' } });
  await submit(page, 'I feel stressed');
  await expect(page.getByRole('dialog', { name: 'AI Coach adaptation' })).toContainText('Start with “Medtech”');
  await expect(page.locator('.todo-text')).toHaveText(['Medtech', 'Science', 'Fil', 'IT Module 10', 'Archi']);
  await expect.poll(() => account.savedOrder()).toEqual(['medtech', 'science', 'fil', 'it', 'archi']);
  await page.reload();
  await expect(page.locator('.todo-text')).toHaveText(['Medtech', 'Science', 'Fil', 'IT Module 10', 'Archi']);
});
