import type { ClipboardType } from '@main/electronRuntime';
import type { I18nService } from '@main/i18n';
import type { TranslationExecutionSnapshot, TranslationRuntime } from '@main/services/translation';
import type { DiagnosticCaptureService } from '@main/services/diagnosticCapture';
import type { SelectedTextActionGate } from '@main/services/selectedTextActionState';
import { createTextActionCacheKey, type TextActionResultCache } from '@main/services/textActionCache';
import type { TextAutomationService } from '@main/services/textAutomation';
import {
  formatNotificationBody,
  presentNotificationError,
  type PresentedNotificationError,
  type SystemNotificationOptions,
} from '@shared/notifications';

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

export interface SelectedTextTranslationLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

export type SelectedTextTranslationRuntime = Pick<
  TranslationRuntime,
  'getFailureMessage' | 'getSnapshot' | 'isCurrent' | 'translateWithSnapshot' | 'validateInput'
>;

export interface SelectedTextTranslationDependencies {
  readonly actionGate: SelectedTextActionGate;
  readonly cache: TextActionResultCache;
  readonly clipboard: SelectedTextTranslationClipboard;
  readonly diagnosticCapture: Pick<DiagnosticCaptureService, 'captureTranslationCacheHit'>;
  readonly logger: SelectedTextTranslationLogger;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly notify: (title: string, body: string, options?: SystemNotificationOptions) => void;
  readonly platform: NodeJS.Platform;
  readonly runtime: SelectedTextTranslationRuntime;
  readonly textAutomation: Pick<TextAutomationService, 'run'>;
  readonly wait: (delayMs: number) => Promise<void>;
}

function createFailureResult(error: string): SelectedTextTranslationResult {
  return { success: false, status: error, error };
}

function createSkippedResult(): SelectedTextTranslationResult {
  return { success: false, status: '', skipped: true };
}

function createSuccessResult(status: string): SelectedTextTranslationResult {
  return { success: true, status };
}

/** Owns one serialized selected-text Translation workflow and its cache. */
export class SelectedTextTranslationService {
  public constructor(private readonly dependencies: SelectedTextTranslationDependencies) {}

