import { currentPrettifyPrompt, currentPrettifyReasoning } from '@main/config';
import {
  readClipboardText,
  showSystemNotification,
  writeTypedClipboardText,
  type ClipboardType,
} from '@main/electronRuntime';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import { prettifyText, type PrettifyTextSettings } from '@main/services/prettify';
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
  prettify: (
    text: string,
    settings: PrettifyTextSettings,
  ) => Promise<{ success: boolean; text?: string; error?: string }>;
}

export interface SelectedTextPrettifyService {
  (): Promise<SelectedTextPrettifyResult>;
  cancel(): SelectedTextPrettifyResult | null;
}

interface SelectedTextPrettifyRun {
  abortController: AbortController;
  cancelled: boolean;
  previousClipboardText: string | null;
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

function createCancelledResult(): SelectedTextPrettifyResult {
  const status = t('status.prettifyCancelled');
  return {
    success: false,
    status,
    error: status,
  };
}

export function createSelectedTextPrettifyService(deps: SelectedTextPrettifyDependencies): SelectedTextPrettifyService {
  let activeRun: SelectedTextPrettifyRun | null = null;

  const service = async function prettifySelectedText(): Promise<SelectedTextPrettifyResult> {
    if (activeRun) {
      const error = t('error.prettifyInProgress');
      notifyPrettifyFailure(deps, error);
      return createFailureResult(error);
    }

    const run: SelectedTextPrettifyRun = {
      abortController: new AbortController(),
      cancelled: false,
      previousClipboardText: null,
    };
    activeRun = run;

    try {
      run.previousClipboardText = deps.clipboard.readText();
      const selectedText = readSelectedText(deps);

      if (!selectedText.trim()) {
        const error = t('error.noSelectedText');
        notifyPrettifyFailure(deps, error);
        return createFailureResult(error);
      }

      const settings = deps.getPrettifySettings();
      log.info('Prettifying selected text:', { textLength: selectedText.length, reasoning: settings.reasoning });
      const prettified = await deps.prettify(selectedText, {
        ...settings,
        signal: run.abortController.signal,
      });
      if (run.cancelled || run.abortController.signal.aborted) {
        restoreClipboard(deps, run.previousClipboardText);
        return createCancelledResult();
      }

      if (!prettified.success || !prettified.text?.trim()) {
        const error = prettified.error || t('error.noPrettifyResult');
        restoreClipboard(deps, run.previousClipboardText);
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
      if (run.cancelled || run.abortController.signal.aborted) {
        restoreClipboard(deps, run.previousClipboardText);
        return createCancelledResult();
      }

      const message = getErrorMessage(error) || t('status.prettifyFailed');
      restoreClipboard(deps, run.previousClipboardText);
      log.warn('Selected-text prettify failed:', message);
      notifyPrettifyFailure(deps, message);
      return createFailureResult(message);
    } finally {
      if (activeRun === run) {
        activeRun = null;
      }
    }
  } as SelectedTextPrettifyService;

  service.cancel = (): SelectedTextPrettifyResult | null => {
    if (!activeRun || activeRun.abortController.signal.aborted) {
      return null;
    }

    activeRun.cancelled = true;
    activeRun.abortController.abort();
    restoreClipboard(deps, activeRun.previousClipboardText);
    log.info('Selected-text prettify cancelled');
    return createCancelledResult();
  };

  return service;
}

const selectedTextPrettifyService = createSelectedTextPrettifyService({
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

export const prettifySelectedText = selectedTextPrettifyService;
export const cancelSelectedTextPrettify = (): SelectedTextPrettifyResult | null => selectedTextPrettifyService.cancel();
