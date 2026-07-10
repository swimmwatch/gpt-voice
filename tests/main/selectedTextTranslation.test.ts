import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '@main/i18n';
import {
  createSelectedTextTranslationService,
  type SelectedTextTranslationDependencies,
} from '@main/services/selectedTextTranslation';
import { createSelectedTextActionGate, type SelectedTextActionGate } from '@main/services/selectedTextActionState';
import { createTextActionResultCache, type TextActionResultCache } from '@main/services/textActionCache';
import type { ClipboardType } from '@main/electronRuntime';
import type { TextAutomationAction } from '@main/services/textAutomation';
import type { SystemNotificationOptions } from '@shared/notifications';

interface TestServiceOptions {
  actionGate?: SelectedTextActionGate;
  cache?: TextActionResultCache;
  copyFails?: boolean;
  copyText?: string;
  selectionText?: string;
  targetLang?: string;
  translateResult?: { success: boolean; text?: string; error?: string };
  translateWait?: Promise<void>;
}

function createTestService(options: TestServiceOptions = {}) {
  const clipboard = {
    clipboard: 'previous clipboard',
    selection: options.selectionText || '',
  };
  const actions: TextAutomationAction[] = [];
  const notifications: Array<{ title: string; body: string; options?: SystemNotificationOptions }> = [];
  const translations: Array<{ text: string; targetLang: string }> = [];

  const deps: SelectedTextTranslationDependencies = {
    actionGate: options.actionGate || createSelectedTextActionGate(),
    automateTextAction: async (action) => {
      actions.push(action);
      if (action === 'copy' && options.copyFails) {
        throw new Error('xdotool is required for selected-text translation');
      }
      if (action === 'copy' && options.copyText !== undefined) {
        clipboard.clipboard = options.copyText;
      }
    },
    clipboard: {
      readText: (type?: ClipboardType) => clipboard[type || 'clipboard'],
      writeText: (text: string, type?: ClipboardType) => {
        clipboard[type || 'clipboard'] = text;
      },
    },
    cache: options.cache || createTextActionResultCache(20),
    getTargetLang: () => options.targetLang || 'uk',
    notify: (title, body, options) => {
      notifications.push({ title, body, options });
    },
    platform: 'linux',
    translate: async (text, targetLang) => {
      translations.push({ text, targetLang });
      await options.translateWait;
      return options.translateResult || { success: true, text: 'translated text' };
    },
    wait: async () => {},
  };

  return {
    actions,
    clipboard,
    notifications,
    service: createSelectedTextTranslationService(deps),
    translations,
  };
}

