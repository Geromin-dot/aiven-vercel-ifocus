import { test, expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { accountFixture } from './account-fixture.mjs';

test('a fresh student session ignores stale idle time and still detects real inactivity', async ({ page, context }) => {
  await page.clock.install();
  await accountFixture(context);
  await page.addInitScript(() => localStorage.setItem('ifocus_last_user_activity', String(Date.now() - 10 * 60_000)));
  await page.goto('/dashboard');
  await expect(page.locator('.journal-textarea')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Date.now() - Number(localStorage.getItem('ifocus_last_user_activity')))).toBeLessThan(10_000);
  await page.clock.fastForward(2_000);
  const idleAlert = page.getByText('You have been idle for 1 minute with no timer running', { exact: false });
  await expect(idleAlert).toHaveCount(0);
  await page.clock.fastForward(60_000);
  await expect(idleAlert).toBeVisible();
});

test('the Feature Guide mounts the video in place and removes it when leaving the topic', async ({ page, context }) => {
  await accountFixture(context);
  await context.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Video frame fixture</p>' }));
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Feature Guide', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Feature guide' });
  await guide.getByRole('button', { name: 'Video Tutorial' }).click();
  const frame = guide.locator('iframe[title="iFocus tutorial video"]');
  await expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/ydmefujKPIY');
  await expect(frame.contentFrame().getByText('Video frame fixture')).toBeVisible();
  await guide.getByRole('button', { name: 'Focus Timer' }).click();
  await expect(frame).toHaveCount(0);
});

