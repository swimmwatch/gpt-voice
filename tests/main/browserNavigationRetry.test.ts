import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BrowserNavigationService,
  type BrowserNavigationRetryEvent,
  getBrowserNavigationRetryDelayMs,
  isRetryableBrowserNavigationError,
  retryBrowserNavigation,
} from '@main/browserNavigationRetry';

describe('browser navigation retry', () => {
  it('recognizes transient browser network changes without retrying authorization failures', () => {
    assert.equal(isRetryableBrowserNavigationError(new Error('page.goto: net::ERR_NETWORK_CHANGED')), true);
    assert.equal(isRetryableBrowserNavigationError(new Error('Timeout 30000ms exceeded')), true);
    assert.equal(isRetryableBrowserNavigationError(new Error('No access token')), false);
  });

  it('uses bounded exponential retry delays with deterministic midpoint jitter', () => {
    assert.equal(getBrowserNavigationRetryDelayMs(1, 0.5), 500);
    assert.equal(getBrowserNavigationRetryDelayMs(2, 0.5), 1000);
    assert.equal(getBrowserNavigationRetryDelayMs(3, 0.5), 2000);
  });

  it('retries a transient ChatGPT navigation and logs safe retry metadata', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const events: BrowserNavigationRetryEvent[] = [];

    await retryBrowserNavigation(
      {
        navigate: async () => {
          attempts += 1;
          if (attempts === 1) {
            throw new Error('page.goto: net::ERR_NETWORK_CHANGED at https://chatgpt.com/');
          }
        },
        service: BrowserNavigationService.ChatGPT,
      },
      {
        onRetry: (event) => events.push(event),
        random: () => 0.5,
        sleep: async (delayMs) => {
          delays.push(delayMs);
        },
      },
    );

    assert.equal(attempts, 2);
    assert.deepEqual(delays, [500]);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.attempt, 1);
    assert.equal(events[0]?.delayMs, 500);
    assert.equal(events[0]?.maxAttempts, 4);
    assert.equal(events[0]?.service, BrowserNavigationService.ChatGPT);
    assert.equal(events[0]?.error.wasSanitized, true);
    assert.equal('rawMessage' in (events[0]?.error || {}), false);
  });

  it('returns a safe connection failure after the final transient Google Translate attempt', async () => {
    let attempts = 0;
    const delays: number[] = [];

    await assert.rejects(
      retryBrowserNavigation(
        {
          navigate: async () => {
            attempts += 1;
            throw new Error('page.goto: net::ERR_NETWORK_CHANGED at https://translate.google.ru/');
          },
          service: BrowserNavigationService.GoogleTranslate,
        },
        {
          random: () => 0.5,
          sleep: async (delayMs) => {
            delays.push(delayMs);
          },
        },
      ),
      /Failed to connect to Google Translate/u,
    );

    assert.equal(attempts, 4);
    assert.deepEqual(delays, [500, 1000, 2000]);
  });

  it('classifies Claude navigation retries independently', async () => {
    const events: BrowserNavigationRetryEvent[] = [];
    let attempts = 0;

    await retryBrowserNavigation(
      {
        navigate: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('page.goto: net::ERR_CONNECTION_RESET');
        },
        service: BrowserNavigationService.Claude,
      },
      {
        onRetry: (event) => events.push(event),
        random: () => 0.5,
        sleep: async () => undefined,
      },
    );

    assert.equal(attempts, 2);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.service, BrowserNavigationService.Claude);
    assert.equal(events[0]?.error.wasSanitized, true);
  });

  it('does not retry non-network navigation failures', async () => {
    let attempts = 0;

    await assert.rejects(
      retryBrowserNavigation({
        navigate: async () => {
          attempts += 1;
          throw new Error('Navigation is not allowed');
        },
        service: BrowserNavigationService.ChatGPT,
      }),
      /Navigation is not allowed/u,
    );

    assert.equal(attempts, 1);
  });
});
