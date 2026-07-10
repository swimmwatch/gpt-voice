import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  showTranscriptionFailureNotification,
  showTranscriptionSuccessNotification,
} from '@renderer/recordingNotifications';
import type { SystemNotificationOptions } from '@shared/notifications';

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
  'notification.textCopied': 'Text copied',
  'notification.transcriptionFailed': 'Recognition failed',
};

function t(key: string, params: Record<string, string> = {}): string {
  let value = translations[key] || key;
  for (const [name, replacement] of Object.entries(params)) {
    value = value.split(`{${name}}`).join(replacement);
  }
  return value;
}

function createNotificationApi() {
  const notifications: Array<{ title: string; body: string; options?: SystemNotificationOptions }> = [];
  return {
    notifications,
    api: {
      showNotification: async (title: string, body: string, options?: SystemNotificationOptions) => {
        notifications.push({ title, body, options });
      },
    },
  };
}

describe('recordingNotifications', () => {
  it('uses a success sound for completed transcription notifications', () => {
    const { api, notifications } = createNotificationApi();

    showTranscriptionSuccessNotification(api, t, 'recognized text');

    assert.deepEqual(notifications, [{ title: 'Text copied', body: 'recognized text', options: { sound: 'success' } }]);
  });

  it('uses an error sound for transcription failure notifications when requested', () => {
    const { api, notifications } = createNotificationApi();

    showTranscriptionFailureNotification(api, t, new Error('provider\nfailed'), 'Transcription failed', {
      sound: 'error',
    });

    assert.deepEqual(notifications, [
      { title: 'Recognition failed', body: 'provider failed', options: { sound: 'error' } },
    ]);
  });

  it('does not show raw traceback details in transcription failure notifications', () => {
    const { api, notifications } = createNotificationApi();

    showTranscriptionFailureNotification(
      api,
      t,
      new Error('Error: provider failed\n    at /home/user/project/src/main/provider.ts:10:1'),
      'Transcription failed',
      {
        sound: 'error',
      },
    );

    assert.deepEqual(notifications, [
      { title: 'Recognition failed', body: 'Something went wrong. Try again.', options: { sound: 'error' } },
    ]);
  });

  it('can show transcription failure notifications without sound for unrelated failures', () => {
    const { api, notifications } = createNotificationApi();

    showTranscriptionFailureNotification(api, t, '', 'Microphone error');

    assert.deepEqual(notifications, [{ title: 'Recognition failed', body: 'Microphone error', options: undefined }]);
  });

  it('swallows rejected notification promises', async () => {
    const api = {
      showNotification: async () => {
        throw new Error('notification unavailable');
      },
    };

    showTranscriptionSuccessNotification(api, t, 'recognized text');
    showTranscriptionFailureNotification(api, t, new Error('provider failed'), 'Transcription failed', {
      sound: 'error',
    });

    await Promise.resolve();
  });
});
