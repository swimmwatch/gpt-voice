import type { Page } from 'playwright-core';
import { BrowserNavigationService, retryBrowserNavigation } from '../browserNavigationRetry';
import { CLAUDE_WEB_ORIGIN } from './claudeWebSession';

const CLAUDE_WEB_NAVIGATION_TIMEOUT_MS = 30_000;
const CLAUDE_WEB_LOAD_SETTLE_TIMEOUT_MS = 10_000;

export interface ClaudeWebNavigationLogger {
  warn(...args: unknown[]): void;
}

/** Browser-navigation adapter with an injected logger and no provider-global state. */
export class ClaudeWebNavigationService {
  public constructor(private readonly logger: ClaudeWebNavigationLogger) {}

  public async navigate(page: Page): Promise<void> {
    await retryBrowserNavigation(
      {
        navigate: () =>
          page.goto(CLAUDE_WEB_ORIGIN, {
            waitUntil: 'domcontentloaded',
            timeout: CLAUDE_WEB_NAVIGATION_TIMEOUT_MS,
          }),
        service: BrowserNavigationService.Claude,
      },
      {
        onRetry: (event) => this.logger.warn('Retrying Claude page navigation:', event),
      },
    );

    try {
      await page.waitForLoadState('load', { timeout: CLAUDE_WEB_LOAD_SETTLE_TIMEOUT_MS });
    } catch {
      this.logger.warn('Claude load event did not settle quickly; continuing after DOMContentLoaded');
    }
  }
}
