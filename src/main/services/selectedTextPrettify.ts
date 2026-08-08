import type { AppConfigStore } from '@main/config';
import type { ClipboardType } from '@main/electronRuntime';
import type { I18nService } from '@main/i18n';
import type { DiagnosticCaptureService } from '@main/services/diagnosticCapture';
import {
  composePrettifyProfileInstruction,
  getPrettifyBuiltInProfileDefinition,
  resolvePrettifyExecutionInstruction,
  type PrettifyExecutionInstruction,
} from '@main/services/prettifyProfileInstruction';
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
import type {
  PrettifyProfileChooserOutcome,
  PrettifyProfileChooserProfileSummary,
  PrettifyProfileChooserRequest,
} from '@shared/prettifyProfileChooser';
import {
  isPrettifyBuiltInProfileId,
  normalizePrettifyProfileCatalog,
  type PrettifyProfileCatalog,
  type PrettifyProfileId,
  type PrettifyProfileKind,
  type ValidatedPrettifyProfileInstruction,
} from '@shared/prettifyProfiles';
import type { KnownPrettifyProviderId, PrettifyProviderSettingsInput } from '@shared/prettifySettings';

export const COPY_SETTLE_DELAY_MS = 120;
export const SELECTED_TEXT_PRETTIFY_CACHE_MAX_ENTRIES = 20;
export const SELECTED_TEXT_PRETTIFY_CACHE_MAX_AGE_MS = 60_000;
export const MAX_PRETTIFY_SELECTED_TEXT_LENGTH = 16_000;

const EMPTY_CHOOSER_SUMMARIES: readonly PrettifyProfileChooserProfileSummary[] = Object.freeze([]);
const INVALID_CHOOSER_SELECTION_ERROR = 'Prettify chooser selection is unavailable';

export interface SelectedTextPrettifyResult {
  cancelled?: true;
  success: boolean;
  status: string;
  error?: string;
  skipped?: true;
}

export interface SelectedTextPrettifyRunObserver {
  readonly onGenerationStarted: () => void;
}

export interface SelectedTextPrettifyClipboard {
  readText(type?: ClipboardType): string;
  writeText(text: string, type?: ClipboardType): void;
}

export interface SelectedTextPrettifyRuntime {
  prepare(
    instruction: PrettifyExecutionInstruction,
    settings: PrettifyProviderSettingsInput,
    signal: AbortSignal,
  ): Promise<PreparePrettifyExecutionResult>;
}

export interface PrettifyProfileChooserPort {
  /** Resolves only after the chooser has closed and released its operation payload. */
  open(request: PrettifyProfileChooserRequest): Promise<PrettifyProfileChooserOutcome>;
  /** Cancels an open chooser and resolves its pending open call as cancelled. */
  cancel(): void;
  focus(): boolean;
}

export interface SelectedTextPrettifyDependencies {
  readonly actionGate: SelectedTextActionGate;
  readonly cache: TextActionResultCache;
  readonly chooser: PrettifyProfileChooserPort;
  readonly clipboard: SelectedTextPrettifyClipboard;
  readonly diagnosticCapture: Pick<DiagnosticCaptureService, 'capturePrettifyCacheHit'>;
  readonly getCacheContext: () => readonly string[];
  readonly logger: {
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
  };
  readonly localization: Pick<I18nService, 'translate'>;
  readonly notify: (title: string, body: string, options?: SystemNotificationOptions) => void;
  readonly openProfileManagement: () => void;
  readonly platform: NodeJS.Platform;
  readonly profileCatalog: Pick<AppConfigStore, 'getPrettifyProfileCatalog'>;
  readonly runtime: SelectedTextPrettifyRuntime;
  readonly textAutomation: Pick<TextAutomationService, 'run'>;
  readonly wait: (delayMs: number) => Promise<void>;
}

export type SelectedTextPrettifyPhase = 'idle' | 'capturing' | 'choosing' | 'generating';

type SelectedTextPrettifyRunPhase = Exclude<SelectedTextPrettifyPhase, 'idle'>;
type SelectedTextPrettifyEntry = 'chooser' | 'quick';

interface PrettifyOperationProfile {
  readonly description?: string;
  readonly id: PrettifyProfileId;
  readonly instruction: ValidatedPrettifyProfileInstruction;
  readonly kind: PrettifyProfileKind;
  readonly name: string;
}

interface PrettifyProfileOperationSnapshot {
  readonly profiles: readonly PrettifyOperationProfile[];
  readonly summaries: readonly PrettifyProfileChooserProfileSummary[];
}

