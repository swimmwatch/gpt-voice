import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, freemem, tmpdir } from 'node:os';
import * as path from 'node:path';

import type {
  ArtifactHttpClient,
  ArtifactHttpClientRequest,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import { NvidiaSmiVramAvailability } from '@main/localWhisper/capability/NvidiaSmiVramAvailability';
import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import {
  ProductionLocalWhisperEnvironmentFactory,
  type LocalWhisperProductionEnvironmentDependencies,
} from '@main/localWhisper/composition/createProductionLocalWhisperEnvironment';
import { LocalWhisperCoordinator } from '@main/localWhisper/coordinator/LocalWhisperCoordinator';
import {
  LocalWhisperDevelopmentActivationLoader,
  openLocalWhisperActivationFile,
} from '@main/localWhisper/development/LocalWhisperDevelopmentActivation';
import type { DeferredLocalWhisperEnvironment } from '@main/localWhisper/ipc/createDeferredLocalWhisperEnvironment';
import {
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperPublicSettings,
  type LocalWhisperRevisionId,
} from '@shared/localWhisper';

import { sha256File } from '../packaging/fileIntegrity';
import {
  createLocalWhisperDevelopmentSession,
  type DevelopmentApplicationLauncher,
} from './LocalWhisperDevelopmentSession';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..');
const SMOKE_ROOT = path.resolve(tmpdir(), 'gpt-voice-local-whisper-task24-application-smoke');
const SMOKE_MARKER = path.join(SMOKE_ROOT, '.task24-owned.json');
const WAV_PATH = path.resolve(WORKSPACE_ROOT, '.cache', 'local-whisper', 'windows-readiness', 'fleurs', 'smoke.wav');
const WAV_SIZE_BYTES = 404_524;
const WAV_SHA256 = '90a8eba6c057eb30b573922d95c303f2d276ba8f7501bbb1f64711a5f00946b6';
const CPU_RUNTIME_REVISION = revision('whisper-cpp-windows-x64-cpu-v1');
const CUDA_RUNTIME_REVISION = revision('whisper-cpp-windows-x64-cuda-12.8.1-sm120a-v1');
const MODEL_REVISION = revision('whisper-cpp-base-full-v1');
const ARTIFACT_TIMEOUT_MS = 15 * 60 * 1000;

interface ApplicationSession {
  readonly coordinator: LocalWhisperCoordinator;
  readonly environment: DeferredLocalWhisperEnvironment;
}

interface SmokeResult {
  readonly cpu: 'Pass';
  readonly cuda: 'Pass';
  readonly offlineReuse: 'Pass';
  readonly cleanup: 'Pass';
}

function revision(value: string): LocalWhisperRevisionId {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Invalid Task 24 smoke revision');
  return parsed;
}

function exactArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function requireSuccess<T>(
  result: { readonly success: true; readonly value: T } | { readonly success: false; readonly error: { code: string } },
  stage: string,
): T {
  if (!result.success) throw new Error(`${stage}:${result.error.code}`);
  return result.value;
}

class OfflineArtifactHttpClient implements ArtifactHttpClient {
  public requestCount = 0;

  public open(_request: ArtifactHttpClientRequest): Promise<never> {
    this.requestCount += 1;
    return Promise.reject(new Error('Task 24 offline restart forbids artifact network access'));
  }
}

class WindowsApplicationSmoke {
  private readonly packageVersion: string;
  private requestSequence = 0;
  private vramSampleCount = 0;

  public constructor() {
    const packageValue = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, 'package.json'), 'utf8')) as {
      readonly version?: unknown;
    };
    if (typeof packageValue.version !== 'string') throw new Error('Task 24 app revision unavailable');
    this.packageVersion = packageValue.version;
  }

  public async run(arguments_: readonly string[]): Promise<void> {
    const activation = await new LocalWhisperDevelopmentActivationLoader({
      appRevision: this.packageVersion,
      arguments: arguments_,
      authenticateCatalog: (document, trustPolicy) => {
        const loaded = new LocalWhisperCatalogRepository({ readDocument: () => document, trustPolicy }).load();
        return loaded.success && loaded.catalog.payload.purpose === 'qualification';
      },
      isPackaged: false,
      openFile: openLocalWhisperActivationFile,
      platform: process.platform,
      userId: process.getuid?.(),
    }).load();
    if (activation.status !== 'active') throw new Error('Task 24 development activation unavailable');

    const workerEvents: Array<{ readonly backend: string; readonly launchMode: string }> = [];
    const first = await this.createApplication(activation, {
      onSessionProcessLaunched: (event) => workerEvents.push({ backend: event.backend, launchMode: event.launchMode }),
      trustedCertificateAuthorities: activation.trustedCertificateAuthorities,
    });
    try {
      await this.install(first, 'runtime', CPU_RUNTIME_REVISION);
      await this.install(first, 'model', MODEL_REVISION);
      await this.install(first, 'runtime', CUDA_RUNTIME_REVISION);
      await this.select(first, 'cpu');
      const cpuEventStart = workerEvents.length;
      await this.exercise(first, 'cpu');
      assert.equal(this.vramSampleCount, 0, 'CPU smoke initialized a GPU resource probe');
      assert.ok(workerEvents.slice(cpuEventStart).every(({ backend }) => backend === 'cpu'));

      await this.select(first, 'cuda');
      const cudaEventStart = workerEvents.length;
      await this.exercise(first, 'cuda');
      assert.ok(this.vramSampleCount > 0, 'CUDA smoke did not sample the selected device');
      assert.ok(workerEvents.slice(cudaEventStart).every(({ backend }) => backend === 'cuda'));
    } finally {
      await this.close(first);
    }

    const offline = new OfflineArtifactHttpClient();
    const restarted = await this.createApplication(activation, {
      artifactHttpClient: offline,
      trustedCertificateAuthorities: activation.trustedCertificateAuthorities,
    });
    try {
      const installed = restarted.environment.facts.snapshot.artifacts.filter(({ state }) => state === 'Installed');
      assert.ok(installed.some(({ revision }) => revision === CPU_RUNTIME_REVISION));
      assert.ok(installed.some(({ revision }) => revision === CUDA_RUNTIME_REVISION));
      assert.ok(installed.some(({ revision }) => revision === MODEL_REVISION));
      await this.exercise(restarted, 'cuda');
      assert.equal(offline.requestCount, 0, 'Offline restart attempted an artifact transfer');
    } finally {
      await this.close(restarted);
    }
  }

  private async createApplication(
    activation: Extract<Awaited<ReturnType<LocalWhisperDevelopmentActivationLoader['load']>>, { status: 'active' }>,
    qualificationHooks: NonNullable<LocalWhisperProductionEnvironmentDependencies['qualificationHooks']>,
  ): Promise<ApplicationSession> {
    const configurationRoot = path.join(SMOKE_ROOT, 'configuration');
    const localAppDataRoot = path.join(SMOKE_ROOT, 'local-app-data');
    const homeRoot = path.join(SMOKE_ROOT, 'home');
    await Promise.all(
      [configurationRoot, localAppDataRoot, homeRoot].map((directory) =>
        mkdir(directory, { mode: 0o700, recursive: true }),
      ),
    );
    const environment = Object.freeze({
      ...process.env,
      APPDATA: configurationRoot,
      HOME: homeRoot,
      LOCALAPPDATA: localAppDataRoot,
      USERPROFILE: homeRoot,
    });
    const vram = new NvidiaSmiVramAvailability({
      platform: process.platform,
      environment,
      pathExists: fs.existsSync,
      command: Object.freeze({
        run: (executablePath: string, arguments_: readonly string[]) =>
          new Promise<string>((resolve, reject) => {
            execFile(
              executablePath,
              [...arguments_],
              { encoding: 'utf8', maxBuffer: 64 * 1024, timeout: 10_000, windowsHide: true },
              (error, stdout) => (error ? reject(new Error('Task 24 NVIDIA resource query failed')) : resolve(stdout)),
            );
          }),
      }),
    });
    const dependencies: LocalWhisperProductionEnvironmentDependencies = {
      appRevision: this.packageVersion,
      architecture: process.arch,
      availableMemoryBytes: freemem,
      availableVramBytes: async (nativeIdentity) => {
        this.vramSampleCount += 1;
        return await vram.sample(nativeIdentity);
      },
      configurationRoot,
      environment,
      fileSystem: fs,
      homeDirectory: () => homeRoot,
      logicalProcessorCount: availableParallelism(),
      nextRequestId: () => `task24-request-${++this.requestSequence}`,
      now: Date.now,
      openPath: () => Promise.resolve(''),
      pid: process.pid,
      platform: process.platform,
      qualificationHooks,
      randomBytes: (size) => randomBytes(size),
      randomNonce: () => randomBytes(24).toString('base64url'),
      readFile: async (filePath) => await readFile(filePath),
      resourcesPath: activation.resourcesPath,
      spawnProcess: spawn,
    };
    const environmentInstance = await new ProductionLocalWhisperEnvironmentFactory(
      dependencies,
      activation.catalogInput,
    ).create();
    if (environmentInstance.facts.snapshot.catalogRevision === null) {
      await environmentInstance.dispose();
      throw new Error('Task 24 production application graph unavailable');
    }
    return {
      environment: environmentInstance,
      coordinator: new LocalWhisperCoordinator(environmentInstance.coordinator),
    };
  }

  private async close(session: ApplicationSession): Promise<void> {
    await session.coordinator.shutdown().catch(() => undefined);
    await session.environment.dispose();
  }

  private async install(
    session: ApplicationSession,
    kind: 'model' | 'runtime',
    artifactRevision: LocalWhisperRevisionId,
  ): Promise<void> {
    const artifact = session.environment.facts.snapshot.artifacts.find(
      (entry) => entry.kind === kind && entry.revision === artifactRevision,
    );
    if (!artifact) throw new Error('Task 24 catalog artifact unavailable');
    if (artifact.state === 'Installed') return;
    const action = artifact.state === 'Missing' ? 'download' : artifact.state === 'Resumable' ? 'resume' : 'retry';
    const current = session.coordinator.snapshot;
    const started = await session.environment.artifacts.execute({
      kind: action,
      artifactKind: artifact.kind,
      artifactId: artifact.id,
      artifactRevision: artifact.revision,
      expectedSnapshotRevision: current.snapshotRevision,
      expectedConfigurationEpoch: current.epochs.configuration,
      expectedInventoryEpoch: current.epochs.inventory,
    });
    if (!started.success) throw new Error(`Task 24 artifact start failed:${started.code ?? 'UNKNOWN'}`);
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let unsubscribe = (): void => undefined;
      const timeout = setTimeout(() => finish(new Error('Task 24 artifact install timed out')), ARTIFACT_TIMEOUT_MS);
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribe();
        if (error) reject(error);
        else resolve();
      };
      const inspect = (facts: DeferredLocalWhisperEnvironment['facts']['snapshot']): void => {
        const currentArtifact = facts.artifacts.find(({ id }) => id === artifact.id);
        const progress = facts.progress.find(({ artifactId }) => artifactId === artifact.id);
        if (currentArtifact?.state === 'Installed') finish();
        else if (progress?.failure) {
          finish(new Error(`Task 24 ${kind} ${artifactRevision} failed:${progress.failure.code}`));
        } else if (currentArtifact && ['Blocked', 'Corrupt', 'Failed'].includes(currentArtifact.state)) {
          finish(new Error(`Task 24 artifact failed:${currentArtifact.state}`));
        }
      };
      unsubscribe = session.environment.facts.subscribe(inspect);
      inspect(session.environment.facts.snapshot);
    });
  }

  private async select(session: ApplicationSession, backend: 'cpu' | 'cuda'): Promise<void> {
    let deviceId = null;
    if (backend === 'cuda') {
      await session.environment.refreshDevices(session.coordinator.snapshot.epochs.configuration);
      const devices = session.environment.facts.snapshot.options.filter(
        (option) =>
          option.group === 'device' &&
          option.available &&
          option.label.startsWith('NVIDIA GPU ') &&
          option.compatibility.eligibleBackends.includes('cuda'),
      );
      assert.equal(devices.length, 1, 'Task 24 expected one renderer-safe NVIDIA device');
      const device = devices[0];
      deviceId = device ? toLocalWhisperOpaqueDeviceId(device.id) : null;
      if (!deviceId) throw new Error('Task 24 renderer-safe NVIDIA device unavailable');
    }
    const current = session.coordinator.snapshot;
    const candidate: LocalWhisperPublicSettings = {
      ...current.settings,
      runtimeRevision: backend === 'cpu' ? CPU_RUNTIME_REVISION : CUDA_RUNTIME_REVISION,
      model: { family: 'base', revision: MODEL_REVISION, variant: 'full' },
      language: 'auto',
      decoding: { strategy: 'greedy', temperatureHundredths: 0 },
      execution:
        backend === 'cpu'
          ? { target: 'cpu', backend: 'cpu', cpuThreads: 'auto' }
          : { target: 'gpu', backend: 'cuda', deviceId },
    };
    requireSuccess(
      await session.coordinator.applySettingsTransaction({
        kind: 'save',
        candidate,
        promptMutation: { kind: 'clear' },
        expectedConfigurationEpoch: current.epochs.configuration,
        expectedInventoryEpoch: current.epochs.inventory,
      }),
      `select-${backend}`,
    );
  }

  private async exercise(session: ApplicationSession, backend: 'cpu' | 'cuda'): Promise<void> {
    const compatibility = await session.coordinator.checkCompatibility();
    if (!compatibility.success) throw new Error(`${backend}-compatibility:${compatibility.error.code}`);
    const load = await session.coordinator.loadNow();
    if (!load.success) throw new Error(`${backend}-load:${load.error.code}`);
    const bytes = await readFile(WAV_PATH);
    const result = await session.coordinator.transcribe({
      dispatch: session.coordinator.captureDispatchSnapshot(),
      buffer: exactArrayBuffer(bytes),
      mimeType: 'audio/wav',
    });
    const transcript = requireSuccess(result, `${backend}-transcribe`);
    assert.ok(transcript.trim().length > 0, `Task 24 ${backend} transcript was empty`);
    requireSuccess(await session.coordinator.unload(), `${backend}-unload`);
  }
}

