import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IpcMainInvokeEvent, WebContents } from 'electron';

import {
  MainIpcController,
  MainIpcTransport,
  TrustedIpcRegistrar,
  type MainIpcControllerDependencies,
} from '@main/ipc';
import { TranslationSettingsValidationError } from '@main/translationSettings';
import {
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
  type TranslationProviderConnectionState,
  type TranslationSettings,
} from '@shared/translationProvider';
import { MainInteractionLock } from '@shared/mainInteractionLock';

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

interface MainIpcControllerTestHook {
  registerTranslationSettingsSaveIpc(): void;
}

const DEFAULT_SETTINGS: TranslationSettings = {
  providerId: 'google',
  targetLanguageByProvider: {
    google: 'uk',
    bing: 'ru',
    yandex: 'be',
  },
};

const READY_CONNECTION: TranslationProviderConnectionState = {
  detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
  providerId: 'bing',
  status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
  targetLanguage: 'ru',
};

class RecordingTransport implements MainIpcTransport {
  public readonly handlers = new Map<string, IpcHandler>();

  public handle(channel: string, listener: IpcHandler): void {
    this.handlers.set(channel, listener);
  }

  public removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }
}

class TranslationSettingsConfigDouble {
  public readonly savedSettings: TranslationSettings[] = [];
  public saveError: Error | null = null;

  public constructor(private settings: TranslationSettings = DEFAULT_SETTINGS) {}

  public getTranslationSettings(): TranslationSettings {
    return this.settings;
  }

  public getHotkeySettings() {
    return {
      cancelHotkey: null,
      hotkey: null,
      prettifyHotkey: null,
      prettifyQuickHotkey: null,
      retryTranscriptionHotkey: null,
      stopHotkey: null,
      translateHotkey: null,
    };
  }

  public saveTranslationSettings(candidate: unknown): TranslationSettings {
    if (this.saveError) throw this.saveError;
    const settings = candidate as TranslationSettings;
    this.settings = settings;
    this.savedSettings.push(settings);
    return settings;
  }
}

class DeferredTranslationRuntime {
  public initializeCalls = 0;
  public initializationFailureSettlements = 0;
  private readonly initializations: Array<ReturnType<typeof createDeferred<TranslationProviderConnectionState>>> = [];

  public initializeSelectedProvider(): Promise<TranslationProviderConnectionState> {
    this.initializeCalls += 1;
    const initialization = createDeferred<TranslationProviderConnectionState>();
    this.initializations.push(initialization);
    return initialization.promise;
  }

  public settleInitializationUnexpectedFailure(): TranslationProviderConnectionState {
    this.initializationFailureSettlements += 1;
    return {
      detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.UnexpectedFailure,
      providerId: null,
      status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.NotConnected,
      targetLanguage: null,
    };
  }

  public resolveInitialization(index: number, state = READY_CONNECTION): void {
    this.initializations[index]?.resolve(state);
  }

  public rejectInitialization(index: number): void {
    this.initializations[index]?.reject(new Error('provider initialization failed'));
  }
}

function createDeferred<Value>(): {
  readonly promise: Promise<Value>;
  readonly reject: (error: Error) => void;
  readonly resolve: (value: Value) => void;
} {
  let resolveDeferred: ((value: Value) => void) | null = null;
  let rejectDeferred: ((error: Error) => void) | null = null;
  const promise = new Promise<Value>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });
  return {
    promise,
    reject: (error) => rejectDeferred?.(error),
    resolve: (value) => resolveDeferred?.(value),
  };
}

function createEvent(): IpcMainInvokeEvent {
  return {
    sender: {
      getURL: () => 'app://gpt-voice/index.html',
    },
    senderFrame: { url: 'app://gpt-voice/index.html' },
  } as unknown as IpcMainInvokeEvent;
}

function createHarness() {
  const transport = new RecordingTransport();
  const config = new TranslationSettingsConfigDouble();
  const runtime = new DeferredTranslationRuntime();
  const logger = { error: () => undefined, info: () => undefined, warn: () => undefined };
  const trustedIpc = new TrustedIpcRegistrar(transport, logger, {
    isTrustedAppWindow: (_sender: WebContents, _url: string) => true,
  } as unknown as MainIpcControllerDependencies['windowManager']);
  const controller = new MainIpcController({
    config,
    hotkeyRegistrationService: {
      snapshot: { entries: [] },
    },
    localization: { translate: (key: string) => key },
    logger,
    mainInteractionLock: new MainInteractionLock(() => false),
    translationRuntime: runtime,
    trustedIpc,
  } as unknown as MainIpcControllerDependencies);
  (controller as unknown as MainIpcControllerTestHook).registerTranslationSettingsSaveIpc();
  const handler = transport.handlers.get('set-translate-settings');
  assert.ok(handler);
  return { config, handler, runtime };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Translation settings initialization IPC', () => {
  it('keeps a successful settings request pending until selected-provider initialization settles', async () => {
    const { config, handler, runtime } = createHarness();
    const candidate = { ...DEFAULT_SETTINGS, providerId: 'bing' as const };
    let settled = false;
    const result = Promise.resolve(handler(createEvent(), candidate)).then((value) => {
      settled = true;
      return value;
    });

    await flushMicrotasks();
    assert.deepEqual(config.savedSettings, [candidate]);
    assert.equal(runtime.initializeCalls, 1);
    assert.equal(settled, false);

    runtime.resolveInitialization(0);
    assert.deepEqual(await result, { success: true, settings: candidate });
  });

  it('serializes repeated settings requests so provider initialization cannot overlap', async () => {
    const { config, handler, runtime } = createHarness();
    const bing = { ...DEFAULT_SETTINGS, providerId: 'bing' as const };
    const yandex = { ...DEFAULT_SETTINGS, providerId: 'yandex' as const };
    const first = Promise.resolve(handler(createEvent(), bing));
    await flushMicrotasks();
    const second = Promise.resolve(handler(createEvent(), yandex));
    await flushMicrotasks();

    assert.deepEqual(config.savedSettings, [bing]);
    assert.equal(runtime.initializeCalls, 1);

    runtime.resolveInitialization(0);
    await first;
    await flushMicrotasks();
    assert.deepEqual(config.savedSettings, [bing, yandex]);
    assert.equal(runtime.initializeCalls, 2);

    runtime.resolveInitialization(1);
    assert.deepEqual(await second, { success: true, settings: yandex });
  });

  it('retains persisted settings and publishes a safe terminal state when initialization throws', async () => {
    const { config, handler, runtime } = createHarness();
    const candidate = { ...DEFAULT_SETTINGS, providerId: 'bing' as const };
    const result = Promise.resolve(handler(createEvent(), candidate));
    await flushMicrotasks();
    runtime.rejectInitialization(0);

    assert.deepEqual(await result, { success: true, settings: candidate });
    assert.deepEqual(config.getTranslationSettings(), candidate);
    assert.equal(runtime.initializationFailureSettlements, 1);
  });

  it('does not initialize a provider after validation or persistence rejects the candidate', async () => {
    const { config, handler, runtime } = createHarness();
    config.saveError = new TranslationSettingsValidationError();

    const result = await Promise.resolve(handler(createEvent(), DEFAULT_SETTINGS));

    assert.deepEqual(result, {
      error: 'error.translationSettingsInvalid',
      settings: DEFAULT_SETTINGS,
      success: false,
    });
    assert.equal(runtime.initializeCalls, 0);
  });
});
