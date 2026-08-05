import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MainProcessRuntimeGraph } from '@main/di/mainProcessRuntimeGraph';
import { VoiceProviderSelectionService } from '@main/localWhisper/ipc/VoiceProviderSelectionService';
import { READY_LOCAL_WHISPER_SNAPSHOT } from '../../providers/localWhisperTestUtils';
import type { LocalWhisperCoordinator } from '@main/localWhisper/coordinator/LocalWhisperCoordinator';
import type { LocalWhisperIpcController } from '@main/localWhisper/ipc/LocalWhisperIpcController';
import type { LocalWhisperSnapshotService } from '@main/localWhisper/ipc/LocalWhisperSnapshotService';

class SelectionConfig {
  public saveCalls = 0;
  public failNextSave = false;

  public constructor(public provider: string | null = 'chatgpt') {}

  public getSnapshot() {
    return { provider: this.provider };
  }

  public setProvider(providerId: string | null): void {
    this.provider = providerId;
  }

  public save(): void {
    this.saveCalls += 1;
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('synthetic persistence failure');
    }
  }
}

function localWhisperReadiness(snapshot = READY_LOCAL_WHISPER_SNAPSHOT) {
  return {
    getReadinessSnapshot: () => Object.freeze({ snapshot, failure: null }),
  };
}

describe('VoiceProviderSelectionService', () => {
  it('commits only after runtime and persistence succeed', async () => {
    const config = new SelectionConfig();
    const switched: string[] = [];
    const service = new VoiceProviderSelectionService({
      config,
      registry: { isKnownProviderId: (value): value is string => value === 'chatgpt' || value === 'local-whisper' },
      runtime: {
        clearProvider: async () => {
          config.setProvider(null);
          return {};
        },
        switchProvider: async (providerId) => {
          switched.push(providerId);
          config.setProvider(providerId);
          return {};
        },
      },
      localWhisper: localWhisperReadiness(),
      getReadinessRevision: () => 7,
    });

    const result = await service.select('local-whisper');
    assert.deepEqual(result, { success: true, committedProviderId: 'local-whisper', readinessRevision: 7 });
    assert.equal(service.getCommittedProviderId(), 'local-whisper');
    assert.deepEqual(switched, ['local-whisper']);
    assert.equal(config.saveCalls, 1);
  });

  it('restores the prior committed provider after runtime or persistence failure', async () => {
    const config = new SelectionConfig();
    const switched: string[] = [];
    let returnRuntimeError = true;
    const service = new VoiceProviderSelectionService({
      config,
      registry: { isKnownProviderId: (value): value is string => value === 'chatgpt' || value === 'local-whisper' },
      runtime: {
        clearProvider: async () => {
          config.setProvider(null);
          return {};
        },
        switchProvider: async (providerId) => {
          switched.push(providerId);
          config.setProvider(providerId);
          if (providerId === 'local-whisper' && returnRuntimeError) return { error: 'private native detail' };
          return {};
        },
      },
      localWhisper: localWhisperReadiness(),
      getReadinessRevision: () => 8,
    });

    const runtimeFailure = await service.select('local-whisper');
    assert.equal(runtimeFailure.success, false);
    assert.equal(runtimeFailure.committedProviderId, 'chatgpt');
    assert.equal(JSON.stringify(runtimeFailure).includes('private native detail'), false);
    assert.equal(config.provider, 'chatgpt');

    returnRuntimeError = false;
    config.failNextSave = true;
    const persistenceFailure = await service.select('local-whisper');
    assert.equal(persistenceFailure.success, false);
    assert.equal(persistenceFailure.committedProviderId, 'chatgpt');
    assert.equal(service.getCommittedProviderId(), 'chatgpt');
    assert.equal(config.provider, 'chatgpt');
    assert.deepEqual(switched, ['local-whisper', 'chatgpt', 'local-whisper', 'chatgpt']);
  });

  it('rolls a failed initial selection back to the intentional no-provider state', async () => {
    const config = new SelectionConfig(null);
    const transitions: string[] = [];
    const service = new VoiceProviderSelectionService({
      config,
      registry: { isKnownProviderId: (value): value is string => value === 'chatgpt' || value === 'local-whisper' },
      runtime: {
        clearProvider: async () => {
          transitions.push('clear');
          config.setProvider(null);
          return {};
        },
        switchProvider: async (providerId) => {
          transitions.push(`switch:${providerId}`);
          config.setProvider(providerId);
          return { error: 'private runtime failure' };
        },
      },
      localWhisper: localWhisperReadiness(),
      getReadinessRevision: () => 9,
    });

    const result = await service.select('chatgpt');

    assert.equal(result.success, false);
    assert.equal(result.committedProviderId, null);
    assert.equal(service.getCommittedProviderId(), null);
    assert.equal(config.provider, null);
    assert.deepEqual(transitions, ['switch:chatgpt', 'clear']);
  });

  it('rejects concurrent and unknown selections without changing committed authority', async () => {
    const config = new SelectionConfig();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const service = new VoiceProviderSelectionService({
      config,
      registry: { isKnownProviderId: (value): value is string => value === 'chatgpt' || value === 'local-whisper' },
      runtime: {
        clearProvider: async () => {
          config.setProvider(null);
          return {};
        },
        switchProvider: async (providerId) => {
          config.setProvider(providerId);
          await blocked;
          return {};
        },
      },
      localWhisper: localWhisperReadiness(),
      getReadinessRevision: () => 9,
    });

    const first = service.select('local-whisper');
    const concurrent = await service.select('chatgpt');
    const unknown = await service.select('forged');
    assert.equal(concurrent.success, false);
    assert.equal(concurrent.committedProviderId, 'chatgpt');
    assert.equal(unknown.success, false);
    assert.equal(service.getCommittedProviderId(), 'chatgpt');
    release();
    await first;
  });

  it('rejects an unready Local Whisper selection before it changes runtime or configuration', async () => {
    const config = new SelectionConfig();
    const switched: string[] = [];
    const service = new VoiceProviderSelectionService({
      config,
      registry: { isKnownProviderId: (value): value is string => value === 'chatgpt' || value === 'local-whisper' },
      runtime: {
        clearProvider: async () => {
          config.setProvider(null);
          return {};
        },
        switchProvider: async (providerId) => {
          switched.push(providerId);
          config.setProvider(providerId);
          return {};
        },
      },
      localWhisper: localWhisperReadiness(
        Object.freeze({
          ...READY_LOCAL_WHISPER_SNAPSHOT,
          residency: 'Unloaded',
          operationalStatus: 'ValidatedUnloaded',
        }),
      ),
      getReadinessRevision: () => 10,
    });

    const result = await service.select('local-whisper');

    assert.equal(result.success, false);
    assert.equal(result.committedProviderId, 'chatgpt');
    if (!result.success) assert.equal(result.error.code, 'OPERATION_CONFLICT');
    assert.equal(config.provider, 'chatgpt');
    assert.equal(config.saveCalls, 0);
    assert.deepEqual(switched, []);
  });
});

