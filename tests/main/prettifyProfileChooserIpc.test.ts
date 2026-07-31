/* eslint-disable max-classes-per-file -- the IPC transport and chooser controller fakes own separate state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { TrustedIpcRegistrar, type MainIpcLogger, type MainIpcTransport } from '@main/ipc';
import {
  PRETTIFY_PROFILE_CHOOSER_IPC_REJECTION_ERROR,
  PrettifyProfileChooserIpcRegistrar,
} from '@main/prettifyProfileChooserIpcRegistrar';
import type { WindowManager } from '@main/window';
import {
  PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS,
  type PrettifyProfileChooserOperationToken,
  type PrettifyProfileChooserPayload,
} from '@shared/prettifyProfileChooser';

const CHOOSER_URL = 'app://gpt-voice/prettify-profile-chooser.html';
const TOKEN = '00000000-0000-4000-8000-000000000009' as PrettifyProfileChooserOperationToken;

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

class RecordingMainIpcTransport implements MainIpcTransport {
  public readonly handlers = new Map<string, IpcHandler>();
  public readonly removed: string[] = [];

  public handle(channel: string, listener: IpcHandler): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.removed.push(channel);
    this.handlers.delete(channel);
  }

  public invoke(channel: string, event: IpcMainInvokeEvent, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) return Promise.reject(new Error('missing handler'));
    try {
      return Promise.resolve(handler(event, ...args));
    } catch (error: unknown) {
      return Promise.reject(error instanceof Error ? error : new Error('IPC handler failed'));
    }
  }
}

class RecordingChooserController {
  public active = true;
  public applyCount = 0;
  public cancelCount = 0;
  public manageCount = 0;
  public payloadLoaded = false;
  public readyCount = 0;
  public readonly payload: PrettifyProfileChooserPayload = Object.freeze({
    profiles: Object.freeze([
      Object.freeze({ id: 'prompt-ready', isDefault: true, kind: 'built-in', name: 'Prompt-ready' }),
    ]),
    sourceText: 'private-source-canary',
    token: TOKEN,
  });

  public apply(token: unknown, profileId: unknown): boolean {
    if (!this.active || token !== TOKEN || profileId !== 'prompt-ready') return false;
    this.applyCount += 1;
    this.active = false;
    return true;
  }

  public cancelWithToken(token: unknown): boolean {
    if (!this.active || token !== TOKEN) return false;
    this.cancelCount += 1;
    this.active = false;
    return true;
  }

  public isTrustedSender(sender: WebContents, senderFrameUrl: string | undefined): boolean {
    return this.active && !sender.isDestroyed() && sender.id === 42 && senderFrameUrl === CHOOSER_URL;
  }

  public loadPayload(): PrettifyProfileChooserPayload | null {
    if (!this.active || this.payloadLoaded) return null;
    this.payloadLoaded = true;
    return this.payload;
  }

  public manageProfiles(token: unknown): boolean {
    if (!this.active || token !== TOKEN) return false;
    this.manageCount += 1;
    this.active = false;
    return true;
  }

  public rendererReady(token: unknown): boolean {
    if (!this.active || !this.payloadLoaded || this.readyCount > 0 || token !== TOKEN) return false;
    this.readyCount += 1;
    return true;
  }
}

function createSender(id = 42, url = CHOOSER_URL, destroyed = false): WebContents {
  return {
    getURL: () => url,
    id,
    isDestroyed: () => destroyed,
  } as WebContents;
}

function createEvent(sender = createSender(), frameUrl: string | null = CHOOSER_URL): IpcMainInvokeEvent {
  return {
    sender,
    ...(frameUrl === null ? {} : { senderFrame: { url: frameUrl } }),
  } as IpcMainInvokeEvent;
}

function createRegistrar() {
  const controller = new RecordingChooserController();
  const transport = new RecordingMainIpcTransport();
  const warnings: string[] = [];
  const registrar = new PrettifyProfileChooserIpcRegistrar({
    controller,
    ipc: transport,
    localization: {
      getCurrentCatalog: () => ({ chooser: 'Choose' }) as never,
      getLocale: () => 'en',
    },
    logger: { warn: (message) => warnings.push(String(message)) },
  });
  registrar.register();
  return { controller, registrar, transport, warnings };
}

async function assertRejected(promise: Promise<unknown>): Promise<void> {
  await assert.rejects(promise, /Rejected Prettify profile chooser IPC request/u);
}

describe('PrettifyProfileChooserIpcRegistrar', () => {
  it('registers only exact chooser channels and accepts the exact live sender', async () => {
    const { controller, registrar, transport } = createRegistrar();
    assert.deepEqual(
      [...transport.handlers.keys()].sort(),
      Object.values(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS)
        .filter((channel) => channel !== PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.localeChanged)
        .sort(),
    );

    const event = createEvent();
    assert.equal(await transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getLocale, event), 'en');
    assert.deepEqual(await transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getTranslations, event), {
      chooser: 'Choose',
    });
    const payload = await transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.load, event);
    assert.equal(payload, controller.payload);
    assert.equal(await transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.ready, event, TOKEN), undefined);
    assert.equal(
      await transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.apply, event, TOKEN, 'prompt-ready'),
      undefined,
    );
    assert.equal(controller.applyCount, 1);

    registrar.dispose();
    registrar.dispose();
    assert.deepEqual(
      transport.removed.sort(),
      Object.values(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS)
        .filter((channel) => channel !== PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.localeChanged)
        .sort(),
    );
  });

  it('rejects wrong, stale, destroyed, wrong-URL, and missing-frame senders without invoking actions', async () => {
    const { controller, transport, warnings } = createRegistrar();
    const invalidEvents = [
      createEvent(createSender(7)),
      createEvent(createSender(42, CHOOSER_URL, true)),
      createEvent(createSender(), 'app://gpt-voice/settings.html'),
      createEvent(createSender(), null),
    ];

    for (const event of invalidEvents) {
      await assertRejected(transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.apply, event, TOKEN, 'prompt-ready'));
    }

    assert.equal(controller.applyCount, 0);
    assert.equal(controller.active, true);
    assert.equal(
      warnings.every((warning) => warning === PRETTIFY_PROFILE_CHOOSER_IPC_REJECTION_ERROR),
      true,
    );
  });

  it('rejects malformed arguments, tokens, duplicate actions, and unknown profiles without closing a valid operation', async () => {
    const { controller, transport } = createRegistrar();
    const event = createEvent();

    await assertRejected(transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.load, event, 'extra'));
    await assertRejected(transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.ready, event, TOKEN));
    assert.equal(controller.active, true);
    assert.equal(controller.payloadLoaded, false);

    await transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.load, event);
    await assertRejected(
      transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.apply, event, 'wrong-token', 'prompt-ready'),
    );
    await assertRejected(transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.apply, event, TOKEN, 'natural'));
    assert.equal(controller.active, true);
    assert.equal(controller.applyCount, 0);

    await transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.cancel, event, TOKEN);
    await assertRejected(transport.invoke(PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.cancel, event, TOKEN));
    assert.equal(controller.cancelCount, 1);
  });

  it('keeps chooser and generic, Settings-only, and streaming trust mutually isolated', async () => {
    const { transport } = createRegistrar();
    const chooserEvent = createEvent();
    const logger: MainIpcLogger = {
      error: () => undefined,
      info: () => undefined,
      warn: () => undefined,
    };
    const genericTrust = {
      getTrustedSettingsWindow: () => null,
      isTrustedAppWindow: () => false,
    } as unknown as WindowManager;
    const genericRegistrar = new TrustedIpcRegistrar(transport, logger, genericTrust);
    genericRegistrar.handle('generic-channel', () => undefined);
    genericRegistrar.handleSettingsWindow('settings-channel', () => undefined);
    genericRegistrar.handleStreaming('streaming-channel', async () => ({}) as never);

    await assert.rejects(transport.invoke('generic-channel', chooserEvent), /Rejected IPC from untrusted sender/u);
    await assert.rejects(transport.invoke('settings-channel', chooserEvent), /Rejected IPC from untrusted sender/u);
    await assert.rejects(transport.invoke('streaming-channel', chooserEvent), /Rejected IPC from untrusted sender/u);

    await assertRejected(
      transport.invoke(
        PRETTIFY_PROFILE_CHOOSER_IPC_CHANNELS.getLocale,
        createEvent(createSender(1, 'app://gpt-voice/index.html'), 'app://gpt-voice/index.html'),
      ),
    );
  });
});
