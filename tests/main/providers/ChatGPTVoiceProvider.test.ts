import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { Page } from 'playwright-core';
import { StatusCodes } from 'http-status-codes';

import { setLocale } from '@main/i18n';
import { ChatGPTVoiceProvider } from '@main/providers/ChatGPTVoiceProvider';

interface FakePageHarness {
  evaluationArguments: unknown[];
  page: Page;
  state: {
    closed: boolean;
  };
}

function createFakePage(evaluationResults: unknown[]): FakePageHarness {
  const evaluationArguments: unknown[] = [];
  const state = { closed: false };
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
  } as unknown as Page;
  return { evaluationArguments, page, state };
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

function response(status: number, body: Record<string, unknown>, retryAfter?: string): unknown {
  return {
    kind: 'response',
    status,
    body: JSON.stringify(body),
    ...(retryAfter ? { retryAfter } : {}),
  };
}

function getAccessTokenArgument(argument: unknown): string | undefined {
  if (typeof argument !== 'object' || argument === null || !('accessToken' in argument)) return undefined;
  return typeof argument.accessToken === 'string' ? argument.accessToken : undefined;
}

interface ProviderHarness {
  clipboardWrites: string[];
  page: FakePageHarness;
  provider: TestChatGPTVoiceProvider;
  recoveryTimeouts: number[];
}

interface ProviderHarnessOptions {
  now?: () => number;
  reloadPage?: () => Promise<void>;
}

function createHarness(evaluationResults: unknown[], options: ProviderHarnessOptions = {}): ProviderHarness {
  const clipboardWrites: string[] = [];
  const recoveryTimeouts: number[] = [];
  const page = createFakePage(evaluationResults);
  const provider = new TestChatGPTVoiceProvider({
    now: options.now,
    reloadPage: async (_page, timeoutMs) => {
      recoveryTimeouts.push(timeoutMs);
      await options.reloadPage?.();
    },
    writeClipboardText: (text) => clipboardWrites.push(text),
  });
  provider.setReady(page.page);
  return { clipboardWrites, page, provider, recoveryTimeouts };
}

describe('ChatGPTVoiceProvider transcription recovery', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('does not automatically replay an ambiguous page-side request failure', async () => {
    const harness = createHarness([
      { kind: 'request-failed' },
      response(Number(StatusCodes.OK), { text: 'synthetic transcript' }),
    ]);

    const result = await harness.provider.transcribe(new Uint8Array([1, 2, 3, 4]).buffer, 'audio/wav');

    assert.deepEqual(result, {
      success: false,
      error: 'ChatGPT transcription was interrupted. Try again.',
    });
    assert.equal(harness.page.evaluationArguments.length, 1);
    assert.deepEqual(harness.recoveryTimeouts, [15000]);
    assert.deepEqual(harness.clipboardWrites, []);
    assert.doesNotMatch(result.error || '', /https?:|page\.evaluate|trace|\/home\//i);
  });

  it('waits for page recovery before an explicit retry without replaying the failed upload', async () => {
    let finishRecovery: (() => void) | undefined;
    const recovery = new Promise<void>((resolve) => {
      finishRecovery = resolve;
    });
    const harness = createHarness(
      [
        { kind: 'request-failed', failure: 'network' },
        response(Number(StatusCodes.OK), { text: 'explicit retry transcript' }),
      ],
      { reloadPage: () => recovery },
    );

    const firstResult = await harness.provider.transcribe(new Uint8Array([5, 6]).buffer, 'audio/wav');
    const retryResult = harness.provider.transcribe(new Uint8Array([5, 6]).buffer, 'audio/wav');
    await Promise.resolve();

    assert.equal(firstResult.success, false);
    assert.equal(harness.page.evaluationArguments.length, 1);
    finishRecovery?.();
    assert.deepEqual(await retryResult, { success: true, text: 'explicit retry transcript' });
    assert.equal(harness.page.evaluationArguments.length, 2);
    assert.deepEqual(harness.recoveryTimeouts, [15000]);
  });

  it('does not replay audio after an execution-context interruption', async () => {
    const harness = createHarness([
      new Error('page.evaluate: synthetic private browser context details at https://private.invalid'),
      response(Number(StatusCodes.OK), { text: 'recovered transcript' }),
    ]);

    const result = await harness.provider.transcribe(new Uint8Array([7, 8]).buffer, 'audio/wav');

    assert.deepEqual(result, {
      success: false,
      error: 'ChatGPT transcription was interrupted. Try again.',
    });
    assert.equal(harness.page.evaluationArguments.length, 1);
    assert.deepEqual(harness.clipboardWrites, []);
    assert.doesNotMatch(result.error || '', /https?:|page\.evaluate|private/i);
  });

  it('does not retry when the interrupted page is closed', async () => {
    const harness = createHarness([new Error('synthetic browser failure')]);
    harness.page.state.closed = true;

    const result = await harness.provider.transcribe(new Uint8Array([9, 10]).buffer, 'audio/wav');

    assert.deepEqual(result, {
      success: false,
      error: 'ChatGPT transcription was interrupted. Try again.',
    });
    assert.equal(harness.page.evaluationArguments.length, 1);
    assert.deepEqual(harness.recoveryTimeouts, []);
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
    assert.deepEqual(harness.clipboardWrites, ['authenticated transcript']);
  });

  it('preserves a safe retry-after duration without replaying a rate-limited request', async () => {
    const body = { error: { message: 'synthetic provider details' } };
    let nowMs = 1000;
    const harness = createHarness(
      [
        response(Number(StatusCodes.TOO_MANY_REQUESTS), body, '45'),
        response(Number(StatusCodes.OK), { text: 'after cooldown' }),
      ],
      { now: () => nowMs },
    );

    const result = await harness.provider.transcribe(new Uint8Array([13, 14]).buffer, 'audio/wav');
    nowMs += 1000;
    const blockedResult = await harness.provider.transcribe(new Uint8Array([15, 16]).buffer, 'audio/wav');

    assert.deepEqual(result, {
      success: false,
      error: 'Too many requests. Try again in 45s.',
    });
    assert.deepEqual(blockedResult, {
      success: false,
      error: 'Too many requests. Try again in 44s.',
    });
    assert.equal(harness.page.evaluationArguments.length, 1);
    assert.deepEqual(harness.clipboardWrites, []);

    nowMs += 44000;
    assert.deepEqual(await harness.provider.transcribe(new Uint8Array([17, 18]).buffer, 'audio/wav'), {
      success: true,
      text: 'after cooldown',
    });
    assert.equal(harness.page.evaluationArguments.length, 2);
  });

  it('passes a bounded request timeout to the browser upload', async () => {
    const harness = createHarness([{ kind: 'request-failed', failure: 'timeout' }]);

    await harness.provider.transcribe(new Uint8Array([19, 20]).buffer, 'audio/wav');

    assert.deepEqual(harness.page.evaluationArguments[0], {
      accessToken: 'initial-synthetic-token',
      audioBase64: 'ExQ=',
      defaultMimeType: 'audio/webm',
      fileExtension: 'wav',
      mimeType: 'audio/wav',
      requestTimeoutMs: 20000,
      transcriptionModel: 'whisper-1',
      uploadFileBasename: 'recording',
    });
    assert.equal(harness.page.evaluationArguments.length, 1);
  });
});
