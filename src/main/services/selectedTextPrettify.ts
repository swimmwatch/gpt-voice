import {
  readClipboardText,
  showSystemNotification,
  writeTypedClipboardText,
  type ClipboardType,
} from '@main/electronRuntime';
import { t } from '@main/i18n';
import { createLogger } from '@main/logger';
import { prettifyText, type PrettifyTextSettings } from '@main/services/prettify';
import { getPrettifySettingsView } from '@main/services/prettifySettingsStorage';
import { selectedTextActionGate, type SelectedTextActionGate } from '@main/services/selectedTextActionState';
import {
  createTextActionCacheKey,
  createTextActionResultCache,
  type TextActionResultCache,
} from '@main/services/textActionCache';
import { runTextAutomationAction, type TextAutomationAction } from '@main/services/textAutomation';
import {
  formatNotificationBody,
  presentNotificationError,
  type PresentedNotificationError,
  type SystemNotificationOptions,
} from '@shared/notifications';
import { getPrettifyProviderCapabilities, type PrettifySettings } from '@shared/prettifySettings';

const log = createLogger('selection-prettify');
export const COPY_SETTLE_DELAY_MS = 120;
export const SELECTED_TEXT_PRETTIFY_CACHE_MAX_ENTRIES = 20;
export const SELECTED_TEXT_PRETTIFY_CACHE_MAX_AGE_MS = 60_000;
export const MAX_PRETTIFY_SELECTED_TEXT_LENGTH = 16_000;

export interface SelectedTextPrettifyResult {
  success: boolean;
  status: string;
  error?: string;
  skipped?: true;
}

export interface SelectedTextPrettifyClipboard {
  readText(type?: ClipboardType): string;
  writeText(text: string, type?: ClipboardType): void;
}

