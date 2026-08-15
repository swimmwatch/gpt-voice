import assert from 'node:assert/strict';
import { it } from 'node:test';

import { LocalWhisperProductionResidentWorkerLease } from '@main/localWhisper/composition/LocalWhisperProductionResidentWorkerLease';
import type { LocalWhisperWorkerLifecycleSession } from '@main/localWhisper/supervisor/LocalWhisperWorkerLifecycle';
import type { LocalWhisperSupervisorResult } from '@main/localWhisper/supervisor/LocalWhisperWorkerSupervisor';
import {
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  toLocalWhisperRevisionId,
  type LocalWhisperSettings,
} from '@shared/localWhisper';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolveDeferred = (_value: T): void => undefined;
  const promise = new Promise<T>((resolve) => {
    resolveDeferred = resolve;
  });
  return Object.freeze({ promise, resolve: resolveDeferred });
}

function success<T>(state: 'idle' | 'warmed', value: T): LocalWhisperSupervisorResult<T> {
  return Object.freeze({ success: true, state, value });
}

function revision(value: string) {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Test revision invalid');
  return parsed;
}

class CancellationSession implements LocalWhisperWorkerLifecycleSession {
  public cancelCalls = 0;
  public readonly cancellation = deferred<LocalWhisperSupervisorResult>();
  public readonly transcription = deferred<LocalWhisperSupervisorResult<string>>();

  public cancel(): Promise<LocalWhisperSupervisorResult> {
    this.cancelCalls += 1;
    return this.cancellation.promise;
  }

  public forceCleanup(): Promise<LocalWhisperSupervisorResult> {
    return Promise.resolve(success('idle', undefined));
  }

  public load(): Promise<LocalWhisperSupervisorResult> {
    return Promise.resolve(success('warmed', undefined));
  }

  public probe(): Promise<LocalWhisperSupervisorResult> {
    return Promise.resolve(success('warmed', undefined));
  }

  public shutdown(): Promise<LocalWhisperSupervisorResult> {
    return Promise.resolve(success('idle', undefined));
  }

  public startAndHandshake(): Promise<LocalWhisperSupervisorResult> {
    return Promise.resolve(success('warmed', undefined));
  }

  public transcribe(): Promise<LocalWhisperSupervisorResult<string>> {
    return this.transcription.promise;
  }

  public unload(): Promise<LocalWhisperSupervisorResult> {
    return Promise.resolve(success('idle', undefined));
  }

  public warmup(): Promise<LocalWhisperSupervisorResult> {
    return Promise.resolve(success('warmed', undefined));
  }
}

const SETTINGS: LocalWhisperSettings = Object.freeze({
  schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  engine: 'whisperCpp',
  runtimeRevision: revision('runtime-v1'),
  model: Object.freeze({ family: 'tiny', revision: revision('model-v1'), variant: 'full' }),
  language: 'en',
  initialPrompt: '',
  decoding: Object.freeze({ strategy: 'greedy', temperatureHundredths: 0 }),
  execution: Object.freeze({ target: 'cpu', backend: 'cpu', cpuThreads: 'auto' }),
});

it('coalesces signal abort and explicit cancel into one native cancellation request', async () => {
  const session = new CancellationSession();
  const lease = new LocalWhisperProductionResidentWorkerLease({
    configurationEpoch: 1,
    lifecycle: {
      forceCleanupFullLoad: () => Promise.resolve(success('idle', undefined)),
      shutdownFullLoad: () => Promise.resolve(success('idle', undefined)),
    },
    revalidateAuthority: () => Promise.resolve(true),
    session,
  });
  const controller = new AbortController();
  const transcription = lease.transcribe({
    audio: Uint8Array.of(1),
    requestId: 'qualification-cancel',
    settings: SETTINGS,
    settingsEpoch: 1,
    signal: controller.signal,
  });

  controller.abort();
  const explicitCancellation = lease.cancel();
  await Promise.resolve();
  assert.equal(session.cancelCalls, 1);

  session.cancellation.resolve(success('warmed', undefined));
  assert.deepEqual(await explicitCancellation, { success: true, value: undefined });
  session.transcription.resolve(success('warmed', 'discarded'));
  await transcription;
  assert.equal(session.cancelCalls, 1);
});