  /** Translates the current desktop selection and writes the accepted result to the clipboard. */
  public readonly translateSelectedTextToClipboard = async (): Promise<SelectedTextTranslationResult> => {
    if (!this.dependencies.actionGate.tryBegin('translate')) {
      this.dependencies.logger.info('Selected-text translation skipped because another selected-text action is active');
      return createSkippedResult();
    }

    let previousClipboardText: string | null = null;
    let snapshot: TranslationExecutionSnapshot | null = null;
    try {
      const snapshotResult = this.dependencies.runtime.getSnapshot();
      if (!snapshotResult.success) {
        const message = this.dependencies.runtime.getFailureMessage(snapshotResult);
        const presented = this.notifyTranslationFailure(message);
        return createFailureResult(presented.userMessage);
      }
      snapshot = snapshotResult.snapshot;

      previousClipboardText = this.dependencies.clipboard.readText();
      this.dependencies.clipboard.writeText('');
      const { selectedText, copyError } = await this.readSelectedText();

      const validationFailure = this.dependencies.runtime.validateInput(selectedText, snapshot);
      if (validationFailure) {
        if (validationFailure.discard || !this.dependencies.runtime.isCurrent(snapshot)) {
          return createSkippedResult();
        }
        if (!selectedText.trim() && copyError) {
          this.dependencies.logger.warn(
            'No selected text found after copy automation failure:',
            this.presentTranslationError(copyError).safeLogMetadata,
          );
        }
        this.restoreClipboard(previousClipboardText);
        const message = this.dependencies.runtime.getFailureMessage(validationFailure);
        const presented = this.notifyTranslationFailure(message);
        return createFailureResult(presented.userMessage);
      }

      const cacheKey = createTextActionCacheKey([
        'translate',
        snapshot.providerId,
        snapshot.contractVersion,
        snapshot.targetLanguage,
        selectedText,
      ]);
      const cachedTranslation = this.dependencies.cache.get(cacheKey);
      if (cachedTranslation) {
        if (!this.dependencies.runtime.isCurrent(snapshot)) return createSkippedResult();
        this.captureCacheHit(selectedText, cachedTranslation, snapshot);
        this.dependencies.clipboard.writeText(cachedTranslation);
        this.notifyTranslationCopied(cachedTranslation);
        this.dependencies.logger.info('Translated selected text copied from cache:', {
          providerId: snapshot.providerId,
          contractVersion: snapshot.contractVersion,
          targetLanguage: snapshot.targetLanguage,
          sourceLength: selectedText.length,
          resultLength: cachedTranslation.length,
        });
        return createSuccessResult(this.dependencies.localization.translate('status.translationCopied'));
      }

      const outcome = await this.dependencies.runtime.translateWithSnapshot(selectedText, snapshot);
      if (!outcome.success) {
        if (outcome.discard || !this.dependencies.runtime.isCurrent(snapshot)) {
          return createSkippedResult();
        }
        this.restoreClipboard(previousClipboardText);
        const message = this.dependencies.runtime.getFailureMessage(outcome);
        const presented = this.notifyTranslationFailure(message);
        return createFailureResult(presented.userMessage);
      }
      if (!this.dependencies.runtime.isCurrent(snapshot)) return createSkippedResult();

      this.dependencies.cache.set(cacheKey, outcome.text);
      this.dependencies.clipboard.writeText(outcome.text);
      this.notifyTranslationCopied(outcome.text);
      return createSuccessResult(this.dependencies.localization.translate('status.translationCopied'));
    } catch (error: unknown) {
      if (snapshot && !this.dependencies.runtime.isCurrent(snapshot)) return createSkippedResult();
      this.restoreClipboard(previousClipboardText);
      const presented = this.notifyTranslationFailure(error);
      this.dependencies.logger.warn('Selected-text translation failed:', presented.safeLogMetadata);
      return createFailureResult(presented.userMessage);
    } finally {
      this.dependencies.actionGate.finish('translate');
    }
  };

  private captureCacheHit(sourceText: string, resultText: string, snapshot: TranslationExecutionSnapshot): void {
    try {
      this.dependencies.diagnosticCapture.captureTranslationCacheHit({
        contractVersion: snapshot.contractVersion,
        providerId: snapshot.providerId,
        resultText,
        sourceText,
        targetLanguage: snapshot.targetLanguage,
      });
    } catch {
      // Diagnostic capture cannot alter selected-text behavior.
    }
  }

  private presentTranslationError(
    error: unknown,
    fallback = this.dependencies.localization.translate('status.translationFailed'),
  ): PresentedNotificationError {
    return presentNotificationError(error, {
      context: 'translation',
      fallback,
      t: this.dependencies.localization.translate,
    });
  }

  private restoreClipboard(previousClipboardText: string | null): void {
    if (previousClipboardText !== null) {
      this.dependencies.clipboard.writeText(previousClipboardText);
    }
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
        this.presentTranslationError(error).safeLogMetadata,
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

  private notifyTranslationFailure(
    error: unknown,
    fallback = this.dependencies.localization.translate('status.translationFailed'),
  ): PresentedNotificationError {
    const presented = this.presentTranslationError(error, fallback);
    try {
      this.dependencies.notify(
        this.dependencies.localization.translate('notification.translationFailed'),
        formatNotificationBody(presented.userMessage, fallback),
        {
          sound: 'error',
        },
      );
    } catch (notificationError: unknown) {
      this.dependencies.logger.warn(
        'Could not show translation failure notification:',
        this.presentTranslationError(notificationError).safeLogMetadata,
      );
    }
    return presented;
  }

  private notifyTranslationCopied(body: string): void {
    try {
      this.dependencies.notify(
        this.dependencies.localization.translate('notification.translationCopied'),
        formatNotificationBody(body, this.dependencies.localization.translate('status.translationCopied')),
        {
          sound: 'success',
        },
      );
    } catch (error: unknown) {
      this.dependencies.logger.warn(
        'Could not show translation copied notification:',
        this.presentTranslationError(error).safeLogMetadata,
      );
    }
  }
}
