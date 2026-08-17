import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperModelLoadFailureNotifier } from '@main/localWhisper/ipc/LocalWhisperModelLoadFailureNotifier';

describe('LocalWhisperModelLoadFailureNotifier', () => {
  it('shows a localized system error with the error sound and no untrusted detail', () => {
    const shown: { readonly title: string; readonly body: string; readonly sound: string | undefined }[] = [];
    const notifier = new LocalWhisperModelLoadFailureNotifier({
      localization: {
        translate: (key, params) => `${key}:${params?.code ?? ''}`,
      },
      logger: { warn: () => undefined },
      notification: {
        show: (title, body, options) => shown.push({ title, body, sound: options?.sound }),
      },
    });

    notifier.notify('INSUFFICIENT_RAM');

    assert.deepEqual(shown, [
      {
        title: 'localWhisper.main.operationFailed:',
        body: 'localWhisper.main.operationFailedCode:INSUFFICIENT_RAM',
        sound: 'error',
      },
    ]);
  });

  it('contains notification delivery failures and records only the safe failure code', () => {
    const warnings: unknown[][] = [];
    const notifier = new LocalWhisperModelLoadFailureNotifier({
      localization: { translate: () => 'safe message' },
      logger: { warn: (...args) => warnings.push(args) },
      notification: {
        show: () => {
          throw new Error('private notification failure');
        },
      },
    });

    notifier.notify('MODEL_LOAD_FAILED');

    assert.deepEqual(warnings, [
      ['Failed to show Local Whisper model-load failure notification', { code: 'MODEL_LOAD_FAILED' }],
    ]);
  });
});
