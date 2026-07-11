import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNotificationBody,
  getNotificationErrorMessage,
  getNotificationSoundKind,
  NotificationErrorCode,
  presentNotificationError,
} from '@shared/notifications';

const translations: Record<string, string> = {
  'error.notificationAudioPreparationFailed': 'Could not prepare the recording. Try recording again.',
  'error.notificationClipboardUnavailable': 'Could not read the selected text. Check the selection and try again.',
  'error.notificationConnectionFailed':
    'Could not connect to {service}. Make sure it is running and the URL is correct.',
  'error.notificationOperationTimedOut': 'The operation timed out. Try again.',
  'error.notificationProviderRequestFailed':
    '{service} returned an error ({status}). Try again or check provider settings.',
  'error.notificationUnexpectedProviderResponse': 'The service returned an unexpected response. Try again.',
  'error.notificationUnknown': 'Something went wrong. Try again.',
};

function t(key: string, params: Record<string, string> = {}): string {
  let value = translations[key] || key;
  for (const [name, replacement] of Object.entries(params)) {
    value = value.split(`{${name}}`).join(replacement);
  }
  return value;
}

describe('notifications', () => {
  it('normalizes notification body text from strings and errors', () => {
    assert.equal(formatNotificationBody('  provider\n unavailable  ', 'fallback'), 'provider unavailable');
    assert.equal(formatNotificationBody(new Error('  failed\tbadly  '), 'fallback'), 'failed badly');
  });

  it('falls back when no error message is available', () => {
    assert.equal(getNotificationErrorMessage({ message: 'ignored' }), '');
    assert.equal(formatNotificationBody({ message: 'ignored' }, 'Fallback body'), 'Fallback body');
  });

  it('truncates long notification bodies', () => {
    const body = 'a'.repeat(130);

    assert.equal(formatNotificationBody(body, 'fallback'), `${'a'.repeat(117)}...`);
  });

  it('sanitizes raw stack traces into a generic human message', () => {
    const presented = presentNotificationError(
      new Error('Error: provider failed\n    at /home/user/project/src/main/provider.ts:10:1'),
      { context: 'prettify', fallback: 'Prettify failed', t },
    );

    assert.equal(presented.code, NotificationErrorCode.Unknown);
    assert.equal(presented.userMessage, 'Something went wrong. Try again.');
    assert.equal(presented.safeLogMetadata.hasStackTrace, true);
    assert.equal('rawMessage' in presented.safeLogMetadata, false);
  });

  it('does not preserve rate-limit-looking messages when they contain a stack trace', () => {
    const presented = presentNotificationError(
      new Error('Error: Too many requests\n    at /home/user/project/src/main/provider.ts:10:1'),
      { context: 'prettify', fallback: 'Prettify failed', t },
    );

    assert.equal(presented.code, NotificationErrorCode.Unknown);
    assert.equal(presented.userMessage, 'Something went wrong. Try again.');
    assert.equal(presented.safeLogMetadata.wasSanitized, true);
  });

  it('turns provider connection failures into service-specific guidance', () => {
    const presented = presentNotificationError(
      'Failed to connect to Ollama at http://127.0.0.1:11434: TypeError: fetch failed',
      { context: 'prettify', fallback: 'Prettify failed', t },
    );

    assert.equal(presented.code, NotificationErrorCode.ConnectionFailed);
    assert.equal(presented.userMessage, 'Could not connect to Ollama. Make sure it is running and the URL is correct.');
    assert.deepEqual(presented.safeLogMetadata.service, 'Ollama');
  });

  it('turns provider HTTP status failures into concise provider messages', () => {
    const presented = presentNotificationError('Ollama request failed (500)', {
      context: 'prettify',
      fallback: 'Prettify failed',
      t,
    });

    assert.equal(presented.code, NotificationErrorCode.ProviderRequestFailed);
    assert.equal(presented.userMessage, 'Ollama returned an error (500). Try again or check provider settings.');
    assert.equal(presented.safeLogMetadata.status, 500);
  });

  it('turns Playwright timeout dumps into timeout messages', () => {
    const presented = presentNotificationError(
      'TimeoutError: page.waitForFunction: Timeout 30000ms exceeded.\nCall log:\n  - waiting for locator',
      { context: 'translation', fallback: 'Translation failed', t },
    );

    assert.equal(presented.code, NotificationErrorCode.OperationTimedOut);
    assert.equal(presented.userMessage, 'The operation timed out. Try again.');
    assert.equal(presented.safeLogMetadata.hasStackTrace, false);
  });

  it('turns raw browser network-change call logs into a connection message', () => {
    const presented = presentNotificationError(
      new Error('page.goto: net::ERR_NETWORK_CHANGED at https://chatgpt.com/\nCall log:\n- navigating to ChatGPT'),
      { context: 'generic', fallback: 'Browser initialization failed', t },
    );

    assert.equal(presented.code, NotificationErrorCode.ConnectionFailed);
    assert.equal(
      presented.userMessage,
      'Could not connect to the service. Make sure it is running and the URL is correct.',
    );
    assert.equal(presented.safeLogMetadata.wasSanitized, true);
  });

  it('preserves existing human-readable localized messages', () => {
    const presented = presentNotificationError('No text selected to prettify', {
      context: 'prettify',
      fallback: 'Prettify failed',
      t,
    });

    assert.equal(presented.code, NotificationErrorCode.HumanReadable);
    assert.equal(presented.userMessage, 'No text selected to prettify');
  });

  it('does not preserve configuration-looking messages when they contain technical details', () => {
    const presented = presentNotificationError(
      'Error: API key not configured\n    at /home/user/project/src/main/provider.ts:10:1',
      { context: 'transcription', fallback: 'Transcription failed', t },
    );

    assert.equal(presented.code, NotificationErrorCode.Unknown);
    assert.equal(presented.userMessage, 'Something went wrong. Try again.');
    assert.equal(presented.safeLogMetadata.hasFilePath, true);
  });

  it('still truncates long human-readable messages after presentation', () => {
    const body = 'a'.repeat(130);

    assert.equal(formatNotificationBody(body, 'fallback', { context: 'generic', t }), `${'a'.repeat(117)}...`);
  });

  it('returns only supported notification sound kinds', () => {
    assert.equal(getNotificationSoundKind({ sound: 'success' }), 'success');
    assert.equal(getNotificationSoundKind({ sound: 'error' }), 'error');
    assert.equal(getNotificationSoundKind(), null);
    assert.equal(getNotificationSoundKind({}), null);
  });
});
