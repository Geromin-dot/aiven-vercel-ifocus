import { test, expect } from '@playwright/test';
import { accountFixture } from './account-fixture.mjs';

test('Privacy & Security shows the current account verification status', async ({ page, context }) => {
  const account = {};
  await accountFixture(context, true, account);
  let verificationStatus = 'PENDING';
  await page.route('**/api/user/profile', route => route.fulfill({
    json: { user: { name: 'History Student', username: 'history-student', verificationStatus, yearLevel: '2nd Year' } },
  }));
  const notice = page.getByRole('status').filter({ hasText: 'Account verification' });
  for (const [status, message] of [
    ['PENDING', 'This account has not been verified yet.'],
    ['VERIFIED', 'This account has been verified.'],
    ['REJECTED', 'This account is unverified.'],
  ]) {
    verificationStatus = status;
    account.verificationStatus = status;
    await page.goto('/settings');
    const privacy = page.locator('.settings-cat-btn').filter({ hasText: 'Privacy & Security' });
    const badges = page.getByRole('img', { name: 'Account verification required' });
    await expect(privacy.getByRole('img', { name: 'Account verification required' })).toHaveCount(status === 'VERIFIED' ? 0 : 1);
    await expect(page.getByRole('link', { name: /Settings/ }).filter({ has: badges })).toHaveCount(status === 'VERIFIED' ? 0 : 1);
    await privacy.click();
    await expect(notice).toContainText(message);
    await expect(page.getByLabel('Year Level', { exact: true })).toHaveValue('2nd Year');
    await expect(page.getByLabel('Year Level', { exact: true })).toBeDisabled();
    await expect(page.getByText('Export Study Data (JSON)', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear Cache' })).toHaveCount(0);
  }
});

test('Google students must complete their existing account before opening the dashboard', async ({ page, context }) => {
  const account = { needsProfileSetup: true, verificationStatus: 'PENDING' };
  await accountFixture(context, true, account);
  let submitted;
  await page.route('**/api/auth/complete-profile', route => {
    submitted = route.request().postDataJSON();
    account.needsProfileSetup = false;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/complete-profile$/);
  await page.getByLabel('Full name').fill('History Student');
  await expect(page.getByLabel('Year level').locator('option')).toHaveText([
    'Select your year level', '1st Year', '2nd Year', '3rd Year', '4th Year',
  ]);
  await page.getByLabel('Year level').selectOption('2nd Year');
  await page.getByLabel('Username').fill('history-student');
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('chosen-password');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('chosen-password');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Tasks List' })).toBeVisible();
  expect(submitted).toEqual({
    name: 'History Student', yearLevel: '2nd Year', username: 'history-student', password: 'chosen-password',
  });
});

test('pending accounts see disabled AI reflection and flashcard generation', async ({ page, context }) => {
  await accountFixture(context, true, { verificationStatus: 'PENDING' });
  const message = 'Your account must be verified by the College Dean’s Office before you can use AI features.';
  await page.goto('/dashboard');
  await expect(page.locator('.journal-textarea')).toBeDisabled();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByText(message, { exact: true })).toHaveCSS('color', 'rgb(153, 27, 27)');
  await expect(page.getByRole('button', { name: 'Submit & Analyze' })).toBeDisabled();
  await page.goto('/flashcards');
  await page.getByRole('button', { name: /Create New Deck/ }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Flashcards with AI' })).toBeDisabled();
});

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
