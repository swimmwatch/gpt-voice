import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '@main/i18n';
import {
  createSelectedTextPrettifyService,
  type SelectedTextPrettifyDependencies,
} from '@main/services/selectedTextPrettify';
import type { ClipboardType } from '@main/electronRuntime';

interface TestServiceOptions {
  selectionText?: string;
  prettifyResult?: { success: boolean; text?: string; error?: string };
  prettifyWait?: Promise<void>;
}

function createTestService(options: TestServiceOptions = {}) {
  const clipboard = {
    clipboard: 'previous clipboard',
    selection: options.selectionText || '',
  };
  const notifications: Array<{ title: string; body: string }> = [];
  const prettifyCalls: Array<{ text: string; prompt: string; reasoning: string }> = [];

  const deps: SelectedTextPrettifyDependencies = {
    clipboard: {
      readText: (type?: ClipboardType) => clipboard[type || 'clipboard'],
      writeText: (text: string, type?: ClipboardType) => {
        clipboard[type || 'clipboard'] = text;
      },
    },
    getPrettifySettings: () => ({ prompt: 'prompt', reasoning: 'instant' }),
    notify: (title, body) => {
      notifications.push({ title, body });
    },
    platform: 'linux',
    prettify: async (text, settings) => {
      prettifyCalls.push({ text, prompt: settings.prompt, reasoning: settings.reasoning });
      await options.prettifyWait;
      return options.prettifyResult || { success: true, text: 'prettified text' };
    },
  };

  return {
    clipboard,
    notifications,
    prettifyCalls,
    service: createSelectedTextPrettifyService(deps),
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
    assert.deepEqual(notifications, [{ title: 'Prettify failed', body: 'No selected text' }]);
  });

  it('uses the Linux selection clipboard', async () => {
    const { clipboard, prettifyCalls, service } = createTestService({
      selectionText: 'primary selection',
    });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(clipboard.clipboard, 'prettified text');
    assert.deepEqual(prettifyCalls, [{ text: 'primary selection', prompt: 'prompt', reasoning: 'instant' }]);
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
    assert.deepEqual(notifications, [{ title: 'Prettify failed', body: 'provider unavailable' }]);
  });

  it('copies prettified text to the clipboard on success', async () => {
    const { clipboard, notifications, service } = createTestService({ selectionText: 'selected text' });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(result.status, 'Selection prettified');
    assert.equal(clipboard.clipboard, 'prettified text');
    assert.deepEqual(notifications, [{ title: 'Text prettified', body: 'Selection prettified' }]);
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
});
