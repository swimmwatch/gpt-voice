import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IpcMainInvokeEvent, WebContents, WebFrameMain } from 'electron';

import { ElectronLocalWhisperSenderAuthority } from '@main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority';
import type { WindowManager } from '@main/window';

interface SenderHarness {
  readonly sender: WebContents;
  readonly sent: { readonly channel: string; readonly value: unknown }[];
  listenerCount(event: string): number;
  emit(event: string, ...args: unknown[]): void;
  setMainFrame(frame: WebFrameMain): void;
}

function createSender(frame: WebFrameMain): SenderHarness {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const sent: { readonly channel: string; readonly value: unknown }[] = [];
  let mainFrame = frame;
  const sender = {
    id: 41,
    get mainFrame() {
      return mainFrame;
    },
    isDestroyed: () => false,
    send: (channel: string, value: unknown) => sent.push({ channel, value }),
    once: (event: string, listener: () => void) => {
      const eventListeners = listeners.get(event) ?? new Set<() => void>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
      return sender;
    },
    removeListener: (event: string, listener: (...args: unknown[]) => void) => {
      const eventListeners = listeners.get(event);
      eventListeners?.delete(listener);
      if (eventListeners?.size === 0) listeners.delete(event);
      return sender;
    },
  } as unknown as WebContents;
  return {
    sender,
    sent,
    listenerCount: (event) => listeners.get(event)?.size ?? 0,
    emit: (event, ...args) => {
      const eventListeners = [...(listeners.get(event) ?? [])];
      listeners.delete(event);
      for (const listener of eventListeners) listener(...args);
    },
    setMainFrame: (next) => (mainFrame = next),
  };
}

function event(sender: WebContents, senderFrame: WebFrameMain | null): IpcMainInvokeEvent {
  return { sender, senderFrame } as IpcMainInvokeEvent;
}

