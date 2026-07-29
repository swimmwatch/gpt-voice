/* eslint-disable max-classes-per-file -- the public family audit and private operation state share one contract. */
import {
  BaseProviderAudit,
  type ProviderAuditDependencies,
  type ProviderAuditErrorClass,
  type ProviderAuditExceptionType,
  type ProviderAuditLifecycle,
  type ProviderAuditMetadataForFamily,
  type ProviderAuditOperationContext,
  type ProviderAuditPhase,
  type ProviderAuditTerminalOutcome,
} from '@main/providerAudit';
import type { DiagnosticProviderAuditCauseCode, ProviderAuditOperation } from '@main/providerAudit/mappings';
import type { CliProcessResult } from '@main/services/prettifyCliRunner';
import type { PrettifyCliRuntimeErrorCode } from '@shared/prettifySettings';

export type PrettifyAuditMetadata = ProviderAuditMetadataForFamily<'prettify'>;

interface DeferredPrettifyAuditTerminal {
  readonly metadata?: PrettifyAuditMetadata;
  readonly outcome: ProviderAuditTerminalOutcome;
  readonly phase: ProviderAuditPhase;
}

/** Defers one Prettify terminal until diagnostic capture has settled. */
class DeferredPrettifyAuditLifecycle implements ProviderAuditLifecycle<'prettify'> {
  private deferredTerminal: DeferredPrettifyAuditTerminal | null = null;

  public constructor(private readonly lifecycle: ProviderAuditLifecycle<'prettify'>) {}

  public started(metadata?: PrettifyAuditMetadata): void {
    this.lifecycle.started(metadata);
  }

  public phaseEntered(phase: ProviderAuditPhase, metadata?: PrettifyAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.phaseEntered(phase, metadata);
  }

  public phaseCompleted(phase: ProviderAuditPhase, metadata?: PrettifyAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.phaseCompleted(phase, metadata);
  }

  public retry(phase: ProviderAuditPhase, metadata?: PrettifyAuditMetadata): void {
    if (this.deferredTerminal === null) this.lifecycle.retry(phase, metadata);
  }

  public recovery(phase: ProviderAuditPhase, metadata?: PrettifyAuditMetadata): void {
    this.lifecycle.recovery(phase, metadata);
  }

  public terminal(
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    metadata?: PrettifyAuditMetadata,
  ): void {
    if (this.deferredTerminal !== null) return;
    this.deferredTerminal = { phase, outcome, ...(metadata === undefined ? {} : { metadata }) };
  }

  public flushTerminal(): boolean {
    if (this.deferredTerminal === null) return false;
    const { metadata, outcome, phase } = this.deferredTerminal;
    this.deferredTerminal = null;
    this.lifecycle.terminal(phase, outcome, metadata);
    return true;
  }

  public hasSuccessfulTerminal(): boolean {
    return this.deferredTerminal?.outcome === 'success';
  }
}

/** Main-only state shared by one Prettify provider operation across orchestration layers. */
class PrettifyAuditOperationContextState implements ProviderAuditOperationContext<'prettify'> {
  private cliCleanupFailure = false;
  private readonly deferredLifecycle: DeferredPrettifyAuditLifecycle | null;

  public readonly lifecycle;
  public readonly now;
  public readonly operationId;
  public readonly startedAt;

  public constructor(context: ProviderAuditOperationContext<'prettify'>, deferTerminal = false) {
    this.deferredLifecycle = deferTerminal ? new DeferredPrettifyAuditLifecycle(context.lifecycle) : null;
    this.lifecycle = this.deferredLifecycle ?? context.lifecycle;
    this.now = context.now;
    this.operationId = context.operationId;
    this.startedAt = context.startedAt;
  }

  public get hasCliCleanupFailure(): boolean {
    return this.cliCleanupFailure;
  }

  public recordCliCleanupFailure(): void {
    this.cliCleanupFailure = true;
  }

  public flushTerminal(): boolean {
    return this.deferredLifecycle?.flushTerminal() ?? false;
  }

  public hasSuccessfulTerminal(): boolean {
    return this.deferredLifecycle?.hasSuccessfulTerminal() ?? false;
  }
}

export type PrettifyAuditOperationContext = PrettifyAuditOperationContextState;

export interface PrettifyAuditMetadataOptions {
  readonly causeCode?: PrettifyAuditMetadata['causeCode'];
  readonly cleanupFailure?: boolean;
  readonly durationMs?: number;
  readonly exceptionType?: ProviderAuditExceptionType;
  readonly httpStatus?: number;
  readonly modelConfigured?: boolean;
  readonly modelNameLength?: number;
  readonly modelSource?: PrettifyAuditMetadata['modelSource'];
  readonly resultLength?: number;
  readonly sourceLength?: number;
  readonly usesDefaultModel?: boolean;
}

