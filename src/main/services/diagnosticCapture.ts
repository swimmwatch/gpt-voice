import {
  DIAGNOSTIC_CAPTURE_CAUSE_CODES,
  type DiagnosticCaptureInsertResult,
  type DiagnosticCaptureStorage,
} from './diagnosticCaptureStorage';
import type { DiagnosticCaptureSettingsService } from './diagnosticCaptureSettings';
import type { DiagnosticProviderAuditCauseCode } from '../providerAudit/mappings';
import type { KnownPrettifyProviderId } from '@shared/prettifySettings';
import type { TranslationProviderId } from '@shared/translationProvider';

export { DIAGNOSTIC_CAPTURE_CAUSE_CODES };

const DIAGNOSTIC_CAPTURE_ACTION_WARNING_LABEL = 'Diagnostic capture action';

export type DiagnosticCaptureAttemptResult =
  | { readonly status: 'disabled' }
  | { readonly status: 'success' }
  | {
      readonly causeCode: DiagnosticProviderAuditCauseCode;
      readonly status: 'failure';
    };

export interface TranslationDiagnosticCaptureInput {
  readonly contractVersion: string;
  readonly providerId: TranslationProviderId;
  readonly resultText: string;
  readonly sourceText: string;
  readonly targetLanguage: string;
}

export interface TranslationProviderDiagnosticCaptureInput extends TranslationDiagnosticCaptureInput {
  readonly providerOperationId?: string;
}

export interface PrettifyDiagnosticCaptureInput {
  readonly contractVersion?: string;
  readonly providerId: KnownPrettifyProviderId;
  readonly resultText: string;
  readonly sourceText: string;
}

export interface PrettifyProviderDiagnosticCaptureInput extends PrettifyDiagnosticCaptureInput {
  readonly providerOperationId?: string;
}

export interface DiagnosticCaptureDependencies {
  readonly logger: {
    warn(...args: unknown[]): void;
  };
  readonly settings: Pick<DiagnosticCaptureSettingsService, 'getSettings'>;
  readonly storage: Pick<DiagnosticCaptureStorage, 'insert'>;
}

/**
 * Owns default-off diagnostic result capture and the cache-only warning
 * boundary. Provider audit adapters remain responsible for provider warnings.
 */
export class DiagnosticCaptureService {
  public constructor(private readonly dependencies: DiagnosticCaptureDependencies) {}

  public captureTranslationProviderSuccess(
    input: TranslationProviderDiagnosticCaptureInput,
  ): Promise<DiagnosticCaptureAttemptResult> {
    return this.captureProvider('translation', input);
  }

  public capturePrettifyProviderSuccess(
    input: PrettifyProviderDiagnosticCaptureInput,
  ): Promise<DiagnosticCaptureAttemptResult> {
    return this.captureProvider('prettify', input);
  }

  public captureTranslationCacheHit(input: TranslationDiagnosticCaptureInput): void {
    this.captureCache('translation', input);
  }

  public capturePrettifyCacheHit(input: PrettifyDiagnosticCaptureInput): void {
    this.captureCache('prettify', input);
  }

  private async captureProvider(
    actionType: 'translation' | 'prettify',
    input: TranslationProviderDiagnosticCaptureInput | PrettifyProviderDiagnosticCaptureInput,
  ): Promise<DiagnosticCaptureAttemptResult> {
    if (!this.isEnabled(actionType)) return { status: 'disabled' };
    if (input.providerOperationId === undefined) {
      return this.failure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed);
    }

    return this.insert({
      actionType,
      ...(input.contractVersion === undefined ? {} : { contractVersion: input.contractVersion }),
      providerId: input.providerId,
      providerOperationId: input.providerOperationId,
      resultText: input.resultText,
      sourceKind: 'provider',
      sourceText: input.sourceText,
      ...('targetLanguage' in input ? { targetLanguage: input.targetLanguage } : {}),
    });
  }

  private captureCache(
    actionType: 'translation' | 'prettify',
    input: TranslationDiagnosticCaptureInput | PrettifyDiagnosticCaptureInput,
  ): void {
    if (!this.isEnabled(actionType)) return;

    void this.insert({
      actionType,
      ...(input.contractVersion === undefined ? {} : { contractVersion: input.contractVersion }),
      providerId: input.providerId,
      resultText: input.resultText,
      sourceKind: 'cache',
      sourceText: input.sourceText,
      ...('targetLanguage' in input ? { targetLanguage: input.targetLanguage } : {}),
    })
      .then((result) => {
        if (result.status === 'failure') {
          this.warnCacheFailure(actionType, input.providerId, result.causeCode);
        }
      })
      .catch(() => {
        this.warnCacheFailure(actionType, input.providerId, DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed);
      });
  }

  private async insert(
    input: Parameters<DiagnosticCaptureStorage['insert']>[0],
  ): Promise<DiagnosticCaptureAttemptResult> {
    try {
      return this.toAttemptResult(await this.dependencies.storage.insert(input));
    } catch {
      return this.failure(DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed);
    }
  }

  private isEnabled(actionType: 'translation' | 'prettify'): boolean {
    try {
      const settings = this.dependencies.settings.getSettings();
      return actionType === 'translation'
        ? settings.captureTranslationDiagnostics
        : settings.capturePrettifyDiagnostics;
    } catch {
      return false;
    }
  }

  private toAttemptResult(result: DiagnosticCaptureInsertResult): DiagnosticCaptureAttemptResult {
    return result.status === 'success' ? { status: 'success' } : this.failure(result.causeCode);
  }

  private failure(causeCode: DiagnosticProviderAuditCauseCode): DiagnosticCaptureAttemptResult {
    return { causeCode, status: 'failure' };
  }

  private warnCacheFailure(
    actionType: 'translation' | 'prettify',
    providerId: TranslationProviderId | KnownPrettifyProviderId,
    causeCode: DiagnosticProviderAuditCauseCode,
  ): void {
    try {
      this.dependencies.logger.warn(DIAGNOSTIC_CAPTURE_ACTION_WARNING_LABEL, {
        actionType,
        causeCode,
        providerId,
        sourceKind: 'cache',
      });
    } catch {
      // Cache capture diagnostics cannot alter the selected-text action.
    }
  }
}
