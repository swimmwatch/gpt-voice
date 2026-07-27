import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import type { ClipboardType } from '@main/electronRuntime';
import { I18nService } from '@main/i18n';
import {
  SelectedTextTranslationService,
  type SelectedTextTranslationDependencies,
  type SelectedTextTranslationRuntime,
} from '@main/services/selectedTextTranslation';
import type { TranslationExecutionSnapshot } from '@main/services/translation';
import { SelectedTextActionGate } from '@main/services/selectedTextActionState';
import { createTextActionResultCache, type TextActionResultCache } from '@main/services/textActionCache';
import type { TextAutomationAction } from '@main/services/textAutomation';
import type {
  TranslationProviderFailure,
  TranslationProviderFailureCode,
  TranslationProviderOutcome,
} from '@main/translateProviders/translationProviderContracts';
import type { TranslationProviderId, TranslationProviderName } from '@shared/translationProvider';
import type { SystemNotificationOptions } from '@shared/notifications';

const localization = new I18nService();

interface TestServiceOptions {
  actionGate?: SelectedTextActionGate;
  cache?: TextActionResultCache;
  contractVersion?: string;
  copyFails?: boolean;
  copyText?: string;
  maxInputCharacters?: number;
  onCopy?: () => void;
  providerId?: TranslationProviderId;
  providerName?: TranslationProviderName;
  selectionText?: string;
  targetLanguage?: string;
  translateOutcome?: TranslationProviderOutcome;
  translateWait?: Promise<void>;
}

function createSnapshot(options: TestServiceOptions = {}): TranslationExecutionSnapshot {
  return Object.freeze({
    contractVersion: options.contractVersion ?? 'test-v1',
    generation: 1,
    maxInputCharacters: options.maxInputCharacters ?? 5_000,
    providerId: options.providerId ?? 'google',
    providerName: options.providerName ?? 'Google',
    targetLanguage: options.targetLanguage ?? 'uk',
  });
}

function createFailure(
  snapshot: TranslationExecutionSnapshot,
  code: TranslationProviderFailureCode,
  sourceLength: number,
  discard = false,
): TranslationProviderFailure {
  return {
    success: false,
    code,
    discard,
    metadata: {
      providerId: snapshot.providerId,
      targetLanguage: snapshot.targetLanguage,
      contractVersion: snapshot.contractVersion,
      sourceLength,
      durationMs: 1,
      attemptCount: 0,
      phase: code === 'cleanupFailure' ? 'cleanup' : 'validation',
    },
  };
}

function createSuccess(
  snapshot: TranslationExecutionSnapshot,
  text = 'translated text',
  sourceLength = 13,
): TranslationProviderOutcome {
  return {
    success: true,
    text,
    metadata: {
      providerId: snapshot.providerId,
      targetLanguage: snapshot.targetLanguage,
      contractVersion: snapshot.contractVersion,
      sourceLength,
      resultLength: text.length,
      durationMs: 2,
      attemptCount: 1,
      phase: 'cleanup',
    },
  };
}

class TestTranslationRuntime implements SelectedTextTranslationRuntime {
  public readonly translations: Array<{ text: string; snapshot: TranslationExecutionSnapshot }> = [];
  private currentGeneration: number;

  public constructor(
    private snapshot: TranslationExecutionSnapshot,
    private readonly options: TestServiceOptions,
  ) {
    this.currentGeneration = snapshot.generation;
  }

  public getSnapshot() {
    return { success: true as const, snapshot: this.snapshot };
  }

