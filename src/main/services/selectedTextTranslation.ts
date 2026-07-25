import {
  readClipboardText,
  showSystemNotification,
  writeTypedClipboardText,
  type ClipboardType,
} from '@main/electronRuntime';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import {
  getTranslationExecutionSnapshot,
  getTranslationFailureMessage,
  isTranslationExecutionCurrent,
  translateWithSnapshot,
  validateTranslationInput,
  type TranslationExecutionSnapshot,
  type TranslationExecutionSnapshotResult,
} from '@main/services/translation';
import { selectedTextActionGate, type SelectedTextActionGate } from '@main/services/selectedTextActionState';
import {
  createTextActionCacheKey,
  createTextActionResultCache,
  type TextActionResultCache,
} from '@main/services/textActionCache';
import { runTextAutomationAction, type TextAutomationAction } from '@main/services/textAutomation';
import type {
  TranslationProviderFailure,
  TranslationProviderOutcome,
} from '@main/translateProviders/translationProviderContracts';
import {
  formatNotificationBody,
  presentNotificationError,
  type PresentedNotificationError,
  type SystemNotificationOptions,
} from '@shared/notifications';

const log = createLogger('selection-translate');
export const COPY_SETTLE_DELAY_MS = 120;
export const SELECTED_TEXT_TRANSLATION_CACHE_MAX_ENTRIES = 20;

export interface SelectedTextTranslationResult {
  success: boolean;
  status: string;
  error?: string;
  skipped?: true;
}

export interface SelectedTextTranslationClipboard {
  readText(type?: ClipboardType): string;
  writeText(text: string, type?: ClipboardType): void;
}

export interface SelectedTextTranslationDependencies {
  actionGate: SelectedTextActionGate;
  automateTextAction: (action: TextAutomationAction) => Promise<void>;
  cache: TextActionResultCache;
  clipboard: SelectedTextTranslationClipboard;
  getFailureMessage: (failure: TranslationProviderFailure) => string;
  getSnapshot: () => TranslationExecutionSnapshotResult;
  isCurrent: (snapshot: TranslationExecutionSnapshot) => boolean;
  notify: (title: string, body: string, options?: SystemNotificationOptions) => void;
  platform: NodeJS.Platform;
  translate: (text: string, snapshot: TranslationExecutionSnapshot) => Promise<TranslationProviderOutcome>;
  validateInput: (text: string, snapshot: TranslationExecutionSnapshot) => TranslationProviderFailure | null;
  wait: (delayMs: number) => Promise<void>;
}

function presentTranslationError(error: unknown, fallback = t('status.translationFailed')): PresentedNotificationError {
  return presentNotificationError(error, { context: 'translation', fallback, t });
}

function restoreClipboard(deps: SelectedTextTranslationDependencies, previousClipboardText: string | null): void {
  if (previousClipboardText !== null) {
    deps.clipboard.writeText(previousClipboardText);
  }
}

async function readSelectedText(
  deps: SelectedTextTranslationDependencies,
): Promise<{ selectedText: string; copyError?: unknown }> {
  let copyError: unknown;
  try {
    await deps.automateTextAction('copy');
    await deps.wait(COPY_SETTLE_DELAY_MS);
  } catch (error: unknown) {
    copyError = error;
    log.warn('Could not copy selected text with OS automation:', presentTranslationError(error).safeLogMetadata);
  }

  let selectedText = deps.clipboard.readText();
  if (!selectedText.trim() && deps.platform === 'linux') {
    selectedText = deps.clipboard.readText('selection');
    if (selectedText.trim() && copyError) {
      log.info('Using Linux selection clipboard after copy automation failed:', {
        textLength: selectedText.length,
      });
    }
  }
  return { selectedText, copyError };
}

function notifyTranslationFailure(
  deps: SelectedTextTranslationDependencies,
  error: unknown,
  fallback = t('status.translationFailed'),
): PresentedNotificationError {
  const presented = presentTranslationError(error, fallback);
  try {
    deps.notify(t('notification.translationFailed'), formatNotificationBody(presented.userMessage, fallback), {
      sound: 'error',
    });
  } catch (notificationError: unknown) {
    log.warn(
      'Could not show translation failure notification:',
      presentTranslationError(notificationError).safeLogMetadata,
    );
  }
  return presented;
}

function notifyTranslationCopied(deps: SelectedTextTranslationDependencies, body: string): void {
  try {
    deps.notify(t('notification.translationCopied'), formatNotificationBody(body, t('status.translationCopied')), {
      sound: 'success',
    });
  } catch (error: unknown) {
    log.warn('Could not show translation copied notification:', presentTranslationError(error).safeLogMetadata);
  }
}

function createFailureResult(error: string): SelectedTextTranslationResult {
  return { success: false, status: error, error };
}

function createSkippedResult(): SelectedTextTranslationResult {
  return { success: false, status: '', skipped: true };
}

