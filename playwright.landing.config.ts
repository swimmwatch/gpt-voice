import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173/gpt-voice/';

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  outputDir: 'test-results/landing',
  testDir: './tests/landing-page/e2e',
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run landing:build && npm run landing:preview -- --host 127.0.0.1 --port 4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
});