interface SelectedTextPrettifyRun {
  readonly abortController: AbortController;
  cancelled: boolean;
  clipboardRestored: boolean;
  completionPromise: Promise<SelectedTextPrettifyResult> | null;
  gateReleased: boolean;
  generationStarted: boolean;
  observer: SelectedTextPrettifyRunObserver | null;
  phase: SelectedTextPrettifyRunPhase;
  previousClipboardText: string | null;
  resultWritten: boolean;
  snapshot: PrettifyProfileOperationSnapshot | null;
  sourceText: string | null;
  summaries: readonly PrettifyProfileChooserProfileSummary[];
}

interface SelectedTextCaptureResult {
  readonly copyError?: unknown;
  readonly selectedText: string;
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

function createOperationProfile(
  catalog: PrettifyProfileCatalog,
  profileId: PrettifyProfileId,
  translate: I18nService['translate'],
): PrettifyOperationProfile {
  if (isPrettifyBuiltInProfileId(profileId)) {
    const profile = getPrettifyBuiltInProfileDefinition(profileId);
    return Object.freeze({
      description: translate(profile.descriptionKey),
      id: profile.id,
      instruction: profile.instruction,
      kind: profile.kind,
      name: translate(profile.nameKey),
    });
  }

  const profile = catalog.customProfiles.find(({ id }) => id === profileId);
  if (!profile) throw new Error(INVALID_CHOOSER_SELECTION_ERROR);
  return Object.freeze({
    ...(profile.description === undefined ? {} : { description: profile.description }),
    id: profile.id,
    instruction: profile.instruction,
    kind: 'custom',
    name: profile.name,
  });
}

function createOperationSnapshot(
  catalogValue: unknown,
  translate: I18nService['translate'],
): PrettifyProfileOperationSnapshot {
  const catalog = normalizePrettifyProfileCatalog(catalogValue);
  const profiles = Object.freeze(
    catalog.chooserOrder.map((profileId) => createOperationProfile(catalog, profileId, translate)),
  );
  const summaries = Object.freeze(
    profiles.map((profile) =>
      Object.freeze({
        ...(profile.description === undefined ? {} : { description: profile.description }),
        id: profile.id,
        isDefault: profile.id === catalog.defaultProfileId,
        kind: profile.kind,
        name: profile.name,
      }),
    ),
  );
  return Object.freeze({ profiles, summaries });
}

/** Owns one phase-aware, cancellable selected-text Prettify workflow and its cache. */
export class SelectedTextPrettifyService {
  private activeRun: SelectedTextPrettifyRun | null = null;
  private disposed = false;
  private lastAppliedProfileId: PrettifyProfileId | null = null;

  public constructor(private readonly dependencies: SelectedTextPrettifyDependencies) {}

  public readonly chooseProfileForSelectedText = (
    observer?: SelectedTextPrettifyRunObserver,
  ): Promise<SelectedTextPrettifyResult> => this.startRun('chooser', observer);

  public readonly applyDefaultProfileToSelectedText = (
    observer?: SelectedTextPrettifyRunObserver,
  ): Promise<SelectedTextPrettifyResult> => this.startRun('quick', observer);

  public focusExistingChooser(): boolean {
    const run = this.activeRun;
    if (!run || run.phase !== 'choosing' || run.abortController.signal.aborted) return false;
    try {
      return this.dependencies.chooser.focus();
    } catch (error: unknown) {
      this.dependencies.logger.warn(
        'Could not focus the active Prettify chooser:',
        this.presentPrettifyError(error).safeLogMetadata,
      );
      return false;
    }
  }

  public cancel(): SelectedTextPrettifyResult | null {
    const run = this.activeRun;
    if (!run || run.abortController.signal.aborted) return null;

    run.cancelled = true;
    run.abortController.abort();
    if (run.phase === 'choosing') {
      try {
        this.dependencies.chooser.cancel();
      } catch (error: unknown) {
        this.dependencies.logger.warn(
          'Could not cancel the active Prettify chooser:',
          this.presentPrettifyError(error).safeLogMetadata,
        );
      }
    }
    this.clearRunSensitiveState(run, run.phase === 'capturing' && !run.clipboardRestored);
    this.dependencies.logger.info('Selected-text prettify cancelled');
    return this.createCancelledResult();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
  }