  public getFailureMessage(failure: TranslationProviderFailure): string {
    switch (failure.code) {
      case 'unsupportedProvider':
      case 'unsupportedTargetLanguage':
        return localization.translate('error.translationUnsupportedSelection');
      case 'emptyInput':
        return localization.translate('error.noTextSelectedToTranslate');
      case 'inputTooLong':
        return localization.translate('error.translationTextTooLong', {
          actual: String(failure.metadata.sourceLength ?? 0),
          max: String(this.snapshot.maxInputCharacters),
          provider: this.snapshot.providerName,
        });
      case 'navigationFailure':
        return localization.translate('error.translationConnectionFailed');
      case 'consentOrChallenge':
        return localization.translate('error.translationConsentOrChallenge');
      case 'pageContractFailure':
        return localization.translate('error.translationPageChanged');
      case 'resultTimeoutOrEmpty':
        return localization.translate('error.translationResultUnavailable');
      case 'cancelledOrStaleOperation':
        return localization.translate('status.translationCancelled');
      case 'cleanupFailure':
        return localization.translate('error.translationCleanupFailed');
    }
  }

  public invalidate(): void {
    this.currentGeneration += 1;
  }

  public isCurrent(candidate: TranslationExecutionSnapshot): boolean {
    return candidate.generation === this.currentGeneration;
  }

  public setProviderId(providerId: TranslationProviderId): void {
    this.snapshot = Object.freeze({ ...this.snapshot, providerId });
  }

  public async translateWithSnapshot(
    text: unknown,
    requestSnapshot: TranslationExecutionSnapshot,
  ): Promise<TranslationProviderOutcome> {
    if (typeof text !== 'string') throw new Error('Expected test Translation source text');
    this.translations.push({ text, snapshot: requestSnapshot });
    await this.options.translateWait;
    return this.options.translateOutcome ?? createSuccess(requestSnapshot, 'translated text', text.length);
  }

  public validateInput(
    text: unknown,
    requestSnapshot: TranslationExecutionSnapshot,
  ): TranslationProviderFailure | null {
    if (typeof text !== 'string') throw new Error('Expected test Translation source text');
    const sourceText = text;
    if (requestSnapshot.generation !== this.currentGeneration) {
      return createFailure(requestSnapshot, 'cancelledOrStaleOperation', sourceText.length, true);
    }
    if (!sourceText.trim()) return createFailure(requestSnapshot, 'emptyInput', sourceText.length);
    if (sourceText.length > requestSnapshot.maxInputCharacters) {
      return createFailure(requestSnapshot, 'inputTooLong', sourceText.length);
    }
    return null;
  }
}

function createTestService(options: TestServiceOptions = {}) {
  const clipboard = {
    clipboard: 'previous clipboard',
    selection: options.selectionText ?? '',
  };
  const actions: TextAutomationAction[] = [];
  const notifications: Array<{
    title: string;
    body: string;
    options?: SystemNotificationOptions;
  }> = [];
  const snapshot = createSnapshot(options);
  const runtime = new TestTranslationRuntime(snapshot, options);

  const dependencies: SelectedTextTranslationDependencies = {
    actionGate: options.actionGate ?? new SelectedTextActionGate(),
    cache: options.cache ?? createTextActionResultCache(20),
    clipboard: {
      readText: (type?: ClipboardType) => (type === 'selection' ? clipboard.selection : clipboard.clipboard),
      writeText: (text: string, type?: ClipboardType) => {
        if (type === 'selection') clipboard.selection = text;
        else clipboard.clipboard = text;
      },
    },
    logger: { info: () => undefined, warn: () => undefined },
    localization,
    notify: (title, body, notificationOptions) => {
      notifications.push({ title, body, options: notificationOptions });
    },
    platform: 'linux',
    runtime,
    textAutomation: {
      run: async (action) => {
        actions.push(action);
        options.onCopy?.();
        if (options.copyFails) throw new Error('synthetic copy failure');
        if (options.copyText !== undefined) clipboard.clipboard = options.copyText;
        return { args: [], command: 'test', requiredExecutable: 'test', strategy: 'linux-x11' };
      },
    },
    wait: async () => {},
  };

  return {
    actions,
    clipboard,
    dependencies,
    invalidate: () => {
      runtime.invalidate();
    },
    notifications,
    runtime,
    service: new SelectedTextTranslationService(dependencies),
    snapshot,
    translations: runtime.translations,
  };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('Condition was not reached');
}

