import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '@main/i18n';
import {
  createSelectedTextPromptCompressionService,
  type SelectedTextPromptCompressionDependencies,
} from '@main/services/selectedTextPromptCompression';
import { createSelectedTextActionGate, type SelectedTextActionGate } from '@main/services/selectedTextActionState';
import { createTextActionResultCache, type TextActionResultCache } from '@main/services/textActionCache';
import type { ClipboardType } from '@main/electronRuntime';
import type { SystemNotificationOptions } from '@shared/notifications';

interface TestServiceOptions {
  actionGate?: SelectedTextActionGate;
  cache?: TextActionResultCache;
  cacheContext?: readonly string[];
  copiedText?: string;
  copyError?: Error;
  platform?: NodeJS.Platform;
  selectionText?: string;
  processResult?: { success: boolean; text?: string; fallback?: boolean; error?: string };
  processWait?: Promise<void>;
}

function createTestService(options: TestServiceOptions = {}) {
  const clipboard = {
    clipboard: 'previous clipboard',
    selection: options.selectionText || '',
  };
  const notifications: Array<{ title: string; body: string; options?: SystemNotificationOptions }> = [];
  const automationCalls: string[] = [];
  const waitCalls: number[] = [];
  const processCalls: Array<{ text: string; signal?: AbortSignal }> = [];

  const deps: SelectedTextPromptCompressionDependencies = {
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
    getCacheContext: () => options.cacheContext || ['headroom'],
    notify: (title, body, options) => {
      notifications.push({ title, body, options });
    },
    platform: options.platform || 'linux',
    processPrompt: async (text, signal) => {
      processCalls.push({ text, signal });
      await options.processWait;
      return options.processResult || { success: true, text: 'compressed prompt' };
    },
    wait: async (delayMs) => {
      waitCalls.push(delayMs);
    },
  };

  return {
    automationCalls,
    clipboard,
    notifications,
    processCalls,
    service: createSelectedTextPromptCompressionService(deps),
    waitCalls,
  };
}

describe('selectedTextPromptCompression', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('keeps the clipboard and fails clearly when no text is selected', async () => {
    const { clipboard, notifications, service } = createTestService();

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.error, 'No text selected to compress');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, [
      { title: 'Prompt compression failed', body: 'No text selected to compress', options: { sound: 'error' } },
    ]);
  });

  it('uses the Linux selection clipboard', async () => {
    const { automationCalls, clipboard, processCalls, service, waitCalls } = createTestService({
      copyError: new Error('copy unavailable'),
      selectionText: 'primary selection',
    });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(clipboard.clipboard, 'compressed prompt');
    assert.deepEqual(automationCalls, ['copy']);
    assert.deepEqual(waitCalls, []);
    assert.equal(processCalls.length, 1);
    assert.equal(processCalls[0]?.text, 'primary selection');
    assert.equal(processCalls[0]?.signal instanceof AbortSignal, true);
  });

  it('copies the compressed prompt to the clipboard on success', async () => {
    const { clipboard, notifications, service } = createTestService({ selectionText: 'selected prompt' });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(result.status, 'Compressed prompt copied');
    assert.equal(clipboard.clipboard, 'compressed prompt');
    assert.deepEqual(notifications, [
      { title: 'Compressed prompt copied', body: 'Compressed prompt copied', options: { sound: 'success' } },
    ]);
  });

  it('copies fallback prompt output without caching it', async () => {
    const { clipboard, notifications, processCalls, service } = createTestService({
      selectionText: 'selected prompt',
      processResult: { success: true, text: 'selected prompt', fallback: true },
    });

    const first = await service();
    const second = await service();

    assert.equal(first.success, true);
    assert.equal(first.status, 'Original prompt copied without compression');
    assert.equal(second.success, true);
    assert.equal(clipboard.clipboard, 'selected prompt');
    assert.equal(processCalls.length, 2);
    assert.deepEqual(notifications, [
      {
        title: 'Original prompt copied',
        body: 'Original prompt copied without compression',
        options: { sound: 'success' },
      },
      {
        title: 'Original prompt copied',
        body: 'Original prompt copied without compression',
        options: { sound: 'success' },
      },
    ]);
  });

  it('copies cached compressed prompts for repeated selected text and context', async () => {
    const { clipboard, notifications, processCalls, service } = createTestService({
      selectionText: 'selected prompt',
      processResult: { success: true, text: 'cached compressed prompt' },
    });

    const first = await service();
    const second = await service();

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(clipboard.clipboard, 'cached compressed prompt');
    assert.equal(processCalls.length, 1);
    assert.deepEqual(notifications, [
      { title: 'Compressed prompt copied', body: 'Compressed prompt copied', options: { sound: 'success' } },
      { title: 'Compressed prompt copied', body: 'Compressed prompt copied', options: { sound: 'success' } },
    ]);
  });

  it('silently skips prompt compression while translation is active', async () => {
    const actionGate = createSelectedTextActionGate();
    assert.equal(actionGate.tryBegin('translate'), true);
    const { automationCalls, notifications, processCalls, service } = createTestService({
      actionGate,
      selectionText: 'selected prompt',
    });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.skipped, true);
    assert.deepEqual(automationCalls, []);
    assert.deepEqual(processCalls, []);
    assert.deepEqual(notifications, []);
  });

  it('cancels an active prompt compression request and restores the clipboard', async () => {
    let finishProcess!: () => void;
    const processWait = new Promise<void>((resolve) => {
      finishProcess = resolve;
    });
    const { clipboard, notifications, processCalls, service } = createTestService({
      selectionText: 'selected prompt',
      processWait,
    });

    const first = service();
    for (let attempts = 0; attempts < 5 && processCalls.length === 0; attempts += 1) {
      await Promise.resolve();
    }
    const cancelResult = service.cancel();

    assert.equal(processCalls.length, 1);
    assert.deepEqual(cancelResult, {
      success: false,
      status: 'Prompt compression cancelled',
      error: 'Prompt compression cancelled',
    });
    assert.equal(processCalls[0]?.signal?.aborted, true);
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, []);

    finishProcess();
    const firstResult = await first;

    assert.deepEqual(firstResult, {
      success: false,
      status: 'Prompt compression cancelled',
      error: 'Prompt compression cancelled',
    });
    assert.equal(clipboard.clipboard, 'previous clipboard');
  });
});
