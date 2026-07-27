import {
  BaseProviderAudit,
  type ProviderAuditDependencies,
  type ProviderAuditErrorClass,
  type ProviderAuditExceptionType,
  type ProviderAuditMetadataForFamily,
  type ProviderAuditOperationContext,
  type ProviderAuditPhase,
  type ProviderAuditTerminalOutcome,
} from '@main/providerAudit';
import type { ProviderAuditOperation } from '@main/providerAudit/mappings';

export type PrettifyAuditMetadata = ProviderAuditMetadataForFamily<'prettify'>;
export type PrettifyAuditOperationContext = ProviderAuditOperationContext<'prettify'>;

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

  public constructor(dependencies: Partial<ProviderAuditDependencies> = {}) {
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
    return this.startOperation(providerId, 'settings-readiness', 'validation', this.createMetadata(options));
  }

  public startAvailability(providerId: unknown): PrettifyAuditOperationContext {
    return this.startOperation(providerId, 'availability', 'dispatch');
  }

  public startModelList(providerId: unknown): PrettifyAuditOperationContext {
    return this.startOperation(providerId, 'model-list', 'dispatch');
  }

  public startModelLoad(providerId: unknown): PrettifyAuditOperationContext {
    return this.startOperation(providerId, 'model-load', 'dispatch');
  }

  public startModelUnload(providerId: unknown): PrettifyAuditOperationContext {
    return this.startOperation(providerId, 'model-unload', 'dispatch');
  }

  public startPrepare(providerId: unknown, options: PrettifyAuditMetadataOptions = {}): PrettifyAuditOperationContext {
    return this.startOperation(providerId, 'prepare', 'dispatch', this.createMetadata(options));
  }

  public startPrettify(providerId: unknown, sourceLength: number): PrettifyAuditOperationContext {
    return this.startOperation(providerId, 'prettify', 'dispatch', this.createMetadata({ sourceLength }));
  }

  public startShutdown(providerId: unknown): PrettifyAuditOperationContext {
    return this.startOperation(providerId, 'shutdown', 'shutdown');
  }

  public recordUnknownProvider(providerId: unknown, operation: ProviderAuditOperation<'prettify'>): void {
    const context = this.startOperation(providerId, operation, 'validation');
    this.terminalFailure(context, 'validation', 'unknown');
  }

  public terminal(
    context: PrettifyAuditOperationContext,
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    options: PrettifyAuditMetadataOptions = {},
  ): void {
    context.lifecycle.terminal(
      phase,
      outcome,
      this.createMetadata({
        ...options,
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
}

export const prettifyProviderAudit = new PrettifyProviderAudit();