describe('ElectronLocalWhisperSenderAuthority', () => {
  it('authorizes only the exact current top-level frame for each distinct surface', () => {
    const settingsFrame = { url: 'app://gpt-voice/provider-settings.html?providerId=local-whisper' } as WebFrameMain;
    const mainFrame = { url: 'app://gpt-voice/' } as WebFrameMain;
    const settingsSender = createSender(settingsFrame);
    const mainSender = createSender(mainFrame);
    const windows = {
      isTrustedLocalWhisperSettingsFrame: (sender: WebContents, frame: WebFrameMain) =>
        sender === settingsSender.sender && frame === settingsFrame,
      isTrustedMainFrame: (sender: WebContents, frame: WebFrameMain) =>
        sender === mainSender.sender && frame === mainFrame,
    } as unknown as WindowManager;
    const authority = new ElectronLocalWhisperSenderAuthority(windows);

    assert.ok(authority.authorizeSettings(event(settingsSender.sender, settingsFrame)));
    assert.equal(authority.authorizeMain(event(settingsSender.sender, settingsFrame)), null);
    assert.ok(authority.authorizeMain(event(mainSender.sender, mainFrame)));
    assert.equal(authority.authorizeSettings(event(mainSender.sender, mainFrame)), null);
    assert.equal(
      authority.authorizeSettings(event(settingsSender.sender, { url: settingsFrame.url } as WebFrameMain)),
      null,
    );
  });

  it('permanently revokes every navigation and renderer lifecycle capability exactly once', () => {
    const events = ['did-start-navigation', 'destroyed', 'render-process-gone'] as const;

    for (const invalidationEvent of events) {
      const frame = { url: 'app://gpt-voice/provider-settings.html?providerId=local-whisper' } as WebFrameMain;
      const sender = createSender(frame);
      const windows = {
        isTrustedLocalWhisperSettingsFrame: (candidate: WebContents, candidateFrame: WebFrameMain) =>
          candidate === sender.sender && candidateFrame === frame,
        isTrustedMainFrame: () => false,
      } as unknown as WindowManager;
      const authority = new ElectronLocalWhisperSenderAuthority(windows);
      const capability = authority.authorizeSettings(event(sender.sender, frame));
      assert.ok(capability, invalidationEvent);
      let retainedInvalidations = 0;
      let removedInvalidations = 0;
      const remove = capability.onInvalidated(() => {
        retainedInvalidations += 1;
      });
      const removeSecond = capability.onInvalidated(() => {
        removedInvalidations += 1;
      });
      removeSecond();
      for (const lifecycleEvent of events) assert.equal(sender.listenerCount(lifecycleEvent), 1, invalidationEvent);

      sender.emit(invalidationEvent);
      assert.equal(retainedInvalidations, 1, invalidationEvent);
      assert.equal(removedInvalidations, 0, invalidationEvent);
      for (const lifecycleEvent of events) assert.equal(sender.listenerCount(lifecycleEvent), 0, invalidationEvent);

      sender.emit(invalidationEvent);
      assert.equal(retainedInvalidations, 1, invalidationEvent);
      assert.equal(capability.isCurrent(), false, invalidationEvent);
      capability.send('private-channel', { path: '/must-not-send' });
      assert.equal(sender.sent.length, 0, invalidationEvent);

      let lateInvalidations = 0;
      capability.onInvalidated(() => {
        lateInvalidations += 1;
      });
      assert.equal(lateInvalidations, 1, invalidationEvent);
      remove();
    }
  });

  it('revokes same-document and nested-frame navigation without trusting navigation flags', () => {
    const canonicalUrl = 'app://gpt-voice/provider-settings.html?providerId=local-whisper';
    const navigationCases = [
      ['same-document hash navigation', canonicalUrl, true, true],
      ['same-document history navigation', canonicalUrl, true, true],
      ['nested-frame navigation', 'https://attacker.example/', false, false],
    ] as const;

    for (const [description, nextUrl, isInPlace, isMainFrame] of navigationCases) {
      const frame = { url: canonicalUrl } as WebFrameMain;
      const sender = createSender(frame);
      const windows = {
        isTrustedLocalWhisperSettingsFrame: (candidate: WebContents, candidateFrame: WebFrameMain) =>
          candidate === sender.sender && candidateFrame === frame,
        isTrustedMainFrame: () => false,
      } as unknown as WindowManager;
      const capability = new ElectronLocalWhisperSenderAuthority(windows).authorizeSettings(
        event(sender.sender, frame),
      );
      assert.ok(capability, description);

      sender.emit('did-start-navigation', {}, nextUrl, isInPlace, isMainFrame);

      assert.equal(capability.isCurrent(), false, description);
      assert.equal(sender.listenerCount('did-start-navigation'), 0, description);
      assert.equal(sender.listenerCount('destroyed'), 0, description);
      assert.equal(sender.listenerCount('render-process-gone'), 0, description);
    }
  });

  it('allows only a fresh canonical frame to receive a replacement capability', () => {
    const canonicalUrl = 'app://gpt-voice/provider-settings.html?providerId=local-whisper';
    const frame = { url: canonicalUrl } as WebFrameMain;
    const sender = createSender(frame);
    const windows = {
      isTrustedLocalWhisperSettingsFrame: (candidate: WebContents, candidateFrame: WebFrameMain) =>
        candidate === sender.sender &&
        candidateFrame === sender.sender.mainFrame &&
        candidateFrame.url === canonicalUrl,
      isTrustedMainFrame: () => false,
    } as unknown as WindowManager;
    const authority = new ElectronLocalWhisperSenderAuthority(windows);
    const original = authority.authorizeSettings(event(sender.sender, frame));
    assert.ok(original);

    sender.emit('did-start-navigation');
    const replacement = { url: canonicalUrl } as WebFrameMain;
    sender.setMainFrame(replacement);
    assert.equal(original.isCurrent(), false);

    const fresh = authority.authorizeSettings(event(sender.sender, replacement));
    assert.ok(fresh);
    assert.equal(fresh.isCurrent(), true);
  });
});
