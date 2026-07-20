import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '@main/i18n';
import {
  MAX_PRETTIFY_SELECTED_TEXT_LENGTH,
  createSelectedTextPrettifyService,
  type SelectedTextPrettifyDependencies,
} from '@main/services/selectedTextPrettify';
import { createSelectedTextActionGate, type SelectedTextActionGate } from '@main/services/selectedTextActionState';
import { createTextActionResultCache, type TextActionResultCache } from '@main/services/textActionCache';
import type { ClipboardType } from '@main/electronRuntime';
import type { SystemNotificationOptions } from '@shared/notifications';
import { DEFAULT_PRETTIFY_SETTINGS, type PrettifyProviderId, type PrettifySettings } from '@shared/prettifySettings';

interface TestServiceOptions {
  actionGate?: SelectedTextActionGate;
  cache?: TextActionResultCache;
  cacheContext?: readonly string[];
  copiedText?: string;
  copyError?: Error;
  platform?: NodeJS.Platform;
  prompt?: string;
  providerId?: PrettifyProviderId;
  baseUrl?: string;
  maxOutputTokens?: number;
  minP?: number;
  model?: string;
  repeatPenalty?: number;
  seed?: number | null;
  temperature?: number;
  topK?: number;
  topP?: number;
  selectionText?: string;
  prepareResult?: { success: false; error: string };
  prepareWait?: Promise<void>;
  providerCacheContext?: readonly string[];
  prettifyResult?: { success: boolean; text?: string; error?: string };
  prettifyWait?: Promise<void>;
}

function createPrettifySettings(options: TestServiceOptions = {}): PrettifySettings {
  const providerId = options.providerId || 'ollama';
  const ollama = {
    ...DEFAULT_PRETTIFY_SETTINGS.ollama,
    baseUrl: providerId === 'ollama' ? options.baseUrl || 'http://127.0.0.1:11434' : 'http://127.0.0.1:11434',
    model: providerId === 'ollama' ? options.model || 'llama3.2' : 'llama3.2',
  };
  const vllm = {
    ...DEFAULT_PRETTIFY_SETTINGS.vllm,
    baseUrl: providerId === 'vllm' ? options.baseUrl || 'http://127.0.0.1:8000/v1' : 'http://127.0.0.1:8000/v1',
    model: providerId === 'vllm' ? options.model || 'qwen2.5' : 'qwen2.5',
  };

  return {
    ...DEFAULT_PRETTIFY_SETTINGS,
    maxOutputTokens: options.maxOutputTokens ?? DEFAULT_PRETTIFY_SETTINGS.maxOutputTokens,
    minP: options.minP ?? DEFAULT_PRETTIFY_SETTINGS.minP,
    prompt: options.prompt || 'prompt',
    providerId,
    repeatPenalty: options.repeatPenalty ?? DEFAULT_PRETTIFY_SETTINGS.repeatPenalty,
    seed: options.seed ?? DEFAULT_PRETTIFY_SETTINGS.seed,
    temperature: options.temperature ?? DEFAULT_PRETTIFY_SETTINGS.temperature,
    topK: options.topK ?? DEFAULT_PRETTIFY_SETTINGS.topK,
    topP: options.topP ?? DEFAULT_PRETTIFY_SETTINGS.topP,
    ollama,
    vllm,
  };
}

