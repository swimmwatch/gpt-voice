import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Page } from 'playwright-core';
import { ClaudeWebNavigationService } from '@main/providers/claudeWebNavigationService';
import { CLAUDE_WEB_ORIGIN } from '@main/providers/claudeWebSession';

interface NavigationCall {
  readonly options?: Readonly<Record<string, unknown>>;
  readonly url: string;
}

class ClaudeWebNavigationFixture {
  public readonly navigationCalls: NavigationCall[] = [];
  public readonly warnings: unknown[][] = [];
  public readonly waitForLoadStateCalls: Array<{
    readonly state: string;
    readonly options?: Readonly<Record<string, unknown>>;
  }> = [];
  public rejectLoadSettlement = false;
  public readonly service = new ClaudeWebNavigationService({
    warn: (...args) => this.warnings.push(args),
  });
  public readonly page = {
    goto: async (url: string, options?: Readonly<Record<string, unknown>>) => {
      this.navigationCalls.push({ url, options });
    },
    waitForLoadState: async (state: string, options?: Readonly<Record<string, unknown>>) => {
      this.waitForLoadStateCalls.push({ state, options });
      if (this.rejectLoadSettlement) throw new Error('synthetic load settlement timeout');
    },
  } as unknown as Page;
}

describe('Claude Web navigation service', () => {
  it('navigates to the canonical origin with the preserved timeout contract', async () => {
    const fixture = new ClaudeWebNavigationFixture();

    await fixture.service.navigate(fixture.page);

    assert.deepEqual(fixture.navigationCalls, [
      {
        url: CLAUDE_WEB_ORIGIN,
        options: {
          timeout: 30_000,
          waitUntil: 'domcontentloaded',
        },
      },
    ]);
    assert.deepEqual(fixture.waitForLoadStateCalls, [
      {
        state: 'load',
        options: { timeout: 10_000 },
      },
    ]);
    assert.deepEqual(fixture.warnings, []);
  });

  it('keeps post-DOMContentLoaded settlement fail-open', async () => {
    const fixture = new ClaudeWebNavigationFixture();
    fixture.rejectLoadSettlement = true;

    await assert.doesNotReject(() => fixture.service.navigate(fixture.page));

    assert.deepEqual(fixture.warnings, [
      ['Claude load event did not settle quickly; continuing after DOMContentLoaded'],
    ]);
  });
});
