import { currentTargetLang } from '@main/config';
import {
  readClipboardText,
  showSystemNotification,
  writeTypedClipboardText,
  type ClipboardType,
} from '@main/electronRuntime';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import { translateText } from '@main/services/translation';
import { normalizeGoogleTranslateTargetLang } from '@main/services/translationUtils';
import { selectedTextActionGate, type SelectedTextActionGate } from '@main/services/selectedTextActionState';
import {
  createTextActionCacheKey,
  createTextActionResultCache,
  type TextActionResultCache,
} from '@main/services/textActionCache';
import { runTextAutomationAction, type TextAutomationAction } from '@main/services/textAutomation';
import { formatNotificationBody, type SystemNotificationOptions } from '@shared/notifications';

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
  getTargetLang: () => string;
  notify: (title: string, body: string, options?: SystemNotificationOptions) => void;
  platform: NodeJS.Platform;
  translate: (text: string, targetLang: string) => Promise<{ success: boolean; text?: string; error?: string }>;
  wait: (delayMs: number) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return '';
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
    log.warn('Could not copy selected text with OS automation:', getErrorMessage(error) || error);
  }

  let selectedText = deps.clipboard.readText();
  if (!selectedText.trim() && deps.platform === 'linux') {
    selectedText = deps.clipboard.readText('selection');
    if (selectedText.trim() && copyError) {
      log.info('Using Linux selection clipboard after copy automation failed:', { textLength: selectedText.length });
    }
  }

  return { selectedText, copyError };
}

function notifyTranslationFailure(deps: SelectedTextTranslationDependencies, body: string): void {
  try {
    deps.notify(t('notification.translationFailed'), formatNotificationBody(body, t('status.translationFailed')), {
      sound: 'error',
    });
  } catch (error: unknown) {
    log.warn('Could not show translation failure notification:', getErrorMessage(error) || error);
  }
}

function notifyTranslationCopied(deps: SelectedTextTranslationDependencies, body: string): void {
  try {
    deps.notify(t('notification.translationCopied'), formatNotificationBody(body, t('status.translationCopied')), {
      sound: 'success',
    });
  } catch (error: unknown) {
    log.warn('Could not show translation copied notification:', getErrorMessage(error) || error);
  }
}

function createFailureResult(error: string): SelectedTextTranslationResult {
  return {
    success: false,
    status: error,
    error,
  };
}

function createSkippedResult(): SelectedTextTranslationResult {
  return {
    success: false,
    status: '',
    skipped: true,
  };
}

function createSuccessResult(): SelectedTextTranslationResult {
  return {
    success: true,
    status: t('status.translationCopied'),
  };
}

export function createSelectedTextTranslationService(deps: SelectedTextTranslationDependencies) {
  return async function translateSelectedTextToClipboard(): Promise<SelectedTextTranslationResult> {
    if (!deps.actionGate.tryBegin('translate')) {
      log.info('Selected-text translation skipped because another selected-text action is active');
      return createSkippedResult();
    }

    let previousClipboardText: string | null = null;

    try {
      previousClipboardText = deps.clipboard.readText();
      deps.clipboard.writeText('');
      const { selectedText, copyError } = await readSelectedText(deps);

      if (!selectedText.trim()) {
        if (copyError) {
          log.warn('No selected text found after copy automation failure:', getErrorMessage(copyError) || copyError);
        }
        const error = t('error.noTextSelectedToTranslate');
        restoreClipboard(deps, previousClipboardText);
        notifyTranslationFailure(deps, error);
        return createFailureResult(error);
      }

      const targetLang = normalizeGoogleTranslateTargetLang(deps.getTargetLang());
      const cacheKey = createTextActionCacheKey(['translate', selectedText, targetLang]);
      const cachedTranslation = deps.cache.get(cacheKey);
      if (cachedTranslation) {
        deps.clipboard.writeText(cachedTranslation);
        notifyTranslationCopied(deps, cachedTranslation);
        log.info('Translated selected text copied from cache:', {
          sourceLength: selectedText.length,
          translatedLength: cachedTranslation.length,
          targetLang,
        });
        return createSuccessResult();
      }

      log.info('Translating selected text:', { textLength: selectedText.length, targetLang });
      const translated = await deps.translate(selectedText, targetLang);
      if (!translated.success || !translated.text?.trim()) {
        const error = translated.error || t('status.translationFailed');
        restoreClipboard(deps, previousClipboardText);
        notifyTranslationFailure(deps, error);
        return createFailureResult(error);
      }

      deps.cache.set(cacheKey, translated.text);
      deps.clipboard.writeText(translated.text);
      notifyTranslationCopied(deps, translated.text);
      log.info('Translated selected text copied:', {
        sourceLength: selectedText.length,
        translatedLength: translated.text.length,
        targetLang,
      });
      return createSuccessResult();
    } catch (error: unknown) {
      const message = getErrorMessage(error) || t('status.translationFailed');
      restoreClipboard(deps, previousClipboardText);
      log.warn('Selected-text translation failed:', message);
      notifyTranslationFailure(deps, message);
      return createFailureResult(message);
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
  getTargetLang: () => currentTargetLang,
  notify: showSystemNotification,
  platform: process.platform,
  translate: translateText,
  wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
});
