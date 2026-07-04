import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '@main/i18n';
import {
  createSelectedTextPrettifyService,
  type SelectedTextPrettifyDependencies,
} from '@main/services/selectedTextPrettify';
import type { ClipboardType } from '@main/electronRuntime';
import type { SystemNotificationOptions } from '@shared/notifications';

interface TestServiceOptions {
  copiedText?: string;
  copyError?: Error;
  platform?: NodeJS.Platform;
  selectionText?: string;
  prettifyResult?: { success: boolean; text?: string; error?: string };
  prettifyWait?: Promise<void>;
}

function createTestService(options: TestServiceOptions = {}) {
  const clipboard = {
    clipboard: 'previous clipboard',
    selection: options.selectionText || '',
  };
  const notifications: Array<{ title: string; body: string; options?: SystemNotificationOptions }> = [];
  const automationCalls: string[] = [];
  const waitCalls: number[] = [];
  const prettifyCalls: Array<{ text: string; prompt: string; reasoning: string; signal?: AbortSignal }> = [];

  const deps: SelectedTextPrettifyDependencies = {
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
    getPrettifySettings: () => ({ prompt: 'prompt', reasoning: 'instant' }),
    notify: (title, body, options) => {
      notifications.push({ title, body, options });
    },
    platform: options.platform || 'linux',
    prettify: async (text, settings) => {
      prettifyCalls.push({ text, prompt: settings.prompt, reasoning: settings.reasoning, signal: settings.signal });
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
    assert.equal(result.error, 'No selected text');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, [
      { title: 'Prettify failed', body: 'No selected text', options: { sound: 'error' } },
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
    assert.equal(prettifyCalls[0]?.reasoning, 'instant');
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

  it('returns an in-progress error for concurrent hotkey presses', async () => {
    let finishPrettify!: () => void;
    const prettifyWait = new Promise<void>((resolve) => {
      finishPrettify = resolve;
    });
    const { service } = createTestService({ selectionText: 'selected text', prettifyWait });

    const first = service();
    const second = await service();
    finishPrettify();
    const firstResult = await first;

    assert.equal(second.success, false);
    assert.equal(second.error, 'Prettify already in progress');
    assert.equal(firstResult.success, true);
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
    const { clipboard, service } = createTestService({ selectionText: 'selected text', prettifyWait });

    const first = service();
    await Promise.resolve();
    assert.equal(service.cancel()?.status, 'Prettify cancelled');
    finishPrettify();
    await first;

    const second = await service();

    assert.equal(second.success, true);
    assert.equal(clipboard.clipboard, 'prettified text');
  });
});
