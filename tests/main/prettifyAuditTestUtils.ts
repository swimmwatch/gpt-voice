/* eslint-disable max-classes-per-file -- the recorder audit and lifecycle form one deterministic test seam. */
import type {
  ProviderAuditDependencies,
  ProviderAuditLifecycle,
  ProviderAuditLifecycleInput,
  ProviderAuditMetadataForFamily,
  ProviderAuditPhase,
  ProviderAuditTerminalOutcome,
  UnknownProviderAuditLifecycleInput,
} from '@main/providerAudit';
import { PrettifyProviderAudit } from '@main/services/prettifyProviderAudit';
import { TEST_PROVIDER_AUDIT_DEPENDENCIES } from './providerAudit/providerAuditTestDependencies';

export type PrettifyAuditLifecycleInput =
  ProviderAuditLifecycleInput<'prettify'> | UnknownProviderAuditLifecycleInput<'prettify'>;

export interface RecordedPrettifyAuditEvent {
  readonly event: 'started' | 'phase-entered' | 'phase-completed' | 'retry' | 'recovery' | 'terminal';
  readonly metadata?: ProviderAuditMetadataForFamily<'prettify'>;
  readonly outcome?: ProviderAuditTerminalOutcome;
  readonly phase: ProviderAuditPhase;
}

export interface RecordedPrettifyAuditOperation {
  readonly events: RecordedPrettifyAuditEvent[];
  readonly input: PrettifyAuditLifecycleInput;
}

class RecordingPrettifyAuditLifecycle implements ProviderAuditLifecycle<'prettify'> {
  private startedAccepted = false;
  private terminalAccepted = false;

  public constructor(
    private readonly operationEvents: RecordedPrettifyAuditEvent[],
    private readonly allEvents: RecordedPrettifyAuditEvent[],
  ) {}

  public started(metadata?: ProviderAuditMetadataForFamily<'prettify'>): void {
    if (this.startedAccepted || this.terminalAccepted) return;
    this.startedAccepted = true;
    this.record({ event: 'started', phase: 'dispatch', ...(metadata === undefined ? {} : { metadata }) });
  }

  public phaseEntered(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<'prettify'>): void {
    this.recordProgress('phase-entered', phase, metadata);
  }

  public phaseCompleted(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<'prettify'>): void {
    this.recordProgress('phase-completed', phase, metadata);
  }

  public retry(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<'prettify'>): void {
    this.recordProgress('retry', phase, metadata);
  }

  public recovery(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<'prettify'>): void {
    this.recordProgress('recovery', phase, metadata);
  }

  public terminal(
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    metadata?: ProviderAuditMetadataForFamily<'prettify'>,
  ): void {
    if (!this.startedAccepted || this.terminalAccepted) return;
    this.terminalAccepted = true;
    this.record({
      event: 'terminal',
      phase,
      outcome,
      ...(metadata === undefined ? {} : { metadata }),
    });
  }

  private recordProgress(
    event: Exclude<RecordedPrettifyAuditEvent['event'], 'started' | 'terminal'>,
    phase: ProviderAuditPhase,
    metadata?: ProviderAuditMetadataForFamily<'prettify'>,
  ): void {
    if (!this.startedAccepted || this.terminalAccepted) return;
    this.record({ event, phase, ...(metadata === undefined ? {} : { metadata }) });
  }

  private record(event: RecordedPrettifyAuditEvent): void {
    this.operationEvents.push(event);
    this.allEvents.push(event);
  }
}

export class RecordingPrettifyProviderAudit extends PrettifyProviderAudit {
  public readonly events: RecordedPrettifyAuditEvent[] = [];
  public readonly operations: RecordedPrettifyAuditOperation[] = [];

  public constructor(dependencies: Partial<ProviderAuditDependencies> = {}) {
    super({ ...TEST_PROVIDER_AUDIT_DEPENDENCIES, ...dependencies });
  }

  protected override buildLifecycle(input: PrettifyAuditLifecycleInput): ProviderAuditLifecycle<'prettify'> {
    const operationEvents: RecordedPrettifyAuditEvent[] = [];
    this.operations.push({ events: operationEvents, input });
    return new RecordingPrettifyAuditLifecycle(operationEvents, this.events);
  }
}

export function getTerminalEvents(operation: RecordedPrettifyAuditOperation): RecordedPrettifyAuditEvent[] {
  return operation.events.filter((event) => event.event === 'terminal');
}
