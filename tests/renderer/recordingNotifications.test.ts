import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  showTranscriptionFailureNotification,
  showTranscriptionSuccessNotification,
} from '@renderer/recordingNotifications';
import type { SystemNotificationOptions } from '@shared/notifications';

const translations: Record<string, string> = {
  'notification.textCopied': 'Text copied',
  'notification.transcriptionFailed': 'Recognition failed',
};

function t(key: string): string {
  return translations[key] || key;
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
