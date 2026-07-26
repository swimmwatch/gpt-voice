/* eslint-disable max-classes-per-file -- the recorder audit and lifecycle are one deterministic test seam. */
import type {
  ProviderAuditDependencies,
  ProviderAuditLifecycle,
  ProviderAuditLifecycleInput,
  ProviderAuditMetadataForFamily,
  ProviderAuditPhase,
  ProviderAuditTerminalOutcome,
  UnknownProviderAuditLifecycleInput,
} from '@main/providerAudit';
import { TranslationProviderAudit } from '@main/translateProviders/translationProviderAudit';
import type { TranslationProviderId } from '@shared/translationProvider';

export type TranslationAuditLifecycleInput =
  | ProviderAuditLifecycleInput<'translation'>
  | UnknownProviderAuditLifecycleInput<'translation'>;

export interface RecordedTranslationAuditEvent {
  readonly event: 'started' | 'phase-entered' | 'phase-completed' | 'retry' | 'recovery' | 'terminal';
  readonly metadata?: ProviderAuditMetadataForFamily<'translation'>;
  readonly outcome?: ProviderAuditTerminalOutcome;
  readonly phase: ProviderAuditPhase;
}

export interface RecordedTranslationAuditOperation {
  readonly events: RecordedTranslationAuditEvent[];
  readonly input: TranslationAuditLifecycleInput;
}

class RecordingTranslationAuditLifecycle implements ProviderAuditLifecycle<'translation'> {
  private startedAccepted = false;
  private terminalAccepted = false;

  public constructor(
    private readonly operationEvents: RecordedTranslationAuditEvent[],
    private readonly allEvents: RecordedTranslationAuditEvent[],
  ) {}

  public started(metadata?: ProviderAuditMetadataForFamily<'translation'>): void {
    if (this.startedAccepted || this.terminalAccepted) return;
    this.startedAccepted = true;
    this.record({ event: 'started', phase: 'dispatch', ...(metadata === undefined ? {} : { metadata }) });
  }

  public phaseEntered(
    phase: ProviderAuditPhase,
    metadata?: ProviderAuditMetadataForFamily<'translation'>,
  ): void {
    this.recordProgress('phase-entered', phase, metadata);
  }

  public phaseCompleted(
    phase: ProviderAuditPhase,
    metadata?: ProviderAuditMetadataForFamily<'translation'>,
  ): void {
    this.recordProgress('phase-completed', phase, metadata);
  }

  public retry(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<'translation'>): void {
    this.recordProgress('retry', phase, metadata);
  }

  public recovery(phase: ProviderAuditPhase, metadata?: ProviderAuditMetadataForFamily<'translation'>): void {
    this.recordProgress('recovery', phase, metadata);
  }

  public terminal(
    phase: ProviderAuditPhase,
    outcome: ProviderAuditTerminalOutcome,
    metadata?: ProviderAuditMetadataForFamily<'translation'>,
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
    event: Exclude<RecordedTranslationAuditEvent['event'], 'started' | 'terminal'>,
    phase: ProviderAuditPhase,
    metadata?: ProviderAuditMetadataForFamily<'translation'>,
  ): void {
    if (!this.startedAccepted || this.terminalAccepted) return;
    this.record({ event, phase, ...(metadata === undefined ? {} : { metadata }) });
  }

  private record(event: RecordedTranslationAuditEvent): void {
    this.operationEvents.push(event);
    this.allEvents.push(event);
  }
}

class RecordingTranslationProviderAudit extends TranslationProviderAudit {
  public constructor(
    private readonly operations: RecordedTranslationAuditOperation[],
    private readonly events: RecordedTranslationAuditEvent[],
    dependencies: Partial<ProviderAuditDependencies>,
  ) {
    super(dependencies);
  }

  protected override buildLifecycle(input: TranslationAuditLifecycleInput): ProviderAuditLifecycle<'translation'> {
    const operationEvents: RecordedTranslationAuditEvent[] = [];
    this.operations.push({ events: operationEvents, input });
    return new RecordingTranslationAuditLifecycle(operationEvents, this.events);
  }
}

export function createTranslationAuditRecorder(): {
  readonly audit: TranslationProviderAudit;
  readonly events: RecordedTranslationAuditEvent[];
  readonly operations: RecordedTranslationAuditOperation[];
} {
  const events: RecordedTranslationAuditEvent[] = [];
  const operations: RecordedTranslationAuditOperation[] = [];
  return {
    audit: new RecordingTranslationProviderAudit(operations, events, {
      elapsedNow: () => 1_000,
    }),
    events,
    operations,
  };
}

export const noopTranslationProviderAudit = new TranslationProviderAudit({
  elapsedNow: () => 1_000,
  getSink: () => null,
});

export function createTranslationAuditRequestFields(
  providerId: TranslationProviderId,
  audit: TranslationProviderAudit = noopTranslationProviderAudit,
) {
  return {
    audit,
    auditContext: audit.startOperation(providerId, 'translate', 'validation'),
  };
}
