import { formatNotificationBody, type SystemNotificationOptions } from '@shared/notifications';

interface TranscriptionNotificationApi {
  showNotification(title: string, body: string, options?: SystemNotificationOptions): Promise<void>;
}

type Translate = (key: string, params?: Record<string, string>) => string;

export function showTranscriptionSuccessNotification(
  api: TranscriptionNotificationApi,
  t: Translate,
  text: string,
): void {
  void api.showNotification(t('notification.textCopied'), text, { sound: 'success' });
}

export function showTranscriptionFailureNotification(
  api: TranscriptionNotificationApi,
  t: Translate,
  error: unknown,
  fallback: string,
  options?: SystemNotificationOptions,
): void {
  void api.showNotification(t('notification.transcriptionFailed'), formatNotificationBody(error, fallback), options);
}