function createSuccessResult(): SelectedTextTranslationResult {
  return { success: true, status: t('status.translationCopied') };
}

function logProviderFailure(failure: TranslationProviderFailure): void {
  log.warn('Selected-text translation failed:', {
    code: failure.code,
    ...failure.metadata,
  });
}

/** Builds the serialized selected-text workflow around an injectable translation runtime. */
export function createSelectedTextTranslationService(deps: SelectedTextTranslationDependencies) {
  return async function translateSelectedTextToClipboard(): Promise<SelectedTextTranslationResult> {
    if (!deps.actionGate.tryBegin('translate')) {
      log.info('Selected-text translation skipped because another selected-text action is active');
      return createSkippedResult();
    }

    let previousClipboardText: string | null = null;
    let snapshot: TranslationExecutionSnapshot | null = null;
    try {
      const snapshotResult = deps.getSnapshot();
      if (!snapshotResult.success) {
        const message = deps.getFailureMessage(snapshotResult);
        const presented = notifyTranslationFailure(deps, message);
        logProviderFailure(snapshotResult);
        return createFailureResult(presented.userMessage);
      }
      snapshot = snapshotResult.snapshot;

      previousClipboardText = deps.clipboard.readText();
      deps.clipboard.writeText('');
      const { selectedText, copyError } = await readSelectedText(deps);

      const validationFailure = deps.validateInput(selectedText, snapshot);
      if (validationFailure) {
        if (validationFailure.discard || !deps.isCurrent(snapshot)) {
          return createSkippedResult();
        }
        if (!selectedText.trim() && copyError) {
          log.warn(
            'No selected text found after copy automation failure:',
            presentTranslationError(copyError).safeLogMetadata,
          );
        }
        restoreClipboard(deps, previousClipboardText);
        const message = deps.getFailureMessage(validationFailure);
        const presented = notifyTranslationFailure(deps, message);
        logProviderFailure(validationFailure);
        return createFailureResult(presented.userMessage);
      }

      const cacheKey = createTextActionCacheKey([
        'translate',
        snapshot.providerId,
        snapshot.contractVersion,
        snapshot.targetLanguage,
        selectedText,
      ]);
      const cachedTranslation = deps.cache.get(cacheKey);
      if (cachedTranslation) {
        if (!deps.isCurrent(snapshot)) return createSkippedResult();
        deps.clipboard.writeText(cachedTranslation);
        notifyTranslationCopied(deps, cachedTranslation);
        log.info('Translated selected text copied from cache:', {
          providerId: snapshot.providerId,
          contractVersion: snapshot.contractVersion,
          targetLanguage: snapshot.targetLanguage,
          sourceLength: selectedText.length,
          resultLength: cachedTranslation.length,
        });
        return createSuccessResult();
      }

      log.info('Translating selected text:', {
        providerId: snapshot.providerId,
        contractVersion: snapshot.contractVersion,
        targetLanguage: snapshot.targetLanguage,
        sourceLength: selectedText.length,
      });
      const outcome = await deps.translate(selectedText, snapshot);
      if (!outcome.success) {
        if (outcome.discard || !deps.isCurrent(snapshot)) {
          return createSkippedResult();
        }
        restoreClipboard(deps, previousClipboardText);
        const message = deps.getFailureMessage(outcome);
        const presented = notifyTranslationFailure(deps, message);
        logProviderFailure(outcome);
        return createFailureResult(presented.userMessage);
      }
      if (!deps.isCurrent(snapshot)) return createSkippedResult();

      deps.cache.set(cacheKey, outcome.text);
      deps.clipboard.writeText(outcome.text);
      notifyTranslationCopied(deps, outcome.text);
      log.info('Translated selected text copied:', {
        ...outcome.metadata,
      });
      return createSuccessResult();
    } catch (error: unknown) {
      if (snapshot && !deps.isCurrent(snapshot)) return createSkippedResult();
      restoreClipboard(deps, previousClipboardText);
      const presented = notifyTranslationFailure(deps, error);
      log.warn('Selected-text translation failed:', presented.safeLogMetadata);
      return createFailureResult(presented.userMessage);
    } finally {
      deps.actionGate.finish('translate');
    }
  };
}

export const translateSelectedTextToClipboard = createSelectedTextTranslationService({
  actionGate: selectedTextActionGate,
  automateTextAction: async (action) => {
    await runTextAutomationAction(action);
  },
  cache: createTextActionResultCache(SELECTED_TEXT_TRANSLATION_CACHE_MAX_ENTRIES),
  clipboard: {
    readText: (type) => readClipboardText(type),
    writeText: (text, type) => writeTypedClipboardText(text, type),
  },
  getFailureMessage: getTranslationFailureMessage,
  getSnapshot: getTranslationExecutionSnapshot,
  isCurrent: isTranslationExecutionCurrent,
  notify: showSystemNotification,
  platform: process.platform,
  translate: translateWithSnapshot,
  validateInput: validateTranslationInput,
  wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
});
