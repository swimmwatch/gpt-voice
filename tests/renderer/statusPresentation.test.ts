import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getRendererStatusDetail,
  notificationErrorStatus,
  renderRendererStatus,
  shouldPresentIdleHotkeyStatus,
  textActionStatusToRendererStatus,
  translatedStatus,
} from '@renderer/statusPresentation';
import { NotificationErrorCode, presentNotificationError } from '@shared/notifications';

describe('renderer status presentation', () => {
  it('translates semantic status with the current locale at render time', () => {
    const status = translatedStatus('status.pressToRecord', { hotkey: 'F9' });
    const english = (key: string, params?: Record<string, string>) => `${key}: ${params?.hotkey ?? ''}`;
    const spanish = (_key: string, params?: Record<string, string>) => `Grabar: ${params?.hotkey ?? ''}`;

    assert.equal(renderRendererStatus(status, english), 'status.pressToRecord: F9');
    assert.equal(renderRendererStatus(status, spanish), 'Grabar: F9');
  });

  it('maps finite text-action events and malformed payloads to safe semantic status', () => {
    const translated = (key: string) => key;

    const cases = [
      ['translation', 'working', 'status.translatingSelection'],
      ['translation', 'completed', 'status.translationCopied'],
      ['translation', 'failed', 'status.translationFailed'],
      ['translation', 'cancelled', 'status.translationCancelled'],
      ['translation', 'skipped', 'status.textActionSkipped'],
      ['prettify', 'working', 'status.prettifyingSelection'],
      ['prettify', 'completed', 'status.prettifiedSelection'],
      ['prettify', 'failed', 'status.prettifyFailed'],
      ['prettify', 'cancelled', 'status.prettifyCancelled'],
      ['prettify', 'skipped', 'status.textActionSkipped'],
    ] as const;

    for (const [action, phase, expected] of cases) {
      assert.equal(renderRendererStatus(textActionStatusToRendererStatus({ action, phase }), translated), expected);
    }

    assert.equal(renderRendererStatus(textActionStatusToRendererStatus(null), translated), 'error.notificationUnknown');
  });

  it('translates nested semantic parameters with the current locale', () => {
    const status = translatedStatus('status.browserInitFailed', {
      error: translatedStatus('error.notificationUnknown'),
    });
    const english = (key: string, params?: Record<string, string>) =>
      key === 'status.browserInitFailed' ? `Browser: ${params?.error}` : 'Something went wrong';
    const spanish = (key: string, params?: Record<string, string>) =>
      key === 'status.browserInitFailed' ? `Navegador: ${params?.error}` : 'Algo salió mal';

    assert.equal(renderRendererStatus(status, english), 'Browser: Something went wrong');
    assert.equal(renderRendererStatus(status, spanish), 'Navegador: Algo salió mal');
  });

  it('preserves classified notification metadata without preserving localized text', () => {
    const presented = presentNotificationError(
      'Failed to connect to Ollama at http://127.0.0.1:11434: TypeError: fetch failed',
      { context: 'generic' },
    );
    assert.equal(presented.code, NotificationErrorCode.ConnectionFailed);

    const status = notificationErrorStatus(presented);
    const translator = (key: string) => key;

    assert.equal(renderRendererStatus(status, translator), 'error.notificationUnknown');
  });

  it('maps every classified central-status failure to a concise safe translation key', () => {
    const expectedKeys = {
      [NotificationErrorCode.AudioPreparationFailed]: 'error.notificationAudioPreparationFailed',
      [NotificationErrorCode.ClipboardUnavailable]: 'error.notificationClipboardUnavailable',
      [NotificationErrorCode.ConnectionFailed]: 'error.notificationUnknown',
      [NotificationErrorCode.HumanReadable]: 'error.notificationUnknown',
      [NotificationErrorCode.NotConfigured]: 'error.notificationUnknown',
      [NotificationErrorCode.OperationTimedOut]: 'error.notificationOperationTimedOut',
      [NotificationErrorCode.ProviderRequestFailed]: 'error.notificationUnknown',
      [NotificationErrorCode.RateLimited]: 'error.notificationUnknown',
      [NotificationErrorCode.UnexpectedProviderResponse]: 'error.notificationUnexpectedProviderResponse',
      [NotificationErrorCode.Unknown]: 'error.notificationUnknown',
    } as const;

    for (const code of Object.values(NotificationErrorCode)) {
      assert.equal(notificationErrorStatus({ code }).key, expectedKeys[code]);
    }
  });

  it('keeps only non-duplicate semantic status in the central detail area', () => {
    assert.equal(getRendererStatusDetail(translatedStatus('status.pressToRecord'), 'idle'), null);
    assert.equal(getRendererStatusDetail(translatedStatus('status.recording'), 'recording'), null);
    assert.equal(getRendererStatusDetail(translatedStatus('status.paused'), 'paused'), null);
    assert.equal(getRendererStatusDetail(translatedStatus('status.transcribing'), 'transcribing'), null);
    assert.deepEqual(getRendererStatusDetail(translatedStatus('status.recordingCancelled'), 'idle'), {
      kind: 'translation',
      key: 'status.recordingCancelled',
    });
  });

  it('does not replace active or preserved status with the idle hotkey prompt', () => {
    assert.equal(shouldPresentIdleHotkeyStatus('idle', false), true);
    assert.equal(shouldPresentIdleHotkeyStatus('recording', false), false);
    assert.equal(shouldPresentIdleHotkeyStatus('paused', false), false);
    assert.equal(shouldPresentIdleHotkeyStatus('idle', true), false);
  });
});
