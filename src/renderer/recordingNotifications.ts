import rendererLog from 'electron-log/renderer';
import {
  formatNotificationBody,
  getNotificationErrorMessage,
  presentNotificationError,
  type PresentedNotificationError,
  type SystemNotificationOptions,
} from '@shared/notifications';

const log = rendererLog.scope('recording-notifications');
const CLAUDE_WEB_ERROR_TRANSLATION_PREFIX = 'error.claudeWeb.';

interface TranscriptionNotificationApi {
  showNotification(title: string, body: string, options?: SystemNotificationOptions): Promise<void>;
}

type Translate = (key: string, params?: Record<string, string>) => string;

function localizeProviderError(error: unknown, t: Translate): unknown {
  const errorMessage = getNotificationErrorMessage(error);
  if (!errorMessage) return error;

  const translationKey = `${CLAUDE_WEB_ERROR_TRANSLATION_PREFIX}${errorMessage}`;
  const translated = t(translationKey);
  return translated === translationKey ? error : translated;
}

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
  const presented = presentNotificationError(localizeProviderError(error, t), {
    context: 'transcription',
    fallback,
    t,
  });
  showNotificationSafely(
    api,
    t('notification.transcriptionFailed'),
    formatNotificationBody(presented.userMessage, fallback),
    options,
  );
  return presented;
}
