import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Drives an already-installed browser instead of Playwright's bundled one.
 *
 * Playwright refuses to install its browsers on macOS versions it no longer
 * supports — `Playwright does not support chromium on mac13` — which leaves a
 * developer on such a machine unable to run this suite at all. Setting
 * `PLAYWRIGHT_CHANNEL=chrome` uses the system Chrome instead.
 *
 * Unset by default, so CI keeps using the pinned bundled build and stays
 * reproducible. This is an escape hatch for local machines, not a default.
 */
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], ...(channel ? { channel } : {}) },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
