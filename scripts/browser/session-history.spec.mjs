import { test, expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';

async function accountFixture(context, initiallySignedIn = true) {
  let authenticated = initiallySignedIn;
  let heldSession = null;
  const token = await encode({ secret: 'history-regression-test-secret', token: {
    sub: 'history-student', sessionId: 'history-login', name: 'History Student', role: 'STUDENT', status: 'ACTIVE',
  } });
  const cookie = `next-auth.session-token=${token}; Path=/; HttpOnly; SameSite=Lax`;
  if (authenticated) await context.addCookies([{ name: 'next-auth.session-token', value: token, url: 'http://127.0.0.1:3106', httpOnly: true }]);
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const headers = { 'Cache-Control': 'no-store' };
    let data = {};
    if (path === '/api/auth/session') {
      if (heldSession) await heldSession;
      data = authenticated ? { user: { id: 'history-student', sessionId: 'history-login', name: 'History Student', role: 'STUDENT', status: 'ACTIVE' }, expires: '2099-01-01T00:00:00Z' } : null;
    } else if (path === '/api/auth/csrf') data = { csrfToken: 'test-csrf' };
    else if (path === '/api/auth/signout') {
      authenticated = false;
      headers['Set-Cookie'] = 'next-auth.session-token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax';
      data = { url: 'http://127.0.0.1:3106/login' };
    } else if (path === '/api/auth/callback/credentials') {
      authenticated = true;
      headers['Set-Cookie'] = cookie;
      data = { url: 'http://127.0.0.1:3106/dashboard' };
    } else if (path === '/api/user/telemetry') data = { userId: 'history-student', telemetryState: {}, timerPreferences: {}, recoverableFocusSessions: [] };
    else if (path === '/api/push/subscription') data = { configured: false, subscribed: false };
    else if (path === '/api/study-sessions') data = { sessions: [] };
    else if (path === '/api/todos' || path === '/api/decks') data = [];
    await route.fulfill({ json: data, headers });
  });
  return {
    expire: async () => { authenticated = false; await context.clearCookies(); },
    hold: () => { let release; heldSession = new Promise(resolve => { release = resolve; }); return () => { release(); heldSession = null; }; },
  };
}

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
