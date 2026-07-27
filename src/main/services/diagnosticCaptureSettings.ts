import type { AppConfigStore } from '../config';
import {
  DIAGNOSTIC_CAPTURE_CAUSE_CODES,
  type DiagnosticCaptureMaintenanceResult,
  type DiagnosticCaptureStorage,
} from './diagnosticCaptureStorage';
import {
  DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES,
  areDiagnosticCaptureSettingsEqual,
  getDiagnosticCaptureCategoriesForClearTarget,
  getDisabledDiagnosticCaptureCategories,
  isDiagnosticCaptureClearRequest,
  isDiagnosticCaptureSettingsMutationRequest,
  type DiagnosticCaptureCategory,
  type DiagnosticCaptureClearResult,
  type DiagnosticCaptureSettings,
  type DiagnosticCaptureSettingsErrorCode,
  type DiagnosticCaptureSettingsMutationResult,
} from '@shared/diagnosticCaptureSettings';

export type DiagnosticCaptureSettingsStore = Pick<
  AppConfigStore,
  'getDiagnosticCaptureSettings' | 'saveDiagnosticCaptureSettings'
>;

export type DiagnosticCaptureSettingsStorage = Pick<DiagnosticCaptureStorage, 'prune' | 'pruneAndPurge' | 'purge'>;

/** Coordinates validated capture settings changes with serialized destructive storage maintenance. */
export class DiagnosticCaptureSettingsService {
  private operationQueue: Promise<void> = Promise.resolve();

  public constructor(
    private readonly settingsStore: DiagnosticCaptureSettingsStore,
    private readonly storage: DiagnosticCaptureSettingsStorage,
  ) {}

  public getSettings(): DiagnosticCaptureSettings {
    return this.settingsStore.getDiagnosticCaptureSettings();
  }

  public setSettings(input: unknown): Promise<DiagnosticCaptureSettingsMutationResult> {
    return this.enqueue(
      () => this.setSettingsNow(input),
      () => this.settingsFailure(DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.StorageFailed),
    );
  }

  public clear(input: unknown): Promise<DiagnosticCaptureClearResult> {
    return this.enqueue(
      () => this.clearNow(input),
      () => ({ errorCode: DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.StorageFailed, success: false }),
    );
  }

  private async setSettingsNow(input: unknown): Promise<DiagnosticCaptureSettingsMutationResult> {
    const current = this.getSettings();
    if (!isDiagnosticCaptureSettingsMutationRequest(input)) {
      return this.settingsFailure(DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.InvalidRequest, current);
    }

    const disabledCategories = getDisabledDiagnosticCaptureCategories(current, input.settings);
    if (!this.categoriesMatch(disabledCategories, input.confirmedPurgeCategories)) {
      return this.settingsFailure(DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.ConfirmationRequired, current);
    }
    if (areDiagnosticCaptureSettingsEqual(current, input.settings)) {
      return { settings: current, success: true };
    }

    const maintenance =
      disabledCategories.length > 0 ? await this.storage.pruneAndPurge(disabledCategories) : await this.storage.prune();
    if (maintenance.status === 'failure') {
      return this.settingsFailure(this.mapStorageFailure(maintenance), current);
    }

    try {
      return {
        settings: this.settingsStore.saveDiagnosticCaptureSettings(input.settings),
        success: true,
      };
    } catch {
      return this.settingsFailure(DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.SaveFailed, current);
    }
  }

  private async clearNow(input: unknown): Promise<DiagnosticCaptureClearResult> {
    if (!isDiagnosticCaptureClearRequest(input)) {
      return { errorCode: DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.InvalidRequest, success: false };
    }

    const result = await this.storage.purge(getDiagnosticCaptureCategoriesForClearTarget(input.target));
    if (result.status === 'failure') {
      return { errorCode: this.mapStorageFailure(result), success: false };
    }
    return { success: true };
  }

  private enqueue<Result>(operation: () => Promise<Result>, unexpectedFailure: () => Result): Promise<Result> {
    const runSafely = async (): Promise<Result> => {
      try {
        return await operation();
      } catch {
        return unexpectedFailure();
      }
    };
    const result = this.operationQueue.then(runSafely, runSafely);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private categoriesMatch(
    expected: readonly DiagnosticCaptureCategory[],
    confirmed: readonly DiagnosticCaptureCategory[],
  ): boolean {
    return expected.length === confirmed.length && expected.every((category) => confirmed.includes(category));
  }

  private mapStorageFailure(
    result: Extract<DiagnosticCaptureMaintenanceResult, { status: 'failure' }>,
  ): DiagnosticCaptureSettingsErrorCode {
    return result.causeCode === DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageUnavailable
      ? DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.StorageUnavailable
      : DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES.StorageFailed;
  }

  private settingsFailure(
    errorCode: DiagnosticCaptureSettingsErrorCode,
    settings = this.getSettings(),
  ): DiagnosticCaptureSettingsMutationResult {
    return { errorCode, settings, success: false };
  }
}
