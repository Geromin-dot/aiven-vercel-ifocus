import { test, expect } from '@playwright/test';
import { accountFixture } from './account-fixture.mjs';

test.use({ serviceWorkers: 'allow', permissions: ['notifications'] });

test('notification tests register through the active worker and repeated clicks create fresh tests', async ({ page, context }) => {
  await accountFixture(context);
  await page.goto('/settings');
  const section = page.getByRole('region', { name: 'PWA timer and notifications' });
  await expect(section.getByText('Notifications allowed')).toBeVisible();
  const button = section.getByRole('button', { name: 'Test Notification', exact: true });
  await button.click();
  await expect(section.getByRole('status')).toContainText('browser registered the test notification');
  const tags = async () => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.getNotifications()).filter(item => item.tag.startsWith('ifocus-test-')).map(item => item.tag);
  });
  const first = await tags();
  expect(first).toHaveLength(1);
  await button.click();
  await expect(section.getByRole('status')).toContainText('browser registered the test notification');
  const second = await tags();
  expect(second).toHaveLength(1);
  expect(second[0]).not.toBe(first[0]);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    (await registration.getNotifications()).filter(item => item.tag.startsWith('ifocus-test-')).forEach(item => item.close());
  });
});
