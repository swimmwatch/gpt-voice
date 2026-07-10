import rendererLog from 'electron-log/renderer';
import {
  formatNotificationBody,
  presentNotificationError,
  type PresentedNotificationError,
  type SystemNotificationOptions,
} from '@shared/notifications';

const log = rendererLog.scope('recording-notifications');

interface TranscriptionNotificationApi {
  showNotification(title: string, body: string, options?: SystemNotificationOptions): Promise<void>;
}

type Translate = (key: string, params?: Record<string, string>) => string;

function showNotificationSafely(
  api: TranscriptionNotificationApi,
  title: string,
  body: string,
  options?: SystemNotificationOptions,
): void {
  void api.showNotification(title, body, options).catch((error: unknown) => {
    log.warn(
      'Could not show transcription notification:',
      presentNotificationError(error, { context: 'transcription', fallback: 'Notification failed' }).safeLogMetadata,
    );
  });
}

export function showTranscriptionSuccessNotification(
  api: TranscriptionNotificationApi,
  t: Translate,
  text: string,
): void {
  showNotificationSafely(api, t('notification.textCopied'), text, { sound: 'success' });
}

export function showTranscriptionFailureNotification(
  api: TranscriptionNotificationApi,
  t: Translate,
  error: unknown,
  fallback: string,
  options?: SystemNotificationOptions,
): PresentedNotificationError {
  const presented = presentNotificationError(error, { context: 'transcription', fallback, t });
  showNotificationSafely(
    api,
    t('notification.transcriptionFailed'),
    formatNotificationBody(presented.userMessage, fallback),
    options,
  );
  return presented;
}
