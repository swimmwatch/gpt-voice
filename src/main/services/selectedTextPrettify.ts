import type { ClipboardType } from '@main/electronRuntime';
import type { I18nService } from '@main/i18n';
import type { DiagnosticCaptureService } from '@main/services/diagnosticCapture';
import type { PrettifySettingsStorage } from '@main/services/prettifySettingsStorage';
import type { PreparePrettifyExecutionResult } from '@main/services/prettifyProviders';
import type { SelectedTextActionGate } from '@main/services/selectedTextActionState';
import { createTextActionCacheKey, type TextActionResultCache } from '@main/services/textActionCache';
import type { TextAutomationService } from '@main/services/textAutomation';
import {
  formatNotificationBody,
  presentNotificationError,
  type PresentedNotificationError,
  type SystemNotificationOptions,
} from '@shared/notifications';
import type { KnownPrettifyProviderId, PrettifySettings } from '@shared/prettifySettings';

export const COPY_SETTLE_DELAY_MS = 120;
export const SELECTED_TEXT_PRETTIFY_CACHE_MAX_ENTRIES = 20;
export const SELECTED_TEXT_PRETTIFY_CACHE_MAX_AGE_MS = 60_000;
export const MAX_PRETTIFY_SELECTED_TEXT_LENGTH = 16_000;

export interface SelectedTextPrettifyResult {
  cancelled?: true;
  success: boolean;
  status: string;
  error?: string;
  skipped?: true;
}

export interface SelectedTextPrettifyClipboard {
  readText(type?: ClipboardType): string;
  writeText(text: string, type?: ClipboardType): void;
}

export interface SelectedTextPrettifyRuntime {
  prepare(settings: PrettifySettings, signal: AbortSignal): Promise<PreparePrettifyExecutionResult>;
}

export interface SelectedTextPrettifyDependencies {
  readonly actionGate: SelectedTextActionGate;
  readonly cache: TextActionResultCache;
  readonly clipboard: SelectedTextPrettifyClipboard;
  readonly diagnosticCapture: Pick<DiagnosticCaptureService, 'capturePrettifyCacheHit'>;
  readonly getCacheContext: () => readonly string[];
  readonly logger: {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
  };
  readonly localization: Pick<I18nService, 'translate'>;
  readonly notify: (title: string, body: string, options?: SystemNotificationOptions) => void;
  readonly platform: NodeJS.Platform;
  readonly runtime: SelectedTextPrettifyRuntime;
  readonly settings: Pick<PrettifySettingsStorage, 'getView'>;
  readonly textAutomation: Pick<TextAutomationService, 'run'>;
  readonly wait: (delayMs: number) => Promise<void>;
}

interface SelectedTextPrettifyRun {
  readonly abortController: AbortController;
  cancelled: boolean;
  previousClipboardText: string | null;
}

function createFailureResult(error: string): SelectedTextPrettifyResult {
  return { success: false, status: error, error };
}

function createCancelledResult(status: string): SelectedTextPrettifyResult {
  return { cancelled: true, success: false, status, error: status };
}

function createSkippedResult(): SelectedTextPrettifyResult {
  return { success: false, status: '', skipped: true };
}

function createSuccessResult(status: string): SelectedTextPrettifyResult {
  return { success: true, status };
}

/** Owns one cancellable selected-text Prettify workflow and its cache. */
export class SelectedTextPrettifyService {
  private activeRun: SelectedTextPrettifyRun | null = null;

  public constructor(private readonly dependencies: SelectedTextPrettifyDependencies) {}

