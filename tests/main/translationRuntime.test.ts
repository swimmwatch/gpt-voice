/* eslint-disable max-classes-per-file -- construction and invocation failures require distinct audit subclasses. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TranslationRuntime,
  type TranslationExecutionSnapshot,
  type TranslationRuntimeRegistry,
} from '@main/services/translation';
import type { ProviderAuditLifecycle } from '@main/providerAudit';
import type {
  TranslationProviderInitializationOutcome,
  TranslationProviderInitializationRequest,
  TranslationProviderFailureCode,
  TranslationProviderOutcome,
  TranslationProviderRequest,
} from '@main/translateProviders/translationProviderContracts';
import { TranslationProviderAudit } from '@main/translateProviders/translationProviderAudit';
import {
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
  type TranslationProviderConnectionState,
  type TranslationProviderId,
  type TranslationSettings,
} from '@shared/translationProvider';
import { noopTranslationProviderAudit } from './translateProviders/translationAuditTestUtils';
import { I18nService } from '@main/i18n';
import { TEST_PROVIDER_AUDIT_DEPENDENCIES } from './providerAudit/providerAuditTestDependencies';
import { RecordingDiagnosticCapture } from './diagnosticCaptureTestUtils';
import { InitialProviderReadinessTestDependencies } from './initialProviderReadinessTestUtils';
import { INITIAL_PROVIDER_READINESS_TIMEOUT_MS } from '@main/services/initialProviderReadinessDeadline';

const DEFAULT_SETTINGS: TranslationSettings = {
  providerId: 'google',
  targetLanguageByProvider: {
    google: 'uk',
    bing: 'ru',
    yandex: 'be',
  },
};
const localization = new I18nService();

class MutableTranslationConfig {
  public constructor(
    private settings: TranslationSettings,
    private readonly error?: Error,
    private translateEnabled = true,
  ) {}

  public getTextActionSettings(): {
    prettifyEnabled: boolean;
    prettifyQuickEnabled: boolean;
    translateEnabled: boolean;
  } {
    return { prettifyEnabled: true, prettifyQuickEnabled: true, translateEnabled: this.translateEnabled };
  }

  public getTranslationSettings(): TranslationSettings {
    if (this.error) throw this.error;
    return this.settings;
  }

  public setSettings(settings: TranslationSettings): void {
    this.settings = settings;
  }

  public setTranslationEnabled(enabled: boolean): void {
    this.translateEnabled = enabled;
  }
}

function createSuccess(request: TranslationProviderRequest, text = 'translated'): TranslationProviderOutcome {
  return {
    success: true,
    text,
    metadata: {
      providerId: request.providerId,
      targetLanguage: request.targetLanguage,
      contractVersion: '2026-07-25',
      sourceLength: request.sourceText.length,
      resultLength: text.length,
      durationMs: 2,
      attemptCount: 1,
      phase: 'cleanup',
    },
  };
}

interface RuntimeHarnessOptions {
  audit?: TranslationProviderAudit;
  diagnosticCapture?: RecordingDiagnosticCapture;
  initialize?: (request: TranslationProviderInitializationRequest) => Promise<TranslationProviderInitializationOutcome>;
  outcome?: TranslationProviderOutcome;
  readinessDeadline?: InitialProviderReadinessTestDependencies;
  settings?: TranslationSettings;
  shutdownError?: Error;
  shutdownFailedProviderIds?: readonly TranslationProviderId[];
  translate?: (request: TranslationProviderRequest) => Promise<TranslationProviderOutcome>;
  translationEnabled?: boolean;
}

interface CapturedAuditEntry {
  readonly level: 'info' | 'warn' | 'error';
  readonly record: {
    readonly causeCode?: string;
    readonly discarded?: boolean;
    readonly errorClass?: string;
    readonly event: string;
    readonly exceptionType?: string;
    readonly operation: string;
    readonly operationId: string;
    readonly outcome: string;
    readonly providerId?: string;
    readonly providerKnown?: boolean;
    readonly sequence: number;
  };
  readonly serialized: string;
}

class CapturingTranslationProviderAudit extends TranslationProviderAudit {
  public readonly entries: CapturedAuditEntry[];

  public constructor() {
    const entries: CapturedAuditEntry[] = [];
    let operationIdCounter = 0;
    let timestamp = Date.parse('2026-07-26T12:00:00.000Z');
    const capture =
      (level: CapturedAuditEntry['level']) =>
      (...args: unknown[]): void => {
        assert.equal(args[0], 'Provider audit event');
        assert.equal(typeof args[1], 'string');
        assert.equal(args.length, 2);
        const serialized = args[1] as string;
        entries.push({
          level,
          record: JSON.parse(serialized) as CapturedAuditEntry['record'],
          serialized,
        });
      };
    const sink = {
      info: capture('info'),
      warn: capture('warn'),
      error: capture('error'),
    };

    super({
      ...TEST_PROVIDER_AUDIT_DEPENDENCIES,
      getSink: () => sink,
      now: () => {
        timestamp += 1;
        return new Date(timestamp);
      },
      randomUUID: () => {
        operationIdCounter += 1;
        return `00000000-0000-4000-8000-${String(operationIdCounter).padStart(12, '0')}`;
      },
    });
    this.entries = entries;
  }
}

class ThrowingConstructionTranslationProviderAudit extends TranslationProviderAudit {
  public constructor() {
    super(TEST_PROVIDER_AUDIT_DEPENDENCIES);
  }

  protected override buildLifecycle(): ProviderAuditLifecycle<'translation'> {
    throw new Error('audit-construction-private-canary');
  }
}

class ThrowingLifecycleTranslationProviderAudit extends TranslationProviderAudit {
  public constructor() {
    super(TEST_PROVIDER_AUDIT_DEPENDENCIES);
  }

  protected override buildLifecycle(): ProviderAuditLifecycle<'translation'> {
    const throwAuditError = (): never => {
      throw new Error('audit-lifecycle-private-canary');
    };
    return {
      started: throwAuditError,
      phaseEntered: throwAuditError,
      phaseCompleted: throwAuditError,
      retry: throwAuditError,
      recovery: throwAuditError,
      terminal: throwAuditError,
    };
  }
}

function createRuntimeHarness(options: RuntimeHarnessOptions = {}) {
  let now = 100;
  const config = new MutableTranslationConfig(
    options.settings ?? DEFAULT_SETTINGS,
    undefined,
    options.translationEnabled,
  );
  const getProviderCalls: unknown[] = [];
  const initializationRequests: TranslationProviderInitializationRequest[] = [];
  const requests: TranslationProviderRequest[] = [];
  let shutdownCalls = 0;
  let cancelInitializationCalls = 0;
  const failedProviderIds = options.shutdownFailedProviderIds ?? [];
  const diagnosticCapture = options.diagnosticCapture ?? new RecordingDiagnosticCapture();
  const readinessDeadline = options.readinessDeadline ?? new InitialProviderReadinessTestDependencies();

  const registry: TranslationRuntimeRegistry = {
    getProvider: (providerId) => {
      getProviderCalls.push(providerId);
      return {
        cancelInitialization: () => {
          cancelInitializationCalls += 1;
        },
        initialize: async (request) => {
          initializationRequests.push(request);
          if (options.initialize) return options.initialize(request);
          const outcome: TranslationProviderInitializationOutcome = {
            success: true,
            metadata: {
              providerId: request.providerId,
              targetLanguage: request.targetLanguage,
              contractVersion: '2026-07-25',
              durationMs: 2,
              attemptCount: 1,
              phase: 'targetSelection',
            },
          };
          request.auditContext.lifecycle.terminal(
            'target-selection',
            'success',
            request.audit.createMetadata(outcome.metadata),
          );
          return outcome;
        },
        translate: async (request) => {
          requests.push(request);
          if (options.translate) return options.translate(request);
          return options.outcome ?? createSuccess(request);
        },
      };
    },
    shutdown: async () => {
      shutdownCalls += 1;
      if (options.shutdownError) throw options.shutdownError;
      return {
        success: failedProviderIds.length === 0,
        failedProviderIds,
      };
    },
  };
  const runtime = new TranslationRuntime({
    audit: options.audit ?? noopTranslationProviderAudit,
    config,
    diagnosticCapture,
    localization,
    now: () => {
      now += 1;
      return now;
    },
    readinessDeadline,
    registry,
  });

  return {
    getProviderCalls,
    initializationRequests,
    diagnosticCapture,
    requests,
    readinessDeadline,
    runtime,
    setSettings: (next: TranslationSettings) => {
      config.setSettings(next);
    },
    setTranslationEnabled: (enabled: boolean) => {
      config.setTranslationEnabled(enabled);
    },
    get shutdownCalls() {
      return shutdownCalls;
    },
    get cancelInitializationCalls() {
      return cancelInitializationCalls;
    },
  };
}

function getSnapshot(runtime: TranslationRuntime): TranslationExecutionSnapshot {
  const result = runtime.getSnapshot();
  assert.equal(result.success, true);
  if (!result.success) throw new Error('synthetic snapshot failure');
  return result.snapshot;
}

describe('TranslationRuntime', () => {
  it('creates an immutable exact provider settings snapshot without registry access', () => {
    const harness = createRuntimeHarness();

    const snapshot = getSnapshot(harness.runtime);

    assert.deepEqual(snapshot, {
      providerId: 'google',
      providerName: 'Google',
      targetLanguage: 'uk',
      contractVersion: '2026-07-25',
      maxInputCharacters: 5_000,
      generation: 0,
    });
    assert.equal(Object.isFrozen(snapshot), true);
    assert.deepEqual(harness.getProviderCalls, []);
  });

  it('initializes the selected provider and target without dispatching translation text', async () => {
    const audit = new CapturingTranslationProviderAudit();
    const harness = createRuntimeHarness({
      audit,
      settings: {
        ...DEFAULT_SETTINGS,
        providerId: 'yandex',
      },
    });
    const states: TranslationProviderConnectionState[] = [];
    harness.runtime.subscribeConnectionState((state) => states.push(state));

    const result = await harness.runtime.initializeSelectedProvider();

    assert.deepEqual(harness.getProviderCalls, ['yandex']);
    assert.equal(harness.initializationRequests.length, 1);
    assert.equal(harness.initializationRequests[0]?.providerId, 'yandex');
    assert.equal(harness.initializationRequests[0]?.targetLanguage, 'be');
    assert.equal('sourceText' in (harness.initializationRequests[0] ?? {}), false);
    assert.deepEqual(harness.requests, []);
    assert.equal(
      audit.entries.every((entry) => entry.record.operation === 'settings-readiness'),
      true,
    );
    assert.equal(audit.entries.filter((entry) => entry.record.event === 'terminal').length, 1);
    assert.equal(audit.entries[audit.entries.length - 1]?.record.outcome, 'success');
    assert.deepEqual(states, [
      {
        detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider,
        providerId: 'yandex',
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking,
        targetLanguage: 'be',
      },
      {
        detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
        providerId: 'yandex',
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
        targetLanguage: 'be',
      },
    ]);
    assert.equal(result, states[1]);
    assert.equal(harness.runtime.getConnectionState(), result);
  });

  it('reports disabled Translation without opening a provider', async () => {
    const harness = createRuntimeHarness({ translationEnabled: false });
    const states: TranslationProviderConnectionState[] = [];
    harness.runtime.subscribeConnectionState((state) => states.push(state));

    const result = await harness.runtime.initializeSelectedProvider();

    assert.deepEqual(result, {
      detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.TranslationDisabled,
      providerId: 'google',
      status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
      targetLanguage: 'uk',
    });
    assert.deepEqual(states, [result]);
    assert.deepEqual(harness.getProviderCalls, []);
    assert.deepEqual(harness.initializationRequests, []);
  });

  it('keeps startup initialization fail-open and audits normalized provider exceptions', async () => {
    const audit = new CapturingTranslationProviderAudit();
    const harness = createRuntimeHarness({
      audit,
      initialize: async () => {
        throw new Error('https://translate.private/session/private-startup-canary');
      },
    });

    await harness.runtime.initializeSelectedProvider();

    const terminal = audit.entries[audit.entries.length - 1];
    assert.equal(terminal?.record.event, 'terminal');
    assert.equal(terminal?.record.outcome, 'failure');
    assert.equal(terminal?.record.causeCode, 'pageContractFailure');
    assert.equal(terminal?.record.exceptionType, 'Error');
    assert.equal(terminal?.level, 'error');
    assert.equal(JSON.stringify(audit.entries).includes('private-startup-canary'), false);
    assert.deepEqual(harness.runtime.getConnectionState(), {
      detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.UnexpectedFailure,
      providerId: 'google',
      status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
      targetLanguage: 'uk',
    });
    assert.doesNotMatch(JSON.stringify(harness.runtime.getConnectionState()), /private|https/i);

    const outcome = await harness.runtime.translateWithSnapshot('first request', getSnapshot(harness.runtime));
    assert.equal(outcome.success, true);
    assert.deepEqual(harness.getProviderCalls, ['google', 'google']);
    assert.equal(harness.requests.length, 1);
  });

  it('maps closed provider readiness failures to human-readable connection details', async () => {
    const expectations: ReadonlyArray<
      readonly [TranslationProviderFailureCode, TranslationProviderConnectionState['detail']]
    > = [
      ['navigationFailure', TRANSLATION_PROVIDER_CONNECTION_DETAILS.NavigationFailed],
      ['consentOrChallenge', TRANSLATION_PROVIDER_CONNECTION_DETAILS.ConsentOrChallenge],
      ['pageContractFailure', TRANSLATION_PROVIDER_CONNECTION_DETAILS.PageChanged],
      ['cleanupFailure', TRANSLATION_PROVIDER_CONNECTION_DETAILS.CleanupFailed],
      ['cancelledOrStaleOperation', TRANSLATION_PROVIDER_CONNECTION_DETAILS.Cancelled],
    ];

    for (const [code, detail] of expectations) {
      const harness = createRuntimeHarness({
        initialize: async (request) => ({
          code,
          discard: code === 'cancelledOrStaleOperation',
          metadata: {
            attemptCount: 1,
            contractVersion: '2026-07-25',
            durationMs: 2,
            phase: 'readiness',
            providerId: request.providerId,
            targetLanguage: request.targetLanguage,
          },
          success: false,
        }),
      });

      assert.deepEqual(await harness.runtime.initializeSelectedProvider(), {
        detail,
        providerId: 'google',
        status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
        targetLanguage: 'uk',
      });
    }
  });

  it('suppresses stale initialization completion after the selected provider changes', async () => {
    let resolveGoogle!: (outcome: TranslationProviderInitializationOutcome) => void;
    const googleOutcome = new Promise<TranslationProviderInitializationOutcome>((resolve) => {
      resolveGoogle = resolve;
    });
    const harness = createRuntimeHarness({
      initialize: (request) => {
        if (request.providerId === 'google') {
          return googleOutcome;
        }
        return Promise.resolve({
          success: true,
          metadata: {
            attemptCount: 1,
            contractVersion: '2026-07-25',
            durationMs: 2,
            phase: 'targetSelection',
            providerId: request.providerId,
            targetLanguage: request.targetLanguage,
          },
        });
      },
    });
    const states: TranslationProviderConnectionState[] = [];
    harness.runtime.subscribeConnectionState((state) => states.push(state));

    const googleInitialization = harness.runtime.initializeSelectedProvider();
    harness.setSettings({ ...DEFAULT_SETTINGS, providerId: 'yandex' });
    const yandexResult = await harness.runtime.initializeSelectedProvider();
    resolveGoogle({
      success: true,
      metadata: {
        attemptCount: 1,
        contractVersion: '2026-07-25',
        durationMs: 3,
        phase: 'targetSelection',
        providerId: 'google',
        targetLanguage: 'uk',
      },
    });
    await googleInitialization;

    assert.deepEqual(yandexResult, {
      detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
      providerId: 'yandex',
      status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
      targetLanguage: 'be',
    });
    assert.equal(
      states.some(
        (state) => state.providerId === 'google' && state.status === TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
      ),
      false,
    );
    assert.equal(harness.runtime.getConnectionState(), yandexResult);
  });

  it('times out ignored initialization cancellation and lets a later attempt connect', async () => {
    const audit = new CapturingTranslationProviderAudit();
    const readinessDeadline = new InitialProviderReadinessTestDependencies();
    let initializationCount = 0;
    let resolveFirst!: (outcome: TranslationProviderInitializationOutcome) => void;
    const firstOutcome = new Promise<TranslationProviderInitializationOutcome>((resolve) => {
      resolveFirst = resolve;
    });
    const harness = createRuntimeHarness({
      audit,
      readinessDeadline,
      initialize: async (request) => {
        initializationCount += 1;
        if (initializationCount === 1) return firstOutcome;
        return {
          success: true,
          metadata: {
            attemptCount: 1,
            contractVersion: '2026-07-25',
            durationMs: 2,
            phase: 'targetSelection',
            providerId: request.providerId,
            targetLanguage: request.targetLanguage,
          },
        };
      },
    });

    const first = harness.runtime.initializeSelectedProvider();
    await Promise.resolve();
    readinessDeadline.clock.advanceBy(INITIAL_PROVIDER_READINESS_TIMEOUT_MS);
    const timedOut = await first;

    assert.deepEqual(timedOut, {
      detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.UnexpectedFailure,
      providerId: 'google',
      status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
      targetLanguage: 'uk',
    });
    assert.equal(harness.initializationRequests[0]?.signal?.aborted, true);
    assert.equal(harness.cancelInitializationCalls, 1);
    const timeoutTerminal = audit.entries.find(
      (entry) => entry.record.event === 'terminal' && entry.record.causeCode === 'timed-out',
    );
    assert.equal(timeoutTerminal?.record.operation, 'settings-readiness');
    assert.equal(timeoutTerminal?.record.errorClass, 'timeout');
    assert.equal(timeoutTerminal?.record.outcome, 'failure');

    const retry = await harness.runtime.initializeSelectedProvider();
    assert.equal(retry.status, TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected);

    resolveFirst({
      success: true,
      metadata: {
        attemptCount: 1,
        contractVersion: '2026-07-25',
        durationMs: 3,
        phase: 'targetSelection',
        providerId: 'google',
        targetLanguage: 'uk',
      },
    });
    await Promise.resolve();
    assert.equal(harness.runtime.getConnectionState(), retry);
    assert.equal(
      audit.entries.filter((entry) => entry.record.causeCode === 'timed-out' && entry.record.event === 'terminal')
        .length,
      1,
    );
  });

  it('fails closed for unsupported provider and target settings without registry access', () => {
    const providerAudit = new CapturingTranslationProviderAudit();
    const targetAudit = new CapturingTranslationProviderAudit();
    const invalidProvider = createRuntimeHarness({
      audit: providerAudit,
      settings: {
        providerId: 'deepl-private-provider-canary',
        targetLanguageByProvider: {},
      } as unknown as TranslationSettings,
    });
    const invalidTarget = createRuntimeHarness({
      audit: targetAudit,
      settings: {
        ...DEFAULT_SETTINGS,
        targetLanguageByProvider: {
          ...DEFAULT_SETTINGS.targetLanguageByProvider,
          google: 'auto',
        },
      },
    });

    const providerFailure = invalidProvider.runtime.getSnapshot();
    const targetFailure = invalidTarget.runtime.getSnapshot();

    assert.equal(providerFailure.success, false);
    assert.equal(providerFailure.success ? null : providerFailure.code, 'unsupportedProvider');
    assert.equal(targetFailure.success, false);
    assert.equal(targetFailure.success ? null : targetFailure.code, 'unsupportedTargetLanguage');
    assert.deepEqual(invalidProvider.getProviderCalls, []);
    assert.deepEqual(invalidTarget.getProviderCalls, []);
    assert.equal(JSON.stringify(providerAudit.entries).includes('deepl-private-provider-canary'), false);
    assert.equal(
      providerAudit.entries.every((entry) => entry.record.providerId === undefined),
      true,
    );
    assert.equal(
      providerAudit.entries.every((entry) => entry.record.providerKnown === false),
      true,
    );
    assert.equal(providerAudit.entries.filter((entry) => entry.record.event === 'terminal').length, 1);
    assert.equal(providerAudit.entries[providerAudit.entries.length - 1]?.level, 'warn');
    assert.equal(targetAudit.entries[targetAudit.entries.length - 1]?.record.causeCode, 'unsupportedTargetLanguage');
    assert.equal(targetAudit.entries[targetAudit.entries.length - 1]?.level, 'warn');
  });

  it('audits settings snapshot exceptions without changing the thrown error', () => {
    const audit = new CapturingTranslationProviderAudit();
    const settingsError = new Error('settings-session-private-canary');
    const runtime = new TranslationRuntime({
      audit: audit,
      config: new MutableTranslationConfig(DEFAULT_SETTINGS, settingsError),
      diagnosticCapture: new RecordingDiagnosticCapture(),
      localization,
      now: () => 100,
      readinessDeadline: new InitialProviderReadinessTestDependencies(),
      registry: {
        getProvider: () => {
          throw new Error('provider must not be created');
        },
        shutdown: async () => ({ success: true, failedProviderIds: [] }),
      },
    });

    assert.throws(
      () => runtime.getSnapshot(),
      (error: unknown) => error === settingsError,
    );
    assert.equal(audit.entries.filter((entry) => entry.record.event === 'terminal').length, 1);
    assert.equal(audit.entries[audit.entries.length - 1]?.level, 'error');
    assert.equal(audit.entries[audit.entries.length - 1]?.record.exceptionType, 'Error');
    assert.equal(JSON.stringify(audit.entries).includes('settings-session-private-canary'), false);
  });

  it('rejects empty and over-limit text before provider creation', async () => {
    const audit = new CapturingTranslationProviderAudit();
    const harness = createRuntimeHarness({
      audit: audit,
      settings: {
        ...DEFAULT_SETTINGS,
        providerId: 'bing',
      },
    });
    const snapshot = getSnapshot(harness.runtime);

    const empty = await harness.runtime.translateWithSnapshot('   ', snapshot);
    const tooLong = await harness.runtime.translateWithSnapshot('x'.repeat(1_001), snapshot);

    assert.equal(empty.success ? null : empty.code, 'emptyInput');
    assert.equal(tooLong.success ? null : tooLong.code, 'inputTooLong');
    assert.deepEqual(harness.getProviderCalls, []);
    const translateTerminals = audit.entries.filter(
      (entry) => entry.record.operation === 'translate' && entry.record.event === 'terminal',
    );
    assert.deepEqual(
      translateTerminals.map((entry) => [entry.record.causeCode, entry.level]),
      [
        ['emptyInput', 'warn'],
        ['inputTooLong', 'warn'],
      ],
    );
  });

  it('submits the original complete source once through the selected provider', async () => {
    const audit = new CapturingTranslationProviderAudit();
    const sourceCanary = 'source-private-canary';
    const resultCanary = 'result-private-canary';
    const harness = createRuntimeHarness({
      audit: audit,
      translate: async (request) => createSuccess(request, resultCanary),
    });
    const snapshot = getSnapshot(harness.runtime);
    const sourceText = `  ${sourceCanary}  `;

    const outcome = await harness.runtime.translateWithSnapshot(sourceText, snapshot);

    assert.equal(outcome.success, true);
    assert.deepEqual(harness.getProviderCalls, ['google']);
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.requests[0]?.sourceText, sourceText);
    assert.equal(harness.requests[0]?.targetLanguage, 'uk');
    const translateEntries = audit.entries.filter((entry) => entry.record.operation === 'translate');
    assert.equal(new Set(translateEntries.map((entry) => entry.record.operationId)).size, 1);
    assert.deepEqual(
      translateEntries.map((entry) => entry.record.sequence),
      translateEntries.map((_entry, index) => index + 1),
    );
    assert.equal(translateEntries.filter((entry) => entry.record.event === 'terminal').length, 1);
    assert.equal(translateEntries[translateEntries.length - 1]?.level, 'info');
    const serializedAudit = JSON.stringify(translateEntries);
    assert.equal(serializedAudit.includes(sourceCanary), false);
    assert.equal(serializedAudit.includes(resultCanary), false);
  });

  it('captures every registered provider success once with its audit operation ID', async () => {
    for (const [providerId, targetLanguage] of [
      ['google', 'uk'],
      ['bing', 'ru'],
      ['yandex', 'be'],
    ] as const) {
      const audit = new CapturingTranslationProviderAudit();
      const diagnosticCapture = new RecordingDiagnosticCapture();
      diagnosticCapture.providerResult = { status: 'success' };
      const harness = createRuntimeHarness({
        audit,
        diagnosticCapture,
        settings: {
          ...DEFAULT_SETTINGS,
          providerId,
        },
      });
      const snapshot = getSnapshot(harness.runtime);

      const outcome = await harness.runtime.translateWithSnapshot('source-private-canary', snapshot);

      assert.equal(outcome.success, true);
      assert.equal(harness.diagnosticCapture.translationProviderInputs.length, 1);
      const input = harness.diagnosticCapture.translationProviderInputs[0];
      assert.equal(input?.providerId, providerId);
      assert.equal(input?.targetLanguage, targetLanguage);
      assert.equal(input?.sourceText, 'source-private-canary');
      assert.equal(input?.resultText, 'translated');
      const operationEntries = audit.entries.filter((entry) => entry.record.operationId === input?.providerOperationId);
      const terminalEntry = operationEntries[operationEntries.length - 1];
      assert.equal(terminalEntry?.record.event, 'terminal');
      assert.equal(terminalEntry?.record.outcome, 'success');
      assert.equal(operationEntries.filter((entry) => entry.record.event === 'terminal').length, 1);
    }
  });

  it('emits capture failure warning before unchanged Translation success terminal', async () => {
    const audit = new CapturingTranslationProviderAudit();
    const diagnosticCapture = new RecordingDiagnosticCapture();
    diagnosticCapture.providerResult = {
      causeCode: 'diagnostic-storage-unavailable',
      status: 'failure',
    };
    const harness = createRuntimeHarness({ audit, diagnosticCapture });
    const snapshot = getSnapshot(harness.runtime);

    const outcome = await harness.runtime.translateWithSnapshot('translation-source-private-canary', snapshot);

    assert.equal(outcome.success, true);
    const operationId = diagnosticCapture.translationProviderInputs[0]?.providerOperationId;
    const operationEntries = audit.entries.filter((entry) => entry.record.operationId === operationId);
    const warningEntry = operationEntries[operationEntries.length - 2];
    const terminalEntry = operationEntries[operationEntries.length - 1];
    assert.equal(warningEntry?.record.event, 'recovery');
    assert.equal(warningEntry?.record.causeCode, 'diagnostic-storage-unavailable');
    assert.equal(warningEntry?.level, 'warn');
    assert.equal(terminalEntry?.record.event, 'terminal');
    assert.equal(terminalEntry?.record.outcome, 'success');
    assert.equal(JSON.stringify(operationEntries).includes('translation-source-private-canary'), false);
  });

  it('keeps Translation success unchanged when the injected capture adapter throws', async () => {
    const audit = new CapturingTranslationProviderAudit();
    const diagnosticCapture = new RecordingDiagnosticCapture();
    diagnosticCapture.throwOnProviderCapture = true;
    const harness = createRuntimeHarness({ audit, diagnosticCapture });
    const snapshot = getSnapshot(harness.runtime);

    const outcome = await harness.runtime.translateWithSnapshot('source', snapshot);

    assert.equal(outcome.success, true);
    const translateEntries = audit.entries.filter((entry) => entry.record.operation === 'translate');
    assert.equal(translateEntries[translateEntries.length - 2]?.record.causeCode, 'diagnostic-storage-failed');
    assert.equal(translateEntries[translateEntries.length - 2]?.level, 'warn');
    assert.equal(translateEntries[translateEntries.length - 1]?.record.outcome, 'success');
  });

  it('does not let direct IPC compatibility override the authoritative target', async () => {
    const harness = createRuntimeHarness();

    const rejected = await harness.runtime.translateText('selected text', 'ru');
    const accepted = await harness.runtime.translateText('selected text', 'uk');

    assert.deepEqual(rejected, {
      success: false,
      error: 'Select a supported translation provider and language.',
    });
    assert.deepEqual(accepted, { success: true, text: 'translated' });
    assert.deepEqual(harness.getProviderCalls, ['google']);
  });

  it('keeps a captured snapshot stable when settings change', async () => {
    const harness = createRuntimeHarness();
    const snapshot = getSnapshot(harness.runtime);
    harness.setSettings({
      providerId: 'bing',
      targetLanguageByProvider: {
        ...DEFAULT_SETTINGS.targetLanguageByProvider,
        bing: 'en',
      },
    });

    await harness.runtime.translateWithSnapshot('selected text', snapshot);

    assert.deepEqual(harness.getProviderCalls, ['google']);
    assert.equal(harness.requests[0]?.targetLanguage, 'uk');
  });

  it('normalizes unexpected provider exceptions without exposing their details', async () => {
    const audit = new CapturingTranslationProviderAudit();
    const exceptionCanary = 'https://private.invalid/session/account?token=credential-private-canary';
    const harness = createRuntimeHarness({
      audit: audit,
      translate: async () => {
        throw new Error(exceptionCanary);
      },
    });
    const snapshot = getSnapshot(harness.runtime);

    const outcome = await harness.runtime.translateWithSnapshot('source-private-exception-canary', snapshot);

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'pageContractFailure');
    const terminal = audit.entries.filter(
      (entry) => entry.record.operation === 'translate' && entry.record.event === 'terminal',
    );
    assert.equal(terminal.length, 1);
    assert.equal(terminal[0]?.level, 'error');
    assert.equal(terminal[0]?.record.errorClass, 'internal');
    assert.equal(terminal[0]?.record.exceptionType, 'Error');
    assert.equal(JSON.stringify(audit.entries).includes(exceptionCanary), false);
    assert.equal(JSON.stringify(audit.entries).includes('source-private-exception-canary'), false);
  });

  it('keeps outcomes unchanged when injected audit lifecycle construction throws', async () => {
    const harness = createRuntimeHarness({
      audit: new ThrowingConstructionTranslationProviderAudit(),
    });
    const snapshot = getSnapshot(harness.runtime);

    const outcome = await harness.runtime.translateWithSnapshot('selected text', snapshot);

    assert.equal(outcome.success, true);
    assert.equal(outcome.success ? outcome.text : null, 'translated');
  });

  it('keeps outcomes unchanged when the injected audit lifecycle throws', async () => {
    const harness = createRuntimeHarness({
      audit: new ThrowingLifecycleTranslationProviderAudit(),
    });
    const snapshot = getSnapshot(harness.runtime);

    const outcome = await harness.runtime.translateWithSnapshot('selected text', snapshot);

    assert.equal(outcome.success, true);
    assert.equal(outcome.success ? outcome.text : null, 'translated');
  });

  it('invalidates in-flight results and aborts their provider request during shutdown', async () => {
    const audit = new CapturingTranslationProviderAudit();
    let finishTranslation!: (outcome: TranslationProviderOutcome) => void;
    const pending = new Promise<TranslationProviderOutcome>((resolve) => {
      finishTranslation = resolve;
    });
    const harness = createRuntimeHarness({
      audit,
      translate: async (request) => {
        request.auditContext.lifecycle.terminal('cleanup', 'success', {
          attemptCount: 1,
          durationMs: 1,
          resultLength: 'translated'.length,
          sourceLength: request.sourceText.length,
        });
        return pending;
      },
    });
    const snapshot = getSnapshot(harness.runtime);
    const operation = harness.runtime.translateWithSnapshot('selected text', snapshot);
    await Promise.resolve();
    assert.equal(
      audit.entries.filter((entry) => entry.record.operation === 'translate' && entry.record.event === 'terminal')
        .length,
      0,
    );

    const shutdown = await harness.runtime.shutdown();
    assert.equal(shutdown.success, true);
    assert.equal(harness.requests[0]?.signal?.aborted, true);

    finishTranslation(createSuccess(harness.requests[0]));
    const outcome = await operation;

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'cancelledOrStaleOperation');
    assert.equal(outcome.success ? false : outcome.discard, true);
    const terminal = audit.entries.filter(
      (entry) => entry.record.operation === 'translate' && entry.record.event === 'terminal',
    );
    assert.equal(terminal.length, 1);
    assert.equal(terminal[0]?.level, 'info');
    assert.equal(terminal[0]?.record.outcome, 'cancelled');
    assert.equal(terminal[0]?.record.discarded, true);
    assert.deepEqual(harness.diagnosticCapture.translationProviderInputs, []);
  });

  it('preserves connection listeners across reset and clears them only on final shutdown', async () => {
    const harness = createRuntimeHarness();
    const states: TranslationProviderConnectionState[] = [];
    const listener = (state: TranslationProviderConnectionState): void => {
      states.push(state);
    };
    harness.runtime.subscribeConnectionState(listener);

    const reset = await harness.runtime.reset();
    await harness.runtime.initializeSelectedProvider();

    assert.equal(reset.success, true);
    assert.deepEqual(
      states.map((state) => [state.status, state.detail]),
      [
        [TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking, TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider],
        [TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected, TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready],
      ],
    );

    await harness.runtime.shutdown();
    const listenerCallCount = states.length;
    harness.runtime.settleResetUnexpectedFailure();

    assert.equal(states.length, listenerCallCount);
  });

  it('settles reset cleanup failure without clearing connection listeners', async () => {
    const harness = createRuntimeHarness({
      shutdownFailedProviderIds: ['bing'],
    });
    const states: TranslationProviderConnectionState[] = [];
    harness.runtime.subscribeConnectionState((state) => states.push(state));

    const reset = await harness.runtime.reset();
    harness.runtime.settleResetUnexpectedFailure();

    assert.deepEqual(reset, {
      success: false,
      failedProviderIds: ['bing'],
    });
    assert.deepEqual(
      states.map((state) => [state.status, state.detail]),
      [
        [TRANSLATION_PROVIDER_CONNECTION_STATUSES.Checking, TRANSLATION_PROVIDER_CONNECTION_DETAILS.OpeningProvider],
        [TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected, TRANSLATION_PROVIDER_CONNECTION_DETAILS.CleanupFailed],
        [
          TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
          TRANSLATION_PROVIDER_CONNECTION_DETAILS.UnexpectedFailure,
        ],
      ],
    );
  });

  it('normalizes throwing registry cleanup and settles reset readiness', async () => {
    const harness = createRuntimeHarness({
      shutdownError: new Error('private://session/account?token=credential-canary'),
    });
    const states: TranslationProviderConnectionState[] = [];
    harness.runtime.subscribeConnectionState((state) => states.push(state));

    const reset = await harness.runtime.reset();

    assert.deepEqual(reset, {
      failedProviderIds: [],
      success: false,
    });
    assert.equal(states[states.length - 1]?.detail, TRANSLATION_PROVIDER_CONNECTION_DETAILS.CleanupFailed);
    assert.equal(JSON.stringify({ reset, states }).includes('credential-canary'), false);
  });

  it('suppresses stale provider audit phases after reset invalidates an active request', async () => {
    const audit = new CapturingTranslationProviderAudit();
    let finishTranslation!: (outcome: TranslationProviderOutcome) => void;
    const pending = new Promise<TranslationProviderOutcome>((resolve) => {
      finishTranslation = resolve;
    });
    const harness = createRuntimeHarness({
      audit,
      translate: async () => pending,
    });
    const snapshot = getSnapshot(harness.runtime);
    const operation = harness.runtime.translateWithSnapshot('selected text', snapshot);
    await Promise.resolve();

    await harness.runtime.reset();
    const auditEntryCount = audit.entries.length;
    harness.requests[0]?.auditContext.lifecycle.phaseEntered('submission');

    assert.equal(audit.entries.length, auditEntryCount);
    finishTranslation(createSuccess(harness.requests[0]));
    const outcome = await operation;
    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'cancelledOrStaleOperation');
  });

  it('surfaces sanitized shutdown failure identities for retry', async () => {
    const harness = createRuntimeHarness({
      shutdownFailedProviderIds: ['bing'],
    });

    const result = await harness.runtime.shutdown();

    assert.deepEqual(result, {
      success: false,
      failedProviderIds: ['bing'],
    });
    assert.equal(harness.shutdownCalls, 1);
  });

  it('keeps generations, provider routing, and audits isolated between runtimes', async () => {
    const firstAudit = new CapturingTranslationProviderAudit();
    const secondAudit = new CapturingTranslationProviderAudit();
    const first = createRuntimeHarness({ audit: firstAudit });
    const second = createRuntimeHarness({ audit: secondAudit });
    const firstSnapshot = getSnapshot(first.runtime);
    const secondSnapshot = getSnapshot(second.runtime);

    await first.runtime.shutdown();
    const firstFailure = first.runtime.validateInput('selected text', firstSnapshot);
    const secondFailure = second.runtime.validateInput('selected text', secondSnapshot);

    assert.equal(firstFailure?.code, 'cancelledOrStaleOperation');
    assert.equal(secondFailure, null);
    assert.equal(first.shutdownCalls, 1);
    assert.equal(second.shutdownCalls, 0);
    assert.equal(firstAudit.entries.length > secondAudit.entries.length, true);
    assert.equal(
      secondAudit.entries.some((entry) => entry.record.causeCode === 'cancelledOrStaleOperation'),
      false,
    );
  });
});
