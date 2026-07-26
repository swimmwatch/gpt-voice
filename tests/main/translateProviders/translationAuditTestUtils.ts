import type {
  ProviderAuditLifecycle,
  ProviderAuditMetadataForFamily,
  ProviderAuditPhase,
  ProviderAuditTerminalOutcome,
} from '@main/providerAudit';

export interface RecordedTranslationAuditEvent {
  readonly event: 'started' | 'phase-entered' | 'phase-completed' | 'retry' | 'recovery' | 'terminal';
  readonly metadata?: ProviderAuditMetadataForFamily<'translation'>;
  readonly outcome?: ProviderAuditTerminalOutcome;
  readonly phase: ProviderAuditPhase;
}

export function createTranslationAuditRecorder(): {
  readonly events: RecordedTranslationAuditEvent[];
  readonly lifecycle: ProviderAuditLifecycle<'translation'>;
} {
  const events: RecordedTranslationAuditEvent[] = [];
  return {
    events,
    lifecycle: {
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
    },
  };
}

export function createNoopTranslationAuditLifecycle(): ProviderAuditLifecycle<'translation'> {
  return {
    started: () => undefined,
    phaseEntered: () => undefined,
    phaseCompleted: () => undefined,
    retry: () => undefined,
    recovery: () => undefined,
    terminal: () => undefined,
  };
}