async function prepareOwnedRoot(): Promise<void> {
  const expectedParent = path.resolve(tmpdir());
  assert.equal(path.dirname(SMOKE_ROOT), expectedParent);
  assert.equal(path.basename(SMOKE_ROOT), 'gpt-voice-local-whisper-task24-application-smoke');
  await rm(SMOKE_ROOT, { force: true, recursive: true });
  await mkdir(SMOKE_ROOT, { mode: 0o700, recursive: true });
  await writeFile(SMOKE_MARKER, '{"owner":"local-whisper-task-24"}', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}

async function cleanupOwnedRoot(): Promise<void> {
  assert.equal(await readFile(SMOKE_MARKER, 'utf8'), '{"owner":"local-whisper-task-24"}');
  await rm(SMOKE_ROOT, { force: true, recursive: true });
}

async function main(): Promise<SmokeResult> {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Task 24 application smoke requires native Windows x64');
  }
  const wav = await sha256File(WAV_PATH);
  const wavBytes = await readFile(WAV_PATH);
  assert.equal(wavBytes.byteLength, WAV_SIZE_BYTES);
  assert.equal(wav, WAV_SHA256);
  await prepareOwnedRoot();
  try {
    const smoke = new WindowsApplicationSmoke();
    const launcher: DevelopmentApplicationLauncher = (_executable, arguments_) => {
      const result = smoke.run(arguments_);
      return Promise.resolve({ waitForExit: () => result, terminate: () => undefined });
    };
    await createLocalWhisperDevelopmentSession(launcher).run(WORKSPACE_ROOT, 'win32');
  } finally {
    await cleanupOwnedRoot();
  }
  return { cpu: 'Pass', cuda: 'Pass', offlineReuse: 'Pass', cleanup: 'Pass' };
}

main()
  .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Task 24 application smoke failed'}\n`);
    process.exitCode = 1;
  });
