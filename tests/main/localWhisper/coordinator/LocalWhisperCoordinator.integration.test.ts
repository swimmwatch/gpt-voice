import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LocalWhisperCapabilityService } from '@main/localWhisper/capability/LocalWhisperCapabilityService';
import { LocalWhisperCoordinator } from '@main/localWhisper/coordinator/LocalWhisperCoordinator';
import type {
  LocalWhisperCoordinatorDependencies,
  LocalWhisperResidentWorkerLease,
} from '@main/localWhisper/coordinator/LocalWhisperCoordinatorTypes';
import {
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  toLocalWhisperRevisionId,
  type LocalWhisperMemoryConfigurationIdentity,
  type LocalWhisperMemoryEstimateRecord,
  type LocalWhisperSettings,
} from '@shared/localWhisper';

function revision(value: string) {
  const result = toLocalWhisperRevisionId(value);
  if (!result) throw new Error('Invalid fixture revision');
  return result;
}

const RUNTIME_REVISION = revision('runtime-cpu-v1');
const MODEL_REVISION = revision('model-base-v1');

const SETTINGS: LocalWhisperSettings = Object.freeze({
  schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  engine: 'whisperCpp',
  runtimeRevision: RUNTIME_REVISION,
  model: Object.freeze({ family: 'base', revision: MODEL_REVISION, variant: 'full' }),
  language: 'auto',
  initialPrompt: '',
  decoding: Object.freeze({ strategy: 'greedy', temperatureHundredths: 0 }),
  execution: Object.freeze({ target: 'cpu', backend: 'cpu', cpuThreads: 4 }),
});

const CONFIGURATION: LocalWhisperMemoryConfigurationIdentity = Object.freeze({
  target: 'cpu',
  backend: 'cpu',
  runtimePackRevision: RUNTIME_REVISION,
  model: Object.freeze({
    engine: 'whisperCpp',
    logicalModel: SETTINGS.model.family,
    sourceCheckpointRevision: revision('checkpoint-v1'),
    artifactRevision: MODEL_REVISION,
    nativeFormat: 'ggml',
    variant: SETTINGS.model.variant,
  }),
});

const ESTIMATE: LocalWhisperMemoryEstimateRecord = Object.freeze({
  ...CONFIGURATION,
  estimatedPeakRamBytes: 1024 ** 3,
  estimatedPeakVramBytes: 'notApplicable',
  evidenceBasis: 'derived',
  sourceBuildRevision: revision('estimate-v1'),
  methodologyLabel: 'Deterministic Linux coordinator fixture',
});

describe('LocalWhisperCoordinator deterministic Linux integration', () => {
  it('composes real capability policy with disposable probe, fresh load, transcription, and unload', async () => {
    const capabilityService = new LocalWhisperCapabilityService();
    let requestSequence = 0;
    let probeCount = 0;
    let loadCount = 0;
    let unloadCount = 0;
    const resident: LocalWhisperResidentWorkerLease = {
      transcribe: () => Promise.resolve({ success: true, value: 'deterministic integration text' }),
      cancel: () => Promise.resolve({ success: true, value: undefined }),
      revalidate: () => Promise.resolve(true),
      unload: () => {
        unloadCount += 1;
        return Promise.resolve({ success: true, value: undefined });
      },
      terminate: () => Promise.resolve(true),
      shutdown: () => Promise.resolve(true),
    };
    const dependencies: LocalWhisperCoordinatorDependencies = {
      settings: {
        validateInitial: (candidate) => (candidate === SETTINGS ? SETTINGS : null),
        validate: (candidate) => (candidate === SETTINGS ? SETTINGS : null),
        defaultSettings: () => SETTINGS,
        save: () => Promise.resolve(),
        reset: () => Promise.resolve(),
      },
      capability: {
        preflight: ({ settings }) =>
          Promise.resolve(
            capabilityService.preflight({
              settings,
              platform: 'linux',
              architecture: 'x64',
              runtimeSetup: 'Installed',
              modelSetup: 'Installed',
              device: null,
              hipApproved: false,
              backendProbe: {
                backend: 'cpu',
                logicalProcessorCount: 8,
                resolvedThreads: 4,
                isaSupported: true,
              },
              configuration: CONFIGURATION,
              estimate: ESTIMATE,
              qualifiedPeak: null,
              availability: { freeRamBytes: 4 * 1024 ** 3, freeVramBytes: null },
              capabilityFingerprint: 'b'.repeat(64),
            }),
          ),
      },
      workers: {
        probeFresh: () => {
          probeCount += 1;
          return Promise.resolve({ success: true, value: undefined });
        },
        loadFresh: () => {
          loadCount += 1;
          return Promise.resolve({ success: true, value: resident });
        },
      },
      artifacts: { removeSelected: () => Promise.resolve({ success: false, code: 'DELETE_FAILED' }) },
      cache: {
        context: (_settings, epochs) => Object.freeze(['local-whisper', String(epochs.configuration)]),
      },
      nextRequestId: () => `integration-${++requestSequence}`,
      initial: {
        settings: SETTINGS,
        configured: true,
        inventoryEpoch: 1,
        runtimeSetup: 'Installed',
        modelSetup: 'Installed',
      },
    };
    const coordinator = new LocalWhisperCoordinator(dependencies);

    assert.equal((await coordinator.checkCompatibility()).success, true);
    assert.equal(probeCount, 1);
    assert.equal(loadCount, 0);
    assert.equal(coordinator.snapshot.runtime.capability, 'EstimateOnly');
    assert.equal(coordinator.snapshot.resources?.evidence, 'catalog');

    assert.equal((await coordinator.loadNow()).success, true);
    assert.equal(loadCount, 1);
    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'Ready');
    const transcription = await coordinator.transcribe({
      dispatch: coordinator.captureDispatchSnapshot(),
      buffer: Uint8Array.from([1, 2, 3, 4]).buffer,
      mimeType: 'audio/wav',
    });
    assert.equal(transcription.success ? transcription.value : null, 'deterministic integration text');
    assert.equal((await coordinator.unload()).success, true);
    assert.equal(unloadCount, 1);
    assert.equal(coordinator.snapshot.runtime.operationalStatus, 'ValidatedUnloaded');
  });
});