const PRETTIFY_AUDIT_ERROR_CLASS_BY_CAUSE = {
  'diagnostic-redaction-failed': 'internal',
  'diagnostic-row-too-large': 'internal',
  'diagnostic-storage-failed': 'internal',
  'diagnostic-storage-unavailable': 'internal',
  'empty-output': 'provider-rejection',
  'empty-result': 'provider-rejection',
  'invalid-model': 'configuration',
  'malformed-output': 'contract',
  'model-discovery-failed': 'provider-rejection',
  'model-lifecycle-failed': 'provider-rejection',
  'nonzero-exit': 'provider-rejection',
  'no-tools-unavailable': 'configuration',
  'not-authenticated': 'authentication',
  'not-configured': 'configuration',
  'not-executable': 'configuration',
  'not-installed': 'configuration',
  'output-limit': 'provider-rejection',
  'process-failed': 'provider-rejection',
  'request-failed': 'provider-rejection',
  'schema-unavailable': 'configuration',
  'timed-out': 'timeout',
  'unexpected-response': 'contract',
  cancelled: 'cancellation',
  'connection-failed': 'connection',
  unknown: 'internal',
  unsupported: 'configuration',
} as const satisfies Readonly<Record<NonNullable<PrettifyAuditMetadata['causeCode']>, ProviderAuditErrorClass>>;

/** Main-only Prettify audit family adapter for HTTP and CLI lifecycle packets. */
export class PrettifyProviderAudit extends BaseProviderAudit<'prettify'> {
  public readonly family = 'prettify' as const;

  public constructor(dependencies: ProviderAuditDependencies) {
    super(dependencies);
  }

  public createMetadata(options: PrettifyAuditMetadataOptions = {}): PrettifyAuditMetadata {
    return {
      ...(options.durationMs === undefined ? {} : { durationMs: options.durationMs }),
      ...(options.httpStatus === undefined ? {} : { httpStatus: options.httpStatus }),
      ...(options.modelConfigured === undefined ? {} : { modelConfigured: options.modelConfigured }),
      ...(options.modelNameLength === undefined ? {} : { modelNameLength: options.modelNameLength }),
      ...(options.modelSource === undefined ? {} : { modelSource: options.modelSource }),
      ...(options.resultLength === undefined ? {} : { resultLength: options.resultLength }),
      ...(options.sourceLength === undefined ? {} : { sourceLength: options.sourceLength }),
      ...(options.usesDefaultModel === undefined ? {} : { usesDefaultModel: options.usesDefaultModel }),
      ...(options.causeCode === undefined
        ? {}
        : {
            causeCode: options.causeCode,
            errorClass: this.getErrorClass(options.causeCode, options.exceptionType, options.cleanupFailure === true),
          }),
      ...(options.exceptionType === undefined ? {} : { exceptionType: options.exceptionType }),
    };
  }