function createTestService(options: TestServiceOptions = {}) {
  const clipboard = {
    clipboard: 'previous clipboard',
    selection: options.selectionText || '',
  };
  const notifications: Array<{ title: string; body: string; options?: SystemNotificationOptions }> = [];
  const automationCalls: string[] = [];
  const waitCalls: number[] = [];
  const prepareCalls: PrettifySettings[] = [];
  const prettifyCalls: Array<{
    text: string;
    providerId: PrettifyProviderId;
    prompt: string;
    model: string;
    baseUrl: string;
    maxOutputTokens: number;
    minP: number;
    repeatPenalty: number;
    seed: number | null;
    temperature: number;
    topK: number;
    topP: number;
    signal?: AbortSignal;
  }> = [];
  const prettifySettings = createPrettifySettings(options);

  const deps: SelectedTextPrettifyDependencies = {
    actionGate: options.actionGate || createSelectedTextActionGate(),
    automateTextAction: async (action) => {
      automationCalls.push(action);
      if (options.copyError) {
        throw options.copyError;
      }
      if (options.copiedText !== undefined) {
        clipboard.clipboard = options.copiedText;
      }
    },
    clipboard: {
      readText: (type?: ClipboardType) => clipboard[type || 'clipboard'],
      writeText: (text: string, type?: ClipboardType) => {
        clipboard[type || 'clipboard'] = text;
      },
    },
    cache: options.cache || createTextActionResultCache(20),
    getCacheContext: () => options.cacheContext || [],
    getPrettifySettings: () => prettifySettings,
    notify: (title, body, options) => {
      notifications.push({ title, body, options });
    },
    platform: options.platform || 'linux',
    prepare: async (settings, signal) => {
      const typedSettings = settings;
      prepareCalls.push(typedSettings);
      await options.prepareWait;
      if (options.prepareResult) return options.prepareResult;
      const providerSettings = typedSettings.providerId === 'vllm' ? typedSettings.vllm : typedSettings.ollama;
      return {
        success: true as const,
        prepared: {
          providerId: typedSettings.providerId,
          cacheContext: options.providerCacheContext ?? [
            typedSettings.providerId,
            providerSettings.baseUrl,
            providerSettings.model,
            typedSettings.prompt,
            String(typedSettings.temperature),
            String(typedSettings.topP),
            String(typedSettings.topK),
            String(typedSettings.minP),
            String(typedSettings.repeatPenalty),
            String(typedSettings.maxOutputTokens),
            typedSettings.seed === null ? '' : String(typedSettings.seed),
          ],
          execute: async (text: string) => {
            prettifyCalls.push({
              text,
              providerId: typedSettings.providerId,
              prompt: typedSettings.prompt,
              model: providerSettings.model,
              baseUrl: providerSettings.baseUrl,
              maxOutputTokens: typedSettings.maxOutputTokens,
              minP: typedSettings.minP,
              repeatPenalty: typedSettings.repeatPenalty,
              seed: typedSettings.seed,
              temperature: typedSettings.temperature,
              topK: typedSettings.topK,
              topP: typedSettings.topP,
              signal,
            });
            await options.prettifyWait;
            return options.prettifyResult || { success: true, text: 'prettified text' };
          },
        },
      };
    },
    wait: async (delayMs) => {
      waitCalls.push(delayMs);
    },
  };

  return {
    automationCalls,
    clipboard,
    notifications,
    prepareCalls,
    prettifyCalls,
    service: createSelectedTextPrettifyService(deps),
    waitCalls,
  };
}

