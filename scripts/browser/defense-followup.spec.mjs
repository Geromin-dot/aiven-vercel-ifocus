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
  const disclaimer = page.getByRole('button', { name: 'About AI Coach & disclaimer' });
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
    const button = heading.getByRole('button', { name: 'About AI Coach & disclaimer' });
    await expect(button).toBeVisible();
    const [headerBox, buttonBox] = await Promise.all([heading.boundingBox(), button.boundingBox()]);
    expect(Math.abs(headerBox.x + headerBox.width - buttonBox.x - buttonBox.width)).toBeLessThan(2);
    expect(Math.abs(headerBox.y - buttonBox.y)).toBeLessThan(2);
    await page.getByRole('link', { name: 'iFocus landing page' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: /Open Dashboard/ })).toBeVisible();
  }
});
