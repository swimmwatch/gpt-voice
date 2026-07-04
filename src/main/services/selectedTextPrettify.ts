import { currentPrettifyPrompt, currentPrettifyReasoning } from '@main/config';
import {
  readClipboardText,
  showSystemNotification,
  writeTypedClipboardText,
  type ClipboardType,
} from '@main/electronRuntime';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import { prettifyText } from '@main/services/prettify';
import type { PrettifySettings } from '@shared/prettifySettings';

const log = createLogger('selection-prettify');
const NOTIFICATION_BODY_MAX_CHARS = 120;

export interface SelectedTextPrettifyResult {
  success: boolean;
  status: string;
  error?: string;
}

export interface SelectedTextPrettifyClipboard {
  readText(type?: ClipboardType): string;
  writeText(text: string, type?: ClipboardType): void;
}

export interface SelectedTextPrettifyDependencies {
  clipboard: SelectedTextPrettifyClipboard;
  getPrettifySettings: () => PrettifySettings;
  notify: (title: string, body: string) => void;
  platform: NodeJS.Platform;
  prettify: (text: string, settings: PrettifySettings) => Promise<{ success: boolean; text?: string; error?: string }>;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return '';
}

function formatNotificationBody(error: unknown, fallback: string): string {
  const message = getErrorMessage(error) || fallback;
  const singleLine = message.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= NOTIFICATION_BODY_MAX_CHARS) {
    return singleLine;
  }
  return `${singleLine.slice(0, NOTIFICATION_BODY_MAX_CHARS - 3)}...`;
}

function restoreClipboard(deps: SelectedTextPrettifyDependencies, previousClipboardText: string | null): void {
  if (previousClipboardText !== null) {
    deps.clipboard.writeText(previousClipboardText);
  }
}

function readSelectedText(deps: SelectedTextPrettifyDependencies): string {
  if (deps.platform === 'linux') {
    const selectedText = deps.clipboard.readText('selection');
    if (selectedText.trim()) {
      return selectedText;
    }
  }

  return '';
}

function notifyPrettifyFailure(deps: SelectedTextPrettifyDependencies, body: string): void {
  try {
    deps.notify(t('notification.prettifyFailed'), formatNotificationBody(body, t('status.prettifyFailed')));
  } catch (error: unknown) {
    log.warn('Could not show prettify failure notification:', getErrorMessage(error) || error);
  }
}

function notifyPrettifySuccess(deps: SelectedTextPrettifyDependencies): void {
  try {
    deps.notify(t('notification.textPrettified'), t('status.prettifiedSelection'));
  } catch (error: unknown) {
    log.warn('Could not show prettify success notification:', getErrorMessage(error) || error);
  }
}

function createFailureResult(error: string): SelectedTextPrettifyResult {
  return {
    success: false,
    status: error,
    error,
  };
}

export function createSelectedTextPrettifyService(deps: SelectedTextPrettifyDependencies) {
  let inProgress = false;

  return async function prettifySelectedText(): Promise<SelectedTextPrettifyResult> {
    if (inProgress) {
      const error = t('error.prettifyInProgress');
      notifyPrettifyFailure(deps, error);
      return createFailureResult(error);
    }

    inProgress = true;
    let previousClipboardText: string | null = null;

    try {
      previousClipboardText = deps.clipboard.readText();
      const selectedText = readSelectedText(deps);

      if (!selectedText.trim()) {
        const error = t('error.noSelectedText');
        notifyPrettifyFailure(deps, error);
        return createFailureResult(error);
      }

      const settings = deps.getPrettifySettings();
      log.info('Prettifying selected text:', { textLength: selectedText.length, reasoning: settings.reasoning });
      const prettified = await deps.prettify(selectedText, settings);
      if (!prettified.success || !prettified.text?.trim()) {
        const error = prettified.error || t('error.noPrettifyResult');
        restoreClipboard(deps, previousClipboardText);
        notifyPrettifyFailure(deps, error);
        return createFailureResult(error);
      }

      deps.clipboard.writeText(prettified.text);
      notifyPrettifySuccess(deps);
      log.info('Prettified selected text copied:', {
        sourceLength: selectedText.length,
        prettifiedLength: prettified.text.length,
      });
      return {
        success: true,
        status: t('status.prettifiedSelection'),
      };
    } catch (error: unknown) {
      const message = getErrorMessage(error) || t('status.prettifyFailed');
      restoreClipboard(deps, previousClipboardText);
      log.warn('Selected-text prettify failed:', message);
      notifyPrettifyFailure(deps, message);
      return createFailureResult(message);
    } finally {
      inProgress = false;
    }
  };
}

export const prettifySelectedText = createSelectedTextPrettifyService({
  clipboard: {
    readText: (type) => readClipboardText(type),
    writeText: (text, type) => writeTypedClipboardText(text, type),
  },
  getPrettifySettings: () => ({
    prompt: currentPrettifyPrompt,
    reasoning: currentPrettifyReasoning,
  }),
  notify: showSystemNotification,
  platform: process.platform,
  prettify: prettifyText,
});
