import { test, expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { accountFixture } from './account-fixture.mjs';

test('device selection is saved once per login, retries failures, and returns for the next login', async ({ page, context }, testInfo) => {
  const options = { devicePrompt: true };
  await accountFixture(context, true, options);
  let failSave = true;
  let selected = null;
  await context.route('**/api/user/profile', route => {
    if (route.request().method() === 'PUT') {
      if (failSave) return route.fulfill({ status: 503, json: { error: 'Could not save your device. Please try again.' } });
      selected = route.request().postDataJSON().studyDevice;
    }
    return route.fulfill({ json: { user: { name: 'History Student', username: 'history', studyDevice: selected }, stats: {} } });
  });
  await page.goto('/dashboard');
  const dialog = page.getByRole('dialog', { name: 'What device are you using right now?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio')).toHaveCount(2);
  await dialog.getByRole('radio', { name: 'Mobile', exact: true }).check();
  await page.setViewportSize({ width: 390, height: 740 });
  await page.screenshot({ path: testInfo.outputPath('device-selection-phone.png') });
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Could not save');
  expect(await page.evaluate(() => localStorage.getItem('ifocus_device_prompt_session_history-student'))).toBe(null);
  failSave = false;
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(selected).toBe('mobile');
  await page.reload();
  await expect(page.locator('.journal-textarea')).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.goto('/settings');
  await page.getByText('Privacy & Security', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Mobile', exact: true })).toBeChecked();
  await expect(dialog).toHaveCount(0);
  options.loginId = 'history-next-login';
  await page.goto('/dashboard');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: 'PC/Desktop', exact: true }).check();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(selected).toBe('pc');
});

test('existing student selects Male or Female once and sees Sex in Settings', async ({ page, context }) => {
  const options = { missingSex: true };
  await accountFixture(context, true, options);
  await context.route('**/api/user/sex', route => {
    expect(route.request().postDataJSON()).toEqual({ sex: 'Male' });
    options.missingSex = false;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/dashboard');
  const notice = page.getByRole('complementary', { name: 'Complete your profile' });
  await expect(notice.getByRole('radio')).toHaveCount(2);
  await notice.getByRole('radio', { name: 'Male', exact: true }).check();
  await notice.getByRole('button', { name: 'Save selection' }).click();
  await expect(notice).toHaveCount(0);
  await page.goto('/settings');
  await page.getByText('Privacy & Security', { exact: true }).click();
  await expect(page.getByLabel('Sex', { exact: true })).toHaveValue('Male');
  await expect(page.getByLabel('Sex', { exact: true })).toHaveAttribute('readonly', '');
});

test('quota is compact and its limit still blocks a new plan', async ({ page, context }) => {
  await accountFixture(context);
  await context.route('**/api/ai/usage', route => route.fulfill({ json: { usage: { reflection: { remaining: 9, limit: 10 }, flashcards: { remaining: 2, limit: 3 } } } }));
  await context.route('**/api/ai/coach', route => route.fulfill({ status: 429, json: { error: 'You have used your 10 Quick Reflection AI requests today. Try again after midnight, Philippine time.' } }));
  await page.goto('/dashboard');
  await expect(page.locator('.ai-usage-notice')).toHaveText('9/10');
  await expect(page.locator('.journal-textarea')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Study cycles', exact: true })).toHaveCount(0);
  await page.locator('.journal-textarea').fill('Help me review anatomy for my exam.');
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  await expect(page.getByText('You have used your 10 Quick Reflection AI requests today.', { exact: false })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'AI Coach adaptation' })).toHaveCount(0);
});

test('cycle buttons appear after the suggestion and update the actual timer without another AI request', async ({ page, context }, testInfo) => {
  await accountFixture(context, true, { coachResponse: { state: 'Engaged', orderedIds: [], workMinutes: 35, breakMinutes: 10, targetSessions: 2,
    actionPlan: 'Choose a clear goal for your anatomy review and check what you recall before opening your notes.' } });
  let calls = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/ai/coach') calls++; });
  await page.goto('/dashboard');
  await expect(page.getByRole('group', { name: 'Study cycles', exact: true })).toHaveCount(0);
  await page.locator('.journal-textarea').fill('Help me review anatomy for my exam.');
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'AI Coach adaptation' });
  const cycles = dialog.getByRole('group', { name: 'Study cycles', exact: true });
  await expect(cycles.getByRole('button')).toHaveText(['1', '2', '3', '4', '5']);
  const previousVersion = await page.evaluate(() => JSON.parse(localStorage.getItem('ifocus_timer_state')).updatedAt);
  await cycles.getByRole('button', { name: '5', exact: true }).click();
  await expect(cycles.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ifocus_timer_state')).customSessions)).toBe(5);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ifocus_timer_state')).updatedAt)).toBeGreaterThan(previousVersion);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ifocus_journal_history'))[0].aiReply.sessions)).toBe(5);
  expect(calls).toBe(1);
  await page.screenshot({ path: testInfo.outputPath('suggestion-cycles.png') });
});

