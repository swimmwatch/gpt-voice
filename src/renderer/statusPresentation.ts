import type { TranslationKey } from '@main/i18n';
import { NotificationErrorCode, type PresentedNotificationError } from '@shared/notifications';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';
import type { TextActionStatus } from '@shared/textActionStatus';

export type RendererStatusParams = Record<string, string | RendererStatus>;

export interface RendererStatus {
  kind: 'translation';
  key: TranslationKey;
  params?: RendererStatusParams;
}

export type TranslateRendererStatus = (key: TranslationKey, params?: Record<string, string>) => string;

export function translatedStatus(key: TranslationKey, params?: RendererStatusParams): RendererStatus {
  return params ? { kind: 'translation', key, params } : { kind: 'translation', key };
}

export function renderRendererStatus(status: RendererStatus | null, t: TranslateRendererStatus): string {
  if (!status) return '';

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

const TEXT_ACTION_STATUS_KEYS = {
  prettify: {
    cancelled: 'status.prettifyCancelled',
    completed: 'status.prettifiedSelection',
    failed: 'status.prettifyFailed',
    skipped: 'status.textActionSkipped',
    working: 'status.prettifyingSelection',
  },
  translation: {
    cancelled: 'status.translationCancelled',
    completed: 'status.translationCopied',
    failed: 'status.translationFailed',
    skipped: 'status.textActionSkipped',
    working: 'status.translatingSelection',
  },
} as const satisfies Record<TextActionStatus['action'], Record<TextActionStatus['phase'], TranslationKey>>;

const LIFECYCLE_STATUS_KEYS: Partial<Record<RecordingLifecycleState, TranslationKey>> = {
  idle: 'status.pressToRecord',
  paused: 'status.paused',
  recording: 'status.recording',
  retrying: 'status.resendingTranscription',
  stopping: 'status.stopping',
  transcribing: 'status.transcribing',
};

/** Maps the finite main-process text-action contract to locale-safe renderer status. */
export function textActionStatusToRendererStatus(status: TextActionStatus | null): RendererStatus {
  if (!status) return translatedStatus('error.notificationUnknown');
  return translatedStatus(TEXT_ACTION_STATUS_KEYS[status.action][status.phase]);
}

/** Hides semantic state that is already represented by the lifecycle indicator. */
export function getRendererStatusDetail(
  status: RendererStatus | null,
  recordingState: RecordingLifecycleState,
): RendererStatus | null {
  if (!status || status.key === LIFECYCLE_STATUS_KEYS[recordingState]) return null;
  return status;
}

/** Converts a classified safe error into a locale-independent status descriptor. */
export function notificationErrorStatus(error: Pick<PresentedNotificationError, 'code'>): RendererStatus {
  switch (error.code) {
    case NotificationErrorCode.AudioPreparationFailed:
      return translatedStatus('error.notificationAudioPreparationFailed');
    case NotificationErrorCode.ClipboardUnavailable:
      return translatedStatus('error.notificationClipboardUnavailable');
    case NotificationErrorCode.ConnectionFailed:
      return translatedStatus('error.notificationUnknown');
    case NotificationErrorCode.OperationTimedOut:
      return translatedStatus('error.notificationOperationTimedOut');
    case NotificationErrorCode.ProviderRequestFailed:
      return translatedStatus('error.notificationUnknown');
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
