import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  literalStatus,
  notificationErrorStatus,
  renderRendererStatus,
  shouldPresentIdleHotkeyStatus,
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

  it('keeps external literal status unchanged across locale renderers', () => {
    const status = literalStatus('External status');

    assert.equal(
      renderRendererStatus(status, () => 'translated'),
      'External status',
    );
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
    const translator = (key: string, params?: Record<string, string>) => `${key}:${params?.service ?? ''}`;

    assert.equal(renderRendererStatus(status, translator), 'error.notificationConnectionFailed:Ollama');
  });

  it('does not replace active or preserved status with the idle hotkey prompt', () => {
    assert.equal(shouldPresentIdleHotkeyStatus('idle', false), true);
    assert.equal(shouldPresentIdleHotkeyStatus('recording', false), false);
    assert.equal(shouldPresentIdleHotkeyStatus('paused', false), false);
    assert.equal(shouldPresentIdleHotkeyStatus('idle', true), false);
  });
});
