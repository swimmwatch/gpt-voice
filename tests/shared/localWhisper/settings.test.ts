import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createNeverConfiguredLocalWhisperSettings,
  EMPTY_LOCAL_WHISPER_DEPENDENT_SELECTION_MEMORY,
  getLocalWhisperDeviceSelectionKey,
  getLocalWhisperModelRevisionSelectionKey,
  getLocalWhisperPromptValidationError,
  getLocalWhisperRuntimeSelectionKey,
  initializeLocalWhisperDependentSelection,
  isValidLocalWhisperPublicSettings,
  LocalWhisperCacheContext,
  LOCAL_WHISPER_MODEL_FAMILIES,
  readLocalWhisperDependentSelection,
  rememberLocalWhisperDependentSelection,
  rememberLocalWhisperSettingsSelections,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  validateLocalWhisperSettings,
  type LocalWhisperDeviceDescriptor,
  type LocalWhisperKnownRuntimeSelection,
  type LocalWhisperOpaqueDeviceId,
  type LocalWhisperRevisionId,
  type LocalWhisperSettings,
  type LocalWhisperSettingsValidationContext,
} from '@shared/localWhisper';

function revision(value: string): LocalWhisperRevisionId {
  const result = toLocalWhisperRevisionId(value);
  assert.ok(result);
  return result;
}

function deviceId(value: string): LocalWhisperOpaqueDeviceId {
  const result = toLocalWhisperOpaqueDeviceId(value);
  assert.ok(result);
  return result;
}

const NVIDIA_DEVICE_ID = deviceId('gpu:nvidia:0');
const AMD_DEVICE_ID = deviceId('gpu:amd:0');

const DEVICES: readonly LocalWhisperDeviceDescriptor[] = Object.freeze([
  Object.freeze({
    id: NVIDIA_DEVICE_ID,
    label: 'NVIDIA GPU 0',
    vendor: 'nvidia',
    available: true,
    eligibleBackends: Object.freeze(['cuda'] as const),
  }),
  Object.freeze({
    id: AMD_DEVICE_ID,
    label: 'AMD GPU 0',
    vendor: 'amd',
    available: false,
    eligibleBackends: Object.freeze(['hip', 'vulkan'] as const),
  }),
]);

function createContext(
  eligibleGpuCombinations: LocalWhisperSettingsValidationContext['eligibleGpuCombinations'] = [
    { engine: 'whisperCpp', backend: 'cuda', deviceId: NVIDIA_DEVICE_ID },
  ],
): LocalWhisperSettingsValidationContext {
  const knownModelSelections = LOCAL_WHISPER_MODEL_FAMILIES.map((family) => ({
    engine: 'whisperCpp' as const,
    family,
    revision: revision(`whisper-cpp-${family}-v1`),
    variant: 'full' as const,
    recommended: true,
  }));
  const knownRuntimeSelections: readonly LocalWhisperKnownRuntimeSelection[] = Object.freeze([
    {
      engine: 'whisperCpp',
      target: 'gpu',
      backend: 'cuda',
      revision: revision('whisper-cpp-cuda-v1'),
      recommended: true,
    },
    {
      engine: 'whisperCpp',
      target: 'gpu',
      backend: 'hip',
      revision: revision('whisper-cpp-hip-v1'),
      recommended: true,
    },
    {
      engine: 'whisperCpp',
      target: 'gpu',
      backend: 'vulkan',
      revision: revision('whisper-cpp-vulkan-v1'),
      recommended: true,
    },
    {
      engine: 'whisperCpp',
      target: 'cpu',
      backend: 'cpu',
      revision: revision('whisper-cpp-cpu-v1'),
      recommended: true,
    },
  ]);
  return Object.freeze({
    platform: 'linux',
    architecture: 'x64',
    logicalProcessorCount: 16,
    knownDevices: DEVICES,
    knownRuntimeSelections,
    knownModelSelections: Object.freeze(knownModelSelections),
    eligibleGpuCombinations: Object.freeze([...eligibleGpuCombinations]),
  });
}

