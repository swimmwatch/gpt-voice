import {
  readClipboardText,
  showSystemNotification,
  writeTypedClipboardText,
  type ClipboardType,
} from '@main/electronRuntime';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import { processCompressedPrompt } from '@main/services/promptCompression';
import { selectedTextActionGate, type SelectedTextActionGate } from '@main/services/selectedTextActionState';
import {
  createTextActionCacheKey,
  createTextActionResultCache,
  type TextActionResultCache,
} from '@main/services/textActionCache';
import { runTextAutomationAction, type TextAutomationAction } from '@main/services/textAutomation';
import { formatNotificationBody, type SystemNotificationOptions } from '@shared/notifications';

const log = createLogger('selection-prompt-compression');
export const COPY_SETTLE_DELAY_MS = 120;
export const SELECTED_TEXT_PROMPT_COMPRESSION_CACHE_MAX_ENTRIES = 20;

export interface SelectedTextPromptCompressionResult {
  success: boolean;
  status: string;
  error?: string;
  skipped?: true;
}

export interface SelectedTextPromptCompressionClipboard {
  readText(type?: ClipboardType): string;
  writeText(text: string, type?: ClipboardType): void;
}

export interface SelectedTextPromptCompressionDependencies {
  actionGate: SelectedTextActionGate;
  automateTextAction: (action: TextAutomationAction) => Promise<void>;
  cache: TextActionResultCache;
  clipboard: SelectedTextPromptCompressionClipboard;
  getCacheContext: () => readonly string[];
  notify: (title: string, body: string, options?: SystemNotificationOptions) => void;
  platform: NodeJS.Platform;
  processPrompt: (text: string, signal?: AbortSignal) => Promise<{ success: boolean; text?: string; error?: string }>;
  wait: (delayMs: number) => Promise<void>;
}

export interface SelectedTextPromptCompressionService {
  (): Promise<SelectedTextPromptCompressionResult>;
  cancel(): SelectedTextPromptCompressionResult | null;
}

interface SelectedTextPromptCompressionRun {
  abortController: AbortController;
  cancelled: boolean;
  previousClipboardText: string | null;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return '';
}

function restoreClipboard(deps: SelectedTextPromptCompressionDependencies, previousClipboardText: string | null): void {
  if (previousClipboardText !== null) {
    deps.clipboard.writeText(previousClipboardText);
  }
}

