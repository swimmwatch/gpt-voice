import {
  PRETTIFY_PROVIDER_UNAVAILABLE_ERROR_KEY,
  type PreparedPrettifyExecution,
  type TextProcessingResult,
} from '@main/services/prettifyProviderBase';
import {
  DIAGNOSTIC_CAPTURE_CAUSE_CODES,
  type DiagnosticCaptureAttemptResult,
  type DiagnosticCaptureService,
} from '@main/services/diagnosticCapture';
import type { PrettifyExecutionInstruction } from '@main/services/prettifyProfileInstruction';
import type { PrettifyAuditOperationContext, PrettifyProviderAudit } from '@main/services/prettifyProviderAudit';
import type { KnownPrettifyProviderId } from '@shared/prettifySettings';
import type { I18nService } from '@main/i18n';

export interface OneShotPrettifyExecutionDependencies {
  readonly audit: PrettifyProviderAudit;
  readonly diagnosticCapture: Pick<DiagnosticCaptureService, 'capturePrettifyProviderSuccess'>;
  readonly execute: (text: string, auditContext: PrettifyAuditOperationContext) => Promise<TextProcessingResult>;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly providerCapabilityVersion?: string;
}

/** Owns one-shot, audited capture invariants for a prepared Prettify execution. */
export class OneShotPrettifyExecution implements PreparedPrettifyExecution {
  public readonly cacheContext: readonly string[];
  private consumed = false;

  public constructor(
    public readonly providerId: KnownPrettifyProviderId,
    providerCacheContext: readonly string[],
    instruction: PrettifyExecutionInstruction,
    private readonly dependencies: OneShotPrettifyExecutionDependencies,
  ) {
    this.cacheContext = Object.freeze([
      ...providerCacheContext,
      'instruction-contract-version',
      String(instruction.instructionContractVersion),
      'effective-instruction',
      instruction.effectiveInstruction,
    ]);
  }

  public async execute(text: string): Promise<TextProcessingResult> {
    if (this.consumed) {
      return {
        success: false,
        error: this.dependencies.localization.translate(PRETTIFY_PROVIDER_UNAVAILABLE_ERROR_KEY),
      };
    }
    this.consumed = true;
    const auditContext = this.dependencies.audit.startCapturedPrettify(this.providerId, text.length);

    try {
      const result = await this.dependencies.execute(text, auditContext);
      if (result.success && result.text?.trim() && this.dependencies.audit.canCaptureSuccess(auditContext)) {
        const captureResult = await this.captureSuccess(text, result.text, auditContext.operationId);
        if (captureResult.status === 'failure') {
          this.dependencies.audit.recordDiagnosticCaptureFailure(auditContext, captureResult.causeCode);
        }
      }
      return result;
    } catch (error: unknown) {
      this.dependencies.audit.terminalException(auditContext, 'result', error, {
        sourceLength: text.length,
      });
      throw error;
    } finally {
      this.dependencies.audit.flushCapturedPrettify(auditContext);
    }
  }

  private async captureSuccess(
    sourceText: string,
    resultText: string,
    providerOperationId?: string,
  ): Promise<DiagnosticCaptureAttemptResult> {
    try {
      return await this.dependencies.diagnosticCapture.capturePrettifyProviderSuccess({
        ...(this.dependencies.providerCapabilityVersion === undefined
          ? {}
          : { contractVersion: this.dependencies.providerCapabilityVersion }),
        providerId: this.providerId,
        providerOperationId,
        resultText,
        sourceText,
      });
    } catch {
      return {
        causeCode: DIAGNOSTIC_CAPTURE_CAUSE_CODES.StorageFailed,
        status: 'failure',
      };
    }
  }
}
