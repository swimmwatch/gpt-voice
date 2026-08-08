import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import {
  FileLocalWhisperPrivateJsonStore,
  LOCAL_WHISPER_PRIVATE_DIRECTORY_MODE,
  LOCAL_WHISPER_PRIVATE_FILE_MODE,
  LocalWhisperSettingsRepository,
  LocalWhisperSettingsRepositoryError,
  resolveLocalWhisperSettingsFile,
} from '@main/localWhisper/settings/LocalWhisperSettingsRepository';
import {
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  validateLocalWhisperSettings,
  type LocalWhisperSettings,
  type LocalWhisperSettingsValidationContext,
} from '@shared/localWhisper';

const temporaryDirectories: string[] = [];
const RUNTIME_REVISION = toLocalWhisperRevisionId('whisper-cpp-cpu-pack-v1')!;
const CUDA_RUNTIME_REVISION = toLocalWhisperRevisionId('whisper-cpp-cuda-pack-v1')!;
const LEGACY_CUDA_RUNTIME_REVISION = toLocalWhisperRevisionId('whisper-cpp-cuda-sm86-pack-v1')!;
const MODEL_REVISION = toLocalWhisperRevisionId('base-ggml-v1')!;
const CUDA_DEVICE_ID = toLocalWhisperOpaqueDeviceId(`device-v1-${'a'.repeat(64)}`)!;

