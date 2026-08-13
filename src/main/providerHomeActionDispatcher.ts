import type { MainInteractionLock } from '@shared/mainInteractionLock';
import { presentNotificationError, type NotificationErrorLogMetadata } from '@shared/notifications';
import type {
  ProviderHomeActionCommand,
  ProviderHomeActionResult,
  ProviderHomeActionState,
  ProviderHomeTextAction,
} from '@shared/providerHomeAction';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';
import type { TextActionSettings } from '@shared/textActionSettings';
import type { TextActionStatus, TextActionStatusAction } from '@shared/textActionStatus';
import type { AppConfigStore } from './config';
import type { I18nService } from './i18n';
import type { PrettifyRuntime } from './services/prettifyProviders';
import type { SelectedTextPrettifyRunObserver, SelectedTextPrettifyService } from './services/selectedTextPrettify';
import type { SelectedTextActionGate } from './services/selectedTextActionState';
import type { SelectedTextTranslationRunObserver } from './services/selectedTextTranslation';
import { getTrayIconStateForRecordingLifecycle } from './trayIconState';
import type { TrayController } from './tray';
import type { WindowManager } from './window';

export type ProviderHomeActionInvocationSource = 'escape' | 'global-shortcut' | 'provider-home';

interface TextActionResultForStatus {
  readonly cancelled?: true;
  readonly skipped?: true;
  readonly success: boolean;
}

interface SelectedTextTranslationActionService {
  canCancel(): boolean;
  cancel(): boolean;
  translateSelectedTextToClipboard(observer?: SelectedTextTranslationRunObserver): Promise<TextActionResultForStatus>;
}

interface ProviderHomeActionDispatcherDependencies {
  readonly config: Pick<AppConfigStore, 'getSnapshot' | 'getTextActionSettings'>;
  readonly getRecordingLifecycleState: () => RecordingLifecycleState;
  readonly localization: Pick<I18nService, 'translate'>;
  readonly logger: {
    info(message: string, metadata?: Readonly<Record<string, unknown>>): void;
    warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  };
  readonly mainInteractionLock: Pick<MainInteractionLock, 'locked'>;
  readonly notification: {
    show(title: string, body: string): void;
  };
  readonly prettifyRuntime: Pick<PrettifyRuntime, 'isProviderConnected'>;
  readonly selectedTextActionGate: Pick<SelectedTextActionGate, 'getActive' | 'subscribe'>;
  readonly selectedTextPrettifyService: Pick<
    SelectedTextPrettifyService,
    'canCancel' | 'cancel' | 'chooseProfileForSelectedText' | 'focusExistingChooser'
  >;
  readonly selectedTextTranslationService: SelectedTextTranslationActionService;
  readonly trayController: Pick<TrayController, 'updateIcon'>;
  readonly windowManager: Pick<WindowManager, 'getMainWindow' | 'publishProviderHomeActionState'>;
}

/**
 * Owns canonical main-process Prettify and Translation starts/cancels.
 * Global shortcuts, Escape, and homepage controls are intentionally thin adapters.
 */
export class ProviderHomeActionDispatcher {
  private disposed = false;
  private readonly unsubscribeGate: () => void;

  public constructor(private readonly dependencies: ProviderHomeActionDispatcherDependencies) {
    this.unsubscribeGate = dependencies.selectedTextActionGate.subscribe(() => this.publishState());
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeGate();
  }

  public dispatch(
    command: ProviderHomeActionCommand,
    source: ProviderHomeActionInvocationSource,
  ): ProviderHomeActionResult {
    if (this.disposed) return { accepted: false };
    if (command.action === 'cancel') return this.cancel(command.provider, source);
    return this.start(command.provider, source);
  }

  public getState(): ProviderHomeActionState {
    const activeAction = this.getActiveAction();
    return Object.freeze({
      activeAction,
      activeActionCancellable: activeAction !== null && this.canCancel(activeAction),
      settings: Object.freeze({ ...this.getSettings() }),
    });
  }

  public publishState(): void {
    if (this.disposed) return;
    this.dependencies.windowManager.publishProviderHomeActionState(this.getState());
  }

  private cancel(
    provider: ProviderHomeTextAction,
    source: ProviderHomeActionInvocationSource,
  ): ProviderHomeActionResult {
    if (this.dependencies.mainInteractionLock.locked || this.getActiveAction() !== provider) {
      return { accepted: false };
    }

    const accepted =
      provider === 'prettify'
        ? Boolean(this.dependencies.selectedTextPrettifyService.cancel())
        : this.dependencies.selectedTextTranslationService.cancel();
    if (accepted) {
      this.dependencies.logger.info('Selected-text provider action cancelled', { provider, source });
      this.publishState();
    }
    return { accepted };
  }

  private start(
    provider: ProviderHomeTextAction,
    source: ProviderHomeActionInvocationSource,
  ): ProviderHomeActionResult {
    if (this.dependencies.mainInteractionLock.locked) return { accepted: false };
    return provider === 'prettify' ? this.startPrettify(source) : this.startTranslation(source);
  }

