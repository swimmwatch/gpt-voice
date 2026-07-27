import type {
  DiagnosticCaptureAttemptResult,
  PrettifyDiagnosticCaptureInput,
  PrettifyProviderDiagnosticCaptureInput,
  TranslationDiagnosticCaptureInput,
  TranslationProviderDiagnosticCaptureInput,
} from '../../src/main/services/diagnosticCapture';

/** Test seam that owns deterministic capture calls and provider outcomes. */
export class RecordingDiagnosticCapture {
  public readonly prettifyCacheInputs: PrettifyDiagnosticCaptureInput[] = [];
  public readonly prettifyProviderInputs: PrettifyProviderDiagnosticCaptureInput[] = [];
  public readonly translationCacheInputs: TranslationDiagnosticCaptureInput[] = [];
  public readonly translationProviderInputs: TranslationProviderDiagnosticCaptureInput[] = [];

  public providerResult: DiagnosticCaptureAttemptResult = { status: 'disabled' };
  public throwOnCacheCapture = false;
  public throwOnProviderCapture = false;

  public async capturePrettifyProviderSuccess(
    input: PrettifyProviderDiagnosticCaptureInput,
  ): Promise<DiagnosticCaptureAttemptResult> {
    if (this.throwOnProviderCapture) throw new Error('synthetic capture failure');
    this.prettifyProviderInputs.push(input);
    return this.providerResult;
  }

  public async captureTranslationProviderSuccess(
    input: TranslationProviderDiagnosticCaptureInput,
  ): Promise<DiagnosticCaptureAttemptResult> {
    if (this.throwOnProviderCapture) throw new Error('synthetic capture failure');
    this.translationProviderInputs.push(input);
    return this.providerResult;
  }

  public capturePrettifyCacheHit(input: PrettifyDiagnosticCaptureInput): void {
    if (this.throwOnCacheCapture) throw new Error('synthetic capture failure');
    this.prettifyCacheInputs.push(input);
  }

  public captureTranslationCacheHit(input: TranslationDiagnosticCaptureInput): void {
    if (this.throwOnCacheCapture) throw new Error('synthetic capture failure');
    this.translationCacheInputs.push(input);
  }
}
