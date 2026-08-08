import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LocalWhisperSettingsRepository,
  type LocalWhisperPrivateJsonReadResult,
  type LocalWhisperPrivateJsonStore,
} from '@main/localWhisper/settings/LocalWhisperSettingsRepository';
import {
  LOCAL_WHISPER_ENGINES,
  LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  isLocalWhisperEngine,
  isLocalWhisperModelIdentity,
  isLocalWhisperWorkerClientMessage,
  isLocalWhisperWorkerServerMessage,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  validateLocalWhisperSettings,
  type LocalWhisperSettingsValidationContext,
} from '@shared/localWhisper';

const RUNTIME_REVISION = toLocalWhisperRevisionId('whisper-cpp-cpu-pack-v1')!;
const MODEL_REVISION = toLocalWhisperRevisionId('base-ggml-v1')!;
const SOURCE_REVISION = toLocalWhisperRevisionId('openai-whisper-base-v1')!;
const DEVICE_ID = toLocalWhisperOpaqueDeviceId('gpu:nvidia:0')!;

const VALID_MODEL = Object.freeze({
  engine: 'whisperCpp',
  logicalModel: 'base',
  sourceCheckpointRevision: SOURCE_REVISION,
  artifactRevision: MODEL_REVISION,
  nativeFormat: 'ggml',
  variant: 'full',
} as const);

const VALID_SETTINGS = Object.freeze({
  schemaVersion: 1,
  engine: 'whisperCpp',
  runtimeRevision: RUNTIME_REVISION,
  model: Object.freeze({ family: 'base', revision: MODEL_REVISION, variant: 'full' }),
  language: 'auto',
  initialPrompt: '',
  decoding: Object.freeze({ strategy: 'greedy', temperatureHundredths: 0 }),
  execution: Object.freeze({ target: 'cpu', backend: 'cpu', cpuThreads: 'auto' }),
} as const);

const VALID_RESIDENCY = Object.freeze({
  engine: 'whisperCpp',
  runtimePackRevision: RUNTIME_REVISION,
  target: 'gpu',
  backend: 'cuda',
  deviceId: DEVICE_ID,
  model: VALID_MODEL,
  resolvedCpuThreads: null,
} as const);

function context(): LocalWhisperSettingsValidationContext {
  return {
    platform: 'linux',
    architecture: 'x64',
    logicalProcessorCount: 8,
    knownDevices: [],
    eligibleGpuCombinations: [],
    knownRuntimeSelections: [
      {
        engine: 'whisperCpp',
        target: 'cpu',
        backend: 'cpu',
        revision: RUNTIME_REVISION,
        recommended: true,
      },
    ],
    knownModelSelections: [
      {
        engine: 'whisperCpp',
        family: 'base',
        revision: MODEL_REVISION,
        variant: 'full',
        recommended: true,
      },
    ],
  };
}

class MemorySettingsStore implements LocalWhisperPrivateJsonStore {
  public constructor(private value: unknown) {}

  public read(): LocalWhisperPrivateJsonReadResult {
    return { status: 'ok', value: this.value };
  }

  public remove(): boolean {
    return false;
  }

  public write(value: unknown): void {
    this.value = value;
  }
}

describe('Local Whisper single-engine contract', () => {
  it('accepts only the fixed Whisper.cpp engine and ggml native model format', () => {
    assert.deepEqual([...LOCAL_WHISPER_ENGINES], ['whisperCpp']);
    assert.equal(isLocalWhisperEngine('whisperCpp'), true);
    assert.equal(isLocalWhisperEngine('fasterWhisper'), false);
    assert.equal(isLocalWhisperModelIdentity(VALID_MODEL), true);
    assert.equal(isLocalWhisperModelIdentity({ ...VALID_MODEL, nativeFormat: 'ctranslate2' }), false);
  });

  it('rejects removed engine and precision fields at settings and worker boundaries', () => {
    assert.equal(
      validateLocalWhisperSettings({ ...VALID_SETTINGS, engine: 'fasterWhisper' }, context()).success,
      false,
    );
    assert.equal(
      validateLocalWhisperSettings(
        { ...VALID_SETTINGS, execution: { ...VALID_SETTINGS.execution, precision: 'float16' } },
        context(),
      ).success,
      false,
    );
    assert.equal(
      isLocalWhisperWorkerServerMessage({
        type: 'helloAck',
        protocolVersion: 1,
        engine: 'fasterWhisper',
        runtimeRevision: RUNTIME_REVISION,
        runtimeBuildDigest: 'a'.repeat(64),
        backend: 'cuda',
        capabilities: ['cuda-sm-86'],
        maxControlFrameBytes: LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
        maxAudioChunkBytes: LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
      }),
      false,
    );
    assert.equal(
      isLocalWhisperWorkerClientMessage({
        type: 'load',
        protocolVersion: 1,
        requestId: 'load-1',
        authorityId: 'AAECAwQFBgcICQoLDA0ODw',
        deviceBinding: { kind: 'gpuIndex', index: 0 },
        loadChallenge: 'QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8',
        registryFingerprint: 'a'.repeat(64),
        residency: { ...VALID_RESIDENCY, precision: 'float16' },
      }),
      false,
    );
  });

  it('rejects persisted alternate-engine settings and dependent-selection keys', () => {
    for (const document of [
      {
        namespace: 'local-whisper',
        schemaVersion: 1,
        settings: { ...VALID_SETTINGS, engine: 'fasterWhisper' },
        dependentSelections: { values: {} },
      },
      {
        namespace: 'local-whisper',
        schemaVersion: 1,
        settings: VALID_SETTINGS,
        dependentSelections: { values: { 'runtime:fasterWhisper:cpu:cpu': RUNTIME_REVISION } },
      },
    ]) {
      const repository = new LocalWhisperSettingsRepository(new MemorySettingsStore(document));
      assert.deepEqual(repository.load(context()), { status: 'invalid', code: 'INVALID_SETTINGS' });
    }
  });
});
