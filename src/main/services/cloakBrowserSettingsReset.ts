import type { BackgroundBrowserService, BackgroundBrowserStatus } from '@main/browser';
import type {
  CloakBrowserSettingsRepository,
  CloakBrowserSettingsWithSecret,
  PreparedCloakBrowserSettings,
} from '@main/cloakBrowserSettings';
import { assertValidCloakBrowserSettingsInput } from '@main/cloakBrowserSettingsUtils';
import type { I18nService } from '@main/i18n';
import {
  InitialProviderReadinessDeadline,
  type InitialProviderReadinessDeadlineDependencies,
} from '@main/services/initialProviderReadinessDeadline';
import type { TranslationRuntime } from '@main/services/translation';
import type { CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';

const CLOAK_BROWSER_SETTINGS_SAVE_FAILURE_KEY = 'translate.settingsSaveFailed';
const CLOAK_BROWSER_SETTINGS_SAVE_FAILURE_MESSAGE = 'Failed to save settings';
const TRANSLATION_CLEANUP_FAILURE_KEY = 'error.translationCleanupFailed';

export type CloakBrowserSettingsSaveResult =
  | {
      readonly backgroundStatus: BackgroundBrowserStatus;
      readonly settings: CloakBrowserSettingsView;
      readonly success: true;
    }
  | {
      readonly backgroundStatus?: BackgroundBrowserStatus;
      readonly error: string;
      readonly settings?: CloakBrowserSettingsView;
      readonly success: false;
    };

export interface CloakBrowserSettingsResetServiceDependencies {
  readonly backgroundBrowser: Pick<BackgroundBrowserService, 'initialize' | 'releaseForSettingsReset'>;
  readonly getVoiceProviderId: () => string | null;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly logger: {
    error(message: string): void;
    info(message: string): void;
    warn(message: string): void;
  };
  readonly publishBackgroundStatus: (status: BackgroundBrowserStatus, fallbackProviderId: string | null) => void;
  readonly readinessDeadline: InitialProviderReadinessDeadlineDependencies;
  readonly settings: Pick<CloakBrowserSettingsRepository, 'getSnapshot' | 'getView' | 'prepare'>;
  readonly translation: Pick<
    TranslationRuntime,
    'initializeSelectedProvider' | 'reset' | 'settleResetCleanupFailure' | 'settleResetUnexpectedFailure'
  >;
}

/**
 * Serializes the recoverable CloakBrowser settings transaction and owns its
 * candidate, persistence, rollback, and Translation readiness ordering.
 */
export class CloakBrowserSettingsResetService {
  private queueTail: Promise<void> = Promise.resolve();

  public constructor(private readonly dependencies: CloakBrowserSettingsResetServiceDependencies) {}

  public save(request: unknown): Promise<CloakBrowserSettingsSaveResult> {
    const operation = this.queueTail.then(() => this.saveNow(request));
    this.queueTail = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async saveNow(request: unknown): Promise<CloakBrowserSettingsSaveResult> {
    let prepared: PreparedCloakBrowserSettings;
    try {
      assertValidCloakBrowserSettingsInput(request);
      prepared = this.dependencies.settings.prepare(request);
    } catch {
      this.log('warn', 'CloakBrowser settings request was rejected');
      return this.failure(this.getCurrentSettings());
    }

    this.log('info', 'Saving CloakBrowser settings');
    let translationReset;
    try {
      translationReset = await this.dependencies.translation.reset();
    } catch {
      this.settleTranslationCleanupFailure();
      return this.failure(prepared.authoritativeSettings, this.getTranslationCleanupFailureMessage());
    }
    if (!translationReset.success) {
      this.log('warn', 'CloakBrowser settings save was blocked by Translation cleanup');
      return this.failure(prepared.authoritativeSettings, this.getTranslationCleanupFailureMessage());
    }

    const backgroundReleased = await this.releaseBackgroundBrowser();
    if (!backgroundReleased) {
      this.settleTranslationCleanupFailure();
      this.log('warn', 'CloakBrowser settings save was blocked by browser cleanup');
      return this.failure(prepared.authoritativeSettings, this.getTranslationCleanupFailureMessage());
    }

    const candidateStatus = await this.initializeBackgroundBrowser(prepared.settingsWithSecret);
    if (candidateStatus === null || candidateStatus.error) {
      await this.releaseBackgroundBrowser();
      this.settleTranslationUnexpectedFailure();
      this.log('warn', 'CloakBrowser settings candidate restart failed');
      return this.failure(
        prepared.authoritativeSettings,
        candidateStatus?.error ?? this.getSaveFailureMessage(),
        candidateStatus ?? undefined,
      );
    }

    let savedSettings: CloakBrowserSettingsView;
    try {
      savedSettings = prepared.persist();
    } catch {
      return this.restoreAfterPersistenceFailure(prepared.authoritativeSettings);
    }

    const result: CloakBrowserSettingsSaveResult = {
      backgroundStatus: candidateStatus,
      settings: savedSettings,
      success: true,
    };
    this.log('info', 'CloakBrowser settings saved');
    await this.warmSelectedTranslationProvider();
    return result;
  }

  private async restoreAfterPersistenceFailure(
    authoritativeSettings: CloakBrowserSettingsView,
  ): Promise<CloakBrowserSettingsSaveResult> {
    this.log('error', 'CloakBrowser settings persistence failed');
    if (!(await this.releaseBackgroundBrowser())) {
      this.settleTranslationUnexpectedFailure();
      return this.failure(authoritativeSettings);
    }

    let restoredSettings;
    try {
      restoredSettings = this.dependencies.settings.getSnapshot();
    } catch {
      this.settleTranslationUnexpectedFailure();
      return this.failure(authoritativeSettings);
    }

    const deadline = new InitialProviderReadinessDeadline(this.dependencies.readinessDeadline);
    let restoration;
    try {
      restoration = await deadline.run(async () => {
        const status = await this.initializeBackgroundBrowser(restoredSettings.settingsWithSecret, false);
        if (status === null || deadline.signal.aborted) return status;
        this.publishBackgroundStatus(status);
        if (status.error) return status;
        await this.dependencies.translation.initializeSelectedProvider();
        return status;
      });
    } catch {
      await this.releaseBackgroundBrowser();
      this.settleTranslationUnexpectedFailure();
      return this.failure(restoredSettings.settings);
    }

    if (restoration.status === 'stopped') {
      await this.releaseBackgroundBrowser();
      try {
        await this.dependencies.translation.reset();
      } catch {
        // The closed settlement below remains fail-open.
      }
      this.settleTranslationUnexpectedFailure();
      return this.failure(restoredSettings.settings);
    }

    const restorationStatus = restoration.value;
    if (restorationStatus === null || restorationStatus.error) {
      await this.releaseBackgroundBrowser();
      this.settleTranslationUnexpectedFailure();
      return this.failure(restoredSettings.settings, this.getSaveFailureMessage(), restorationStatus ?? undefined);
    }

    return this.failure(restoredSettings.settings, this.getSaveFailureMessage(), restorationStatus);
  }

  private async initializeBackgroundBrowser(
    settings: CloakBrowserSettingsWithSecret,
    publishStatus = true,
  ): Promise<BackgroundBrowserStatus | null> {
    try {
      const status = await this.dependencies.backgroundBrowser.initialize({
        cloakBrowserSettings: settings,
      });
      if (publishStatus) this.publishBackgroundStatus(status);
      return status;
    } catch {
      return null;
    }
  }

  private async releaseBackgroundBrowser(): Promise<boolean> {
    try {
      return await this.dependencies.backgroundBrowser.releaseForSettingsReset();
    } catch {
      return false;
    }
  }

  private async warmSelectedTranslationProvider(): Promise<void> {
    try {
      await this.dependencies.translation.initializeSelectedProvider();
    } catch {
      this.settleTranslationUnexpectedFailure();
    }
  }

  private publishBackgroundStatus(status: BackgroundBrowserStatus): void {
    try {
      this.dependencies.publishBackgroundStatus(status, this.dependencies.getVoiceProviderId());
    } catch {
      // Presentation failures cannot alter browser or settings ownership.
    }
  }

  private failure(
    settings?: CloakBrowserSettingsView,
    error = this.getSaveFailureMessage(),
    backgroundStatus?: BackgroundBrowserStatus,
  ): CloakBrowserSettingsSaveResult {
    return {
      ...(backgroundStatus === undefined ? {} : { backgroundStatus }),
      error,
      ...(settings === undefined ? {} : { settings }),
      success: false,
    };
  }

  private getCurrentSettings(): CloakBrowserSettingsView | undefined {
    try {
      return this.dependencies.settings.getView();
    } catch {
      return undefined;
    }
  }

  private getSaveFailureMessage(): string {
    try {
      return this.dependencies.localization.translate(CLOAK_BROWSER_SETTINGS_SAVE_FAILURE_KEY);
    } catch {
      return CLOAK_BROWSER_SETTINGS_SAVE_FAILURE_MESSAGE;
    }
  }

  private getTranslationCleanupFailureMessage(): string {
    try {
      return this.dependencies.localization.translate(TRANSLATION_CLEANUP_FAILURE_KEY);
    } catch {
      return CLOAK_BROWSER_SETTINGS_SAVE_FAILURE_MESSAGE;
    }
  }

  private settleTranslationCleanupFailure(): void {
    try {
      this.dependencies.translation.settleResetCleanupFailure();
    } catch {
      // Connection publication cannot alter cleanup or persistence ordering.
    }
  }

  private settleTranslationUnexpectedFailure(): void {
    try {
      this.dependencies.translation.settleResetUnexpectedFailure();
    } catch {
      // Connection publication cannot alter cleanup or persistence ordering.
    }
  }

  private log(level: 'error' | 'info' | 'warn', message: string): void {
    try {
      this.dependencies.logger[level](message);
    } catch {
      // Logging remains fail-open and never changes reset settlement.
    }
  }
}
