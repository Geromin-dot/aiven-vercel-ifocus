import { test, expect } from '@playwright/test';
import { accountFixture } from './account-fixture.mjs';

test('deleted username login shows the account notice above the form', async ({ page, context }) => {
  await accountFixture(context, false);
  await context.route('**/api/auth/callback/credentials', route => route.fulfill({
    json: { url: 'http://127.0.0.1:3106/api/auth/error?error=ACCOUNT_DELETED' },
  }));
  await page.goto('/login');
  await page.locator('#login-identifier').fill('deleted-student');
  await page.locator('#login-password').fill('old-password');
  await page.getByRole('button', { name: 'Sign In to Dashboard' }).click();
  const notice = page.getByRole('alert').filter({ hasText: 'This account has been deleted. Feel free to register again.' });
  await expect(notice).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Register with Google' })).toBeVisible();
});

test('a deleted signed-in account is returned to login with the deletion notice', async ({ page, context }) => {
  await accountFixture(context);
  let deleted = false;
  await context.route('**/api/auth/session', route => {
    if (!deleted) return route.fallback();
    return route.fulfill({ json: { error: 'ACCOUNT_DELETED' } });
  });
  await page.goto('/dashboard');
  await expect(page.getByTestId('protected-content')).toBeVisible();
  deleted = true;
  await page.reload();
  await expect(page).toHaveURL(/\/login\?error=ACCOUNT_DELETED$/);
  await expect(page.getByRole('alert').filter({ hasText: 'This account has been deleted.' })).toBeVisible();
});

test('logout prevents Chrome Back and Forward from restoring private pages and clears cached reflections', async ({ page, context }) => {
  await accountFixture(context);
  const documentResponse = await page.goto('/dashboard');
  expect(documentResponse.headers()['cache-control']).toContain('no-store');
  await expect(page.getByTestId('protected-content')).toBeVisible();
  await page.goto('/analytics');
  await expect(page.getByTestId('protected-content')).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('ifocus_journal_history_PrivateStudent', 'private reflection');
    localStorage.setItem('ifocus_timer_preferences', JSON.stringify({ focusDuration: 25 }));
  });
  await page.getByRole('button', { name: 'Sign Out', exact: true }).last().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('protected-content')).toHaveCount(0);
  expect((await context.cookies()).some(cookie => cookie.name === 'next-auth.session-token')).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('ifocus_journal_history_PrivateStudent'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('ifocus_timer_preferences'))).not.toBeNull();
  await page.goBack();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('protected-content')).toHaveCount(0);
  await page.goForward();
  await expect(page.getByTestId('protected-content')).toHaveCount(0);
  // APIRequestContext bypasses page interception, exercising the real server.
  expect((await context.request.get('/api/todos')).status()).toBe(401);
  expect((await context.request.post('/api/ai/coach', { data: { text: 'I am ready to study' } })).status()).toBe(401);
});

test('history restore hides private UI until a fresh session succeeds, and rejects an expired session', async ({ page, context }) => {
  const account = await accountFixture(context);
  await page.goto('/dashboard');
  await expect(page.getByTestId('protected-content')).toBeVisible();
  const release = account.hold();
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.getByTestId('protected-content')).not.toBeVisible();
  await account.expire();
  release();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('protected-content')).toHaveCount(0);
});

test('valid login replaces the login history entry and authenticated users can navigate normally', async ({ page, context }) => {
  await accountFixture(context, false);
  await page.goto('/');
  await page.goto('/login');
  await page.locator('#login-identifier').fill('history-student');
  await page.locator('#login-password').fill('test-password');
  await page.getByRole('button', { name: 'Sign In to Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId('protected-content')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('http://127.0.0.1:3106/');
  await page.goForward();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId('protected-content')).toBeVisible();
});

test('server redirects anonymous protected-page requests and marks them no-store', async ({ request }) => {
  for (const path of ['/dashboard', '/coach', '/analytics', '/settings', '/flashcards', '/admin']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toContain('/login');
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

test('logout clears the other tab in the same browser', async ({ page, context }) => {
  await accountFixture(context);
  await page.goto('/dashboard');
  await expect(page.getByTestId('protected-content')).toBeVisible();
  const other = await context.newPage();
  await other.goto('/coach');
  await expect(other.getByTestId('protected-content')).toBeVisible();
  await page.getByRole('button', { name: 'Sign Out', exact: true }).last().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(other).toHaveURL(/\/login/);
  await expect(other.getByTestId('protected-content')).toHaveCount(0);
  await other.close();
});

test('a valid session can resume a history-restored page after verification', async ({ page, context }) => {
  const account = await accountFixture(context);
  await page.goto('/dashboard');
  await expect(page.getByTestId('protected-content')).toBeVisible();
  await page.locator('.journal-textarea').fill('I feel motivated and want to study');
  const release = account.hold();
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.getByTestId('protected-content')).not.toBeVisible();
  release();
  await expect(page.getByTestId('protected-content')).toBeVisible();
  await expect(page.locator('.journal-textarea')).toHaveValue('I feel motivated and want to study');
  await expect(page).toHaveURL(/\/dashboard/);
});
