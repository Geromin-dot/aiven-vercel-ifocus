import { test, expect } from '@playwright/test';
import { accountFixture } from './account-fixture.mjs';

test('BreakGate saves more than 20 questions and fits the progress bar on desktop and phone', async ({ page, context }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await accountFixture(context);
  const deck = {
    id: 'long-deck', title: 'Long review deck', userId: 'history-student',
    cards: Array.from({ length: 28 }, (_, index) => ({ front: `Term ${index + 1}`, back: `Definition ${index + 1}` })),
  };
  await page.route('**/api/decks', route => route.fulfill({ json: [deck] }));
  await page.addInitScript(activeDeck => localStorage.setItem('ifocus_active_breakgate_deck', JSON.stringify(activeDeck)), deck);
  await page.addInitScript(() => {
    window.coachChimeNotes = [];
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = createOscillator.call(this);
      const setFrequency = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
      oscillator.frequency.setValueAtTime = (frequency, time) => {
        if (frequency === 659.25 || frequency === 987.77) window.coachChimeNotes.push(frequency);
        return setFrequency(frequency, time);
      };
      return oscillator;
    };
  });
  await page.goto('/settings');
  const settingsCount = page.getByLabel('BreakGate Questions Count', { exact: true });
  await settingsCount.fill('24');
  await page.getByRole('button', { name: 'Save Preferences', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ifocus_breakgate_question_count'))).toBe('24');

  await page.goto('/dashboard');
  await page.getByTitle('Custom Timer Settings').click();
  const customCount = page.getByLabel('BreakGate Questions', { exact: true });
  await expect(customCount).toHaveValue('24');
  await customCount.fill('26');
  await page.getByRole('button', { name: 'Save Settings', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ifocus_breakgate_question_count'))).toBe('26');
  const dialog = page.getByRole('dialog', { name: 'Break Retrieval Challenge' });
  const openGate = async () => {
    await page.evaluate(() => {
      localStorage.setItem('ifocus_timer_state', JSON.stringify({
        isFocus: true, isRunning: true, sessionCount: 1, timerPreset: 'Custom',
        timeLeft: 1, totalTime: 1, targetEndTime: Date.now() + 1000,
        customWorkDuration: 1, customBreakDuration: 1, customSessions: 1,
        timerSessionId: 'breakgate-long-test', authSessionId: 'history-login', userId: 'history-student',
      }));
    });
    await page.reload();
    await expect(page.locator('#timerToggleBtn')).toHaveText('Stop');
    await page.clock.fastForward(1100);
    await expect(dialog).toBeVisible();
  };
  await openGate();
  const progress = dialog.getByRole('progressbar', { name: 'BreakGate progress' });
  await expect(dialog.getByText('Question 1 of 26')).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuemax', '26');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await dialog.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(await dialog.evaluate(element => element.clientWidth));
  }
  await dialog.getByRole('button', { name: /^A Definition/ }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  const fill = progress.locator('.breakgate-progress-fill');
  await expect(fill).toHaveCSS('transition-property', 'width');
  await expect(fill).toHaveCSS('transition-duration', '0.32s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(fill).toHaveCSS('transition-duration', '0s');
  await dialog.getByRole('button', { name: 'Next Question' }).click();
  await expect(dialog.getByText('Question 2 of 26')).toBeVisible();

  const skipWithHistory = async count => {
    await page.evaluate(count => {
      const skips = Array.from({ length: count }, (_, index) => ({
        status: 'skipped', timestamp: new Date(Date.now() - (index + 1) * 1000).toISOString(),
      }));
      localStorage.setItem('ifocus_breakgate_events', JSON.stringify(skips));
    }, count);
    await dialog.getByRole('button', { name: 'Skip to Break' }).click();
    await expect(dialog).toHaveCount(0);
  };
  await skipWithHistory(4);
  const notice = page.getByRole('complementary', { name: 'Coach has noticed something' });
  await expect(notice).toContainText('5 BreakGate challenges');
  expect(await page.evaluate(() => window.coachChimeNotes)).toEqual([659.25, 987.77]);
  expect(await notice.evaluate(element => element.scrollWidth)).toBeLessThanOrEqual(await notice.evaluate(element => element.clientWidth));
  await notice.getByRole('button', { name: 'Dismiss' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ifocus_active_breakgate_deck'))).not.toBeNull();
  await openGate();
  await skipWithHistory(5);
  await expect(notice).toHaveCount(0);
  expect(await page.evaluate(() => window.coachChimeNotes)).toEqual([]);
  await openGate();
  await page.evaluate(() => localStorage.setItem('ifocus_sound_preferences', JSON.stringify({ telemetryChime: false })));
  await skipWithHistory(9);
  await expect(notice).toContainText('10 BreakGate challenges');
  expect(await page.evaluate(() => window.coachChimeNotes)).toEqual([]);
  await notice.getByRole('button', { name: 'View Coach Strategy' }).click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ifocus_active_breakgate_deck'))).not.toBeNull();
  const apply = page.getByRole('button', { name: 'Apply Strategy to Dashboard' });
  await expect(apply).toHaveClass(/btn-primary/);
  const timerBefore = await page.evaluate(() => localStorage.getItem('ifocus_timer_state'));
  await apply.click();
  await expect(notice).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ifocus_active_breakgate_deck'))).toBeNull();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ifocus_timer_state'))).toBe(timerBefore);
});

test('custom settings open directly after a one-second focus and break cycle', async ({ page, context }) => {
  await page.clock.install();
  await accountFixture(context);
  await page.addInitScript(() => {
    localStorage.setItem('ifocus_timer_preferences', JSON.stringify({ autoStartBreaks: true, autoStartFocus: true }));
    localStorage.setItem('ifocus_sound_preferences', JSON.stringify({ dailyReminder: false }));
    localStorage.setItem('ifocus_ai_adjusted_active', 'true');
    localStorage.setItem('ifocus_ai_adjusted_details', JSON.stringify({ state: 'Adaptive', rhythm: '1s Focus / 1s Rest', sessions: 2 }));
    localStorage.setItem('ifocus_timer_state', JSON.stringify({
      isFocus: true, isRunning: true, sessionCount: 1, timerPreset: 'Custom',
      timeLeft: 1, totalTime: 1, targetEndTime: Date.now() + 1000,
      customWorkDuration: 1, customBreakDuration: 1, customSessions: 2,
      timerSessionId: 'short-cycle-test', authSessionId: 'history-login', userId: 'history-student',
    }));
  });
  await page.goto('/dashboard');
  await expect(page.locator('#timerToggleBtn')).toHaveText('Stop');
  for (const phase of [false, true]) {
    await page.clock.fastForward(1100);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ifocus_timer_state')).isFocus)).toBe(phase);
  }
  await page.clock.fastForward(1100);
  await expect(page.getByText('All Planned Sessions Finished!')).toBeVisible();
  await page.getByRole('button', { name: 'Keep Custom Rhythm' }).click();
  await page.getByTitle('Custom Timer Settings').click();
  await expect(page.getByRole('heading', { name: 'Custom Timer Settings' })).toBeVisible();
  await expect(page.getByText('Override AI Recommendation?')).toHaveCount(0);
});

test('long task lists keep full-height rows and scroll inside the dashboard panel', async ({ page, context }) => {
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
    const rows = list.locator('[data-todo-id]');
    await expect(rows).toHaveCount(1);
    const initialHeight = (await panel.boundingBox()).height;
    const rowHeight = (await rows.first().boundingBox()).height;

    taskCount = width === 390 ? 12 : 17;
    await page.reload();
    await expect(rows).toHaveCount(taskCount);
    const panelHeight = (await panel.boundingBox()).height;
    if (width >= 769) expect(panelHeight).toBeCloseTo(initialHeight, 0);
    const rowHeights = await rows.evaluateAll(elements => elements.map(row => row.offsetHeight));
    expect(Math.min(...rowHeights)).toBeGreaterThanOrEqual(Math.floor(rowHeight));

    const heading = page.getByRole('heading', { name: 'Tasks List' });
    await rows.nth(3).locator('.todo-text').hover();
    const headingTop = (await heading.boundingBox()).y;
    if (width === 390) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
      const text = await rows.nth(3).locator('.todo-text').boundingBox();
      const x = Math.round(text.x + text.width / 2);
      const y = Math.round(text.y + text.height / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (const distance of [15, 45, 85, 120]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - distance }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    } else {
      await page.mouse.wheel(0, 240);
    }
    await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
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
