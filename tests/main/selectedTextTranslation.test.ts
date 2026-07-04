import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '@main/i18n';
import {
  createSelectedTextTranslationService,
  type SelectedTextTranslationDependencies,
} from '@main/services/selectedTextTranslation';
import type { ClipboardType } from '@main/electronRuntime';
import type { TextAutomationAction } from '@main/services/textAutomation';
import type { SystemNotificationOptions } from '@shared/notifications';

interface TestServiceOptions {
  copyFails?: boolean;
  copyText?: string;
  selectionText?: string;
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
    getTargetLang: () => 'uk',
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
    assert.equal(result.error, 'No selected text');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(actions, ['copy']);
    assert.deepEqual(notifications, [
      { title: 'Translation failed', body: 'No selected text', options: { sound: 'error' } },
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
    assert.equal(result.error, 'No selected text');
    assert.equal(clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(actions, ['copy']);
    assert.deepEqual(notifications, [
      { title: 'Translation failed', body: 'No selected text', options: { sound: 'error' } },
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

  it('returns an in-progress error for concurrent hotkey presses', async () => {
    let finishTranslation!: () => void;
    const translateWait = new Promise<void>((resolve) => {
      finishTranslation = resolve;
    });
    const { service } = createTestService({ copyText: 'selected text', translateWait });

    const first = service();
    const second = await service();
    finishTranslation();
    const firstResult = await first;

    assert.equal(second.success, false);
    assert.equal(second.error, 'Translation already in progress');
    assert.equal(firstResult.success, true);
  });
});
