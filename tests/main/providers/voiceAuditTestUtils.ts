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
  | ProviderAuditLifecycleInput<'voice'>
  | UnknownProviderAuditLifecycleInput<'voice'>;

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

class RecordingVoiceProviderAudit extends VoiceProviderAudit {
  public constructor(
    private readonly operations: RecordedVoiceAuditOperation[],
    dependencies: Partial<ProviderAuditDependencies>,
  ) {
    super(dependencies);
  }

  protected override buildLifecycle(input: VoiceAuditLifecycleInput): ProviderAuditLifecycle<'voice'> {
    const events: RecordedVoiceAuditEvent[] = [];
    this.operations.push({ events, input });
    return {
      started: (metadata) => {
        events.push({ event: 'started', phase: 'dispatch', ...(metadata === undefined ? {} : { metadata }) });
      },
      phaseEntered: (phase, metadata) => {
        events.push({ event: 'phase-entered', phase, ...(metadata === undefined ? {} : { metadata }) });
      },
      phaseCompleted: (phase, metadata) => {
        events.push({ event: 'phase-completed', phase, ...(metadata === undefined ? {} : { metadata }) });
      },
      retry: (phase, metadata) => {
        events.push({ event: 'retry', phase, ...(metadata === undefined ? {} : { metadata }) });
      },
      recovery: (phase, metadata) => {
        events.push({ event: 'recovery', phase, ...(metadata === undefined ? {} : { metadata }) });
      },
      terminal: (phase, outcome, metadata) => {
        events.push({
          event: 'terminal',
          phase,
          outcome,
          ...(metadata === undefined ? {} : { metadata }),
        });
      },
    };
  }
}

export function createVoiceAuditRecorder(
  dependencies: Partial<ProviderAuditDependencies> = {},
): {
  readonly audit: VoiceProviderAudit;
  readonly operations: RecordedVoiceAuditOperation[];
} {
  const operations: RecordedVoiceAuditOperation[] = [];
  return {
    audit: new RecordingVoiceProviderAudit(operations, dependencies),
    operations,
  };
}

export function getTerminalEvents(operation: RecordedVoiceAuditOperation): RecordedVoiceAuditEvent[] {
  return operation.events.filter((event) => event.event === 'terminal');
}
