import type { I18nService } from '@main/i18n';
import type { ScopedLogger } from '@main/logger';
import type { LocalWhisperFailureCode } from '@shared/localWhisper';
import type { SystemNotificationOptions } from '@shared/notifications';

export interface LocalWhisperSystemNotificationPort {
  show(title: string, body: string, options?: SystemNotificationOptions): void;
}

export interface LocalWhisperModelLoadFailureNotifierDependencies {
  readonly localization: Pick<I18nService, 'translate'>;
  readonly logger: Pick<ScopedLogger, 'warn'>;
  readonly notification: LocalWhisperSystemNotificationPort;
}

/** Shows one localized system error for a terminal Local Whisper model-load failure. */
export class LocalWhisperModelLoadFailureNotifier {
  public constructor(private readonly dependencies: LocalWhisperModelLoadFailureNotifierDependencies) {}

  public notify(code: LocalWhisperFailureCode): void {
    try {
      this.dependencies.notification.show(
        this.dependencies.localization.translate('localWhisper.main.operationFailed'),
        this.dependencies.localization.translate('localWhisper.main.operationFailedCode', { code }),
        { sound: 'error' },
      );
    } catch {
      this.dependencies.logger.warn('Failed to show Local Whisper model-load failure notification', { code });
    }
  }
}
