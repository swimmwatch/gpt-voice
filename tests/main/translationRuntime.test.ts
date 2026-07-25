import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TranslationRuntime,
  type TranslationExecutionSnapshot,
  type TranslationRuntimeRegistry,
} from '@main/services/translation';
import type {
  TranslationProviderOutcome,
  TranslationProviderRequest,
} from '@main/translateProviders/translationProviderContracts';
import type { TranslationProviderId, TranslationSettings } from '@shared/translationProvider';

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
  outcome?: TranslationProviderOutcome;
  settings?: TranslationSettings;
  shutdownFailedProviderIds?: readonly TranslationProviderId[];
  translate?: (request: TranslationProviderRequest) => Promise<TranslationProviderOutcome>;
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
    const invalidProvider = createRuntimeHarness({
      settings: {
        providerId: 'deepl',
        targetLanguageByProvider: {},
      } as unknown as TranslationSettings,
    });
    const invalidTarget = createRuntimeHarness({
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
  });

  it('rejects empty and over-limit text before provider creation', async () => {
    const harness = createRuntimeHarness({
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
  });

  it('submits the original complete source once through the selected provider', async () => {
    const harness = createRuntimeHarness();
    const snapshot = getSnapshot(harness.runtime);
    const sourceText = '  keep surrounding whitespace  ';

    const outcome = await harness.runtime.translateWithSnapshot(sourceText, snapshot);

    assert.equal(outcome.success, true);
    assert.deepEqual(harness.getProviderCalls, ['google']);
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.requests[0]?.sourceText, sourceText);
    assert.equal(harness.requests[0]?.targetLanguage, 'uk');
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

  it('invalidates in-flight results and aborts their provider request during shutdown', async () => {
    let finishTranslation!: (outcome: TranslationProviderOutcome) => void;
    const pending = new Promise<TranslationProviderOutcome>((resolve) => {
      finishTranslation = resolve;
    });
    const harness = createRuntimeHarness({
      translate: async () => pending,
    });
    const snapshot = getSnapshot(harness.runtime);
    const operation = harness.runtime.translateWithSnapshot('selected text', snapshot);
    await Promise.resolve();

    const shutdown = await harness.runtime.shutdown();
    assert.equal(shutdown.success, true);
    assert.equal(harness.requests[0]?.signal?.aborted, true);

    finishTranslation(createSuccess(harness.requests[0]));
    const outcome = await operation;

    assert.equal(outcome.success, false);
    assert.equal(outcome.success ? null : outcome.code, 'cancelledOrStaleOperation');
    assert.equal(outcome.success ? false : outcome.discard, true);
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