test('the admin directory filters cards and promotes only after in-app confirmation', async ({ page, context }) => {
  const user = { id: 'directory-admin', sessionId: 'fixture', name: 'Admin Fixture', role: 'ADMIN', status: 'ACTIVE' };
  const token = await encode({ secret: 'history-regression-test-secret', token: { ...user, sub: user.id } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, url: 'http://127.0.0.1:3106' }]);
  const students = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduated'].map((yearLevel, index) => ({
    id: String(index), name: index === 0 ? 'Student With a Long Name for the Evaluation Cohort' : 'Student ' + index,
    username: index === 0 ? 'verylongstudentusernamewithoutspaces2026' : 'student' + index,
    email: 'verylongemailaddressforthegraduatingstudent@school-example.edu', yearLevel, createdAt: '2026-10-01',
    status: 'ACTIVE', verificationStatus: 'VERIFIED', formattedStudyTime: '20m', decksCount: 1, completedTodos: 1, totalTodos: 3,
  }));
  let promotions = 0;
  await context.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: { user, expires: '2099-01-01T00:00:00Z' } });
    if (path === '/api/admin/overview') return route.fulfill({ json: { metrics: { totalStudents: 5 }, students } });
    if (path === '/api/admin/year-levels' && request.method() === 'GET') return route.fulfill({ json: { token: 'preview', count: 4, graduates: 1 } });
    if (path === '/api/admin/year-levels' && request.method() === 'POST') {
      expect(request.postDataJSON()).toEqual({ token: 'preview' });
      promotions++;
      students[3].yearLevel = 'Graduated';
      return route.fulfill({ json: { count: 4 } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin');
  const directory = page.getByRole('region', { name: 'Student Progress Directory' });
  await expect(directory.getByRole('article')).toHaveCount(5);
  const cards = await directory.getByRole('article').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(cards[0]).toBe(cards[1]);
  for (const width of [1920, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await directory.getByRole('article').evaluateAll(cards => cards.some(card => {
      const bounds = card.getBoundingClientRect();
      return [...card.querySelectorAll('*')].some(element => {
        const box = element.getBoundingClientRect();
        return box.left < bounds.left - 1 || box.right > bounds.right + 1 ||
          (element.matches('h3, p') && element.scrollWidth > element.clientWidth + 1);
      });
    }));
    expect(overflow, `student cards at ${width}px`).toBe(false);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  const yearFilter = directory.getByRole('combobox', { name: 'Year level' });
  for (const level of ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduated']) {
    await yearFilter.selectOption(level);
    await expect(directory.getByRole('article')).toHaveCount(1);
    await expect(directory.getByRole('article')).toContainText(level);
  }
  await directory.getByRole('button', { name: 'Promote Year Levels' }).click();
  const modal = page.getByRole('dialog', { name: 'Promote Year Levels' });
  await expect(modal).toContainText('4 student account(s)');
  await modal.getByRole('button', { name: 'Cancel' }).click();
  expect(promotions).toBe(0);
  await directory.getByRole('button', { name: 'Promote Year Levels' }).click();
  await modal.getByRole('button', { name: 'Confirm promotion' }).click();
  await expect(modal).toHaveCount(0);
  await expect(directory.getByRole('article')).toHaveCount(2);
  expect(promotions).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCards = await directory.getByRole('article').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(mobileCards[1]).toBeGreaterThan(mobileCards[0]);
});

test('the Coach disclaimer opens as a dialog and preserves the draft reflection', async ({ page, context }) => {
  await accountFixture(context);
  await page.goto('/dashboard');
  const reflection = page.locator('.journal-textarea');
  await reflection.fill('I want to review anatomy.');
  const disclaimer = page.getByRole('button', { name: 'Disclaimer for AI Coach' });
  await disclaimer.click();
  const dialog = page.getByRole('dialog', { name: 'About AI Coach' });
  await expect(dialog).toContainText('Your AI study buddy');
  await expect(dialog).toContainText('qualified healthcare or mental health professionals');
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(reflection).toHaveValue('I want to review anatomy.');
  await expect(disclaimer).toBeFocused();
});

test('Quick Reflection keeps the disclaimer in its header and the Study Hub opens the signed-in landing page', async ({ page, context }) => {
  await accountFixture(context);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/dashboard');
    const reflection = page.locator('#quick-reflection-card');
    await expect(reflection.getByText('Flight:', { exact: false })).toHaveCount(0);
    const heading = reflection.locator('.quick-reflection-heading');
    const button = heading.getByRole('button', { name: 'Disclaimer for AI Coach' });
    await expect(button).toBeVisible();
    const [headerBox, buttonBox] = await Promise.all([heading.boundingBox(), button.boundingBox()]);
    expect(Math.abs(headerBox.x + headerBox.width - buttonBox.x - buttonBox.width)).toBeLessThan(2);
    expect(Math.abs(headerBox.y - buttonBox.y)).toBeLessThan(2);
    await page.getByRole('link', { name: 'iFocus landing page' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: /Open Dashboard/ })).toBeVisible();
  }
});

test('Coach and Feature Guide explain uncertainty and applying a strategy leaves focus paused', async ({ page, context }) => {
  await accountFixture(context);
  await page.goto('/coach');
  await expect(page.getByRole('region', { name: 'Research-backed study habits' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Disclaimer for AI Coach' }).click();
  const disclaimer = page.getByRole('dialog', { name: 'About AI Coach' });
  await expect(disclaimer).toContainText('dismiss it if it does not fit your needs');
  const habits = disclaimer.getByRole('region', { name: 'Research-backed study habits' });
  await expect(habits.getByRole('link', { name: 'Agarwal et al. (2021)' })).toHaveAttribute('href', 'https://doi.org/10.1007/s10648-021-09595-9');
  await expect(habits.getByRole('link', { name: 'Latimier et al. (2021)' })).toHaveAttribute('href', 'https://doi.org/10.1007/s10648-020-09572-8');
  await disclaimer.getByRole('button', { name: 'Got it' }).click();
  await expect(disclaimer).toHaveCount(0);

  await page.getByRole('button', { name: 'Feature Guide', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Feature guide' });
  await guide.getByRole('button', { name: 'Disclaimer for AI Coach' }).click();
  await expect(disclaimer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(disclaimer).toHaveCount(0);
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Close guide' }).click();

  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.evaluate(() => {
    localStorage.setItem('ifocus_breakgate_events', JSON.stringify(
      [1, 2, 3].map(offset => ({ status: 'skipped', timestamp: new Date(Date.now() - offset * 1000).toISOString() }))
    ));
  });
  await page.goto('/coach');
  await expect(page.getByText('Recovery Needed', { exact: true })).toBeVisible();
  await expect(page.getByText('5m Recovery Break', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Apply Strategy to Dashboard' }).click();
  await page.getByRole('button', { name: 'Continue to focus' }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await expect.poll(() => page.evaluate(() => {
    const timer = JSON.parse(localStorage.getItem('ifocus_timer_state') || '{}');
    return [timer.isRunning, timer.isFocus, timer.customWorkDuration, localStorage.getItem('ifocus_ai_rest_recovery')];
  })).toEqual([false, true, 900, null]);
});

test('Coach offers an optional five-minute break and leaves focus stopped at the end', async ({ page, context }) => {
  await page.clock.install();
  await accountFixture(context);
  await page.addInitScript(() => localStorage.setItem('ifocus_timer_preferences', JSON.stringify({ autoStartFocus: true })));
  await page.goto('/coach');
  await expect(page.getByText('Study Resilience', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Apply Strategy to Dashboard' }).click();
  await page.getByRole('button', { name: 'Take a 5-minute break' }).click();
  await expect(page).toHaveURL(/dashboard$/);
  const timer = () => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('ifocus_timer_state') || '{}');
    return [state.isRunning, state.isFocus, state.totalTime, state.sessionCount];
  });
  await expect.poll(timer).toEqual([true, false, 300, 1]);
  await page.clock.fastForward(301_000);
  await expect.poll(timer).toEqual([false, true, 1500, 1]);
});

test('Coach hides expired reflections and Analytics shows only recorded BreakGate counts', async ({ page, context }) => {
  await accountFixture(context);
  await page.addInitScript(() => {
    localStorage.setItem('ifocus_journal_history_History Student', JSON.stringify([
      { id: 'expired', text: 'Expired reflection fixture', date: new Date(Date.now() - 49 * 3600000).toISOString() },
      { id: 'recent', text: 'Recent reflection fixture', date: new Date(Date.now() - 1000).toISOString() },
    ]));
    const date = new Date().toISOString();
    localStorage.setItem('ifocus_session_history', JSON.stringify(
      [1, 2].map(id => ({ id, date, duration: 1, durationSeconds: 60, type: 'pomodoro', synced: true }))
    ));
    localStorage.setItem('ifocus_breakgate_events', JSON.stringify([
      { id: 'complete', status: 'completed', date }, { id: 'skip', status: 'skipped', date },
      { id: 'yesterday', status: 'skipped', date: new Date(Date.now() - 86400000).toISOString() },
    ]));
  });
  await page.goto('/coach');
  await expect(page.getByText('1 Entry', { exact: true })).toBeVisible();
  await expect(page.getByText('Expired reflection fixture', { exact: false })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ifocus_journal_history_History Student')).map(entry => entry.id))).toEqual(['recent']);
  await page.goto('/analytics');
  const activity = page.getByRole('region', { name: 'BreakGate Activity' });
  await expect(activity.locator('dd')).toHaveText(['2', '1', '1']);
  await expect(page.getByText('1 min Pomodoro Focus Session', { exact: true })).toHaveCount(2);
  await expect(activity).toContainText('All completed and skipped challenges today.');
  await expect(activity.locator('svg')).toHaveCount(3);
  const [heading, firstRow] = await Promise.all([
    activity.getByRole('heading').boundingBox(),
    activity.locator('dl > div').first().boundingBox(),
  ]);
  expect(firstRow.y - (heading.y + heading.height)).toBeLessThan(50);
  const [activityBox, retention] = await Promise.all([
    activity.boundingBox(),
    page.getByRole('heading', { name: 'Active Recall Retention' }).boundingBox(),
  ]);
  expect(retention.y - (activityBox.y + activityBox.height)).toBeGreaterThan(0);
  expect(retention.y - (activityBox.y + activityBox.height)).toBeLessThan(36);
  for (const viewport of [{ width: 1920, height: 964 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const [root, focusColumn, recallCard] = await Promise.all([
        page.locator('.analytics-page-root').boundingBox(),
        page.locator('.analytics-focus-column').boundingBox(),
        page.locator('.analytics-review-column > :last-child').boundingBox(),
      ]);
      const bottom = recallCard.y + recallCard.height;
      return Math.max(Math.abs(root.y + root.height - bottom), Math.abs(focusColumn.y + focusColumn.height - bottom));
    }).toBeLessThan(3);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const chart = page.locator('.analytics-chart-body');
  await expect(chart).toBeVisible();
  expect((await chart.boundingBox()).height).toBeGreaterThanOrEqual(180);
  await expect(page.getByRole('heading', { name: 'Active Recall Retention' })).toBeVisible();
});