afterEach(() => {
  localization.setLocale('en');
});

describe('selected-text translation', () => {
  it('restores clipboard and reports an empty selection', async () => {
    const harness = createTestService();

    const result = await harness.service.translateSelectedTextToClipboard();

    assert.equal(result.success, false);
    assert.equal(result.error, 'No text selected to translate');
    assert.equal(harness.clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(harness.actions, ['copy']);
    assert.deepEqual(harness.translations, []);
    assert.deepEqual(harness.notifications, [
      {
        title: 'Translation failed',
        body: 'No text selected to translate',
        options: { sound: 'error' },
      },
    ]);
  });

  it('uses the Linux selection clipboard when normal copy is empty or unavailable', async () => {
    const normal = createTestService({ selectionText: 'primary selection' });
    const failedCopy = createTestService({
      copyFails: true,
      selectionText: 'primary selection',
    });

    assert.equal((await normal.service.translateSelectedTextToClipboard()).success, true);
    assert.equal((await failedCopy.service.translateSelectedTextToClipboard()).success, true);
    assert.equal(normal.clipboard.clipboard, 'translated text');
    assert.equal(failedCopy.clipboard.clipboard, 'translated text');
    assert.equal(normal.translations[0]?.text, 'primary selection');
    assert.equal(failedCopy.translations[0]?.text, 'primary selection');
  });

  it('snapshots provider settings before clipboard automation', async () => {
    let liveProvider: TranslationProviderId = 'google';
    const harness = createTestService({
      copyText: 'selected text',
      onCopy: () => {
        liveProvider = 'bing';
        harness.runtime.setProviderId(liveProvider);
      },
    });
    await harness.service.translateSelectedTextToClipboard();

    assert.equal(liveProvider, 'bing');
    assert.equal(harness.translations[0]?.snapshot.providerId, 'google');
  });

  it('rejects provider input limits before translation and reports safe lengths', async () => {
    const harness = createTestService({
      copyText: 'x'.repeat(1_001),
      maxInputCharacters: 1_000,
      providerId: 'bing',
      providerName: 'Bing',
    });

    const result = await harness.service.translateSelectedTextToClipboard();

    assert.equal(result.success, false);
    assert.equal(result.error, 'Selected text is too long for Bing: 1001 characters; maximum 1000.');
    assert.equal(harness.clipboard.clipboard, 'previous clipboard');
    assert.deepEqual(harness.translations, []);
  });

  it('restores clipboard and localizes typed provider failures', async () => {
    const snapshot = createSnapshot();
    const harness = createTestService({
      copyText: 'selected text',
      translateOutcome: createFailure(snapshot, 'navigationFailure', 13),
    });

    const result = await harness.service.translateSelectedTextToClipboard();

    assert.equal(result.success, false);
    assert.equal(result.error, 'Could not connect to the translation provider. Try again.');
    assert.equal(harness.clipboard.clipboard, 'previous clipboard');
  });

  it('copies successful provider output only after the provider outcome is complete', async () => {
    const harness = createTestService({ copyText: 'selected text' });

    const result = await harness.service.translateSelectedTextToClipboard();

    assert.equal(result.success, true);
    assert.equal(result.status, 'Translation copied');
    assert.equal(harness.clipboard.clipboard, 'translated text');
    assert.deepEqual(harness.notifications, [
      {
        title: 'Translation copied',
        body: 'translated text',
        options: { sound: 'success' },
      },
    ]);
  });

  it('keys cache entries by provider, contract version, target, and source', async () => {
    const cache = createTextActionResultCache(20);
    const first = createTestService({
      cache,
      copyText: 'selected text',
      providerId: 'google',
      contractVersion: 'v1',
      targetLanguage: 'uk',
    });
    const exact = createTestService({
      cache,
      copyText: 'selected text',
      providerId: 'google',
      contractVersion: 'v1',
      targetLanguage: 'uk',
    });
    const providerChanged = createTestService({
      cache,
      copyText: 'selected text',
      providerId: 'bing',
      providerName: 'Bing',
      contractVersion: 'v1',
      targetLanguage: 'uk',
    });
    const contractChanged = createTestService({
      cache,
      copyText: 'selected text',
      providerId: 'google',
      contractVersion: 'v2',
      targetLanguage: 'uk',
    });
    const targetChanged = createTestService({
      cache,
      copyText: 'selected text',
      providerId: 'google',
      contractVersion: 'v1',
      targetLanguage: 'ru',
    });

    await first.service.translateSelectedTextToClipboard();
    await exact.service.translateSelectedTextToClipboard();
    await providerChanged.service.translateSelectedTextToClipboard();
    await contractChanged.service.translateSelectedTextToClipboard();
    await targetChanged.service.translateSelectedTextToClipboard();

    assert.equal(first.translations.length, 1);
    assert.equal(exact.translations.length, 0);
    assert.equal(providerChanged.translations.length, 1);
    assert.equal(contractChanged.translations.length, 1);
    assert.equal(targetChanged.translations.length, 1);
  });

  it('keeps service instances and their caches isolated by default', async () => {
    const first = createTestService({ copyText: 'selected text' });
    const second = createTestService({ copyText: 'selected text' });

    await first.service.translateSelectedTextToClipboard();
    await first.service.translateSelectedTextToClipboard();
    await second.service.translateSelectedTextToClipboard();

    assert.notEqual(first.service, second.service);
    assert.equal(first.translations.length, 1);
    assert.equal(second.translations.length, 1);
  });

  it('does not cache failed or cleanup-failed outcomes', async () => {
    const cache = createTextActionResultCache(20);
    const snapshot = createSnapshot();
    const failed = createTestService({
      cache,
      copyText: 'selected text',
      translateOutcome: createFailure(snapshot, 'cleanupFailure', 13),
    });
    const retry = createTestService({ cache, copyText: 'selected text' });

    await failed.service.translateSelectedTextToClipboard();
    await retry.service.translateSelectedTextToClipboard();

    assert.equal(failed.translations.length, 1);
    assert.equal(retry.translations.length, 1);
  });

  it('discards late outcomes after generation invalidation without clipboard or notification effects', async () => {
    let finishTranslation!: () => void;
    const translateWait = new Promise<void>((resolve) => {
      finishTranslation = resolve;
    });
    const harness = createTestService({
      copyText: 'selected text',
      translateWait,
    });

    const operation = harness.service.translateSelectedTextToClipboard();
    await waitUntil(() => harness.translations.length === 1);
    harness.invalidate();
    finishTranslation();
    const result = await operation;

    assert.equal(result.skipped, true);
    assert.equal(harness.clipboard.clipboard, 'selected text');
    assert.deepEqual(harness.notifications, []);
  });

  it('silently skips duplicate selected-text actions', async () => {
    let finishTranslation!: () => void;
    const translateWait = new Promise<void>((resolve) => {
      finishTranslation = resolve;
    });
    const harness = createTestService({
      copyText: 'selected text',
      translateWait,
    });

    const first = harness.service.translateSelectedTextToClipboard();
    const second = await harness.service.translateSelectedTextToClipboard();
    finishTranslation();
    const firstResult = await first;

    assert.equal(second.skipped, true);
    assert.equal(firstResult.success, true);
    assert.equal(harness.translations.length, 1);
  });

  it('silently skips translation while prettify is active', async () => {
    const actionGate = new SelectedTextActionGate();
    assert.equal(actionGate.tryBegin('prettify'), true);
    const harness = createTestService({
      actionGate,
      copyText: 'selected text',
    });

    const result = await harness.service.translateSelectedTextToClipboard();

    assert.equal(result.skipped, true);
    assert.deepEqual(harness.actions, []);
    assert.deepEqual(harness.translations, []);
    assert.deepEqual(harness.notifications, []);
  });
});
