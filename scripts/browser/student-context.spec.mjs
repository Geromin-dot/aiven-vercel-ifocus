import { test, expect } from '@playwright/test';
import { accountFixture } from './account-fixture.mjs';

test('existing student saves a one-time identity and sees the saved value in Settings', async ({ page, context }) => {
  const options = { missingGender: true };
  await accountFixture(context, true, options);
  await context.route('**/api/user/gender', route => {
    expect(route.request().postDataJSON()).toEqual({ genderIdentity: 'Prefer not to say' });
    options.missingGender = false;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/dashboard');
  const notice = page.getByRole('complementary', { name: 'Complete your profile' });
  await expect(notice).toBeVisible();
  await notice.getByLabel('Gender identity', { exact: true }).selectOption('Prefer not to say');
  await notice.getByRole('button', { name: 'Save selection' }).click();
  await expect(notice).toHaveCount(0);
  await page.goto('/settings');
  await page.getByText('Privacy & Security', { exact: true }).click();
  await expect(page.getByLabel('Gender identity', { exact: true })).toHaveValue('Prefer not to say');
  await expect(page.getByLabel('Gender identity', { exact: true })).toHaveAttribute('readonly', '');
});

test('daily cap is visible and cannot silently turn into a new study plan', async ({ page, context }) => {
  await accountFixture(context);
  await context.route('**/api/ai/usage', route => route.fulfill({ json: { usage: { reflection: { remaining: 0, limit: 10 }, flashcards: { remaining: 0, limit: 3 } } } }));
  await context.route('**/api/ai/coach', route => route.fulfill({ status: 429, json: { error: 'You have used your 10 Quick Reflection AI requests today. Try again after midnight, Philippine time.' } }));
  await page.goto('/dashboard');
  await expect(page.getByText('0 of 10 AI requests remaining today.', { exact: false })).toBeVisible();
  await page.locator('.journal-textarea').fill('Help me review anatomy for my exam.');
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  await expect(page.getByText('You have used your 10 Quick Reflection AI requests today.', { exact: false })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'AI Coach adaptation' })).toHaveCount(0);
  await page.goto('/flashcards');
  await page.getByRole('button', { name: 'Create Deck', exact: true }).click();
  await expect(page.getByText('0 of 3 AI requests remaining today.', { exact: false })).toBeVisible();
  await page.getByText('What can I upload or paste?', { exact: true }).click();
  await expect(page.getByText('Export PowerPoint slides as PDF first.', { exact: false })).toBeVisible();
});

test('local college offices appear ahead of existing crisis contacts', async ({ page, context }) => {
  await accountFixture(context);
  await page.goto('/dashboard');
  await page.locator('.journal-textarea').fill('I feel worthless.');
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'You deserve support and a pause' });
  await expect(dialog.getByText('Guidance Counselor', { exact: true })).toBeVisible();
  await expect(dialog.getByText('College Dean', { exact: true })).toBeVisible();
  expect(await dialog.evaluate(element => {
    const office = element.querySelector('.local-support-options');
    const contact = element.querySelector('a[href^="tel:"]');
    return Boolean(office.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
});

test('new controls and guides fit desktop tablet and phone screens', async ({ page, context }, testInfo) => {
  test.setTimeout(180_000);
  await accountFixture(context, true, { missingGender: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/dashboard', '/flashcards', '/analytics', '/coach', '/settings']) {
      await page.goto(path);
      await expect(page.getByRole('complementary', { name: 'Complete your profile' })).toBeVisible();
      if (path === '/dashboard') {
        await page.getByText('Choosing task effort and ordering', { exact: true }).click();
        await expect(page.getByText('If every task is High', { exact: false })).toBeVisible();
        await expect(page.getByRole('button', { name: '12/3', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '35/10', exact: true })).toBeVisible();
        await page.getByLabel('Study cycles', { exact: true }).selectOption('4');
      }
      if (path === '/flashcards') {
        await page.getByRole('button', { name: 'Create Deck', exact: true }).click();
        await page.getByText('What can I upload or paste?', { exact: true }).click();
      }
      if (path === '/analytics') await expect(page.getByRole('heading', { name: 'Devices used for study' })).toBeVisible();
      if (path === '/coach') {
        await page.getByText('College Dean', { exact: true }).scrollIntoViewIfNeeded();
        await expect(page.getByText('College Dean', { exact: true })).toBeVisible();
      }
      if (path === '/settings') await page.getByText('Privacy & Security', { exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} overflow at ${width}`).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${width}-${path.slice(1)}.png`), fullPage: true });
    }
  }
});

test('registration includes a required one-time gender field on every screen size', async ({ page, context }, testInfo) => {
  await accountFixture(context, false);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByLabel('Gender identity', { exact: true })).toHaveAttribute('required', '');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel('Gender identity', { exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${width}-register.png`), fullPage: true });
  }
});
