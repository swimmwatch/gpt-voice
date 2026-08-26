import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { TranslationSettingsState, presentPendingTranslationSettingsRepairNotice } from '@main/translationSettings';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('translation settings startup notice', () => {
  it('consumes one aggregated sanitized repair notice per process', () => {
    const state = new TranslationSettingsState();
    const adversarialValue = 'private-invalid-provider-value';
    state.load(
      {
        providerId: adversarialValue,
        targetLanguageByProvider: {
          google: 'private-invalid-code',
        },
      },
      undefined,
      () => {},
    );
    const notifications: Array<{ body: string; title: string }> = [];
    const present = (): boolean =>
      presentPendingTranslationSettingsRepairNotice({
        notice: state.consumeRepairNotice(),
        notify: (title, body) => notifications.push({ body, title }),
        translate: (key) => `localized:${key}`,
      });

    assert.equal(present(), true);
    assert.equal(present(), false);
    assert.deepEqual(notifications, [
      {
        body: 'localized:notification.translationSettingsRepairedBody',
        title: 'localized:notification.translationSettingsRepaired',
      },
    ]);
    assert.equal(JSON.stringify(notifications).includes(adversarialValue), false);
  });

  it('keeps a notification-runtime failure nonblocking and one-shot', () => {
    const state = new TranslationSettingsState();
    state.load(undefined, 'ru', () => {});

    assert.doesNotThrow(() => {
      assert.equal(
        presentPendingTranslationSettingsRepairNotice({
          notice: state.consumeRepairNotice(),
          notify: () => {
            throw new Error('notifications unavailable');
          },
          translate: (key) => key,
        }),
        true,
      );
    });
    assert.equal(state.consumeRepairNotice(), null);
  });

  it('runs after locale setup and before IPC, windows, or startup coordination', () => {
    const application = readProjectFile('src/main/mainProcessApplication.ts');
    const loadIndex = application.indexOf('dependencies.config.load();');
    const localeIndex = application.indexOf('dependencies.localization.setLocale(', loadIndex);
    const noticeIndex = application.indexOf('presentPendingTranslationSettingsRepairNotice({', localeIndex);
    const ipcIndex = application.indexOf('runtime.registerIpc();', noticeIndex);
    const windowIndex = application.indexOf('this.dependencies.windowManager.createMainWindow();', noticeIndex);
    const startupIndex = application.indexOf('this.dependencies.firstLaunchStartupCoordinator.start()', noticeIndex);

    assert.equal(loadIndex >= 0, true);
    assert.equal(loadIndex < localeIndex, true);
    assert.equal(localeIndex < noticeIndex, true);
    assert.equal(noticeIndex < ipcIndex, true);
    assert.equal(noticeIndex < windowIndex, true);
    assert.equal(noticeIndex < startupIndex, true);
  });
});
