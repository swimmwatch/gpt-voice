import type { IpcMainInvokeEvent, WebContents } from 'electron';

import type { WindowManager } from '../../window';
import type { LocalWhisperIpcSenderAuthority, LocalWhisperIpcSenderCapability } from './LocalWhisperIpcController';

type CapabilitySurface = 'settings' | 'main';

/** Binds one IPC capability to the exact current top-level Electron frame and live owned window. */
export class ElectronLocalWhisperSenderAuthority implements LocalWhisperIpcSenderAuthority {
  private readonly frameIds = new WeakMap<object, number>();
  private nextFrameId = 1;

  public constructor(private readonly windows: WindowManager) {}

  public authorizeSettings(event: IpcMainInvokeEvent): LocalWhisperIpcSenderCapability | null {
    return this.authorize('settings', event);
  }

  public authorizeMain(event: IpcMainInvokeEvent): LocalWhisperIpcSenderCapability | null {
    return this.authorize('main', event);
  }

  private authorize(surface: CapabilitySurface, event: IpcMainInvokeEvent): LocalWhisperIpcSenderCapability | null {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame || event.sender.isDestroyed()) return null;
    const trusted =
      surface === 'settings'
        ? this.windows.isTrustedLocalWhisperSettingsFrame(event.sender, frame)
        : this.windows.isTrustedMainFrame(event.sender, frame);
    if (!trusted) return null;

    const frameId = this.frameId(frame);
    const key = `${surface}:${event.sender.id}:${frameId}`;
    const isCurrent = (): boolean => {
      if (event.sender.isDestroyed() || event.sender.mainFrame !== frame) return false;
      return surface === 'settings'
        ? this.windows.isTrustedLocalWhisperSettingsFrame(event.sender, frame)
        : this.windows.isTrustedMainFrame(event.sender, frame);
    };
    return Object.freeze({
      key,
      isCurrent,
      send: (channel: string, value: unknown): void => {
        if (isCurrent()) event.sender.send(channel, value);
      },
      onInvalidated: (listener: () => void): (() => void) => this.listenForInvalidation(event.sender, listener),
    });
  }

  private frameId(frame: object): number {
    const current = this.frameIds.get(frame);
    if (current !== undefined) return current;
    const next = this.nextFrameId;
    this.nextFrameId += 1;
    this.frameIds.set(frame, next);
    return next;
  }

  private listenForInvalidation(sender: WebContents, listener: () => void): () => void {
    const invalidate = (): void => listener();
    sender.once('did-start-navigation', invalidate);
    sender.once('destroyed', invalidate);
    sender.once('render-process-gone', invalidate);
    return () => {
      sender.removeListener('did-start-navigation', invalidate);
      sender.removeListener('destroyed', invalidate);
      sender.removeListener('render-process-gone', invalidate);
    };
  }
}
