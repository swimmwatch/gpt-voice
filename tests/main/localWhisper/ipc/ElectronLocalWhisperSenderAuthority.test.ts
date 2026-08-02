import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IpcMainInvokeEvent, WebContents, WebFrameMain } from 'electron';

import { ElectronLocalWhisperSenderAuthority } from '@main/localWhisper/ipc/ElectronLocalWhisperSenderAuthority';
import type { WindowManager } from '@main/window';

interface SenderHarness {
  readonly sender: WebContents;
  readonly sent: { readonly channel: string; readonly value: unknown }[];
  readonly listeners: Map<string, () => void>;
  setMainFrame(frame: WebFrameMain): void;
}

function createSender(frame: WebFrameMain): SenderHarness {
  const listeners = new Map<string, () => void>();
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
      listeners.set(event, listener);
      return sender;
    },
    removeListener: (event: string) => {
      listeners.delete(event);
      return sender;
    },
  } as unknown as WebContents;
  return { sender, sent, listeners, setMainFrame: (next) => (mainFrame = next) };
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

  it('revokes reload/replacement capabilities and removes lifecycle listeners', () => {
    const frame = { url: 'app://gpt-voice/provider-settings.html?providerId=local-whisper' } as WebFrameMain;
    const sender = createSender(frame);
    const windows = {
      isTrustedLocalWhisperSettingsFrame: (candidate: WebContents, candidateFrame: WebFrameMain) =>
        candidate === sender.sender && candidateFrame === frame,
      isTrustedMainFrame: () => false,
    } as unknown as WindowManager;
    const authority = new ElectronLocalWhisperSenderAuthority(windows);
    const capability = authority.authorizeSettings(event(sender.sender, frame));
    assert.ok(capability);
    let invalidations = 0;
    const remove = capability.onInvalidated(() => {
      invalidations += 1;
    });
    assert.deepEqual(
      new Set(sender.listeners.keys()),
      new Set(['did-start-navigation', 'destroyed', 'render-process-gone']),
    );

    sender.listeners.get('did-start-navigation')?.();
    assert.equal(invalidations, 1);
    const replacement = { url: frame.url } as WebFrameMain;
    sender.setMainFrame(replacement);
    assert.equal(capability.isCurrent(), false);
    capability.send('private-channel', { path: '/must-not-send' });
    assert.equal(sender.sent.length, 0);

    remove();
    assert.equal(sender.listeners.size, 0);
  });
});
