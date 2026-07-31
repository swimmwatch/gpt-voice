import type { IpcMainInvokeEvent } from 'electron';
import type { I18nService } from './i18n';
import type { MainIpcLogger, MainIpcTransport } from './ipc';
import type { PrettifyProfileChooserWindowController } from './prettifyProfileChooserWindowController';
import { PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS } from '@shared/prettifyProfileChooser';

export const PRETTIFY_PROFILE_CHOOSER_IPC_REJECTION_ERROR = 'Rejected Prettify profile chooser IPC request';

export interface PrettifyProfileChooserIpcRegistrarDependencies {
  readonly controller: Pick<
    PrettifyProfileChooserWindowController,
    'apply' | 'cancelWithToken' | 'isTrustedSender' | 'loadPayload' | 'manageProfiles' | 'rendererReady'
  >;
  readonly ipc: MainIpcTransport;
  readonly localization: Pick<I18nService, 'getCurrentCatalog' | 'getLocale'>;
  readonly logger: Pick<MainIpcLogger, 'warn'>;
}

type ChooserIpcListener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

/** Owns only the isolated chooser IPC channels and their exact sender boundary. */
export class PrettifyProfileChooserIpcRegistrar {
  private readonly channels = new Set<string>();
  private disposed = false;
  private registered = false;

  public constructor(private readonly dependencies: PrettifyProfileChooserIpcRegistrarDependencies) {}

  public register(): void {
    if (this.disposed) throw new Error('Prettify profile chooser IPC registrar is disposed');
    if (this.registered) return;
    this.registered = true;

    const { controller, localization } = this.dependencies;
    this.handle(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.load, 0, () => {
      const payload = controller.loadPayload();
      if (!payload) this.reject();
      return payload;
    });
    this.handle(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.ready, 1, (_event, token) => {
      if (!controller.rendererReady(token)) this.reject();
    });
    this.handle(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.apply, 2, (_event, token, profileId) => {
      if (!controller.apply(token, profileId)) this.reject();
    });
    this.handle(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.cancel, 1, (_event, token) => {
      if (!controller.cancelWithToken(token)) this.reject();
    });
    this.handle(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.manageProfiles, 1, (_event, token) => {
      if (!controller.manageProfiles(token)) this.reject();
    });
    this.handle(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getTranslations, 0, () => {
      return localization.getCurrentCatalog();
    });
    this.handle(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getLocale, 0, () => {
      return localization.getLocale();
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const channel of this.channels) this.dependencies.ipc.removeHandler(channel);
    this.channels.clear();
  }

  private handle(channel: string, argumentCount: number, listener: ChooserIpcListener): void {
    this.dependencies.ipc.handle(channel, (event, ...args) => {
      if (
        args.length !== argumentCount ||
        !this.dependencies.controller.isTrustedSender(event.sender, event.senderFrame?.url)
      ) {
        this.reject();
      }
      return listener(event, ...args);
    });
    this.channels.add(channel);
  }

  private reject(): never {
    this.dependencies.logger.warn(PRETTIFY_PROFILE_CHOOSER_IPC_REJECTION_ERROR);
    throw new Error(PRETTIFY_PROFILE_CHOOSER_IPC_REJECTION_ERROR);
  }
}