test('local college offices come first and the desktop support dialog fits without scrolling', async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 960 });
  await accountFixture(context);
  await page.goto('/dashboard');
  await page.locator('.journal-textarea').fill('I want to die');
  await page.getByRole('button', { name: 'Submit & Analyze', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your safety comes first' });
  await expect(dialog.getByText('Guidance Counselor', { exact: true })).toBeVisible();
  await expect(dialog.getByText('College Dean', { exact: true })).toBeVisible();
  expect(await dialog.evaluate(element => {
    const office = element.querySelector('.local-support-options');
    const contact = element.querySelector('a[href^="tel:"]');
    return Boolean(office.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  expect(await dialog.locator('.coach-support-content').evaluate(element => element.scrollHeight <= element.clientHeight + 2)).toBe(true);
  await expect(dialog).toHaveCSS('border-radius', '22px');
  await page.screenshot({ path: testInfo.outputPath('desktop-support.png') });
  await page.setViewportSize({ width: 390, height: 740 });
  await dialog.getByRole('button', { name: 'Close', exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('phone-support.png') });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('upload guide offers readable sample PDF and text with an example card', async ({ page, context }) => {
  await accountFixture(context);
  await page.goto('/flashcards');
  await page.getByRole('button', { name: 'Create Deck', exact: true }).click();
  await page.getByText('What can I upload or paste?', { exact: true }).click();
  await expect(page.getByText('Example study notes', { exact: true })).toBeVisible();
  await expect(page.getByText('Example card', { exact: true })).toBeVisible();
  const pdf = await page.request.get('/samples/ifocus-study-notes.pdf');
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  const notes = await page.request.get('/samples/ifocus-study-notes.txt');
  expect(await notes.text()).toContain('COMPUTER BASICS');
});

test('device preference is editable and persists through reload, without Analytics counters', async ({ page, context }) => {
  await accountFixture(context);
  let studyDevice = null;
  await context.route('**/api/user/profile', route => {
    if (route.request().method() === 'PUT') studyDevice = route.request().postDataJSON().studyDevice;
    return route.fulfill({ json: { user: { name: 'History Student', username: 'history', sex: 'Male', studyDevice }, stats: {} } });
  });
  await page.goto('/settings');
  await page.getByText('Privacy & Security', { exact: true }).click();
  await page.getByRole('radio', { name: 'Mobile', exact: true }).check();
  await page.getByRole('button', { name: 'Save device', exact: true }).click();
  await expect(page.getByText('Device preference saved.', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Both', exact: true }).check();
  await page.getByRole('button', { name: 'Save device', exact: true }).click();
  await expect.poll(() => studyDevice).toBe('both');
  await page.reload();
  await page.getByText('Privacy & Security', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Both', exact: true })).toBeChecked();
  await page.goto('/analytics');
  await expect(page.getByText('Devices used for study', { exact: true })).toHaveCount(0);
});

test('admin directory displays the student device preference', async ({ page, context }) => {
  const user = { id: 'admin-fixture', name: 'Admin Fixture', role: 'ADMIN', status: 'ACTIVE' };
  const token = await encode({ secret: 'history-regression-test-secret', token: { ...user, sub: user.id } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, url: 'http://127.0.0.1:3106' }]);
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: { user, expires: '2099-01-01T00:00:00Z' } });
    if (path === '/api/admin/overview') return route.fulfill({ json: { metrics: { totalStudents: 1 }, students: [{
      id: 'student', name: 'Student Fixture', username: 'student', role: 'STUDENT', status: 'ACTIVE', verificationStatus: 'VERIFIED', studyDevice: 'both', sex: 'Female',
      yearLevel: '2nd Year', decksCount: 0, totalTodos: 0, completedTodos: 0, decks: [], recentSessions: [] }] } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin');
  await expect(page.getByText('Used iFocus recently on: Both', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await expect(page.getByText('Used iFocus recently on:', { exact: true })).toBeVisible();
});

test('corrected controls fit desktop tablet and phone screens', async ({ page, context }, testInfo) => {
  test.setTimeout(180_000);
  await accountFixture(context, true, { missingSex: true });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/dashboard', '/flashcards', '/analytics', '/settings']) {
      await page.goto(path);
      await expect(page.getByRole('complementary', { name: 'Complete your profile' })).toBeVisible();
      if (path === '/flashcards') {
        await page.getByRole('button', { name: 'Create Deck', exact: true }).click();
        await page.getByText('What can I upload or paste?', { exact: true }).click();
      }
      if (path === '/settings') await page.getByText('Privacy & Security', { exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} overflow at ${width}`).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${width}-${path.slice(1)}.png`), fullPage: true });
    }
  }
});

test('email registration requires a Male or Female selection', async ({ page, context }, testInfo) => {
  await accountFixture(context, false);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('radio')).toHaveCount(2);
  await expect(page.getByRole('radio', { name: 'Male', exact: true })).toHaveAttribute('required', '');
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('radio', { name: 'Female', exact: true }).check();
    const card = await page.locator('.auth-card-panel').boundingBox();
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${width}-register.png`), fullPage: true });
  }
});
