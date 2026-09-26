import { defineConfig, devices } from '@playwright/test';
import { findChromium } from './scripts/lib/chromium';

const base = process.env.BASE_PATH ?? '/wealth-shown-to-scale/';
// Use a pre-installed Chromium when the Playwright-managed build is absent (sandboxes, CI images).
const executablePath = findChromium();

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:4173${base}`,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: `http://127.0.0.1:4173${base}en/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
