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
import { VoiceProviderAudit } from '@main/providers/voiceProviderAudit';

export type VoiceAuditLifecycleInput =
  ProviderAuditLifecycleInput<'voice'> | UnknownProviderAuditLifecycleInput<'voice'>;

export interface RecordedVoiceAuditEvent {
  readonly event: 'started' | 'phase-entered' | 'phase-completed' | 'retry' | 'recovery' | 'terminal';
  readonly metadata?: ProviderAuditMetadataForFamily<'voice'>;
  readonly outcome?: ProviderAuditTerminalOutcome;
  readonly phase: ProviderAuditPhase;
}

export interface RecordedVoiceAuditOperation {
  readonly events: RecordedVoiceAuditEvent[];
  readonly input: VoiceAuditLifecycleInput;
}

class RecordingVoiceAuditLifecycle implements ProviderAuditLifecycle<'voice'> {
  public constructor(private readonly events: RecordedVoiceAuditEvent[]) {}

  public started(metadata?: ProviderAuditMetadataForFamily<'voice'>): void {
    this.events.push({ event: 'started', phase: 'dispatch', ...(metadata === undefined ? {} : { metadata }) });
  }

  public phaseEntered(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<'voice'>): void {
    this.events.push({ event: 'phase-entered', phase, ...(metadata === undefined ? {} : { metadata }) });
  }

  public phaseCompleted(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<'voice'>): void {
    this.events.push({ event: 'phase-completed', phase, ...(metadata === undefined ? {} : { metadata }) });
  }

  public retry(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<'voice'>): void {
    this.events.push({ event: 'retry', phase, ...(metadata === undefined ? {} : { metadata }) });
  }

  public recovery(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<'voice'>): void {
    this.events.push({ event: 'recovery', phase, ...(metadata === undefined ? {} : { metadata }) });
  }

  public terminal(
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    metadata?: ProviderAuditMetadataForFamily<'voice'>,
  ): void {
    this.events.push({
      event: 'terminal',
      phase,
      outcome,
      ...(metadata === undefined ? {} : { metadata }),
    });
  }
}

export class RecordingVoiceProviderAudit extends VoiceProviderAudit {
  public readonly operations: RecordedVoiceAuditOperation[] = [];

  public constructor(dependencies: Partial<ProviderAuditDependencies> = {}) {
    super(dependencies);
  }

  protected override buildLifecycle(input: VoiceAuditLifecycleInput): ProviderAuditLifecycle<'voice'> {
    const events: RecordedVoiceAuditEvent[] = [];
    this.operations.push({ events, input });
    return new RecordingVoiceAuditLifecycle(events);
  }
}

export function getTerminalEvents(operation: RecordedVoiceAuditOperation): RecordedVoiceAuditEvent[] {
  return operation.events.filter((event) => event.event === 'terminal');
}