describe('selectedTextTranslation', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('restores the clipboard and fails clearly when no text is selected', async () => {
    const { actions, clipboard, notifications, service } = createTestService();

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.error, 'No text selected to translate');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(actions, ['copy']);
    assert.deepEqual(notifications, [
      { title: 'Translation failed', body: 'No text selected to translate', options: { sound: 'error' } },
    ]);
  });

  it('uses the Linux selection clipboard fallback when normal copy is empty', async () => {
    const { actions, clipboard, service, translations } = createTestService({ selectionText: 'primary selection' });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(clipboard.clipboard, 'translated text');
    assert.deepEqual(actions, ['copy']);
    assert.deepEqual(translations, [{ text: 'primary selection', targetLang: 'uk' }]);
  });

  it('uses the Linux selection clipboard fallback when copy automation is unavailable', async () => {
    const { actions, clipboard, service, translations } = createTestService({
      copyFails: true,
      selectionText: 'primary selection',
    });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(result.status, 'Translation copied');
    assert.equal(clipboard.clipboard, 'translated text');
    assert.deepEqual(actions, ['copy']);
    assert.deepEqual(translations, [{ text: 'primary selection', targetLang: 'uk' }]);
  });

  it('returns no selected text when copy automation fails and the selection clipboard is empty', async () => {
    const { actions, clipboard, notifications, service } = createTestService({ copyFails: true });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.error, 'No text selected to translate');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(actions, ['copy']);
    assert.deepEqual(notifications, [
      { title: 'Translation failed', body: 'No text selected to translate', options: { sound: 'error' } },
    ]);
  });

  it('restores the clipboard when translation fails', async () => {
    const { clipboard, notifications, service } = createTestService({
      copyText: 'selected text',
      translateResult: { success: false, error: 'provider unavailable' },
    });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.error, 'provider unavailable');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, [
      { title: 'Translation failed', body: 'provider unavailable', options: { sound: 'error' } },
    ]);
  });

  it('sanitizes translation timeout failures in notification and returned status', async () => {
    const { clipboard, notifications, service } = createTestService({
      copyText: 'selected text',
      translateResult: {
        success: false,
        error: 'TimeoutError: page.waitForFunction: Timeout 30000ms exceeded.\nCall log:\n  - waiting for locator',
      },
    });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.error, 'The operation timed out. Try again.');
    assert.equal(result.status, 'The operation timed out. Try again.');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(notifications, [
      { title: 'Translation failed', body: 'The operation timed out. Try again.', options: { sound: 'error' } },
    ]);
  });

  it('copies translated text to the clipboard on success', async () => {
    const { actions, clipboard, notifications, service } = createTestService({ copyText: 'selected text' });

    const result = await service();

    assert.equal(result.success, true);
    assert.equal(result.status, 'Translation copied');
    assert.equal(clipboard.clipboard, 'translated text');
    assert.deepEqual(actions, ['copy']);
    assert.deepEqual(notifications, [
      { title: 'Translation copied', body: 'translated text', options: { sound: 'success' } },
    ]);
  });

  it('copies cached translated text for repeated selected text and language', async () => {
    const { clipboard, notifications, service, translations } = createTestService({
      copyText: 'selected text',
      translateResult: { success: true, text: 'cached translation' },
    });

    const first = await service();
    const second = await service();

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(clipboard.clipboard, 'cached translation');
    assert.deepEqual(translations, [{ text: 'selected text', targetLang: 'uk' }]);
    assert.deepEqual(notifications, [
      { title: 'Translation copied', body: 'cached translation', options: { sound: 'success' } },
      { title: 'Translation copied', body: 'cached translation', options: { sound: 'success' } },
    ]);
  });

  it('misses the translation cache when target language changes', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      copyText: 'selected text',
      targetLang: 'uk',
      translateResult: { success: true, text: 'uk translation' },
    });
    const second = createTestService({
      cache,
      copyText: 'selected text',
      targetLang: 'ru',
      translateResult: { success: true, text: 'ru translation' },
    });

    await first.service();
    await second.service();

    assert.deepEqual(first.translations, [{ text: 'selected text', targetLang: 'uk' }]);
    assert.deepEqual(second.translations, [{ text: 'selected text', targetLang: 'ru' }]);
    assert.equal(second.clipboard.clipboard, 'ru translation');
  });

  it('does not cache failed translations', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      copyText: 'selected text',
      translateResult: { success: false, error: 'provider unavailable' },
    });
    const second = createTestService({
      cache,
      copyText: 'selected text',
      translateResult: { success: true, text: 'translated after failure' },
    });

    await first.service();
    const secondResult = await second.service();

    assert.equal(secondResult.success, true);
    assert.deepEqual(first.translations, [{ text: 'selected text', targetLang: 'uk' }]);
    assert.deepEqual(second.translations, [{ text: 'selected text', targetLang: 'uk' }]);
    assert.equal(second.clipboard.clipboard, 'translated after failure');
  });

  it('silently skips duplicate concurrent hotkey presses', async () => {
    let finishTranslation!: () => void;
    const translateWait = new Promise<void>((resolve) => {
      finishTranslation = resolve;
    });
    const { notifications, service, translations } = createTestService({ copyText: 'selected text', translateWait });

    const first = service();
    const second = await service();
    finishTranslation();
    const firstResult = await first;

    assert.equal(second.success, false);
    assert.equal(second.skipped, true);
    assert.equal(second.status, '');
    assert.equal(firstResult.success, true);
    assert.deepEqual(translations, [{ text: 'selected text', targetLang: 'uk' }]);
    assert.deepEqual(notifications, [
      { title: 'Translation copied', body: 'translated text', options: { sound: 'success' } },
    ]);
  });

  it('silently skips translation while prettify is active', async () => {
    const actionGate = createSelectedTextActionGate();
    assert.equal(actionGate.tryBegin('prettify'), true);
    const { actions, notifications, service, translations } = createTestService({
      actionGate,
      copyText: 'selected text',
    });

    const result = await service();

    assert.equal(result.success, false);
    assert.equal(result.skipped, true);
    assert.deepEqual(actions, []);
    assert.deepEqual(translations, []);
    assert.deepEqual(notifications, []);
  });
});
