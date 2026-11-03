import { test, expect } from '@playwright/test';

test('the session boundary preserves full-width landing and login layouts', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: null }));
  await page.route('**/api/auth/csrf', route => route.fulfill({ json: { csrfToken: 'layout-test' } }));
  for (const width of [1920, 1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, selector] of [['/', '.landing-page-root'], ['/login', '.auth-page-root']]) {
      await page.goto(path);
      await expect(page.locator(selector)).toBeVisible();
      const dimensions = await page.locator(selector).evaluate(element => {
        const box = element.getBoundingClientRect();
        return { left: box.left, width: box.width, viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth };
      });
      expect(Math.abs(dimensions.left), `${path} at ${width}px should start at the viewport edge`).toBeLessThanOrEqual(1);
      expect(Math.abs(dimensions.width - dimensions.viewport), `${path} at ${width}px should fill the viewport`).toBeLessThanOrEqual(1);
      expect(dimensions.document, `${path} at ${width}px must not scroll sideways`).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
  }
});
