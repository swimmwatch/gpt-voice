/* eslint-disable max-classes-per-file -- One private capability class owns each authority-issued lifecycle. */
import type { IpcMainInvokeEvent, WebContents, WebFrameMain } from 'electron';

import type { WindowManager } from '../../window';
import type { LocalWhisperIpcSenderAuthority, LocalWhisperIpcSenderCapability } from './LocalWhisperIpcController';

type CapabilitySurface = 'settings' | 'main';
type InvalidationEvent = 'did-start-navigation' | 'destroyed' | 'render-process-gone';

const INVALIDATION_EVENTS: readonly InvalidationEvent[] = ['did-start-navigation', 'destroyed', 'render-process-gone'];

/** Owns one terminal, exact-document sender capability and its Electron listener lifetime. */
class ElectronLocalWhisperSenderCapability implements LocalWhisperIpcSenderCapability {
  private readonly invalidationListeners = new Set<() => void>();
  private invalidated = false;
  private lifecycleListening = false;
  private readonly invalidateFromLifecycle = (): void => this.invalidate();

  public constructor(
    public readonly key: string,
    private readonly surface: CapabilitySurface,
    private readonly sender: WebContents,
    private readonly frame: WebFrameMain,
    private readonly windows: WindowManager,
  ) {
    this.listenForInvalidation();
  }

  public isCurrent(): boolean {
    if (this.invalidated || this.sender.isDestroyed() || this.sender.mainFrame !== this.frame) return false;
    return this.surface === 'settings'
      ? this.windows.isTrustedLocalWhisperSettingsFrame(this.sender, this.frame)
      : this.windows.isTrustedMainFrame(this.sender, this.frame);
  }

  public send(channel: string, value: unknown): void {
    if (this.isCurrent()) this.sender.send(channel, value);
  }

  public onInvalidated(listener: () => void): () => void {
    if (this.invalidated) {
      listener();
      return () => undefined;
    }
    this.invalidationListeners.add(listener);
    return () => this.invalidationListeners.delete(listener);
  }

  private listenForInvalidation(): void {
    this.lifecycleListening = true;
    for (const event of INVALIDATION_EVENTS) {
      if (this.invalidated) break;
      this.addLifecycleListener(event);
    }
    if (this.invalidated) this.removeLifecycleListeners();
  }

  private invalidate(): void {
    if (this.invalidated) return;
    this.invalidated = true;
    this.removeLifecycleListeners();
    const listeners = [...this.invalidationListeners];
    this.invalidationListeners.clear();
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // Capability revocation is authoritative even if subscriber cleanup throws.
      }
    }
  }

  private removeLifecycleListeners(): void {
    if (!this.lifecycleListening) return;
    this.lifecycleListening = false;
    for (const event of INVALIDATION_EVENTS) this.removeLifecycleListener(event);
  }

  private addLifecycleListener(event: InvalidationEvent): void {
    switch (event) {
      case 'did-start-navigation':
        this.sender.once('did-start-navigation', this.invalidateFromLifecycle);
        return;
      case 'destroyed':
        this.sender.once('destroyed', this.invalidateFromLifecycle);
        return;
      case 'render-process-gone':
        this.sender.once('render-process-gone', this.invalidateFromLifecycle);
        return;
    }
  }

  private removeLifecycleListener(event: InvalidationEvent): void {
    switch (event) {
      case 'did-start-navigation':
        this.sender.removeListener('did-start-navigation', this.invalidateFromLifecycle);
        return;
      case 'destroyed':
        this.sender.removeListener('destroyed', this.invalidateFromLifecycle);
        return;
      case 'render-process-gone':
        this.sender.removeListener('render-process-gone', this.invalidateFromLifecycle);
        return;
    }
  }
}

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
    return new ElectronLocalWhisperSenderCapability(key, surface, event.sender, frame, this.windows);
  }

  private frameId(frame: object): number {
    const current = this.frameIds.get(frame);
    if (current !== undefined) return current;
    const next = this.nextFrameId;
    this.nextFrameId += 1;
    this.frameIds.set(frame, next);
    return next;
  }
}
