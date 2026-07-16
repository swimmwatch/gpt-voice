import { defineConfig, devices } from '@playwright/test';

const pagesUrl = 'http://127.0.0.1:4175/gpt-voice/';

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: './tests/pages/e2e',
  timeout: 30_000,
  use: {
    baseURL: pagesUrl,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run pages:serve',
    reuseExistingServer: !process.env.CI,
    url: pagesUrl,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
