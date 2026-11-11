import { test, expect } from '@playwright/test';
import { accountFixture } from './account-fixture.mjs';

test('a long task list scrolls inside the dashboard panel', async ({ page, context }) => {
  await accountFixture(context);
  const tasks = Array.from({ length: 30 }, (_, index) => ({
    id: String(index), text: `Study task ${index + 1}`, priority: 'medium', completed: false,
  }));
  let taskCount = 1;
  await page.route('**/api/todos', route => route.fulfill({ json: tasks.slice(0, taskCount) }));
  const list = page.locator('.dashboard-tasks-column .todo-list');
  const panel = page.locator('.dashboard-tasks-column');

  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    taskCount = 1;
    await page.goto('/dashboard');
    await expect(list.locator('[data-todo-id]')).toHaveCount(1);
    const initialHeight = (await panel.boundingBox()).height;

    taskCount = tasks.length;
    await page.reload();
    await expect(list.locator('[data-todo-id]')).toHaveCount(tasks.length);
    const panelHeight = (await panel.boundingBox()).height;
    if (width >= 769) expect(panelHeight).toBeCloseTo(initialHeight, 0);

    const heading = page.getByRole('heading', { name: 'Tasks List' });
    const headingTop = (await heading.boundingBox()).y;
    const scroll = await list.evaluate(element => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(scroll).toBeGreaterThan(0);
    expect((await heading.boundingBox()).y).toBeCloseTo(headingTop, 0);
  }
});

test('presence and progress checks repeat in each focus block and completed time retries', async ({ page, context }) => {
  await page.clock.install();
  await accountFixture(context);
  let failStudySave = true;
  let failCheckpoint = false;
  const saved = [];
  await page.route('**/api/user/telemetry', route => {
    if (failCheckpoint && route.request().method() === 'POST') {
      return route.fulfill({ status: 503, json: {} });
    }
    return route.fallback();
  });
  await page.route('**/api/study-sessions', async route => {
    if (route.request().method() === 'GET') return route.fallback();
    if (failStudySave) return route.fulfill({ status: 503, json: { message: 'Try again' } });
    const input = route.request().postDataJSON();
    saved.push(input.timerSessionId);
    return route.fulfill({ json: { session: {
      id: input.timerSessionId, createdAt: new Date().toISOString(), duration: input.duration,
    } } });
  });
  await page.addInitScript(() => {
    localStorage.setItem('ifocus_timer_preferences', JSON.stringify({
      activePresenceEnabled: true, activePresenceInterval: 5,
      burnoutCheckEnabled: true, burnoutCheckMinutes: 10, autoStartBreaks: true,
    }));
    localStorage.setItem('ifocus_sound_preferences', JSON.stringify({ dailyReminder: false }));
    localStorage.setItem('ifocus_timer_state', JSON.stringify({
      isFocus: true, isRunning: true, sessionCount: 1, timerPreset: '25/5',
      timeLeft: 1500, totalTime: 1500, targetEndTime: Date.now() + 1500000,
      timerSessionId: 'first-test-block', authSessionId: 'history-login', userId: 'history-student',
    }));
  });
  await page.goto('/dashboard');
  await expect(page.locator('#timerToggleBtn')).toHaveText('Stop');
  const presence = page.getByRole('button', { name: 'Continue Session', exact: true });
  const progress = page.getByText('Study Progress Check', { exact: true });
  const confirmNextPresence = async () => {
    await page.clock.fastForward(301000);
    await expect(presence).toBeVisible();
    await presence.click();
  };

  for (let block = 1; block <= 4; block++) {
    await confirmNextPresence();
    await expect(progress).toBeHidden();
    await page.clock.fastForward(301000);
    await expect(presence).toBeVisible();
    await page.getByRole('button', { name: 'Stay Paused' }).click();
    await page.clock.fastForward(1000);
    await expect(progress).toBeVisible();
    await page.getByRole('button', { name: 'Go to Pomodoro Timer' }).click();
    failCheckpoint = true;
    const failedCheckpoint = page.waitForResponse(response =>
      response.url().endsWith('/api/user/telemetry') && response.status() === 503);
    await page.locator('#timerToggleBtn').click();
    await expect(page.locator('#timerToggleBtn')).toHaveText('Stop');
    await failedCheckpoint;
    await expect(page.getByText('Timer could not sync')).toHaveCount(0);
    failCheckpoint = false;
    await confirmNextPresence();
    await confirmNextPresence();
    await page.clock.fastForward(301000);
    if (block < 4) {
      const nextBlock = page.getByRole('button', { name: `Skip Break & Start Session ${block + 1}` });
      await expect(nextBlock).toBeVisible();
      await nextBlock.click();
    } else {
      await expect(page.getByText('All Planned Sessions Finished!')).toBeVisible();
    }
  }

  const pendingIds = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('ifocus_pending_study_sessions')).map(item => item.timerSessionId));
  expect(pendingIds).toHaveLength(4);
  expect(new Set(pendingIds).size).toBe(4);
  failStudySave = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => saved).toEqual(pendingIds);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ifocus_pending_study_sessions'))).toBeNull();
});

test('dragging a task saves the new order and it survives reload', async ({ page, context }) => {
  const tasks = ['Read chapter', 'Write notes', 'Practice quiz'].map((text, index) => ({
    id: String(index), text, priority: 'medium', completed: false,
  }));
  const account = await accountFixture(context, true, { tasks });
  await page.goto('/dashboard');
  const source = page.locator('.todo-text').filter({ hasText: /^Read chapter$/ });
  const target = page.locator('[data-todo-id="2"]');
  await expect(source).toBeVisible();
  const start = await source.boundingBox();
  const end = await target.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, end.y + end.height / 2 + 8, { steps: 8 });
  expect(await page.evaluate(() => window.getSelection().toString())).toBe('');
  const preview = page.locator('.todo-drop-preview');
  await expect(preview).toContainText('Read chapter');
  await expect(preview).toHaveCSS('opacity', '0.48');
  await expect.poll(async () => (await preview.boundingBox()).y - (await target.boundingBox()).y).toBeGreaterThan(0);
  expect(account.savedOrder()).toEqual([]);
  await page.mouse.up();
  await expect(preview).toHaveCount(0);
  await expect.poll(account.savedOrder).toEqual(['1', '2', '0']);
  await page.reload();
  await expect(page.locator('[data-todo-id]')).toHaveText([
    /Write notes/, /Practice quiz/, /Read chapter/,
  ]);
});
