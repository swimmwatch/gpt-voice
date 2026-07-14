import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173/gpt-voice/';
const crossBrowserCoverage = process.env.CI || process.env.PLAYWRIGHT_CROSS_BROWSER === 'true';
const projects = crossBrowserCoverage
  ? [
      { name: 'chromium', use: { browserName: 'chromium' as const } },
      { name: 'firefox', use: { browserName: 'firefox' as const } },
      { name: 'webkit', use: { browserName: 'webkit' as const } },
    ]
  : [{ name: 'chromium', use: { browserName: 'chromium' as const } }];

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  outputDir: 'test-results/landing',
  projects,
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