  private startRun(
    entry: SelectedTextPrettifyEntry,
    observer?: SelectedTextPrettifyRunObserver,
  ): Promise<SelectedTextPrettifyResult> {
    if (this.disposed) return Promise.resolve(createSkippedResult());
    if (this.activeRun) {
      if (this.activeRun.phase === 'choosing') this.focusExistingChooser();
      this.dependencies.logger.info('Selected-text prettify skipped because a prettify run is already active');
      return Promise.resolve(createSkippedResult());
    }
    if (!this.dependencies.actionGate.tryBegin('prettify')) {
      this.dependencies.logger.info('Selected-text prettify skipped because another selected-text action is active');
      return Promise.resolve(createSkippedResult());
    }

    const run: SelectedTextPrettifyRun = {
      abortController: new AbortController(),
      cancelled: false,
      clipboardRestored: false,
      completionPromise: null,
      gateReleased: false,
      generationStarted: false,
      observer: observer ?? null,
      phase: 'capturing',
      previousClipboardText: null,
      resultWritten: false,
      snapshot: null,
      sourceText: null,
      summaries: EMPTY_CHOOSER_SUMMARIES,
    };
    this.activeRun = run;
    const completionPromise = this.executeRun(run, entry);
    run.completionPromise = completionPromise;
    return completionPromise;
  }

  private async executeRun(
    run: SelectedTextPrettifyRun,
    entry: SelectedTextPrettifyEntry,
  ): Promise<SelectedTextPrettifyResult> {
    try {
      const { selectedText, copyError } = await this.captureSelectedText(run);
      if (!this.canContinue(run)) return this.createCancelledResult();

      if (!selectedText.trim()) {
        if (copyError) {
          this.dependencies.logger.warn(
            'No selected text found after copy automation failure:',
            this.presentPrettifyError(copyError).safeLogMetadata,
          );
        }
        const error = this.dependencies.localization.translate('error.noTextSelectedToPrettify');
        const presented = this.notifyPrettifyFailure(error);
        return createFailureResult(presented.userMessage);
      }

      if (selectedText.length > MAX_PRETTIFY_SELECTED_TEXT_LENGTH) {
        const error = this.dependencies.localization.translate('error.prettifyTextTooLong', {
          max: String(MAX_PRETTIFY_SELECTED_TEXT_LENGTH),
        });
        const presented = this.notifyPrettifyFailure(error);
        return createFailureResult(presented.userMessage);
      }

      return entry === 'chooser'
        ? await this.runChooserFlow(run, selectedText)
        : await this.runQuickFlow(run, selectedText);
    } catch (error: unknown) {
      if (!this.canContinue(run)) return this.createCancelledResult();
      const presented = this.notifyPrettifyFailure(error);
      this.dependencies.logger.warn('Selected-text prettify failed:', presented.safeLogMetadata);
      return createFailureResult(presented.userMessage);
    } finally {
      this.finishRun(run);
    }
  }

  private async captureSelectedText(run: SelectedTextPrettifyRun): Promise<SelectedTextCaptureResult> {
    let capture: SelectedTextCaptureResult | undefined;
    let failure: { readonly error: unknown } | null = null;
    try {
      run.previousClipboardText = this.dependencies.clipboard.readText();
      this.dependencies.clipboard.writeText('');
      capture = await this.readSelectedText();
    } catch (error: unknown) {
      failure = { error };
    } finally {
      const previousClipboardText = run.previousClipboardText;
      run.previousClipboardText = null;
      run.clipboardRestored = true;
      if (previousClipboardText !== null) {
        try {
          this.dependencies.clipboard.writeText(previousClipboardText);
        } catch (error: unknown) {
          this.dependencies.logger.warn(
            'Could not restore clipboard after selected-text capture:',
            this.presentPrettifyError(error).safeLogMetadata,
          );
          failure = { error };
        }
      }
    }
    if (failure) throw failure.error;
    if (!capture) throw new Error('Selected-text capture failed');
    run.sourceText = capture.selectedText;
    return capture;
  }

  private async runChooserFlow(
    run: SelectedTextPrettifyRun,
    selectedText: string,
  ): Promise<SelectedTextPrettifyResult> {
    const catalog = this.dependencies.profileCatalog.getPrettifyProfileCatalog();
    const snapshot = createOperationSnapshot(catalog, this.dependencies.localization.translate);
    run.snapshot = snapshot;
    run.summaries = snapshot.summaries;
    run.phase = 'choosing';

    const initialProfileId =
      this.lastAppliedProfileId && snapshot.profiles.some(({ id }) => id === this.lastAppliedProfileId)
        ? this.lastAppliedProfileId
        : undefined;
    const request = Object.freeze({
      ...(initialProfileId === undefined ? {} : { initialProfileId }),
      profiles: snapshot.summaries,
      sourceText: selectedText,
    });
    const outcome = await this.dependencies.chooser.open(request);
    if (!this.canContinue(run)) return this.createCancelledResult();

    if (outcome.type === 'cancel' || outcome.type === 'close') return this.createCancelledResult();
    if (outcome.type === 'manageProfiles') {
      this.clearRunSensitiveState(run);
      this.finishRun(run);
      this.dependencies.openProfileManagement();
      return this.createCancelledResult();
    }

    const profile = snapshot.profiles.find(({ id }) => id === outcome.profileId);
    if (!profile) throw new Error(INVALID_CHOOSER_SELECTION_ERROR);
    this.lastAppliedProfileId = profile.id;
    return this.executeInstruction(run, selectedText, composePrettifyProfileInstruction(profile.instruction));
  }

