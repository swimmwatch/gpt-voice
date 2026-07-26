import { randomUUID } from 'node:crypto';

import { createLogger } from '@main/logger';

import {
  PROVIDER_AUDIT_LABEL,
  PROVIDER_AUDIT_SCHEMA_VERSION,
  type ProviderAuditFamily,
  type ProviderAuditMetadata,
  type ProviderAuditMetadataKey,
  type ProviderAuditOutcome,
  type ProviderAuditPhase,
  type ProviderAuditRecord,
  type ProviderAuditSeverity,
  type ProviderAuditTerminalOutcome,
  isProviderAuditFamily,
  isProviderAuditPhase,
  isProviderAuditTerminalOutcome,
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
  readonly providerId: unknown;
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
  readonly getSink: () => ProviderAuditSink | null | undefined;
  readonly now: () => Date;
  readonly randomUUID: () => string;
}

const DEFAULT_DEPENDENCIES: ProviderAuditDependencies = {
  getSink: () => createLogger('provider-audit'),
  now: () => new Date(),
  randomUUID,
};

const NOOP_LIFECYCLE: ProviderAuditLifecycle<ProviderAuditFamily> = {
  started: () => undefined,
  phaseEntered: () => undefined,
  phaseCompleted: () => undefined,
  retry: () => undefined,
  recovery: () => undefined,
  terminal: () => undefined,
};

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
  if (event.event !== 'terminal') return 'info';
  if (
    event.outcome === 'success' ||
    event.outcome === 'cancelled' ||
    event.outcome === 'stale' ||
    event.discarded === true
  ) {
    return 'info';
  }
  if (
    event.causeCode !== undefined &&
    DIAGNOSTIC_CAUSE_CODES.has(event.causeCode as DiagnosticProviderAuditCauseCode)
  ) {
    return 'warn';
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

export function createProviderAuditLifecycle<Family extends ProviderAuditFamily>(
  input: ProviderAuditLifecycleInput<Family> | UnknownProviderAuditLifecycleInput<Family>,
  dependencies: Partial<ProviderAuditDependencies> = {},
): ProviderAuditLifecycle<Family> {
  try {
    if (!isProviderAuditFamily(input.family)) {
      return NOOP_LIFECYCLE;
    }
    if (!isProviderAuditOperation(input.family, input.operation)) {
      return NOOP_LIFECYCLE;
    }

    const idGenerator = dependencies.randomUUID ?? DEFAULT_DEPENDENCIES.randomUUID;
    const operationId = input.operationId ?? idGenerator();
    if (!isCanonicalOperationId(operationId)) {
      return NOOP_LIFECYCLE;
    }

    const providerId =
      'providerKnown' in input && input.providerKnown === false
        ? undefined
        : isProviderAuditProviderId(input.family, input.providerId)
          ? input.providerId
          : undefined;
    const now = dependencies.now ?? DEFAULT_DEPENDENCIES.now;
    let sink: ProviderAuditSink | null | undefined;
    try {
      sink = (dependencies.getSink ?? DEFAULT_DEPENDENCIES.getSink)();
    } catch {
      sink = undefined;
    }

    return new ProviderAuditLifecycleState(input.family, providerId, input.operation, operationId, now, sink);
  } catch {
    return NOOP_LIFECYCLE;
  }
}