describe('selectedTextPrettify', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('keeps the clipboard and fails clearly when no text is selected', async () => {
    const { clipboard, notifications, service } = createTestService();

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.error, 'No text selected to prettify');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, [
      { title: 'Prettify failed', body: 'No text selected to prettify', options: { sound: 'error' } },
    ]);
  });

  it('rejects selected text over the inference limit before calling the provider', async () => {
    const { clipboard, notifications, prettifyCalls, service } = createTestService({
      selectionText: 'x'.repeat(MAX_PRETTIFY_SELECTED_TEXT_LENGTH + 1),
    });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(
      result.error,
      `Selected text is too long to prettify (maximum ${MAX_PRETTIFY_SELECTED_TEXT_LENGTH} characters)`,
    );
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(prettifyCalls, []);
    assert.deepEqual(notifications, [
      {
        title: 'Prettify failed',
        body: `Selected text is too long to prettify (maximum ${MAX_PRETTIFY_SELECTED_TEXT_LENGTH} characters)`,
        options: { sound: 'error' },
      },
    ]);
  });

  it('uses the Linux selection clipboard', async () => {
    const { automationCalls, clipboard, prettifyCalls, service, waitCalls } = createTestService({
      copyError: new Error('copy unavailable'),
      selectionText: 'primary selection',
    });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(clipboard.clipboard, 'prettified text');
    assert.deepEqual(automationCalls, ['copy']);
    assert.deepEqual(waitCalls, []);
    assert.equal(prettifyCalls.length, 1);
    assert.equal(prettifyCalls[0]?.text, 'primary selection');
    assert.equal(prettifyCalls[0]?.prompt, 'prompt');
    assert.equal(prettifyCalls[0]?.providerId, 'ollama');
    assert.equal(prettifyCalls[0]?.model, 'llama3.2');
    assert.equal(prettifyCalls[0]?.signal instanceof AbortSignal, true);
    assert.equal(prettifyCalls[0]?.signal?.aborted, false);
  });

  it('uses copy automation on non-Linux platforms', async () => {
    const { automationCalls, clipboard, prettifyCalls, service, waitCalls } = createTestService({
      copiedText: 'copied selection',
      platform: 'darwin',
    });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(clipboard.clipboard, 'prettified text');
    assert.deepEqual(automationCalls, ['copy']);
    assert.deepEqual(waitCalls, [120]);
    assert.equal(prettifyCalls[0]?.text, 'copied selection');
  });

  it('passes the configured prettify provider settings to the prettify service', async () => {
    const { prettifyCalls, service } = createTestService({
      providerId: 'vllm',
      baseUrl: 'http://127.0.0.1:9000/v1',
      model: 'qwen3',
      maxOutputTokens: 512,
      minP: 0.05,
      repeatPenalty: 1.1,
      seed: 7,
      temperature: 0.4,
      topK: 32,
      topP: 0.8,
      selectionText: 'selected text',
    });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(prettifyCalls.length, 1);
    assert.equal(prettifyCalls[0]?.providerId, 'vllm');
    assert.equal(prettifyCalls[0]?.baseUrl, 'http://127.0.0.1:9000/v1');
    assert.equal(prettifyCalls[0]?.model, 'qwen3');
    assert.equal(prettifyCalls[0]?.maxOutputTokens, 512);
    assert.equal(prettifyCalls[0]?.minP, 0.05);
    assert.equal(prettifyCalls[0]?.repeatPenalty, 1.1);
    assert.equal(prettifyCalls[0]?.seed, 7);
    assert.equal(prettifyCalls[0]?.temperature, 0.4);
    assert.equal(prettifyCalls[0]?.topK, 32);
    assert.equal(prettifyCalls[0]?.topP, 0.8);
  });

  it('keeps the previous clipboard when prettify fails', async () => {
    const { clipboard, notifications, service } = createTestService({
      selectionText: 'selected text',
      prettifyResult: { success: false, error: 'provider unavailable' },
    });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.error, 'provider unavailable');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, [
      { title: 'Prettify failed', body: 'provider unavailable', options: { sound: 'error' } },
    ]);
  });

  it('restores the clipboard when provider preparation fails before execution', async () => {
    const { clipboard, notifications, prepareCalls, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prepareResult: { success: false, error: 'CLI unavailable' },
    });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.error, 'CLI unavailable');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.equal(prepareCalls.length, 1);
    assert.equal(prettifyCalls.length, 0);
    assert.deepEqual(notifications, [
      { title: 'Prettify failed', body: 'CLI unavailable', options: { sound: 'error' } },
    ]);
  });

  it('restores the clipboard and shows provider errors', async () => {
    const cooldownError = 'Failed to connect to Ollama at http://127.0.0.1:11434: fetch failed';
    const { clipboard, notifications, service } = createTestService({
      selectionText: 'selected text',
      prettifyResult: { success: false, error: cooldownError },
    });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.error, 'Could not connect to Ollama. Make sure it is running and the URL is correct.');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, [
      {
        title: 'Prettify failed',
        body: 'Could not connect to Ollama. Make sure it is running and the URL is correct.',
        options: { sound: 'error' },
      },
    ]);
  });

  it('copies prettified text to the clipboard on success', async () => {
    const { clipboard, notifications, service } = createTestService({ selectionText: 'selected text' });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(result.status, 'Selection prettified');
    assert.equal(clipboard.clipboard, 'prettified text');
    assert.deepEqual(notifications, [
      { title: 'Text prettified', body: 'Selection prettified', options: { sound: 'success' } },
    ]);
  });

  it('copies cached prettified text for repeated selected text and settings', async () => {
    const { clipboard, notifications, prepareCalls, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'cached prettified text' },
    });

    const first = await service();
    const second = await service();

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(clipboard.clipboard, 'cached prettified text');
    assert.equal(prepareCalls.length, 2);
    assert.equal(prettifyCalls.length, 1);
    assert.deepEqual(notifications, [
      { title: 'Text prettified', body: 'Selection prettified', options: { sound: 'success' } },
      { title: 'Text prettified', body: 'Selection prettified', options: { sound: 'success' } },
    ]);
  });

  it('misses the cache when the prepared provider capability version changes', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      providerCacheContext: ['claude-cli', '2.1.71', '', '', 'default', 'prompt'],
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'first result' },
    });
    const second = createTestService({
      cache,
      providerCacheContext: ['claude-cli', '2.1.72', '', '', 'default', 'prompt'],
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'second result' },
    });

    await first.service();
    await second.service();

    assert.equal(first.prepareCalls.length, 1);
    assert.equal(second.prepareCalls.length, 1);
    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(second.clipboard.clipboard, 'second result');
  });

  it('misses the prettify cache when settings change', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      selectionText: 'selected text',
      prompt: 'same prompt',
      model: 'llama3.2',
      prettifyResult: { success: true, text: 'first result' },
    });
    const second = createTestService({
      cache,
      selectionText: 'selected text',
      prompt: 'same prompt',
      model: 'llama3.3',
      prettifyResult: { success: true, text: 'second result' },
    });

    await first.service();
    await second.service();

    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(second.clipboard.clipboard, 'second result');
  });

  it('misses the prettify cache when provider/base URL/model/temperature changes', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      selectionText: 'selected text',
      providerId: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2',
      temperature: 0,
      prettifyResult: { success: true, text: 'ollama result' },
    });
    const second = createTestService({
      cache,
      selectionText: 'selected text',
      providerId: 'vllm',
      baseUrl: 'http://127.0.0.1:8000/v1',
      model: 'qwen2.5',
      temperature: 0,
      prettifyResult: { success: true, text: 'vllm result' },
    });
    const third = createTestService({
      cache,
      selectionText: 'selected text',
      providerId: 'vllm',
      baseUrl: 'http://127.0.0.1:8001/v1',
      model: 'qwen2.5',
      temperature: 0.2,
      prettifyResult: { success: true, text: 'new vllm result' },
    });

    await first.service();
    await second.service();
    await third.service();

    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(third.prettifyCalls.length, 1);
    assert.equal(third.clipboard.clipboard, 'new vllm result');
  });

  it('misses the prettify cache when generation settings change', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      selectionText: 'selected text',
      maxOutputTokens: 0,
      minP: 0,
      repeatPenalty: 1,
      seed: null,
      topK: 40,
      topP: 0.9,
      prettifyResult: { success: true, text: 'default generation result' },
    });
    const second = createTestService({
      cache,
      selectionText: 'selected text',
      maxOutputTokens: 512,
      minP: 0.05,
      repeatPenalty: 1.1,
      seed: 7,
      topK: 32,
      topP: 0.8,
      prettifyResult: { success: true, text: 'custom generation result' },
    });

    await first.service();
    await second.service();

    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(second.clipboard.clipboard, 'custom generation result');
  });

  it('does not cache failed prettify results', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      selectionText: 'selected text',
      prettifyResult: { success: false, error: 'provider unavailable' },
    });
    const second = createTestService({
      cache,
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'prettified after failure' },
    });

    await first.service();
    const secondResult = await second.service();

    assert.equal(secondResult.success, true);
    assert.equal(first.prettifyCalls.length, 1);
    assert.equal(second.prettifyCalls.length, 1);
    assert.equal(second.clipboard.clipboard, 'prettified after failure');
  });

  it('silently skips duplicate concurrent hotkey presses', async () => {
    let finishPrettify!: () => void;
    const prettifyWait = new Promise<void>((resolve) => {
      finishPrettify = resolve;
    });
    const { notifications, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prettifyWait,
    });

    const first = service();
    const second = await service();
    finishPrettify();
    const firstResult = await first;

    assert.equal(second.success, false);
    assert.equal(second.skipped, true);
    assert.equal(second.status, '');
    assert.equal(firstResult.success, true);
    assert.equal(prettifyCalls.length, 1);
    assert.deepEqual(notifications, [
      { title: 'Text prettified', body: 'Selection prettified', options: { sound: 'success' } },
    ]);
  });

  it('silently skips prettify while translation is active', async () => {
    const actionGate = createSelectedTextActionGate();
    assert.equal(actionGate.tryBegin('translate'), true);
    const { automationCalls, notifications, prettifyCalls, service } = createTestService({
      actionGate,
      selectionText: 'selected text',
    });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.skipped, true);
    assert.deepEqual(automationCalls, []);
    assert.deepEqual(prettifyCalls, []);
    assert.deepEqual(notifications, []);
  });

  it('cancels an active prettify request, restores the clipboard, and suppresses late results', async () => {
    let finishPrettify!: () => void;
    const prettifyWait = new Promise<void>((resolve) => {
      finishPrettify = resolve;
    });
    const { clipboard, notifications, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prettifyWait,
    });

    const first = service();
    for (let attempts = 0; attempts < 5 && prettifyCalls.length === 0; attempts += 1) {
      await Promise.resolve();
    }
    const cancelResult = service.cancel();

    assert.equal(prettifyCalls.length, 1);
    assert.deepEqual(cancelResult, {
      cancelled: true,
      success: false,
      status: 'Prettify cancelled',
      error: 'Prettify cancelled',
    });
    assert.equal(prettifyCalls[0]?.signal?.aborted, true);
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, []);

    finishPrettify();
    const firstResult = await first;

    assert.deepEqual(firstResult, {
      cancelled: true,
      success: false,
      status: 'Prettify cancelled',
      error: 'Prettify cancelled',
    });
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, []);
  });

  it('cancels during provider preparation without executing generation', async () => {
    let finishPreparation!: () => void;
    const prepareWait = new Promise<void>((resolve) => {
      finishPreparation = resolve;
    });
    const { clipboard, notifications, prepareCalls, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prepareWait,
    });

    const active = service();
    for (let attempts = 0; attempts < 5 && prepareCalls.length === 0; attempts += 1) {
      await Promise.resolve();
    }
    const cancelled = service.cancel();
    finishPreparation();
    const result = await active;

    assert.equal(cancelled?.status, 'Prettify cancelled');
    assert.equal(cancelled?.cancelled, true);
    assert.equal(result.status, 'Prettify cancelled');
    assert.equal(result.cancelled, true);
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.equal(prettifyCalls.length, 0);
    assert.deepEqual(notifications, []);
  });

  it('returns null when cancelling with no active prettify request', () => {
    const { service } = createTestService({ selectionText: 'selected text' });

    assert.equal(service.cancel(), null);
  });

  it('allows a new prettify request after a cancelled run settles', async () => {
    let finishPrettify!: () => void;
    const prettifyWait = new Promise<void>((resolve) => {
      finishPrettify = resolve;
    });
    const { clipboard, prettifyCalls, service } = createTestService({ selectionText: 'selected text', prettifyWait });

    const first = service();
    for (let attempts = 0; attempts < 5 && prettifyCalls.length === 0; attempts += 1) {
      await Promise.resolve();
    }
    assert.equal(prettifyCalls.length, 1);
    assert.equal(service.cancel()?.status, 'Prettify cancelled');
    finishPrettify();
    await first;

    const second = await service();

    assert.equal(second.success, true);
    assert.equal(clipboard.clipboard, 'prettified text');
    assert.equal(prettifyCalls.length, 2);
  });
});
