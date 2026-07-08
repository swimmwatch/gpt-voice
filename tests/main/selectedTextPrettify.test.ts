import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '@main/i18n';
import {
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
  model?: string;
  temperature?: number;
  selectionText?: string;
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
    prompt: options.prompt || 'prompt',
    providerId,
    temperature: options.temperature ?? DEFAULT_PRETTIFY_SETTINGS.temperature,
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
  const prettifyCalls: Array<{
    text: string;
    providerId: PrettifyProviderId;
    prompt: string;
    model: string;
    baseUrl: string;
    temperature: number;
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
    prettify: async (text, settings) => {
      const typedSettings = settings as PrettifySettings & { signal?: AbortSignal };
      const providerSettings = typedSettings.providerId === 'vllm' ? typedSettings.vllm : typedSettings.ollama;
      prettifyCalls.push({
        text,
        providerId: typedSettings.providerId,
        prompt: typedSettings.prompt,
        model: providerSettings.model,
        baseUrl: providerSettings.baseUrl,
        temperature: typedSettings.temperature,
        signal: typedSettings.signal,
      });
      await options.prettifyWait;
      return options.prettifyResult || { success: true, text: 'prettified text' };
    },
    wait: async (delayMs) => {
      waitCalls.push(delayMs);
    },
  };

  return {
    automationCalls,
    clipboard,
    notifications,
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
      temperature: 0.4,
      selectionText: 'selected text',
    });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(prettifyCalls.length, 1);
    assert.equal(prettifyCalls[0]?.providerId, 'vllm');
    assert.equal(prettifyCalls[0]?.baseUrl, 'http://127.0.0.1:9000/v1');
    assert.equal(prettifyCalls[0]?.model, 'qwen3');
    assert.equal(prettifyCalls[0]?.temperature, 0.4);
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

  it('restores the clipboard and shows provider errors', async () => {
    const cooldownError = 'Failed to connect to Ollama at http://127.0.0.1:11434: fetch failed';
    const { clipboard, notifications, service } = createTestService({
      selectionText: 'selected text',
      prettifyResult: { success: false, error: cooldownError },
    });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.error, cooldownError);
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, [{ title: 'Prettify failed', body: cooldownError, options: { sound: 'error' } }]);
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
    const { clipboard, notifications, prettifyCalls, service } = createTestService({
      selectionText: 'selected text',
      prettifyResult: { success: true, text: 'cached prettified text' },
    });

    const first = await service();
    const second = await service();

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(clipboard.clipboard, 'cached prettified text');
    assert.equal(prettifyCalls.length, 1);
    assert.deepEqual(notifications, [
      { title: 'Text prettified', body: 'Selection prettified', options: { sound: 'success' } },
      { title: 'Text prettified', body: 'Selection prettified', options: { sound: 'success' } },
    ]);
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
      success: false,
      status: 'Prettify cancelled',
      error: 'Prettify cancelled',
    });
    assert.equal(clipboard.clipboard, 'previous clipboard');
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
