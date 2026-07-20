import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { Page } from 'playwright-core';
import { StatusCodes } from 'http-status-codes';

import { setLocale } from '@main/i18n';
import { ChatGPTVoiceProvider } from '@main/providers/ChatGPTVoiceProvider';

interface FakePageHarness {
  evaluationArguments: unknown[];
  loadStateCalls: Array<{ state: string; timeout: number | undefined }>;
  page: Page;
  state: {
    closed: boolean;
    loadStateError: Error | null;
  };
}

function createFakePage(evaluationResults: unknown[]): FakePageHarness {
  const evaluationArguments: unknown[] = [];
  const loadStateCalls: Array<{ state: string; timeout: number | undefined }> = [];
  const state = { closed: false, loadStateError: null as Error | null };
  const page = {
    async evaluate<Result, Argument>(_pageFunction: unknown, argument: Argument): Promise<Result> {
      evaluationArguments.push(argument);
      const result = evaluationResults.shift();
      if (result instanceof Error) throw result;
      return result as Result;
    },
    isClosed(): boolean {
      return state.closed;
    },
    async waitForLoadState(loadState: string, options?: { timeout?: number }): Promise<void> {
      loadStateCalls.push({ state: loadState, timeout: options?.timeout });
      if (state.loadStateError) throw state.loadStateError;
    },
  } as unknown as Page;
  return { evaluationArguments, loadStateCalls, page, state };
}

class TestChatGPTVoiceProvider extends ChatGPTVoiceProvider {
  refreshCalls = 0;
  refreshedToken = 'refreshed-synthetic-token';

  setReady(page: Page, accessToken = 'initial-synthetic-token'): void {
    this.page = page;
    this.accessToken = accessToken;
  }

  override async refreshAccessToken(): Promise<string> {
    this.refreshCalls += 1;
    this.accessToken = this.refreshedToken;
    return this.accessToken;
  }
}

function response(status: number, body: Record<string, unknown>): unknown {
  return { kind: 'response', status, body: JSON.stringify(body) };
}

function getAccessTokenArgument(argument: unknown): string | undefined {
  if (typeof argument !== 'object' || argument === null || !('accessToken' in argument)) return undefined;
  return typeof argument.accessToken === 'string' ? argument.accessToken : undefined;
}

interface ProviderHarness {
  clipboardWrites: string[];
  page: FakePageHarness;
  provider: TestChatGPTVoiceProvider;
  retryDelays: number[];
}

function createHarness(evaluationResults: unknown[]): ProviderHarness {
  const clipboardWrites: string[] = [];
  const retryDelays: number[] = [];
  const page = createFakePage(evaluationResults);
  const provider = new TestChatGPTVoiceProvider({
    waitForTranscriptionRetry: async (delayMs) => {
      retryDelays.push(delayMs);
    },
    writeClipboardText: (text) => clipboardWrites.push(text),
  });
  provider.setReady(page.page);
  return { clipboardWrites, page, provider, retryDelays };
}

describe('ChatGPTVoiceProvider transcription recovery', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('retries one page-side request failure and completes side effects once', async () => {
    const harness = createHarness([
      { kind: 'request-failed' },
      response(Number(StatusCodes.OK), { text: 'synthetic transcript' }),
    ]);

    const result = await harness.provider.transcribe(new Uint8Array([1, 2, 3, 4]).buffer, 'audio/wav');

    assert.deepEqual(result, { success: true, text: 'synthetic transcript' });
    assert.deepEqual(harness.retryDelays, [500]);
    assert.equal(harness.page.evaluationArguments.length, 2);
    assert.deepEqual(harness.clipboardWrites, ['synthetic transcript']);
  });

  it('stops after one retry and returns no browser details', async () => {
    const harness = createHarness([{ kind: 'request-failed' }, { kind: 'request-failed' }]);

    const result = await harness.provider.transcribe(new Uint8Array([5, 6]).buffer, 'audio/wav');

    assert.deepEqual(result, {
      success: false,
      error: 'ChatGPT transcription was interrupted. Try again.',
    });
    assert.deepEqual(harness.retryDelays, [500]);
    assert.equal(harness.page.evaluationArguments.length, 2);
    assert.deepEqual(harness.clipboardWrites, []);
    assert.doesNotMatch(result.error || '', /https?:|page\.evaluate|trace|\/home\//i);
  });

  it('waits for the same page after an execution-context interruption', async () => {
    const harness = createHarness([
      new Error('page.evaluate: synthetic private browser context details'),
      response(Number(StatusCodes.OK), { text: 'recovered transcript' }),
    ]);

    const result = await harness.provider.transcribe(new Uint8Array([7, 8]).buffer, 'audio/wav');

    assert.deepEqual(result, { success: true, text: 'recovered transcript' });
    assert.deepEqual(harness.retryDelays, [500]);
    assert.deepEqual(harness.page.loadStateCalls, [{ state: 'domcontentloaded', timeout: 5000 }]);
    assert.deepEqual(harness.clipboardWrites, ['recovered transcript']);
  });

  it('does not retry when the interrupted page is closed', async () => {
    const harness = createHarness([new Error('synthetic browser failure')]);
    harness.page.state.closed = true;

    const result = await harness.provider.transcribe(new Uint8Array([9, 10]).buffer, 'audio/wav');

    assert.deepEqual(result, {
      success: false,
      error: 'ChatGPT transcription was interrupted. Try again.',
    });
    assert.deepEqual(harness.retryDelays, []);
    assert.equal(harness.page.evaluationArguments.length, 1);
    assert.deepEqual(harness.page.loadStateCalls, []);
  });

  it('keeps authentication refresh within the two-attempt bound', async () => {
    const harness = createHarness([
      response(Number(StatusCodes.UNAUTHORIZED), { error: 'synthetic unauthorized response' }),
      response(Number(StatusCodes.OK), { text: 'authenticated transcript' }),
    ]);

    const result = await harness.provider.transcribe(new Uint8Array([11, 12]).buffer, 'audio/wav');

    assert.deepEqual(result, { success: true, text: 'authenticated transcript' });
    assert.equal(harness.provider.refreshCalls, 1);
    assert.equal(harness.page.evaluationArguments.length, 2);
    assert.equal(getAccessTokenArgument(harness.page.evaluationArguments[0]), 'initial-synthetic-token');
    assert.equal(getAccessTokenArgument(harness.page.evaluationArguments[1]), 'refreshed-synthetic-token');
    assert.deepEqual(harness.retryDelays, []);
    assert.deepEqual(harness.clipboardWrites, ['authenticated transcript']);
  });

  it('fails safely when the page cannot settle before retry', async () => {
    const harness = createHarness([new Error('private context failure')]);
    harness.page.state.loadStateError = new Error('private load-state failure');

    const result = await harness.provider.transcribe(new Uint8Array([13, 14]).buffer, 'audio/wav');

    assert.deepEqual(result, {
      success: false,
      error: 'ChatGPT transcription was interrupted. Try again.',
    });
    assert.equal(harness.page.evaluationArguments.length, 1);
    assert.deepEqual(harness.clipboardWrites, []);
  });
});