  public startSettingsReadiness(
    providerId: unknown,
    options: PrettifyAuditMetadataOptions = {},
  ): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(
      this.startOperation(providerId, 'settings-readiness', 'validation', this.createMetadata(options)),
    );
  }

  public startAvailability(providerId: unknown): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(this.startOperation(providerId, 'availability', 'dispatch'));
  }

  public startCapabilityCheck(providerId: unknown): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(this.startOperation(providerId, 'capability-check', 'dispatch'));
  }

  public startModelList(providerId: unknown): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(this.startOperation(providerId, 'model-list', 'dispatch'));
  }

  public startModelLoad(providerId: unknown): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(this.startOperation(providerId, 'model-load', 'dispatch'));
  }

  public startModelUnload(providerId: unknown): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(this.startOperation(providerId, 'model-unload', 'dispatch'));
  }

  public startPrepare(providerId: unknown, options: PrettifyAuditMetadataOptions = {}): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(
      this.startOperation(providerId, 'prepare', 'dispatch', this.createMetadata(options)),
    );
  }

  public startPrettify(providerId: unknown, sourceLength: number): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(
      this.startOperation(providerId, 'prettify', 'dispatch', this.createMetadata({ sourceLength })),
    );
  }

  public startCapturedPrettify(providerId: unknown, sourceLength: number): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(
      this.startOperation(providerId, 'prettify', 'dispatch', this.createMetadata({ sourceLength })),
      true,
    );
  }

  public flushCapturedPrettify(context: PrettifyAuditOperationContext): boolean {
    return context.flushTerminal();
  }

  public canCaptureSuccess(context: PrettifyAuditOperationContext): boolean {
    return context.hasSuccessfulTerminal();
  }

  public startProcessCleanup(providerId: unknown): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(this.startOperation(providerId, 'process-cleanup', 'cleanup'));
  }

  public startShutdown(providerId: unknown): PrettifyAuditOperationContext {
    return new PrettifyAuditOperationContextState(this.startOperation(providerId, 'shutdown', 'shutdown'));
  }

  public recordUnknownProvider(providerId: unknown, operation: ProviderAuditOperation<'prettify'>): void {
    const context = new PrettifyAuditOperationContextState(this.startOperation(providerId, operation, 'validation'));
    this.terminalFailure(context, 'validation', 'unknown');
  }

  public enterCliProcess(context: PrettifyAuditOperationContext): void {
    context.lifecycle.phaseEntered('process');
  }

  public completeCliProcess(context: PrettifyAuditOperationContext, result: CliProcessResult): void {
    context.lifecycle.phaseCompleted(
      'process',
      this.createMetadata({
        durationMs: result.diagnostics.durationMs,
      }),
    );
    if (result.diagnostics.cleanup !== 'failed') return;

    context.recordCliCleanupFailure();
    const cleanupMetadata = this.createMetadata({
      causeCode: 'process-failed',
      cleanupFailure: true,
    });
    context.lifecycle.phaseEntered('cleanup', cleanupMetadata);
    context.lifecycle.phaseCompleted('cleanup', cleanupMetadata);
  }

  public terminalCliFailure(
    context: PrettifyAuditOperationContext,
    causeCode: PrettifyCliRuntimeErrorCode,
    options: Omit<PrettifyAuditMetadataOptions, 'causeCode'> = {},
  ): void {
    const phase = this.getCliFailurePhase(causeCode);
    if (causeCode === 'cancelled') {
      this.terminalCancelled(context, phase, options);
      return;
    }
    this.terminalFailure(context, phase, causeCode, options);
  }

  public terminal(
    context: PrettifyAuditOperationContext,
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    options: PrettifyAuditMetadataOptions = {},
  ): void {
    const cleanupFailure = options.cleanupFailure === true || context.hasCliCleanupFailure;
    context.lifecycle.terminal(
      cleanupFailure ? 'cleanup' : phase,
      cleanupFailure ? 'failure' : outcome,
      this.createMetadata({
        ...options,
        ...(cleanupFailure && options.causeCode === undefined ? { causeCode: 'process-failed' as const } : {}),
        cleanupFailure,
        durationMs: options.durationMs ?? this.durationMs(context),
      }),
    );
  }

  public terminalSuccess(
    context: PrettifyAuditOperationContext,
    phase: ProviderAuditPhase,
    options: PrettifyAuditMetadataOptions = {},
  ): void {
    this.terminal(context, phase, 'success', options);
  }

  public recordDiagnosticCaptureFailure(
    context: PrettifyAuditOperationContext,
    causeCode: DiagnosticProviderAuditCauseCode,
  ): void {
    context.lifecycle.recovery(
      'result',
      this.createMetadata({
        causeCode,
      }),
    );
  }

  public terminalFailure(
    context: PrettifyAuditOperationContext,
    phase: ProviderAuditPhase,
    causeCode: NonNullable<PrettifyAuditMetadata['causeCode']>,
    options: Omit<PrettifyAuditMetadataOptions, 'causeCode'> = {},
  ): void {
    this.terminal(context, phase, 'failure', { ...options, causeCode });
  }

  public terminalCancelled(
    context: PrettifyAuditOperationContext,
    phase: ProviderAuditPhase,
    options: Omit<PrettifyAuditMetadataOptions, 'causeCode'> = {},
  ): void {
    this.terminal(context, phase, 'cancelled', { ...options, causeCode: 'cancelled' });
  }

  public terminalException(
    context: PrettifyAuditOperationContext,
    phase: ProviderAuditPhase,
    error: unknown,
    options: Omit<PrettifyAuditMetadataOptions, 'causeCode' | 'exceptionType'> = {},
  ): void {
    this.terminalFailure(context, phase, 'unknown', {
      ...options,
      exceptionType: this.normalizeException(error),
    });
  }

  private getErrorClass(
    causeCode: NonNullable<PrettifyAuditMetadata['causeCode']>,
    exceptionType?: ProviderAuditExceptionType,
    cleanupFailure = false,
  ): ProviderAuditErrorClass {
    if (cleanupFailure) return 'cleanup';
    if (exceptionType !== undefined) return 'internal';
    return PRETTIFY_AUDIT_ERROR_CLASS_BY_CAUSE[causeCode];
  }

  private getCliFailurePhase(causeCode: PrettifyCliRuntimeErrorCode): ProviderAuditPhase {
    switch (causeCode) {
      case 'not-installed':
      case 'not-executable':
      case 'invalid-model':
      case 'schema-unavailable':
        return 'configuration';
      case 'not-authenticated':
      case 'unsupported':
      case 'no-tools-unavailable':
        return 'readiness';
      case 'model-discovery-failed':
        return 'model-discovery';
      case 'empty-output':
      case 'malformed-output':
        return 'result';
      case 'cancelled':
      case 'timed-out':
      case 'output-limit':
      case 'nonzero-exit':
      case 'process-failed':
        return 'process';
    }
  }
}
