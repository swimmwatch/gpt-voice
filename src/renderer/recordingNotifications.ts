import { formatNotificationBody, type SystemNotificationOptions } from '@shared/notifications';

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
  void api.showNotification(title, body, options).catch(() => undefined);
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
): void {
  showNotificationSafely(api, t('notification.transcriptionFailed'), formatNotificationBody(error, fallback), options);
}