  private startPrettify(source: ProviderHomeActionInvocationSource): ProviderHomeActionResult {
    const settings = this.dependencies.config.getSnapshot();
    if (!this.dependencies.prettifyRuntime.isProviderConnected(settings.prettifySettings.providerId)) {
      this.dependencies.logger.info('Prettify provider action rejected because provider is not connected', { source });
      this.sendStatus({ action: 'prettify', phase: 'failed' });
      this.showPrettifyDisconnectedNotification();
      return { accepted: false };
    }

    if (source === 'global-shortcut' && this.dependencies.selectedTextPrettifyService.focusExistingChooser()) {
      this.dependencies.logger.info('Focused active Prettify chooser from global shortcut');
      return { accepted: true };
    }

    if (!this.canStart('prettify')) return { accepted: false };

    let generationPresentationStarted = false;
    const observer: SelectedTextPrettifyRunObserver = {
      onGenerationStarted: (): void => {
        if (generationPresentationStarted) return;
        generationPresentationStarted = true;
        this.dependencies.trayController.updateIcon('prettifying');
        this.sendStatus({ action: 'prettify', phase: 'working' });
      },
    };
    const promise = this.dependencies.selectedTextPrettifyService.chooseProfileForSelectedText(observer);
    this.observeCompletion('prettify', promise, () => generationPresentationStarted);
    this.publishState();
    return { accepted: true };
  }

  private startTranslation(source: ProviderHomeActionInvocationSource): ProviderHomeActionResult {
    if (!this.canStart('translation')) return { accepted: false };

    let translationPresentationStarted = false;
    const observer: SelectedTextTranslationRunObserver = {
      onTranslationStarted: (): void => {
        if (translationPresentationStarted) return;
        translationPresentationStarted = true;
        this.dependencies.trayController.updateIcon('processing');
      },
    };
    this.dependencies.logger.info('Starting selected-text Translation provider action', { source });
    const promise = this.dependencies.selectedTextTranslationService.translateSelectedTextToClipboard(observer);
    this.sendStatus({ action: 'translation', phase: 'working' });
    this.observeCompletion('translation', promise, () => translationPresentationStarted);
    this.publishState();
    return { accepted: true };
  }

  private canStart(provider: ProviderHomeTextAction): boolean {
    const settings = this.getSettings();
    const enabled = provider === 'prettify' ? settings.prettifyEnabled : settings.translateEnabled;
    return (
      enabled &&
      !this.dependencies.mainInteractionLock.locked &&
      !this.dependencies.selectedTextActionGate.getActive() &&
      this.dependencies.getRecordingLifecycleState() === 'idle'
    );
  }

  private canCancel(provider: ProviderHomeTextAction): boolean {
    return provider === 'prettify'
      ? this.dependencies.selectedTextPrettifyService.canCancel()
      : this.dependencies.selectedTextTranslationService.canCancel();
  }

  private getActiveAction(): ProviderHomeTextAction | null {
    const action = this.dependencies.selectedTextActionGate.getActive();
    if (action === 'prettify') return 'prettify';
    if (action === 'translate') return 'translation';
    return null;
  }

  private getSettings(): TextActionSettings {
    return this.dependencies.config.getTextActionSettings();
  }

  private observeCompletion(
    action: TextActionStatusAction,
    promise: Promise<TextActionResultForStatus>,
    presentationStarted: () => boolean,
  ): void {
    void promise.then(
      (result) => this.settleAction(action, result, presentationStarted()),
      (error: unknown) => this.settleFailure(action, error, presentationStarted()),
    );
  }

  private settleAction(
    action: TextActionStatusAction,
    result: TextActionResultForStatus,
    presentationStarted: boolean,
  ): void {
    this.sendStatus({
      action,
      phase: result.skipped ? 'skipped' : result.cancelled ? 'cancelled' : result.success ? 'completed' : 'failed',
    });
    if (presentationStarted) this.restoreTrayIcon();
    this.publishState();
  }

  private settleFailure(action: TextActionStatusAction, error: unknown, presentationStarted: boolean): void {
    const metadata: NotificationErrorLogMetadata & { readonly action: TextActionStatusAction } = {
      action,
      ...presentNotificationError(error, { context: action }).safeLogMetadata,
    };
    this.dependencies.logger.warn('Selected-text provider action failed', { ...metadata });
    this.sendStatus({ action, phase: 'failed' });
    if (presentationStarted) this.restoreTrayIcon();
    this.publishState();
  }

  private restoreTrayIcon(): void {
    this.dependencies.trayController.updateIcon(
      getTrayIconStateForRecordingLifecycle(this.dependencies.getRecordingLifecycleState()),
    );
  }

  private sendStatus(status: TextActionStatus): void {
    this.dependencies.windowManager.getMainWindow()?.webContents.send('translation-status', status);
  }

  private showPrettifyDisconnectedNotification(): void {
    try {
      const failed = this.dependencies.localization.translate('status.prettifyFailed');
      const disconnected = this.dependencies.localization.translate('provider.notConnected');
      this.dependencies.notification.show('GPT-Voice', `${failed}: ${disconnected}`);
    } catch {
      this.dependencies.logger.warn('Failed to show disconnected Prettify provider notification');
    }
  }
}