  private runQuickFlow(run: SelectedTextPrettifyRun, selectedText: string): Promise<SelectedTextPrettifyResult> {
    const catalog = normalizePrettifyProfileCatalog(this.dependencies.profileCatalog.getPrettifyProfileCatalog());
    return this.executeInstruction(
      run,
      selectedText,
      resolvePrettifyExecutionInstruction(catalog, catalog.defaultProfileId),
    );
  }

  private async executeInstruction(
    run: SelectedTextPrettifyRun,
    selectedText: string,
    instruction: PrettifyExecutionInstruction,
  ): Promise<SelectedTextPrettifyResult> {
    run.phase = 'generating';
    this.notifyGenerationStarted(run);
    const preparation = await this.dependencies.runtime.prepare(instruction, {}, run.abortController.signal);
    if (!this.canContinue(run)) return this.createCancelledResult();
    if (!preparation.success) {
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
      if (!this.canWriteResult(run)) return this.createCancelledResult();
      this.captureCacheHit(selectedText, cachedPrettified, preparation.prepared.providerId);
      this.writeSuccessfulResult(run, cachedPrettified);
      this.dependencies.logger.info('Prettified selected text copied from cache:', {
        sourceLength: selectedText.length,
        prettifiedLength: cachedPrettified.length,
      });
      return this.createSuccessResult();
    }

    const prettified = await preparation.prepared.execute(selectedText);
    if (!this.canContinue(run)) return this.createCancelledResult();
    if (!prettified.success || !prettified.text?.trim()) {
      const error = prettified.error || this.dependencies.localization.translate('error.noPrettifyResult');
      const presented = this.notifyPrettifyFailure(error);
      return createFailureResult(presented.userMessage);
    }
    if (!this.canWriteResult(run)) return this.createCancelledResult();

    this.dependencies.cache.set(cacheKey, prettified.text);
    this.writeSuccessfulResult(run, prettified.text);
    this.dependencies.logger.info('Prettified selected text copied:', {
      sourceLength: selectedText.length,
      prettifiedLength: prettified.text.length,
    });
    return this.createSuccessResult();
  }

  private canContinue(run: SelectedTextPrettifyRun): boolean {
    return this.activeRun === run && !run.cancelled && !run.abortController.signal.aborted;
  }

  private canWriteResult(run: SelectedTextPrettifyRun): boolean {
    return this.canContinue(run) && !run.resultWritten;
  }

  private writeSuccessfulResult(run: SelectedTextPrettifyRun, resultText: string): void {
    run.resultWritten = true;
    this.dependencies.clipboard.writeText(resultText);
    this.notifyPrettifySuccess();
  }

  private notifyGenerationStarted(run: SelectedTextPrettifyRun): void {
    if (run.generationStarted) return;
    run.generationStarted = true;
    try {
      run.observer?.onGenerationStarted();
    } catch (error: unknown) {
      this.dependencies.logger.warn(
        'Could not present Prettify generation start:',
        this.presentPrettifyError(error).safeLogMetadata,
      );
    }
  }

  private clearRunSensitiveState(run: SelectedTextPrettifyRun, preserveClipboard = false): void {
    if (!preserveClipboard) run.previousClipboardText = null;
    run.observer = null;
    run.snapshot = null;
    run.sourceText = null;
    run.summaries = EMPTY_CHOOSER_SUMMARIES;
  }

  private finishRun(run: SelectedTextPrettifyRun): void {
    this.clearRunSensitiveState(run);
    if (this.activeRun === run) this.activeRun = null;
    if (run.gateReleased) return;
    run.gateReleased = true;
    this.dependencies.actionGate.finish('prettify');
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

  private async readSelectedText(): Promise<SelectedTextCaptureResult> {
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
    return { ...(copyError === undefined ? {} : { copyError }), selectedText };
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