  /** Prettifies the current desktop selection while preserving clipboard and cancellation semantics. */
  public readonly prettifySelectedText = async (): Promise<SelectedTextPrettifyResult> => {
    if (!this.dependencies.actionGate.tryBegin('prettify')) {
      this.dependencies.logger.info('Selected-text prettify skipped because another selected-text action is active');
      return createSkippedResult();
    }
    if (this.activeRun) {
      this.dependencies.actionGate.finish('prettify');
      this.dependencies.logger.info('Selected-text prettify skipped because a prettify run is already active');
      return createSkippedResult();
    }

    const run: SelectedTextPrettifyRun = {
      abortController: new AbortController(),
      cancelled: false,
      previousClipboardText: null,
    };
    this.activeRun = run;

    try {
      run.previousClipboardText = this.dependencies.clipboard.readText();
      this.dependencies.clipboard.writeText('');
      const { selectedText, copyError } = await this.readSelectedText();
      if (run.cancelled || run.abortController.signal.aborted) {
        this.restoreClipboard(run.previousClipboardText);
        return this.createCancelledResult();
      }

      if (!selectedText.trim()) {
        if (copyError) {
          this.dependencies.logger.warn(
            'No selected text found after copy automation failure:',
            this.presentPrettifyError(copyError).safeLogMetadata,
          );
        }
        const error = this.dependencies.localization.translate('error.noTextSelectedToPrettify');
        this.restoreClipboard(run.previousClipboardText);
        const presented = this.notifyPrettifyFailure(error);
        return createFailureResult(presented.userMessage);
      }

      if (selectedText.length > MAX_PRETTIFY_SELECTED_TEXT_LENGTH) {
        const error = this.dependencies.localization.translate('error.prettifyTextTooLong', {
          max: String(MAX_PRETTIFY_SELECTED_TEXT_LENGTH),
        });
        this.restoreClipboard(run.previousClipboardText);
        const presented = this.notifyPrettifyFailure(error);
        return createFailureResult(presented.userMessage);
      }

      const settings = this.dependencies.settings.getView();
      const preparation = await this.dependencies.runtime.prepare(settings, run.abortController.signal);
      if (run.cancelled || run.abortController.signal.aborted) {
        this.restoreClipboard(run.previousClipboardText);
        return this.createCancelledResult();
      }
      if (!preparation.success) {
        this.restoreClipboard(run.previousClipboardText);
        const presented = this.notifyPrettifyFailure(preparation.error);
        return createFailureResult(presented.userMessage);
      }

      const cacheKey = createTextActionCacheKey([
        'prettify',
        selectedText,
        ...preparation.prepared.cacheContext,
        ...this.dependencies.getCacheContext(),
      ]);
      const cachedPrettified = this.dependencies.cache.get(cacheKey);
      if (cachedPrettified) {
        this.captureCacheHit(selectedText, cachedPrettified, preparation.prepared.providerId);
        this.dependencies.clipboard.writeText(cachedPrettified);
        this.notifyPrettifySuccess();
        this.dependencies.logger.info('Prettified selected text copied from cache:', {
          sourceLength: selectedText.length,
          prettifiedLength: cachedPrettified.length,
        });
        return this.createSuccessResult();
      }

      const prettified = await preparation.prepared.execute(selectedText);
      if (run.cancelled || run.abortController.signal.aborted) {
        this.restoreClipboard(run.previousClipboardText);
        return this.createCancelledResult();
      }
      if (!prettified.success || !prettified.text?.trim()) {
        const error = prettified.error || this.dependencies.localization.translate('error.noPrettifyResult');
        this.restoreClipboard(run.previousClipboardText);
        const presented = this.notifyPrettifyFailure(error);
        return createFailureResult(presented.userMessage);
      }

      this.dependencies.cache.set(cacheKey, prettified.text);
      this.dependencies.clipboard.writeText(prettified.text);
      this.notifyPrettifySuccess();
      this.dependencies.logger.info('Prettified selected text copied:', {
        sourceLength: selectedText.length,
        prettifiedLength: prettified.text.length,
      });
      return this.createSuccessResult();
    } catch (error: unknown) {
      if (run.cancelled || run.abortController.signal.aborted) {
        this.restoreClipboard(run.previousClipboardText);
        return this.createCancelledResult();
      }
      this.restoreClipboard(run.previousClipboardText);
      const presented = this.notifyPrettifyFailure(error);
      this.dependencies.logger.warn('Selected-text prettify failed:', presented.safeLogMetadata);
      return createFailureResult(presented.userMessage);
    } finally {
      if (this.activeRun === run) this.activeRun = null;
      this.dependencies.actionGate.finish('prettify');
    }
  };