function defaultSettings(context = createContext()): LocalWhisperSettings {
  const result = createNeverConfiguredLocalWhisperSettings(context);
  assert.equal(result.success, true);
  if (!result.success) throw new Error('Expected valid defaults');
  return result.settings;
}

function expectInvalid(candidate: unknown, context = createContext()): void {
  const result = validateLocalWhisperSettings(candidate, context);
  assert.equal(result.success, false);
  if (result.success) throw new Error('Expected invalid Local Whisper settings');
  assert.equal(result.code, 'INVALID_SETTINGS');
  assert.ok(result.issues.length > 0);
}

describe('Local Whisper settings contracts', () => {
  it('creates deterministic never-configured defaults without probing or fallback', () => {
    const settings = defaultSettings();
    assert.deepEqual(settings, {
      schemaVersion: 1,
      engine: 'whisperCpp',
      runtimeRevision: 'whisper-cpp-cuda-v1',
      model: {
        family: 'base',
        revision: 'whisper-cpp-base-v1',
        variant: 'full',
      },
      language: 'auto',
      initialPrompt: '',
      decoding: { strategy: 'greedy', temperatureHundredths: 0 },
      execution: { target: 'gpu', backend: 'cuda', deviceId: NVIDIA_DEVICE_ID },
    });
    assert.equal(Object.isFrozen(settings), true);
    assert.equal(Object.isFrozen(settings.execution), true);
  });

  it('selects the recommended CPU runtime for zero or multiple eligible GPU combinations', () => {
    for (const combinations of [
      [],
      [
        { engine: 'whisperCpp' as const, backend: 'cuda' as const, deviceId: NVIDIA_DEVICE_ID },
        { engine: 'whisperCpp' as const, backend: 'vulkan' as const, deviceId: AMD_DEVICE_ID },
      ],
    ]) {
      const settings = defaultSettings(createContext(combinations));
      assert.deepEqual(settings.execution, { target: 'cpu', backend: 'cpu', cpuThreads: 'auto' });
      assert.equal(settings.runtimeRevision, 'whisper-cpp-cpu-v1');
    }
  });

  it('round-trips every canonical value and omits inactive decoding and target controls', () => {
    const settings = defaultSettings();
    const roundTrip = validateLocalWhisperSettings(JSON.parse(JSON.stringify(settings)) as unknown, createContext());
    assert.deepEqual(roundTrip, { success: true, settings });
    assert.equal('cpuThreads' in settings.execution, false);
    assert.equal('beamSize' in settings.decoding, false);
    assert.equal('bestOf' in settings.decoding, false);
  });

  it('validates prompt-free capability settings without weakening the public boundary', () => {
    const { initialPrompt: _initialPrompt, ...publicSettings } = defaultSettings();

    assert.equal(isValidLocalWhisperPublicSettings(publicSettings, createContext()), true);
    assert.equal(
      isValidLocalWhisperPublicSettings(
        { ...publicSettings, initialPrompt: 'must-not-cross-boundary' },
        createContext(),
      ),
      false,
    );
    assert.equal(
      isValidLocalWhisperPublicSettings(
        { ...publicSettings, execution: { ...publicSettings.execution, deviceId: 'forged-device' } },
        createContext(),
      ),
      false,
    );
  });

  it('round-trips every release-1 target, backend, model, and decoding class', () => {
    const context = createContext();
    const base = defaultSettings(context);
    const executions = [
      {
        engine: 'whisperCpp',
        runtimeRevision: revision('whisper-cpp-cuda-v1'),
        execution: { target: 'gpu', backend: 'cuda', deviceId: NVIDIA_DEVICE_ID },
      },
      {
        engine: 'whisperCpp',
        runtimeRevision: revision('whisper-cpp-hip-v1'),
        execution: { target: 'gpu', backend: 'hip', deviceId: AMD_DEVICE_ID },
      },
      {
        engine: 'whisperCpp',
        runtimeRevision: revision('whisper-cpp-vulkan-v1'),
        execution: { target: 'gpu', backend: 'vulkan', deviceId: AMD_DEVICE_ID },
      },
      {
        engine: 'whisperCpp',
        runtimeRevision: revision('whisper-cpp-cpu-v1'),
        execution: { target: 'cpu', backend: 'cpu', cpuThreads: 'auto' },
      },
    ] as const;
    const decodings = [
      { strategy: 'greedy', temperatureHundredths: 0 },
      { strategy: 'beamSearch', temperatureHundredths: 0, beamSize: 1 },
      { strategy: 'beamSearch', temperatureHundredths: 0, beamSize: 10 },
      { strategy: 'bestOfSampling', temperatureHundredths: 5, bestOf: 1 },
      { strategy: 'bestOfSampling', temperatureHundredths: 100, bestOf: 10 },
    ] as const;

    for (const executionClass of executions) {
      for (const family of LOCAL_WHISPER_MODEL_FAMILIES) {
        for (const decoding of decodings) {
          const engine = executionClass.engine;
          const candidate = {
            ...base,
            ...executionClass,
            model: {
              family,
              revision: revision(`whisper-cpp-${family}-v1`),
              variant: 'full',
            },
            decoding,
          };
          const result = validateLocalWhisperSettings(candidate, context);
          assert.equal(
            result.success,
            true,
            `${engine}/${executionClass.execution.target}/${family}/${decoding.strategy}`,
          );
          if (result.success) {
            assert.deepEqual(
              validateLocalWhisperSettings(JSON.parse(JSON.stringify(result.settings)) as unknown, context),
              result,
            );
          }
        }
      }
    }
  });

  it('rejects malformed, unknown, unsafe-number, and cross-field-invalid inputs without repair', () => {
    const valid = defaultSettings();
    const invalidCandidates: unknown[] = [
      null,
      { ...valid, extra: true },
      { ...valid, engine: 'unknownEngine' },
      { ...valid, runtimeRevision: 'unknown-runtime' },
      { ...valid, language: 'EN' },
      { ...valid, model: { ...valid.model, family: 'large-v2' } },
      { ...valid, model: { ...valid.model, revision: 'unknown-model' } },
      { ...valid, model: { ...valid.model, variant: 'q5_0' } },
      { ...valid, execution: { ...valid.execution, deviceId: 'forged-device' } },
      { ...valid, decoding: { strategy: 'greedy', temperatureHundredths: 5 } },
      { ...valid, decoding: { strategy: 'beamSearch', temperatureHundredths: 0, beamSize: 1.5 } },
      { ...valid, decoding: { strategy: 'bestOfSampling', temperatureHundredths: 7, bestOf: 5 } },
      { ...valid, decoding: { strategy: 'greedy', temperatureHundredths: 0, beamSize: 5 } },
      {
        ...valid,
        execution: { target: 'cpu', backend: 'cpu', cpuThreads: 17 },
        runtimeRevision: revision('whisper-cpp-cpu-v1'),
      },
      {
        ...valid,
        execution: { target: 'gpu', backend: 'hip', deviceId: NVIDIA_DEVICE_ID },
        runtimeRevision: revision('whisper-cpp-hip-v1'),
      },
    ];
    for (const candidate of invalidCandidates) expectInvalid(candidate);
  });

  it('validates Unicode scalar sequences and counts code points without trimming or normalization', () => {
    assert.equal(getLocalWhisperPromptValidationError('😀'.repeat(1_000)), null);
    assert.equal(getLocalWhisperPromptValidationError('😀'.repeat(1_001)), 'too-long');
    assert.equal(getLocalWhisperPromptValidationError('\ud800'), 'invalid-scalar');
    assert.equal(getLocalWhisperPromptValidationError('\udc00'), 'invalid-scalar');
    assert.equal(getLocalWhisperPromptValidationError('safe\u0000unsafe'), 'nul');
    assert.equal(getLocalWhisperPromptValidationError(1), 'invalid-type');
  });

  it('initializes dependent keys once and restores explicit values after switching away and back', () => {
    const runtimeKey = getLocalWhisperRuntimeSelectionKey('whisperCpp', 'gpu', 'cuda');
    const deviceKey = getLocalWhisperDeviceSelectionKey('whisperCpp', 'cuda');
    const revisionKey = getLocalWhisperModelRevisionSelectionKey('whisperCpp', 'base');
    let memory = initializeLocalWhisperDependentSelection(
      EMPTY_LOCAL_WHISPER_DEPENDENT_SELECTION_MEMORY,
      runtimeKey,
      'runtime-v1',
    );
    memory = initializeLocalWhisperDependentSelection(memory, runtimeKey, 'runtime-v2');
    assert.equal(readLocalWhisperDependentSelection(memory, runtimeKey), 'runtime-v1');
    memory = rememberLocalWhisperDependentSelection(memory, deviceKey, NVIDIA_DEVICE_ID);
    memory = rememberLocalWhisperDependentSelection(memory, revisionKey, 'model-v1');
    memory = rememberLocalWhisperDependentSelection(memory, 'backend:whisperCpp:gpu', 'cuda');
    memory = rememberLocalWhisperDependentSelection(memory, 'model:whisperCpp', 'base');
    memory = rememberLocalWhisperDependentSelection(memory, 'threads:whisperCpp', 'auto');
    memory = rememberLocalWhisperDependentSelection(memory, 'request:language', 'ru');

    assert.equal(readLocalWhisperDependentSelection(memory, deviceKey), NVIDIA_DEVICE_ID);
    assert.equal(readLocalWhisperDependentSelection(memory, revisionKey), 'model-v1');
    assert.equal(readLocalWhisperDependentSelection(memory, 'backend:whisperCpp:gpu'), 'cuda');
    assert.equal(readLocalWhisperDependentSelection(memory, 'model:whisperCpp'), 'base');
    assert.equal(readLocalWhisperDependentSelection(memory, 'threads:whisperCpp'), 'auto');
    assert.equal(readLocalWhisperDependentSelection(memory, 'request:language'), 'ru');
    assert.equal(readLocalWhisperDependentSelection(memory, 'device:whisperCpp:vulkan'), undefined);

    const captured = rememberLocalWhisperSettingsSelections(memory, defaultSettings());
    assert.equal(readLocalWhisperDependentSelection(captured, 'runtime:whisperCpp:gpu:cuda'), 'whisper-cpp-cuda-v1');
    assert.equal(readLocalWhisperDependentSelection(captured, 'variant:whisperCpp:base'), 'full');
    assert.equal(readLocalWhisperDependentSelection(captured, 'request:temperatureHundredths'), 0);
    assert.equal(readLocalWhisperDependentSelection(captured, 'request:strategy'), 'greedy');
  });

  it('keeps prompt content private in cache contexts while comparing its injected digest', () => {
    const settings = defaultSettings();
    const withPrompt = { ...settings, initialPrompt: 'private-prompt-canary' } as LocalWhisperSettings;
    const build = (promptSettings: LocalWhisperSettings) =>
      new LocalWhisperCacheContext({
        settings: promptSettings,
        modelIdentity: {
          engine: 'whisperCpp',
          logicalModel: 'base',
          sourceCheckpointRevision: revision('openai-whisper-base-v1'),
          artifactRevision: revision('whisper-cpp-base-v1'),
          nativeFormat: 'ggml',
          variant: 'full',
        },
        protocolRevision: 'protocol-v1',
        mappingRevision: 'mapping-v1',
        deviceClass: 'nvidia-cuda',
        resolvedCpuThreads: null,
        digestPrompt: (prompt) => `digest:${prompt.length}`,
      });
    const first = build(withPrompt);
    const same = build(withPrompt);
    const different = build({ ...withPrompt, initialPrompt: 'different' });
    assert.equal(first.equals(same), true);
    assert.equal(first.equals(different), false);
    assert.doesNotMatch(first.toDebugString(), /private-prompt-canary|digest:/);
    assert.doesNotMatch(JSON.stringify(first.toPublicSnapshot()), /private-prompt-canary|digest:/);
  });
});