describe('MainProcessRuntimeGraph Local Whisper lifecycle', () => {
  it('registers its IPC once and owns exactly-once coordinator shutdown', async () => {
    const calls = {
      mainRegister: 0,
      mainDispose: 0,
      localRegister: 0,
      localDispose: 0,
      shutdown: 0,
      snapshots: 0,
      environmentDispose: 0,
    };
    const graph = new MainProcessRuntimeGraph({
      database: { close: () => undefined } as never,
      diagnosticStorage: {
        pruneOnStartup: () => Promise.resolve(),
        shutdown: () => Promise.resolve({ status: 'success', affectedRows: 0 }),
      } as never,
      diagnosticsArchive: { shutdown: () => Promise.resolve() } as never,
      ipcController: {
        register: () => {
          calls.mainRegister += 1;
        },
        dispose: () => {
          calls.mainDispose += 1;
          return Promise.resolve();
        },
      } as never,
      localWhisperIpcController: {
        register: () => {
          calls.localRegister += 1;
        },
        dispose: () => {
          calls.localDispose += 1;
        },
      } as unknown as LocalWhisperIpcController,
      localWhisperCoordinator: {
        shutdown: () => {
          calls.shutdown += 1;
          return Promise.resolve({ success: true });
        },
      } as unknown as LocalWhisperCoordinator,
      localWhisperEnvironmentDispose: () => {
        calls.environmentDispose += 1;
        return Promise.resolve();
      },
      localWhisperSnapshots: {
        dispose: () => {
          calls.snapshots += 1;
        },
      } as unknown as LocalWhisperSnapshotService,
    });

    graph.registerIpc();
    await graph.disposeIpc();
    await Promise.all([graph.shutdownLocalWhisper(), graph.shutdownLocalWhisper()]);
    assert.deepEqual(calls, {
      mainRegister: 1,
      mainDispose: 1,
      localRegister: 1,
      localDispose: 1,
      shutdown: 1,
      snapshots: 1,
      environmentDispose: 1,
    });
  });
});