  public cancel(): SelectedTextPrettifyResult | null {
    const run = this.activeRun;
    if (!run || run.abortController.signal.aborted) return null;

    run.cancelled = true;
    run.abortController.abort();
    this.restoreClipboard(run.previousClipboardText);
    this.dependencies.logger.info('Selected-text prettify cancelled');
    return this.createCancelledResult();
  }

  private captureCacheHit(sourceText: string, resultText: string, providerId: KnownPrettifyProviderId): void {
    try {
      this.dependencies.diagnosticCapture.capturePrettifyCacheHit({
        providerId,
        resultText,
        sourceText,
      });
    } catch {
      // Diagnostic capture cannot alter selected-text behavior.
    }
  }

  private presentPrettifyError(
    error: unknown,
    fallback = this.dependencies.localization.translate('status.prettifyFailed'),
  ): PresentedNotificationError {
    return presentNotificationError(error, {
      context: 'prettify',
      fallback,
      t: this.dependencies.localization.translate,
    });
  }

  private restoreClipboard(previousClipboardText: string | null): void {
    if (previousClipboardText !== null) this.dependencies.clipboard.writeText(previousClipboardText);
  }

  private async readSelectedText(): Promise<{ selectedText: string; copyError?: unknown }> {
    let copyError: unknown;
    try {
      await this.dependencies.textAutomation.run('copy');
      await this.dependencies.wait(COPY_SETTLE_DELAY_MS);
    } catch (error: unknown) {
      copyError = error;
      this.dependencies.logger.warn(
        'Could not copy selected text with OS automation:',
        this.presentPrettifyError(error).safeLogMetadata,
      );
    }

    let selectedText = this.dependencies.clipboard.readText();
    if (!selectedText.trim() && this.dependencies.platform === 'linux') {
      selectedText = this.dependencies.clipboard.readText('selection');
      if (selectedText.trim() && copyError) {
        this.dependencies.logger.info('Using Linux selection clipboard after copy automation failed:', {
          textLength: selectedText.length,
        });
      }
    }
    return { selectedText, copyError };
  }

  private notifyPrettifyFailure(
    error: unknown,
    fallback = this.dependencies.localization.translate('status.prettifyFailed'),
  ): PresentedNotificationError {
    const presented = this.presentPrettifyError(error, fallback);
    try {
      this.dependencies.notify(
        this.dependencies.localization.translate('notification.prettifyFailed'),
        formatNotificationBody(presented.userMessage, fallback),
        { sound: 'error' },
      );
    } catch (notificationError: unknown) {
      this.dependencies.logger.warn(
        'Could not show prettify failure notification:',
        this.presentPrettifyError(notificationError).safeLogMetadata,
      );
    }
    return presented;
  }

  private notifyPrettifySuccess(): void {
    try {
      this.dependencies.notify(
        this.dependencies.localization.translate('notification.textPrettified'),
        this.dependencies.localization.translate('status.prettifiedSelection'),
        { sound: 'success' },
      );
    } catch (error: unknown) {
      this.dependencies.logger.warn(
        'Could not show prettify success notification:',
        this.presentPrettifyError(error).safeLogMetadata,
      );
    }
  }

  private createCancelledResult(): SelectedTextPrettifyResult {
    return createCancelledResult(this.dependencies.localization.translate('status.prettifyCancelled'));
  }

  private createSuccessResult(): SelectedTextPrettifyResult {
    return createSuccessResult(this.dependencies.localization.translate('status.prettifiedSelection'));
  }
}
