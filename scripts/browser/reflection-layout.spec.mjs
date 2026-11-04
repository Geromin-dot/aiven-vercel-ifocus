import { test, expect } from '@playwright/test';
import { accountFixture } from './account-fixture.mjs';

for (const [width, height] of [[1920, 910], [1536, 730], [1366, 650], [1280, 600], [1024, 576], [390, 700], [320, 640]]) {
  test(`Quick Reflection Submit remains reachable at ${width}x${height}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height });
    await accountFixture(context, true, { tasks: [
      { id: 'a', text: 'IT Module 10', priority: 'high' }, { id: 'b', text: 'Archi', priority: 'high' },
      { id: 'c', text: 'Fil', priority: 'medium' }, { id: 'd', text: 'Science', priority: 'medium' },
      { id: 'e', text: 'Medtech', priority: 'low' },
    ] });
    await page.goto('/dashboard');
    const card = page.locator('#quick-reflection-card');
    await expect(card).toBeVisible();
    const geometry = await card.evaluate(element => ({ height: element.clientHeight, content: element.scrollHeight,
      overflow: getComputedStyle(element).overflowY }));
    expect(geometry.content, 'The form must not hide its Submit button below a clipped card').toBeLessThanOrEqual(geometry.height + 2);
    await card.locator('textarea').fill('I feel ready to review anatomy.');
    const submit = card.getByRole('button', { name: 'Submit & Analyze', exact: true });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeEnabled();
    expect(await submit.evaluate(element => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return box.height >= 40 && (hit === element || element.contains(hit));
    }), 'Submit must have a usable height and must not be clipped or covered').toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`reflection-${width}.png`) });
  });
}