async function readSelectedText(
  deps: SelectedTextPromptCompressionDependencies,
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

function notifyPromptCompressionFailure(deps: SelectedTextPromptCompressionDependencies, body: string): void {
  try {
    deps.notify(
      t('notification.promptCompressionFailed'),
      formatNotificationBody(body, t('status.promptCompressionFailed')),
      {
        sound: 'error',
      },
    );
  } catch (error: unknown) {
    log.warn('Could not show prompt compression failure notification:', getErrorMessage(error) || error);
  }
}

function notifyPromptCompressionSuccess(deps: SelectedTextPromptCompressionDependencies): void {
  try {
    deps.notify(t('notification.promptCompressionCopied'), t('status.promptCompressionCopied'), { sound: 'success' });
  } catch (error: unknown) {
    log.warn('Could not show prompt compression success notification:', getErrorMessage(error) || error);
  }
}

function createFailureResult(error: string): SelectedTextPromptCompressionResult {
  return {
    success: false,
    status: error,
    error,
  };
}

function createCancelledResult(): SelectedTextPromptCompressionResult {
  const status = t('status.promptCompressionCancelled');
  return {
    success: false,
    status,
    error: status,
  };
}

function createSkippedResult(): SelectedTextPromptCompressionResult {
  return {
    success: false,
    status: '',
    skipped: true,
  };
}

function createSuccessResult(): SelectedTextPromptCompressionResult {
  return {
    success: true,
    status: t('status.promptCompressionCopied'),
  };
}

export function createSelectedTextPromptCompressionService(
  deps: SelectedTextPromptCompressionDependencies,
): SelectedTextPromptCompressionService {
  let activeRun: SelectedTextPromptCompressionRun | null = null;

  const service = async function compressSelectedPrompt(): Promise<SelectedTextPromptCompressionResult> {
    if (!deps.actionGate.tryBegin('promptCompression')) {
      log.info('Selected-text prompt compression skipped because another selected-text action is active');
      return createSkippedResult();
    }
    if (activeRun) {
      deps.actionGate.finish('promptCompression');
      log.info('Selected-text prompt compression skipped because a prompt compression run is already active');
      return createSkippedResult();
    }

    const run: SelectedTextPromptCompressionRun = {
      abortController: new AbortController(),
      cancelled: false,
      previousClipboardText: null,
    };
    activeRun = run;

    try {
      run.previousClipboardText = deps.clipboard.readText();
      deps.clipboard.writeText('');
      const { selectedText, copyError } = await readSelectedText(deps);
      if (run.cancelled || run.abortController.signal.aborted) {
        restoreClipboard(deps, run.previousClipboardText);
        return createCancelledResult();
      }

      if (!selectedText.trim()) {
        if (copyError) {
          log.warn('No selected text found after copy automation failure:', getErrorMessage(copyError) || copyError);
        }
        const error = t('error.noTextSelectedToCompressPrompt');
        restoreClipboard(deps, run.previousClipboardText);
        notifyPromptCompressionFailure(deps, error);
        return createFailureResult(error);
      }

      const cacheKey = createTextActionCacheKey(['promptCompression', selectedText, ...deps.getCacheContext()]);
      const cachedResult = deps.cache.get(cacheKey);
      if (cachedResult) {
        deps.clipboard.writeText(cachedResult);
        notifyPromptCompressionSuccess(deps);
        log.info('Compressed prompt copied from cache:', {
          sourceLength: selectedText.length,
          compressedLength: cachedResult.length,
        });
        return createSuccessResult();
      }

      log.info('Compressing selected prompt:', { textLength: selectedText.length });
      const processed = await deps.processPrompt(selectedText, run.abortController.signal);
      if (run.cancelled || run.abortController.signal.aborted) {
        restoreClipboard(deps, run.previousClipboardText);
        return createCancelledResult();
      }

      if (!processed.success || !processed.text?.trim()) {
        const error = processed.error || t('error.noPromptCompressionResult');
        restoreClipboard(deps, run.previousClipboardText);
        notifyPromptCompressionFailure(deps, error);
        return createFailureResult(error);
      }

      deps.cache.set(cacheKey, processed.text);
      deps.clipboard.writeText(processed.text);
      notifyPromptCompressionSuccess(deps);
      log.info('Compressed prompt copied:', {
        sourceLength: selectedText.length,
        compressedLength: processed.text.length,
      });
      return createSuccessResult();
    } catch (error: unknown) {
      if (run.cancelled || run.abortController.signal.aborted) {
        restoreClipboard(deps, run.previousClipboardText);
        return createCancelledResult();
      }

      const message = getErrorMessage(error) || t('status.promptCompressionFailed');
      restoreClipboard(deps, run.previousClipboardText);
      log.warn('Selected-text prompt compression failed:', message);
      notifyPromptCompressionFailure(deps, message);
      return createFailureResult(message);
    } finally {
      if (activeRun === run) {
        activeRun = null;
      }
      deps.actionGate.finish('promptCompression');
    }
  } as SelectedTextPromptCompressionService;

  service.cancel = (): SelectedTextPromptCompressionResult | null => {
    if (!activeRun || activeRun.abortController.signal.aborted) {
      return null;
    }

    activeRun.cancelled = true;
    activeRun.abortController.abort();
    restoreClipboard(deps, activeRun.previousClipboardText);
    log.info('Selected-text prompt compression cancelled');
    return createCancelledResult();
  };

  return service;
}

const selectedTextPromptCompressionService = createSelectedTextPromptCompressionService({
  actionGate: selectedTextActionGate,
  automateTextAction: async (action) => {
    await runTextAutomationAction(action);
  },
  cache: createTextActionResultCache(SELECTED_TEXT_PROMPT_COMPRESSION_CACHE_MAX_ENTRIES),
  clipboard: {
    readText: (type) => readClipboardText(type),
    writeText: (text, type) => writeTypedClipboardText(text, type),
  },
  getCacheContext: () => ['headroom'],
  notify: showSystemNotification,
  platform: process.platform,
  processPrompt: processCompressedPrompt,
  wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
});

export const compressSelectedPrompt = selectedTextPromptCompressionService;
export const cancelSelectedTextPromptCompression = (): SelectedTextPromptCompressionResult | null =>
  selectedTextPromptCompressionService.cancel();
