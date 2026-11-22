import { test, expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';

test('admin directory stays usable while scrolling a large student list', async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  const user = { id: 'display-admin', name: 'Display Admin', role: 'ADMIN', status: 'ACTIVE' };
  const token = await encode({ secret: 'history-regression-test-secret', token: { ...user, sub: user.id } });
  await context.addCookies([{ name: 'next-auth.session-token', value: token, url: 'http://127.0.0.1:3106' }]);
  let studentCount = 31;
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: { user, expires: '2099-01-01T00:00:00Z' } });
    if (path === '/api/admin/overview') return route.fulfill({ json: {
      metrics: { totalStudents: studentCount },
      students: Array.from({ length: studentCount }, (_, index) => ({
        id: `display-${index}`, name: `Student ${index + 1}`, username: `student${index + 1}`, email: `student${index + 1}@example.test`,
        yearLevel: index % 2 ? '1st Year' : '2nd Year', status: 'ACTIVE', verificationStatus: 'VERIFIED',
        studyDevice: 'pc', sex: 'Male', decksCount: 1, totalTodos: 3, completedTodos: 1,
        decks: [], recentSessions: [], formattedStudyTime: '25m',
      })),
    } });
    return route.fulfill({ json: {} });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const client = await context.newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const results = [];
  for (const count of [31, 200]) {
    studentCount = count;
    await page.goto('/admin');
    const directory = page.getByRole('region', { name: 'Student Progress Directory' });
    await expect(directory.getByRole('article')).toHaveCount(count);
    await page.locator('.admin-portal-root').evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect.getComputedTiming().iterations !== Infinity)
        .map(animation => animation.finished.catch(() => {})));
    });
    const before = await client.send('Performance.getMetrics');
    const scroll = await page.evaluate(async () => {
      const element = [document.querySelector('main'), document.scrollingElement].find(item => item.scrollHeight > item.clientHeight + 100);
      const intervals = [];
      let last = performance.now();
      for (let frame = 0; frame < 120; frame++) {
        await new Promise(requestAnimationFrame);
        const now = performance.now();
        intervals.push(now - last);
        last = now;
        const position = (frame < 60 ? frame : 119 - frame) / 59;
        element.scrollTop = position * (element.scrollHeight - element.clientHeight);
      }
      return { frames: intervals.length, p95FrameMs: intervals.sort((a, b) => a - b)[Math.floor(intervals.length * 0.95)] };
    });
    const after = await client.send('Performance.getMetrics');
    const delta = name => (after.metrics.find(item => item.name === name)?.value || 0) - (before.metrics.find(item => item.name === name)?.value || 0);
    results.push({ students: count, ...scroll, layoutMs: delta('LayoutDuration') * 1000,
      styleMs: delta('RecalcStyleDuration') * 1000, mainThreadMs: delta('TaskDuration') * 1000 });
    await expect(directory.getByRole('article')).toHaveCount(count);
    const lastCard = directory.getByRole('article').last();
    await lastCard.getByRole('button', { name: 'Inspect', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close Record' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Record' }).click();
    if (count === 31) await page.screenshot({ path: testInfo.outputPath('admin-directory.png') });
  }
  console.log('Admin display benchmark (4x CPU, synthetic fixtures):', JSON.stringify(results));
  await testInfo.attach('scroll-metrics', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
});
