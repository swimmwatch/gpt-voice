/* eslint-disable max-classes-per-file -- the public base and private lifecycle implementations form one audit core. */

import {
  PROVIDER_AUDIT_LABEL,
  PROVIDER_AUDIT_SCHEMA_VERSION,
  type ProviderAuditFamily,
  type ProviderAuditMetadata,
  type ProviderAuditMetadataKey,
  type ProviderAuditOutcome,
  type ProviderAuditPhase,
  type ProviderAuditRecord,
  type ProviderAuditExceptionType,
  type ProviderAuditSeverity,
  type ProviderAuditTerminalOutcome,
  isProviderAuditFamily,
  isProviderAuditPhase,
  isProviderAuditTerminalOutcome,
  normalizeProviderAuditExceptionType,
  validateProviderAuditMetadata,
} from './contracts';
import {
  type DiagnosticProviderAuditCauseCode,
  type ProviderAuditCauseCode,
  type ProviderAuditOperation,
  type ProviderAuditProviderId,
  isProviderAuditCauseCode,
  isProviderAuditOperation,
  isProviderAuditProviderId,
} from './mappings';

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DIAGNOSTIC_CAUSE_CODES = new Set<DiagnosticProviderAuditCauseCode>([
  'diagnostic-storage-unavailable',
  'diagnostic-row-too-large',
  'diagnostic-redaction-failed',
  'diagnostic-storage-failed',
]);
const EXPECTED_WARNING_ERROR_CLASSES = new Set([
  'validation',
  'configuration',
  'authentication',
  'provider-rejection',
  'rate-limit',
  'connection',
  'timeout',
]);

export type ProviderAuditMetadataForFamily<Family extends ProviderAuditFamily> = Omit<
  ProviderAuditMetadata,
  'causeCode'
> & {
  readonly causeCode?: ProviderAuditCauseCode<Family>;
};

export interface ProviderAuditLifecycleInput<Family extends ProviderAuditFamily> {
  readonly family: Family;
  readonly operation: ProviderAuditOperation<Family>;
  readonly operationId?: string;
  readonly providerId: ProviderAuditProviderId<Family>;
}

export interface UnknownProviderAuditLifecycleInput<Family extends ProviderAuditFamily> {
  readonly family: Family;
  readonly operation: ProviderAuditOperation<Family>;
  readonly operationId?: string;
  readonly providerKnown: false;
}

