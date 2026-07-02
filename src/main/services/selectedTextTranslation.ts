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
import { runTextAutomationAction, type TextAutomationAction } from '@main/services/textAutomation';

const log = createLogger('selection-translate');
const COPY_SETTLE_DELAY_MS = 120;
const NOTIFICATION_BODY_MAX_CHARS = 120;

export interface SelectedTextTranslationResult {
  success: boolean;
  status: string;
  error?: string;
}

export interface SelectedTextTranslationClipboard {
  readText(type?: ClipboardType): string;
  writeText(text: string, type?: ClipboardType): void;
}

export interface SelectedTextTranslationDependencies {
  automateTextAction: (action: TextAutomationAction) => Promise<void>;
  clipboard: SelectedTextTranslationClipboard;
  getTargetLang: () => string;
  notify: (title: string, body: string) => void;
  platform: NodeJS.Platform;
  translate: (text: string, targetLang: string) => Promise<{ success: boolean; text?: string; error?: string }>;
  wait: (delayMs: number) => Promise<void>;
}

function formatNotificationBody(error: unknown, fallback: string): string {
  const message = getErrorMessage(error) || fallback;
  const singleLine = message.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= NOTIFICATION_BODY_MAX_CHARS) {
    return singleLine;
  }
  return `${singleLine.slice(0, NOTIFICATION_BODY_MAX_CHARS - 3)}...`;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return '';
}

function notifyTranslationFailure(deps: SelectedTextTranslationDependencies, body: string): void {
  try {
    deps.notify(t('notification.translationFailed'), formatNotificationBody(body, t('status.translationFailed')));
  } catch (error: unknown) {
    log.warn('Could not show translation failure notification:', getErrorMessage(error) || error);
  }
}

function notifyTranslationCopied(deps: SelectedTextTranslationDependencies, body: string): void {
  try {
    deps.notify(t('notification.translationCopied'), formatNotificationBody(body, t('status.translationCopied')));
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

export function createSelectedTextTranslationService(deps: SelectedTextTranslationDependencies) {
  let inProgress = false;

  return async function translateSelectedTextToClipboard(): Promise<SelectedTextTranslationResult> {
    if (inProgress) {
      const error = t('error.translationInProgress');
      notifyTranslationFailure(deps, error);
      return createFailureResult(error);
    }

    inProgress = true;
    let previousClipboardText: string | null = null;

    try {
      previousClipboardText = deps.clipboard.readText();
      deps.clipboard.writeText('');
      const { selectedText, copyError } = await readSelectedText(deps);

      if (!selectedText.trim()) {
        if (copyError) {
          log.warn('No selected text found after copy automation failure:', getErrorMessage(copyError) || copyError);
        }
        const error = t('error.noSelectedText');
        restoreClipboard(deps, previousClipboardText);
        notifyTranslationFailure(deps, error);
        return createFailureResult(error);
      }

      const targetLang = deps.getTargetLang();
      log.info('Translating selected text:', { textLength: selectedText.length, targetLang });
      const translated = await deps.translate(selectedText, targetLang);
      if (!translated.success || !translated.text) {
        const error = translated.error || t('status.translationFailed');
        restoreClipboard(deps, previousClipboardText);
        notifyTranslationFailure(deps, error);
        return createFailureResult(error);
      }

      deps.clipboard.writeText(translated.text);
      notifyTranslationCopied(deps, translated.text);
      log.info('Translated selected text copied:', {
        sourceLength: selectedText.length,
        translatedLength: translated.text.length,
        targetLang,
      });
      return {
        success: true,
        status: t('status.translationCopied'),
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error) || t('status.translationFailed');
      restoreClipboard(deps, previousClipboardText);
      log.warn('Selected-text translation failed:', message);
      notifyTranslationFailure(deps, message);
      return createFailureResult(message);
    } finally {
      inProgress = false;
    }
  };
}

export const translateSelectedTextToClipboard = createSelectedTextTranslationService({
  automateTextAction: async (action) => {
    await runTextAutomationAction(action);
  },
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
