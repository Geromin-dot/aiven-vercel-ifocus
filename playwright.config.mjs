import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3106', channel: 'chrome', headless: true, serviceWorkers: 'block', viewport: { width: 1280, height: 800 } },
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3106',
    url: 'http://127.0.0.1:3106/login',
    env: { NEXTAUTH_SECRET: 'history-regression-test-secret', NEXTAUTH_URL: 'http://127.0.0.1:3106' },
    reuseExistingServer: false,
  },
});