function createContext(): LocalWhisperSettingsValidationContext {
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

function createSettings(prompt = 'Private prompt'): LocalWhisperSettings {
  return {
    schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
    engine: 'whisperCpp',
    runtimeRevision: RUNTIME_REVISION,
    model: { family: 'base', revision: MODEL_REVISION, variant: 'full' },
    language: 'en',
    initialPrompt: prompt,
    decoding: { strategy: 'greedy', temperatureHundredths: 0 },
    execution: { target: 'cpu', backend: 'cpu', cpuThreads: 'auto' },
  };
}

function createCudaContext(deviceAvailable: boolean): LocalWhisperSettingsValidationContext {
  return {
    platform: 'linux',
    architecture: 'x64',
    logicalProcessorCount: 8,
    knownDevices: deviceAvailable
      ? [
          {
            id: CUDA_DEVICE_ID,
            label: 'NVIDIA GPU 1',
            vendor: 'nvidia',
            available: true,
            eligibleBackends: ['cuda'],
          },
        ]
      : [],
    eligibleGpuCombinations: deviceAvailable
      ? [{ engine: 'whisperCpp', backend: 'cuda', deviceId: CUDA_DEVICE_ID }]
      : [],
    knownRuntimeSelections: [
      {
        engine: 'whisperCpp',
        target: 'gpu',
        backend: 'cuda',
        revision: CUDA_RUNTIME_REVISION,
        recommended: true,
      },
    ],
    knownModelSelections: createContext().knownModelSelections,
  };
}

function createCudaSettings(): LocalWhisperSettings {
  return {
    ...createSettings(),
    runtimeRevision: CUDA_RUNTIME_REVISION,
    execution: { target: 'gpu', backend: 'cuda', deviceId: CUDA_DEVICE_ID },
  };
}

function createHarness() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-local-whisper-settings-'));
  temporaryDirectories.push(directory);
  const filePath = resolveLocalWhisperSettingsFile(directory);
  const store = new FileLocalWhisperPrivateJsonStore({ filePath, fileSystem: fs, platform: process.platform });
  return { directory, filePath, repository: new LocalWhisperSettingsRepository(store), store };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('LocalWhisperSettingsRepository', () => {
  it('returns in-memory defaults without creating a file until explicit save', () => {
    const { filePath, repository } = createHarness();

    const defaults = repository.load(createContext());

    assert.equal(defaults.status, 'default');
    assert.equal(fs.existsSync(filePath), false);

    const saved = repository.save(createSettings(), createContext());
    assert.equal(saved.settings.initialPrompt, 'Private prompt');
    assert.equal(fs.existsSync(filePath), true);
  });

  it('round-trips private settings, remembers dependent selections, and enforces owner-private POSIX modes', () => {
    const { directory, filePath, repository } = createHarness();

    repository.save(createSettings('Приватный prompt 😀'), createContext());
    const loaded = repository.load(createContext());

    assert.equal(loaded.status, 'configured');
    if (loaded.status !== 'configured') return;
    assert.deepEqual(loaded.snapshot.settings, createSettings('Приватный prompt 😀'));
    assert.equal(loaded.snapshot.dependentSelections.values['request:initialPrompt'], 'Приватный prompt 😀');
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(path.dirname(filePath)).mode & 0o777, LOCAL_WHISPER_PRIVATE_DIRECTORY_MODE);
      assert.equal(fs.statSync(filePath).mode & 0o777, LOCAL_WHISPER_PRIVATE_FILE_MODE);
    }
    assert.deepEqual(fs.readdirSync(path.dirname(filePath)), ['settings.json']);
    assert.equal(filePath.startsWith(directory), true);
  });

  it('preserves safe additive fields through read-modify-write', () => {
    const { filePath, repository } = createHarness();
    repository.save(createSettings(), createContext());
    const document = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    const storedSettings = document.settings as Record<string, unknown>;
    const storedModel = storedSettings.model as Record<string, unknown>;
    document.futureFeature = { label: 'preserve-me', version: 2 };
    storedSettings.futureTuning = { enabled: true };
    storedModel.futureVariantMetadata = 'keep';
    fs.writeFileSync(filePath, JSON.stringify(document), { encoding: 'utf8', mode: LOCAL_WHISPER_PRIVATE_FILE_MODE });

    const loaded = repository.load(createContext());
    assert.equal(loaded.status, 'configured');
    repository.save(createSettings('Updated'), createContext());

    const after = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    assert.deepEqual(after.futureFeature, { label: 'preserve-me', version: 2 });
    assert.deepEqual((after.settings as Record<string, unknown>).futureTuning, { enabled: true });
    assert.equal(
      ((after.settings as Record<string, unknown>).model as Record<string, unknown>).futureVariantMetadata,
      'keep',
    );
  });

  it('rejects invalid prompts and direct settings atomically without changing the existing file', () => {
    const { filePath, repository } = createHarness();
    repository.save(createSettings('Original'), createContext());
    const before = fs.readFileSync(filePath);
    const tooLong = createSettings('x'.repeat(1_001));

    assert.throws(
      () => repository.save(tooLong, createContext()),
      (error: unknown) => error instanceof LocalWhisperSettingsRepositoryError && error.code === 'INVALID_SETTINGS',
    );
    assert.deepEqual(fs.readFileSync(filePath), before);
  });

  it('preserves the old file and removes its private temporary sibling when atomic replacement fails', () => {
    const { filePath, repository } = createHarness();
    repository.save(createSettings('Original'), createContext());
    const before = fs.readFileSync(filePath);
    const failingStore = new FileLocalWhisperPrivateJsonStore({
      filePath,
      fileSystem: {
        ...fs,
        renameSync: () => {
          throw new Error('synthetic rename failure');
        },
      },
      platform: process.platform,
      createTemporaryPath: (target) => `${target}.failing.tmp`,
    });
    const failingRepository = new LocalWhisperSettingsRepository(failingStore);

    assert.throws(
      () => failingRepository.save(createSettings('Replacement'), createContext()),
      (error: unknown) =>
        error instanceof LocalWhisperSettingsRepositoryError && error.code === 'SETTINGS_WRITE_FAILED',
    );
    assert.deepEqual(fs.readFileSync(filePath), before);
    assert.equal(fs.existsSync(`${filePath}.failing.tmp`), false);
  });

  it('rejects prohibited operational authority in additive settings fields', () => {
    const { repository, store } = createHarness();
    store.write({
      namespace: 'local-whisper',
      schemaVersion: 1,
      settings: createSettings(),
      dependentSelections: { values: {} },
      futureRuntime: {
        absolutePath: '/tmp/untrusted-worker',
        downloadUrl: 'https://example.invalid',
        endpoint: 'https://example.invalid',
      },
    });

    assert.deepEqual(repository.load(createContext()), { status: 'invalid', code: 'INVALID_SETTINGS' });
  });

  it('keeps previously selected missing revisions as repairable state without replacing them', () => {
    const { repository } = createHarness();
    const selected = createSettings();
    repository.save(selected, createContext());
    const missingContext = { ...createContext(), knownRuntimeSelections: [], knownModelSelections: [] };

    const loaded = repository.load(missingContext);

    assert.equal(loaded.status, 'repairable');
    if (loaded.status !== 'repairable') return;
    assert.equal(loaded.snapshot.settings.runtimeRevision, RUNTIME_REVISION);
    assert.equal(loaded.snapshot.settings.model.revision, MODEL_REVISION);
    assert.equal(
      loaded.snapshot.repairIssues.some(({ path }) => path === 'model'),
      true,
    );
  });

  it('revalidates persisted CUDA settings after startup device discovery restores topology', () => {
    const { repository } = createHarness();
    const settings = createCudaSettings();
    repository.save(settings, createCudaContext(true));

    const beforeDiscovery = repository.load(createCudaContext(false));
    assert.equal(beforeDiscovery.status, 'repairable');
    if (beforeDiscovery.status !== 'repairable') return;
    assert.equal(
      beforeDiscovery.snapshot.repairIssues.some(({ path }) => path === 'execution.deviceId'),
      true,
    );

    const restored = validateLocalWhisperSettings(beforeDiscovery.snapshot.settings, createCudaContext(true));
    assert.equal(restored.success, true);
    if (restored.success) assert.deepEqual(restored.settings, settings);
  });

  it('preserves a legacy CUDA selection as selected-but-unavailable without rewriting it', () => {
    const { repository } = createHarness();
    const legacy = { ...createCudaSettings(), runtimeRevision: LEGACY_CUDA_RUNTIME_REVISION };
    const legacyContext = {
      ...createCudaContext(true),
      knownRuntimeSelections: [
        {
          engine: 'whisperCpp' as const,
          target: 'gpu' as const,
          backend: 'cuda' as const,
          revision: LEGACY_CUDA_RUNTIME_REVISION,
          recommended: true,
        },
      ],
    };
    repository.save(legacy, legacyContext);

    const loaded = repository.load(createCudaContext(true));

    assert.equal(loaded.status, 'repairable');
    if (loaded.status === 'repairable') {
      assert.equal(loaded.snapshot.settings.runtimeRevision, LEGACY_CUDA_RUNTIME_REVISION);
      assert.equal(
        loaded.snapshot.repairIssues.some(({ path }) => path === 'runtimeRevision'),
        true,
      );
    }
  });

  it('opens future schemas read-only and permits only explicit settings reset', () => {
    const { filePath, repository, store } = createHarness();
    store.write({ namespace: 'local-whisper', schemaVersion: 99, privateFutureState: 'untouched' });
    const before = fs.readFileSync(filePath);

    assert.deepEqual(repository.load(createContext()), {
      status: 'unsupported',
      code: 'SETTINGS_VERSION_UNSUPPORTED',
      schemaVersion: 99,
    });
    assert.throws(
      () => repository.save(createSettings(), createContext()),
      (error: unknown) =>
        error instanceof LocalWhisperSettingsRepositoryError && error.code === 'SETTINGS_VERSION_UNSUPPORTED',
    );
    assert.deepEqual(fs.readFileSync(filePath), before);
    assert.equal(repository.reset(), true);
    assert.equal(fs.existsSync(filePath), false);
  });

  it('reset removes only the Local Whisper settings document and clears its private prompt', () => {
    const { directory, filePath, repository } = createHarness();
    const unrelatedFile = path.join(directory, 'unrelated-provider.json');
    fs.writeFileSync(unrelatedFile, 'unrelated', 'utf8');
    repository.save(createSettings('Prompt that must be cleared'), createContext());
    assert.equal(fs.readFileSync(filePath, 'utf8').includes('Prompt that must be cleared'), true);

    assert.equal(repository.reset(), true);

    assert.equal(fs.existsSync(filePath), false);
    assert.equal(fs.readFileSync(unrelatedFile, 'utf8'), 'unrelated');
  });

  it('migrates the known legacy schema in memory without operational side effects', () => {
    const { filePath, repository, store } = createHarness();
    const settings = createSettings('Legacy prompt');
    const { schemaVersion: _schemaVersion, ...legacyConfiguration } = settings;
    store.write({
      namespace: 'local-whisper',
      schemaVersion: 0,
      configuration: legacyConfiguration,
      dependentSelections: { values: {} },
    });
    const before = fs.readFileSync(filePath);

    const migrated = repository.load(createContext());

    assert.equal(migrated.status, 'configured');
    if (migrated.status === 'configured') assert.deepEqual(migrated.snapshot.settings, settings);
    assert.deepEqual(fs.readFileSync(filePath), before);
  });
});
