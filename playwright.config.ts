import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Loads GSC_TEST_MOBILE_NUMBER / GSC_TEST_PASSWORD (and anything else) from a
// local ".env" file, if one exists, before any test file reads process.env.
// ".env" is git-ignored - see .env.example for the template. If no ".env"
// file is present this is a silent no-op, so CI (which sets real environment
// variables instead) is unaffected.
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Playwright configuration for the GSC Malaysia UI automation demo.
 *
 * - Runs headed by default is controlled via the CLI flag (`--headed`), but this
 *   config is equally valid for headless CI runs (`npx playwright test`).
 * - Screenshots and video are captured for every test (not just failures) so
 *   that a full run always produces visual evidence of the journey, as required
 *   by this project's brief. Trace is kept on failure/retry for deep debugging.
 * - Each spec file is independently executable via `npx playwright test <file>`.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  outputDir: 'test-results',

  use: {
    baseURL: 'https://www.gsc.com.my/',
    headless: false,
    viewport: { width: 1366, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    screenshot: 'on',
    video: 'on',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
