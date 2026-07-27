import {
  PRETTIFY_PROVIDER_UNAVAILABLE_ERROR,
  type PreparedPrettifyExecution,
  type TextProcessingResult,
} from '@main/services/prettifyProviderBase';
import {
  DIAGNOSTIC_CAPTURE_CAUSE_CODES,
  type DiagnosticCaptureAttemptResult,
  type DiagnosticCaptureService,
} from '@main/services/diagnosticCapture';
import type { PrettifyAuditOperationContext, PrettifyProviderAudit } from '@main/services/prettifyProviderAudit';
import type { KnownPrettifyProviderId } from '@shared/prettifySettings';

export interface OneShotPrettifyExecutionDependencies {
  readonly audit: PrettifyProviderAudit;
  readonly contractVersion?: string;
  readonly diagnosticCapture: Pick<DiagnosticCaptureService, 'capturePrettifyProviderSuccess'>;
  readonly execute: (text: string, auditContext: PrettifyAuditOperationContext) => Promise<TextProcessingResult>;
}

/** Owns one-shot, audited capture invariants for a prepared Prettify execution. */
export class OneShotPrettifyExecution implements PreparedPrettifyExecution {
  private consumed = false;

  public constructor(
    public readonly providerId: KnownPrettifyProviderId,
    public readonly cacheContext: readonly string[],
    private readonly dependencies: OneShotPrettifyExecutionDependencies,
  ) {}

  public async execute(text: string): Promise<TextProcessingResult> {
    if (this.consumed) return { success: false, error: PRETTIFY_PROVIDER_UNAVAILABLE_ERROR };
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
        ...(this.dependencies.contractVersion === undefined
          ? {}
          : { contractVersion: this.dependencies.contractVersion }),
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