export interface SelectedTextPrettifyDependencies {
  actionGate: SelectedTextActionGate;
  automateTextAction: (action: TextAutomationAction) => Promise<void>;
  cache: TextActionResultCache;
  clipboard: SelectedTextPrettifyClipboard;
  getCacheContext: () => readonly string[];
  getPrettifySettings: () => PrettifySettings;
  notify: (title: string, body: string, options?: SystemNotificationOptions) => void;
  platform: NodeJS.Platform;
  prettify: (
    text: string,
    settings: PrettifyTextSettings,
  ) => Promise<{ success: boolean; text?: string; error?: string }>;
  wait: (delayMs: number) => Promise<void>;
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

function presentPrettifyError(error: unknown, fallback = t('status.prettifyFailed')): PresentedNotificationError {
  return presentNotificationError(error, { context: 'prettify', fallback, t });
}

function restoreClipboard(deps: SelectedTextPrettifyDependencies, previousClipboardText: string | null): void {
  if (previousClipboardText !== null) {
    deps.clipboard.writeText(previousClipboardText);
  }
}

async function readSelectedText(
  deps: SelectedTextPrettifyDependencies,
): Promise<{ selectedText: string; copyError?: unknown }> {
  let copyError: unknown;

  try {
    await deps.automateTextAction('copy');
    await deps.wait(COPY_SETTLE_DELAY_MS);
  } catch (error: unknown) {
    copyError = error;
    log.warn('Could not copy selected text with OS automation:', presentPrettifyError(error).safeLogMetadata);
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

function notifyPrettifyFailure(
  deps: SelectedTextPrettifyDependencies,
  error: unknown,
  fallback = t('status.prettifyFailed'),
): PresentedNotificationError {
  const presented = presentPrettifyError(error, fallback);
  try {
    deps.notify(t('notification.prettifyFailed'), formatNotificationBody(presented.userMessage, fallback), {
      sound: 'error',
    });
  } catch (error: unknown) {
    log.warn('Could not show prettify failure notification:', presentPrettifyError(error).safeLogMetadata);
  }
  return presented;
}

function notifyPrettifySuccess(deps: SelectedTextPrettifyDependencies): void {
  try {
    deps.notify(t('notification.textPrettified'), t('status.prettifiedSelection'), { sound: 'success' });
  } catch (error: unknown) {
    log.warn('Could not show prettify success notification:', presentPrettifyError(error).safeLogMetadata);
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

function createSkippedResult(): SelectedTextPrettifyResult {
  return {
    success: false,
    status: '',
    skipped: true,
  };
}

function createSuccessResult(): SelectedTextPrettifyResult {
  return {
    success: true,
    status: t('status.prettifiedSelection'),
  };
}

function getPrettifyCacheContext(): readonly string[] {
  return [];
}

function getPrettifyProviderCacheContext(settings: PrettifySettings): readonly string[] {
  const providerSettings = settings.providerId === 'ollama' ? settings.ollama : settings.vllm;
  const capabilities = getPrettifyProviderCapabilities(settings.providerId);
  const context: string[] = [settings.providerId];
  if (capabilities.baseUrl) context.push(providerSettings.baseUrl);
  context.push(providerSettings.model);
  if (!capabilities.httpGenerationControls) return context;

  return [
    ...context,
    String(settings.temperature),
    String(settings.topP),
    String(settings.topK),
    String(settings.minP),
    String(settings.repeatPenalty),
    String(settings.maxOutputTokens),
    settings.seed === null ? '' : String(settings.seed),
  ];
}

/** Creates the single-flight selected-text prettify action and its cancellation lifecycle. */
export function createSelectedTextPrettifyService(deps: SelectedTextPrettifyDependencies): SelectedTextPrettifyService {
  let activeRun: SelectedTextPrettifyRun | null = null;

  const service = async function prettifySelectedText(): Promise<SelectedTextPrettifyResult> {
    if (!deps.actionGate.tryBegin('prettify')) {
      log.info('Selected-text prettify skipped because another selected-text action is active');
      return createSkippedResult();
    }
    if (activeRun) {
      deps.actionGate.finish('prettify');
      log.info('Selected-text prettify skipped because a prettify run is already active');
      return createSkippedResult();
    }

    const run: SelectedTextPrettifyRun = {
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
          log.warn(
            'No selected text found after copy automation failure:',
            presentPrettifyError(copyError).safeLogMetadata,
          );
        }
        const error = t('error.noTextSelectedToPrettify');
        restoreClipboard(deps, run.previousClipboardText);
        const presented = notifyPrettifyFailure(deps, error);
        return createFailureResult(presented.userMessage);
      }

      if (selectedText.length > MAX_PRETTIFY_SELECTED_TEXT_LENGTH) {
        const error = t('error.prettifyTextTooLong', { max: String(MAX_PRETTIFY_SELECTED_TEXT_LENGTH) });
        restoreClipboard(deps, run.previousClipboardText);
        const presented = notifyPrettifyFailure(deps, error);
        return createFailureResult(presented.userMessage);
      }

      const settings = deps.getPrettifySettings();
      const cacheKey = createTextActionCacheKey([
        'prettify',
        selectedText,
        settings.prompt,
        ...getPrettifyProviderCacheContext(settings),
        ...deps.getCacheContext(),
      ]);
      const cachedPrettified = deps.cache.get(cacheKey);
      if (cachedPrettified) {
        deps.clipboard.writeText(cachedPrettified);
        notifyPrettifySuccess(deps);
        log.info('Prettified selected text copied from cache:', {
          sourceLength: selectedText.length,
          prettifiedLength: cachedPrettified.length,
        });
        return createSuccessResult();
      }

      log.info('Prettifying selected text:', { textLength: selectedText.length, providerId: settings.providerId });
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
        const presented = notifyPrettifyFailure(deps, error);
        log.warn('Selected-text prettify failed:', presented.safeLogMetadata);
        return createFailureResult(presented.userMessage);
      }

      deps.cache.set(cacheKey, prettified.text);
      deps.clipboard.writeText(prettified.text);
      notifyPrettifySuccess(deps);
      log.info('Prettified selected text copied:', {
        sourceLength: selectedText.length,
        prettifiedLength: prettified.text.length,
      });
      return createSuccessResult();
    } catch (error: unknown) {
      if (run.cancelled || run.abortController.signal.aborted) {
        restoreClipboard(deps, run.previousClipboardText);
        return createCancelledResult();
      }

      restoreClipboard(deps, run.previousClipboardText);
      const presented = notifyPrettifyFailure(deps, error);
      log.warn('Selected-text prettify failed:', presented.safeLogMetadata);
      return createFailureResult(presented.userMessage);
    } finally {
      if (activeRun === run) {
        activeRun = null;
      }
      deps.actionGate.finish('prettify');
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
  actionGate: selectedTextActionGate,
  automateTextAction: async (action) => {
    await runTextAutomationAction(action);
  },
  cache: createTextActionResultCache(SELECTED_TEXT_PRETTIFY_CACHE_MAX_ENTRIES, {
    maxAgeMs: SELECTED_TEXT_PRETTIFY_CACHE_MAX_AGE_MS,
  }),
  clipboard: {
    readText: (type) => readClipboardText(type),
    writeText: (text, type) => writeTypedClipboardText(text, type),
  },
  getCacheContext: getPrettifyCacheContext,
  getPrettifySettings: () => ({
    ...getPrettifySettingsView(),
  }),
  notify: showSystemNotification,
  platform: process.platform,
  prettify: prettifyText,
  wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
});

export const prettifySelectedText = selectedTextPrettifyService;
export const cancelSelectedTextPrettify = (): SelectedTextPrettifyResult | null => selectedTextPrettifyService.cancel();
