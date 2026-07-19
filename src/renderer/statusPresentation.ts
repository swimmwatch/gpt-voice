import type { TranslationKey } from '@main/i18n';
import { NotificationErrorCode, type PresentedNotificationError } from '@shared/notifications';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

export type RendererStatusParams = Record<string, string | RendererStatus>;

export type RendererStatus =
  | {
      kind: 'translation';
      key: TranslationKey;
      params?: RendererStatusParams;
    }
  | {
      kind: 'text';
      text: string;
    };

export type TranslateRendererStatus = (key: TranslationKey, params?: Record<string, string>) => string;

export function translatedStatus(key: TranslationKey, params?: RendererStatusParams): RendererStatus {
  return params ? { kind: 'translation', key, params } : { kind: 'translation', key };
}

export function literalStatus(text: string): RendererStatus {
  return { kind: 'text', text };
}

export function renderRendererStatus(status: RendererStatus | null, t: TranslateRendererStatus): string {
  if (!status) return '';
  if (status.kind === 'text') return status.text;

  const params = status.params
    ? Object.fromEntries(
        Object.entries(status.params).map(([key, value]) => [
          key,
          typeof value === 'string' ? value : renderRendererStatus(value, t),
        ]),
      )
    : undefined;
  return t(status.key, params);
}

/** Converts a classified safe error into a locale-independent status descriptor. */
export function notificationErrorStatus(error: PresentedNotificationError): RendererStatus {
  switch (error.code) {
    case NotificationErrorCode.AudioPreparationFailed:
      return translatedStatus('error.notificationAudioPreparationFailed');
    case NotificationErrorCode.ClipboardUnavailable:
      return translatedStatus('error.notificationClipboardUnavailable');
    case NotificationErrorCode.ConnectionFailed:
      return translatedStatus('error.notificationConnectionFailed', {
        service: error.safeLogMetadata.service || 'the service',
      });
    case NotificationErrorCode.OperationTimedOut:
      return translatedStatus('error.notificationOperationTimedOut');
    case NotificationErrorCode.ProviderRequestFailed:
      return translatedStatus('error.notificationProviderRequestFailed', {
        service: error.safeLogMetadata.service || 'the service',
        status: String(error.safeLogMetadata.status || 'unknown'),
      });
    case NotificationErrorCode.UnexpectedProviderResponse:
      return translatedStatus('error.notificationUnexpectedProviderResponse');
    case NotificationErrorCode.HumanReadable:
    case NotificationErrorCode.NotConfigured:
    case NotificationErrorCode.RateLimited:
    case NotificationErrorCode.Unknown:
      return translatedStatus('error.notificationUnknown');
  }
}

export function shouldPresentIdleHotkeyStatus(
  recordingState: RecordingLifecycleState,
  preserveStatus: boolean,
): boolean {
  return recordingState === 'idle' && !preserveStatus;
}