export interface ProviderAuditLifecycle<Family extends ProviderAuditFamily> {
  started(metadata?: ProviderAuditMetadataForFamily<Family>): void;
  phaseEntered(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void;
  phaseCompleted(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void;
  retry(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void;
  recovery(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void;
  terminal(
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    metadata?: ProviderAuditMetadataForFamily<Family>,
  ): void;
}

export interface ProviderAuditSink {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface ProviderAuditDependencies {
  readonly elapsedNow: () => number;
  readonly getSink: () => ProviderAuditSink | null | undefined;
  readonly now: () => Date;
  readonly randomUUID: () => string;
}

export interface ProviderAuditOperationContext<Family extends ProviderAuditFamily> {
  readonly lifecycle: ProviderAuditLifecycle<Family>;
  readonly now: () => number;
  readonly operationId?: string;
  readonly startedAt: number;
}

/** Stateless fallback used when an audit lifecycle cannot be constructed safely. */
class NoopProviderAuditLifecycle<Family extends ProviderAuditFamily> implements ProviderAuditLifecycle<Family> {
  public started(): void {}

  public phaseEntered(): void {}

  public phaseCompleted(): void {}

  public retry(): void {}

  public recovery(): void {}

  public terminal(): void {}
}

/** Prevents injected lifecycle failures or post-terminal calls from reaching provider behavior. */
class FailOpenProviderAuditLifecycle<Family extends ProviderAuditFamily> implements ProviderAuditLifecycle<Family> {
  private terminalEventAccepted = false;

  public constructor(private readonly lifecycle: ProviderAuditLifecycle<Family>) {}

  public started(metadata?: ProviderAuditMetadataForFamily<Family>): void {
    this.runProgress(() => this.lifecycle.started(metadata));
  }

  public phaseEntered(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void {
    this.runProgress(() => this.lifecycle.phaseEntered(phase, metadata));
  }

  public phaseCompleted(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void {
    this.runProgress(() => this.lifecycle.phaseCompleted(phase, metadata));
  }

  public retry(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void {
    this.runProgress(() => this.lifecycle.retry(phase, metadata));
  }

  public recovery(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void {
    this.runProgress(() => this.lifecycle.recovery(phase, metadata));
  }

  public terminal(
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    metadata?: ProviderAuditMetadataForFamily<Family>,
  ): void {
    if (this.terminalEventAccepted) return;
    this.terminalEventAccepted = true;
    this.callSafely(() => this.lifecycle.terminal(phase, outcome, metadata));
  }

  private runProgress(run: () => void): void {
    if (this.terminalEventAccepted) return;
    this.callSafely(run);
  }

  private callSafely(run: () => void): void {
    try {
      run();
    } catch {
      // Provider audit is diagnostic-only and cannot alter provider behavior.
    }
  }
}

const NOOP_LIFECYCLE = Object.freeze(
  new NoopProviderAuditLifecycle<ProviderAuditFamily>(),
) as ProviderAuditLifecycle<ProviderAuditFamily>;

function isCanonicalOperationId(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_UUID_PATTERN.test(value);
}

function getOccurredAt(now: () => Date): string | null {
  const occurredAt = now();
  if (!(occurredAt instanceof Date) || !Number.isFinite(occurredAt.getTime())) return null;
  return occurredAt.toISOString();
}

function canonicalizeProviderAuditRecord(record: ProviderAuditRecord, metadata: ProviderAuditMetadata): string | null {
  const canonical: Record<string, unknown> = {
    schemaVersion: record.schemaVersion,
    occurredAt: record.occurredAt,
    family: record.family,
  };
  if (record.providerId !== undefined) canonical.providerId = record.providerId;
  canonical.operation = record.operation;
  canonical.operationId = record.operationId;
  canonical.sequence = record.sequence;
  canonical.event = record.event;
  canonical.phase = record.phase;
  canonical.outcome = record.outcome;

  for (const key of Object.keys(metadata).sort() as ProviderAuditMetadataKey[]) {
    canonical[key] = metadata[key];
  }

  const serialized = JSON.stringify(canonical);
  return serialized.includes('\n') || serialized.includes('\r') ? null : serialized;
}

/** Derives the logger level solely from normalized audit state. */
export function deriveProviderAuditSeverity(
  event: Pick<ProviderAuditRecord, 'event' | 'outcome'> & ProviderAuditMetadata,
): ProviderAuditSeverity {
  if (
    event.causeCode !== undefined &&
    DIAGNOSTIC_CAUSE_CODES.has(event.causeCode as DiagnosticProviderAuditCauseCode)
  ) {
    return 'warn';
  }
  if (event.event !== 'terminal') return 'info';
  if (
    event.outcome === 'success' ||
    event.outcome === 'cancelled' ||
    event.outcome === 'stale' ||
    event.discarded === true
  ) {
    return 'info';
  }
  if (event.errorClass === 'cancellation') return 'info';
  if (event.errorClass !== undefined && EXPECTED_WARNING_ERROR_CLASSES.has(event.errorClass)) {
    return 'warn';
  }
  return 'error';
}

/** Owns sequence and terminal state for one provider operation. */
class ProviderAuditLifecycleState<Family extends ProviderAuditFamily> implements ProviderAuditLifecycle<Family> {
  private sequence = 0;
  private startedEventAccepted = false;
  private terminalEventAccepted = false;

  public constructor(
    private readonly family: Family,
    private readonly providerId: ProviderAuditProviderId<Family> | undefined,
    private readonly operation: ProviderAuditOperation<Family>,
    private readonly operationId: string,
    private readonly now: () => Date,
    private readonly sink: ProviderAuditSink | null | undefined,
  ) {}

  public started(metadata?: ProviderAuditMetadataForFamily<Family>): void {
    if (this.startedEventAccepted || this.terminalEventAccepted) return;
    if (this.emit('started', 'dispatch', 'in-progress', metadata)) {
      this.startedEventAccepted = true;
    }
  }

  public phaseEntered(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void {
    if (!this.canEmitProgress()) return;
    this.emit('phase-entered', phase, 'in-progress', metadata);
  }

  public phaseCompleted(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void {
    if (!this.canEmitProgress()) return;
    this.emit('phase-completed', phase, 'success', metadata);
  }

  public retry(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void {
    if (!this.canEmitProgress()) return;
    this.emit('retry', phase, 'in-progress', metadata);
  }

  public recovery(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<Family>): void {
    if (!this.canEmitProgress()) return;
    this.emit('recovery', phase, 'in-progress', metadata);
  }

  public terminal(
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    metadata?: ProviderAuditMetadataForFamily<Family>,
  ): void {
    if (!this.canEmitProgress() || !isProviderAuditTerminalOutcome(outcome)) return;
    if (this.emit('terminal', phase, outcome, metadata)) {
      this.terminalEventAccepted = true;
    }
  }

  private canEmitProgress(): boolean {
    return this.startedEventAccepted && !this.terminalEventAccepted;
  }

  private emit(
    event: ProviderAuditRecord['event'],
    phase: ProviderAuditPhase,
    outcome: ProviderAuditOutcome,
    metadataInput?: ProviderAuditMetadataForFamily<Family>,
  ): boolean {
    try {
      if (!isProviderAuditPhase(phase)) return false;
      const metadata = validateProviderAuditMetadata(metadataInput, (candidate) =>
        isProviderAuditCauseCode(this.family, candidate),
      );
      if (!metadata) return false;

      const normalizedMetadata = this.providerId === undefined ? { ...metadata, providerKnown: false } : metadata;
      const occurredAt = getOccurredAt(this.now);
      if (!occurredAt) return false;

      const record: ProviderAuditRecord = {
        schemaVersion: PROVIDER_AUDIT_SCHEMA_VERSION,
        occurredAt,
        family: this.family,
        ...(this.providerId === undefined ? {} : { providerId: this.providerId }),
        operation: this.operation,
        operationId: this.operationId,
        sequence: this.sequence + 1,
        event,
        phase,
        outcome,
        ...normalizedMetadata,
      };
      const serialized = canonicalizeProviderAuditRecord(record, normalizedMetadata);
      if (!serialized) return false;
      const severity = deriveProviderAuditSeverity(record);

      this.sequence += 1;
      try {
        this.sink?.[severity](PROVIDER_AUDIT_LABEL, serialized);
      } catch {
        // Audit logging is diagnostic-only and cannot alter provider behavior.
      }
      return true;
    } catch {
      return false;
    }
  }
}

/** Main-process orchestration shared by every closed provider audit family. */
export abstract class BaseProviderAudit<Family extends ProviderAuditFamily> {
  public abstract readonly family: Family;

  private readonly dependencies: ProviderAuditDependencies;

  protected constructor(dependencies: ProviderAuditDependencies) {
    this.dependencies = dependencies;
  }

  public isKnownProviderId(providerId: unknown): providerId is ProviderAuditProviderId<Family> {
    return isProviderAuditProviderId(this.family, providerId);
  }

  public createLifecycle(
    providerId: unknown,
    operation: ProviderAuditOperation<Family>,
    operationId?: string,
  ): ProviderAuditLifecycle<Family> {
    const input: ProviderAuditLifecycleInput<Family> | UnknownProviderAuditLifecycleInput<Family> =
      this.isKnownProviderId(providerId)
        ? { family: this.family, operation, operationId, providerId }
        : { family: this.family, operation, operationId, providerKnown: false };
    try {
      return new FailOpenProviderAuditLifecycle(this.buildLifecycle(input));
    } catch {
      return NOOP_LIFECYCLE;
    }
  }

  public startOperation(
    providerId: unknown,
    operation: ProviderAuditOperation<Family>,
    phase: ProviderAuditPhase,
    metadata: ProviderAuditMetadataForFamily<Family> = {},
    operationId?: string,
  ): ProviderAuditOperationContext<Family> {
    const resolvedOperationId = this.resolveOperationId(operationId);
    const lifecycle =
      resolvedOperationId === undefined
        ? NOOP_LIFECYCLE
        : this.createLifecycle(providerId, operation, resolvedOperationId);
    const context = Object.freeze({
      lifecycle,
      now: this.dependencies.elapsedNow,
      ...(resolvedOperationId === undefined ? {} : { operationId: resolvedOperationId }),
      startedAt: this.safeElapsedNow(this.dependencies.elapsedNow),
    });
    lifecycle.started(metadata);
    lifecycle.phaseEntered(phase, metadata);
    return context;
  }

  private resolveOperationId(operationId?: string): string | undefined {
    if (operationId !== undefined) return operationId;
    try {
      const candidate = this.dependencies.randomUUID();
      return isCanonicalOperationId(candidate) ? candidate : undefined;
    } catch {
      return undefined;
    }
  }

  public durationMs(context: ProviderAuditOperationContext<Family>): number {
    return Math.max(0, this.safeElapsedNow(context.now) - context.startedAt);
  }

  protected normalizeException(error: unknown): ProviderAuditExceptionType {
    return normalizeProviderAuditExceptionType(error);
  }

  /** Test seam for deterministic or deliberately failing lifecycle implementations. */
  protected buildLifecycle(
    input: ProviderAuditLifecycleInput<Family> | UnknownProviderAuditLifecycleInput<Family>,
  ): ProviderAuditLifecycle<Family> {
    if (!isProviderAuditFamily(input.family)) {
      return NOOP_LIFECYCLE;
    }
    if (!isProviderAuditOperation(input.family, input.operation)) {
      return NOOP_LIFECYCLE;
    }

    const operationId = input.operationId ?? this.dependencies.randomUUID();
    if (!isCanonicalOperationId(operationId)) {
      return NOOP_LIFECYCLE;
    }

    const providerId =
      'providerId' in input && isProviderAuditProviderId(input.family, input.providerId) ? input.providerId : undefined;
    let sink: ProviderAuditSink | null | undefined;
    try {
      sink = this.dependencies.getSink();
    } catch {
      sink = undefined;
    }

    return new ProviderAuditLifecycleState(
      input.family,
      providerId,
      input.operation,
      operationId,
      this.dependencies.now,
      sink,
    );
  }

  private safeElapsedNow(now: () => number): number {
    try {
      const value = now();
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }
}
