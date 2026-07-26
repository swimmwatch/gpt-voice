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
  TranslationProviderOutcome,
  TranslationProviderRequest,
} from '@main/translateProviders/translationProviderContracts';
import { TranslationProviderAudit } from '@main/translateProviders/translationProviderAudit';
import type { TranslationProviderId, TranslationSettings } from '@shared/translationProvider';
import { noopTranslationProviderAudit } from './translateProviders/translationAuditTestUtils';

const DEFAULT_SETTINGS: TranslationSettings = {
  providerId: 'google',
  targetLanguageByProvider: {
    google: 'uk',
    bing: 'ru',
    yandex: 'be',
  },
};

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
  outcome?: TranslationProviderOutcome;
  settings?: TranslationSettings;
  shutdownFailedProviderIds?: readonly TranslationProviderId[];
  translate?: (request: TranslationProviderRequest) => Promise<TranslationProviderOutcome>;
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
  protected override buildLifecycle(): ProviderAuditLifecycle<'translation'> {
    throw new Error('audit-construction-private-canary');
  }
}

class ThrowingLifecycleTranslationProviderAudit extends TranslationProviderAudit {
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
  let settings = options.settings ?? DEFAULT_SETTINGS;
  const getProviderCalls: unknown[] = [];
  const requests: TranslationProviderRequest[] = [];
  let shutdownCalls = 0;
  const failedProviderIds = options.shutdownFailedProviderIds ?? [];

  const registry: TranslationRuntimeRegistry = {
    getProvider: (providerId) => {
      getProviderCalls.push(providerId);
      return {
        translate: async (request) => {
          requests.push(request);
          if (options.translate) return options.translate(request);
          return options.outcome ?? createSuccess(request);
        },
      };
    },
    shutdown: async () => {
      shutdownCalls += 1;
      return {
        success: failedProviderIds.length === 0,
        failedProviderIds,
      };
    },
  };
  const runtime = new TranslationRuntime({
    audit: options.audit ?? noopTranslationProviderAudit,
    getSettings: () => settings,
    now: () => {
      now += 1;
      return now;
    },
    registry,
  });

  return {
    getProviderCalls,
    requests,
    runtime,
    setSettings: (next: TranslationSettings) => {
      settings = next;
    },
    get shutdownCalls() {
      return shutdownCalls;
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
      getSettings: () => {
        throw settingsError;
      },
      now: () => 100,
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
});
