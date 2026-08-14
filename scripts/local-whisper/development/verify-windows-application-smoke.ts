import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, freemem, tmpdir } from 'node:os';
import * as path from 'node:path';

import type { MainLogFileAccessor, RetainedMainLog, ScopedLogger } from '@main/logger';
import type {
  ArtifactHttpClient,
  ArtifactHttpClientRequest,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
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
  NativeRuntimeLogForwarder,
  NativeRuntimeLogRelay,
} from '@main/localWhisper/supervisor/NativeRuntimeLogStreamDecoder';
import { PROVIDER_AUDIT_SCHEMA_VERSION } from '@main/providerAudit';
import { DiagnosticsArchiveJsonlSerializer } from '@main/services/diagnosticsArchive';
import {
  ArchiverDiagnosticsArchiveWriterFactory,
  DiagnosticsArchiveFormatAdapter,
  inspectDiagnosticsArchiveForVerification,
  type DiagnosticsArchiveMember,
} from '@main/services/diagnosticsArchiveFormat';
import { DIAGNOSTIC_REDACTOR_VERSION } from '@main/services/diagnosticTextRedactor';
import { DiagnosticsManifestBuilder } from '@main/services/diagnosticsManifest';
import { NativeRuntimeLogArchiveExtractor } from '@main/services/nativeRuntimeLogArchive';
import { NativeRuntimeLogArchiveReader } from '@main/services/nativeRuntimeLogArchiveReader';
import {
  DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
  DIAGNOSTICS_ARCHIVE_MEMBER_NAMES,
  type DiagnosticsArchiveEnvironmentSnapshot,
  type DiagnosticsArchivePayloadMemberName,
} from '@shared/diagnosticsArchive';
import {
  toLocalWhisperRevisionId,
  type NativeRuntimeLogRecord,
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
const MODEL_REVISION = revision('whisper-cpp-base-full-v1');
const ARTIFACT_TIMEOUT_MS = 15 * 60 * 1000;
const NATIVE_EVENT_TIMEOUT_MS = 5_000;
const NATIVE_EVENT_POLL_MS = 25;
const DIAGNOSTICS_ARCHIVE_IDS = Object.freeze([
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000021',
]);
const PRIVACY_CANARIES = Object.freeze([
  'packet20-private-path-canary',
  'packet20-private-audio-canary',
  'packet20-private-transcript-canary',
  'packet20-private-credential-canary',
]);

interface ApplicationSession {
  readonly coordinator: LocalWhisperCoordinator;
  readonly environment: DeferredLocalWhisperEnvironment;
  readonly nativeRuntimeLogRelay: CapturingNativeRuntimeLogRelay;
}

interface SmokeResult {
  readonly cpu: 'Pass';
  readonly offlineReuse: 'Pass';
  readonly cleanup: 'Pass';
  readonly diagnosticsArchive: 'Pass';
  readonly diagnosticsArchiveSha256: string;
  readonly nativePrivacy: 'Pass';
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

class CapturingScopedNativeLogger implements ScopedLogger, MainLogFileAccessor {
  private readonly entries: Array<{ readonly level: NativeRuntimeLogRecord['level']; readonly message: string }> = [];

  public debug(...args: unknown[]): void {
    this.record('debug', args);
  }

  public info(...args: unknown[]): void {
    this.record('info', args);
  }

  public warn(...args: unknown[]): void {
    this.record('warn', args);
  }

  public error(...args: unknown[]): void {
    this.record('error', args);
  }

  public readRetainedLogs(): readonly RetainedMainLog[] {
    assert.ok(this.entries.length >= 2, 'Task 24 native main-log history was incomplete');
    const split = Math.floor(this.entries.length / 2);
    const render = (entries: typeof this.entries): string =>
      entries
        .map(({ level, message }) => `[2026-08-14T00:00:00.000Z] [${level}] (local-whisper-native-runtime) ${message}`)
        .join('\n');
    return Object.freeze([
      Object.freeze({ contents: render(this.entries.slice(0, split)), generation: 'rotated' as const }),
      Object.freeze({ contents: render(this.entries.slice(split)), generation: 'current' as const }),
    ]);
  }

  public serialized(): string {
    return this.entries.map(({ message }) => message).join('\n');
  }

  private record(level: NativeRuntimeLogRecord['level'], args: readonly unknown[]): void {
    if (args.length !== 1 || typeof args[0] !== 'string') {
      throw new Error('Task 24 native main-log forwarding changed');
    }
    this.entries.push(Object.freeze({ level, message: args[0] }));
  }
}

class CapturingNativeRuntimeLogRelay extends NativeRuntimeLogRelay {
  private readonly records: NativeRuntimeLogRecord[] = [];
  private readonly retainedLogger = new CapturingScopedNativeLogger();

  public constructor() {
    super();
    this.attach(
      new NativeRuntimeLogForwarder({
        logger: this.retainedLogger,
        now: () => new Date(),
      }),
    );
  }

  public override accept(record: NativeRuntimeLogRecord): void {
    this.records.push(record);
    super.accept(record);
  }

  public hasEvent(component: NativeRuntimeLogRecord['component'], event: NativeRuntimeLogRecord['event']): boolean {
    return this.records.some((record) => record.component === component && record.event === event);
  }

  public async waitForEvents(
    component: NativeRuntimeLogRecord['component'],
    events: readonly NativeRuntimeLogRecord['event'][],
  ): Promise<boolean> {
    const deadline = Date.now() + NATIVE_EVENT_TIMEOUT_MS;
    while (Date.now() <= deadline) {
      if (events.every((event) => this.hasEvent(component, event))) return true;
      await new Promise<void>((resolve) => setTimeout(resolve, NATIVE_EVENT_POLL_MS));
    }
    return false;
  }

  public async verifyProductionArchive(packageVersion: string, archiveId: string): Promise<string> {
    assert.ok(this.records.length > 0, 'Task 24 native log history was empty');
    assert.ok(
      this.records.every(({ level }) => level !== 'debug'),
      'Task 24 production retained debug native data',
    );
    const retainedText = `${JSON.stringify(this.records)}\n${this.retainedLogger.serialized()}`;
    for (const canary of PRIVACY_CANARIES) assert.equal(retainedText.includes(canary), false);

    const extraction = new NativeRuntimeLogArchiveExtractor(this.retainedLogger).extract();
    assert.ok(extraction.summary.includedRecordCount > 0, 'Task 24 native archive history was empty');
    assert.equal(extraction.summary.invalidRecordCount, 0, 'Task 24 native archive contained invalid records');
    const observedKeys = new Set<string>();
    let duplicateRecordCount = 0;
    for (const record of this.records) {
      const key = `${record.processInstanceId}\0${record.sequence}`;
      if (observedKeys.has(key)) duplicateRecordCount += 1;
      else observedKeys.add(key);
    }
    assert.equal(
      extraction.summary.duplicateRecordCount,
      duplicateRecordCount,
      'Task 24 native archive duplicate count changed',
    );
    const jsonl = new DiagnosticsArchiveJsonlSerializer();
    const auditPayload = jsonl.serializeAuditEvents([]);
    const nativeRuntimePayload = jsonl.serializeNativeRuntime(extraction.records);
    const payloads = new Map<DiagnosticsArchivePayloadMemberName, Buffer>([
      [DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents, auditPayload],
      [DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.NativeRuntime, nativeRuntimePayload],
    ]);
    const hash = (payload: Buffer): string => createHash('sha256').update(payload).digest('hex');
    const environment: DiagnosticsArchiveEnvironmentSnapshot = {
      appVersion: packageVersion,
      architecture: 'x64',
      cloakBrowserVersion: '0.5.3',
      electronVersion: '43.1.1',
      nodeVersion: process.versions.node,
      platformFamily: 'windows',
      playwrightVersion: '1.62.1',
      providers: {
        voice: {
          capabilityAvailable: true,
          configured: true,
          readinessKnown: true,
          ready: true,
          registeredProviderIds: ['chatgpt', 'openai-api', 'claude-web', 'local-whisper'],
          selectedProviderId: 'local-whisper',
        },
        prettify: {
          capabilityAvailable: true,
          configured: false,
          readinessKnown: false,
          ready: false,
          registeredProviderIds: ['ollama', 'vllm', 'claude-cli', 'codex-cli'],
          selectedProviderId: null,
        },
        translation: {
          capabilityAvailable: true,
          configured: false,
          readinessKnown: false,
          ready: false,
          registeredProviderIds: ['google', 'bing', 'yandex'],
          selectedProviderId: null,
        },
      },
    };
    const manifestBuilder = new DiagnosticsManifestBuilder({
      databaseSchemaVersion: 2,
      diagnosticRowSchemaVersion: DIAGNOSTIC_ARCHIVE_ROW_SCHEMA_VERSION,
      hash,
      providerAuditSchemaVersion: PROVIDER_AUDIT_SCHEMA_VERSION,
      redactorVersion: DIAGNOSTIC_REDACTOR_VERSION,
    });
    const manifest = manifestBuilder.build({
      archiveId,
      audit: { duplicateRecordCount: 0, invalidRecordCount: 0, validRecordCount: 0 },
      captureSettings: { capturePrettifyDiagnostics: false, captureTranslationDiagnostics: false },
      createdAt: new Date().toISOString(),
      diagnosticRows: [],
      environment,
      nativeRuntime: extraction.summary,
      payloads,
    });
    const members: DiagnosticsArchiveMember[] = [
      { name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest, payload: manifestBuilder.serialize(manifest) },
      { name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.AuditEvents, payload: auditPayload },
      { name: DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.NativeRuntime, payload: nativeRuntimePayload },
    ];
    const diagnosticsRoot = path.join(SMOKE_ROOT, 'diagnostics');
    await mkdir(diagnosticsRoot, { mode: 0o700, recursive: true });
    const archivePath = path.join(diagnosticsRoot, `${archiveId}.zip`);
    const fileSystem = {
      chmod: (filePath: string, mode: number) => fs.promises.chmod(filePath, mode),
      createWriteStream: (filePath: string, options: { readonly flags: 'wx'; readonly mode: number }) =>
        fs.createWriteStream(filePath, options),
      readFile: (filePath: string) => fs.promises.readFile(filePath),
    };
    const format = new DiagnosticsArchiveFormatAdapter({
      fileSystem,
      platform: 'win32',
      writerFactory: new ArchiverDiagnosticsArchiveWriterFactory(),
    });
    await format.writeAndVerify('zip', archivePath, members);
    const archiveBytes = await readFile(archivePath);
    const inspected = inspectDiagnosticsArchiveForVerification('zip', archiveBytes);
    const manifestPayload = inspected.get(DIAGNOSTICS_ARCHIVE_MEMBER_NAMES.Manifest);
    assert.ok(manifestPayload, 'Task 24 diagnostics manifest was absent');
    const inspectedMembers = [...inspected].map(([name, payload]) => ({ name, payload }));
    assert.equal(
      new NativeRuntimeLogArchiveReader({ hash }).inspect(
        JSON.parse(manifestPayload.toString('utf8')),
        inspectedMembers,
      ),
      'valid',
    );
    for (const canary of PRIVACY_CANARIES) assert.equal(archiveBytes.includes(Buffer.from(canary, 'utf8')), false);
    return hash(archiveBytes);
  }
}

class WindowsApplicationSmoke {
  private readonly packageVersion: string;
  private archiveSequence = 0;
  private requestSequence = 0;
  private diagnosticsArchiveDigest: string | null = null;

  public constructor() {
    const packageValue = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, 'package.json'), 'utf8')) as {
      readonly version?: unknown;
    };
    if (typeof packageValue.version !== 'string') throw new Error('Task 24 app revision unavailable');
    this.packageVersion = packageValue.version;
  }

  public get diagnosticsArchiveSha256(): string {
    if (!this.diagnosticsArchiveDigest) throw new Error('Task 24 diagnostics archive was not produced');
    return this.diagnosticsArchiveDigest;
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
      await this.selectCpu(first);
      const cpuEventStart = workerEvents.length;
      await this.exercise(first);
      assert.ok(workerEvents.slice(cpuEventStart).every(({ backend }) => backend === 'cpu'));
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
      assert.ok(installed.some(({ revision }) => revision === MODEL_REVISION));
      await this.exercise(restarted);
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
      CI: undefined,
      HOME: homeRoot,
      LOCALAPPDATA: localAppDataRoot,
      NODE_ENV: 'production',
      PACKET20_PRIVATE_AUDIO_CANARY: PRIVACY_CANARIES[1],
      PACKET20_PRIVATE_CREDENTIAL_CANARY: PRIVACY_CANARIES[3],
      PACKET20_PRIVATE_PATH_CANARY: PRIVACY_CANARIES[0],
      PACKET20_PRIVATE_TRANSCRIPT_CANARY: PRIVACY_CANARIES[2],
      USERPROFILE: homeRoot,
    });
    const nativeRuntimeLogRelay = new CapturingNativeRuntimeLogRelay();
    const dependencies: LocalWhisperProductionEnvironmentDependencies = {
      appRevision: this.packageVersion,
      architecture: process.arch,
      availableMemoryBytes: freemem,
      availableVramBytes: () => Promise.reject(new Error('Windows CPU smoke forbids GPU resource probing')),
      configurationRoot,
      environment,
      fileSystem: fs,
      homeDirectory: () => homeRoot,
      logicalProcessorCount: availableParallelism(),
      nextRequestId: () => `task24-request-${++this.requestSequence}`,
      nativeRuntimeLogRelay,
      now: Date.now,
      openPath: () => Promise.resolve(''),
      pid: process.pid,
      platform: process.platform,
      qualificationHooks,
      randomBytes: (size) => randomBytes(size),
      randomNonce: () => randomBytes(24).toString('base64url'),
      readNvidiaInventory: () => Promise.resolve({ available: false, reason: 'DEVICE_NOT_FOUND' }),
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
      nativeRuntimeLogRelay,
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

  private async selectCpu(session: ApplicationSession): Promise<void> {
    const current = session.coordinator.snapshot;
    const candidate: LocalWhisperPublicSettings = {
      ...current.settings,
      runtimeRevision: CPU_RUNTIME_REVISION,
      model: { family: 'base', revision: MODEL_REVISION, variant: 'full' },
      language: 'auto',
      decoding: { strategy: 'greedy', temperatureHundredths: 0 },
      execution: { target: 'cpu', backend: 'cpu', cpuThreads: 'auto' },
    };
    requireSuccess(
      await session.coordinator.applySettingsTransaction({
        kind: 'save',
        candidate,
        promptMutation: { kind: 'clear' },
        expectedConfigurationEpoch: current.epochs.configuration,
        expectedInventoryEpoch: current.epochs.inventory,
      }),
      'select-cpu',
    );
  }

  private async exercise(session: ApplicationSession): Promise<void> {
    const compatibility = await session.coordinator.checkCompatibility();
    if (!compatibility.success) throw new Error(`cpu-compatibility:${compatibility.error.code}`);
    const load = await session.coordinator.loadNow();
    if (!load.success) throw new Error(`cpu-load:${load.error.code}`);
    const bytes = await readFile(WAV_PATH);
    const result = await session.coordinator.transcribe({
      dispatch: session.coordinator.captureDispatchSnapshot(),
      buffer: exactArrayBuffer(bytes),
      mimeType: 'audio/wav',
    });
    const transcript = requireSuccess(result, 'cpu-transcribe');
    assert.ok(transcript.trim().length > 0, 'Task 24 CPU transcript was empty');
    const requiredWorkerEvents = ['inferenceCompleted', 'requestCompleted'] as const;
    assert.ok(
      await session.nativeRuntimeLogRelay.waitForEvents('whisperWorker', requiredWorkerEvents),
      'Task 24 CPU worker omitted required native events',
    );
    const archiveId = DIAGNOSTICS_ARCHIVE_IDS[this.archiveSequence];
    assert.ok(archiveId, 'Task 24 diagnostics archive identity unavailable');
    this.archiveSequence += 1;
    this.diagnosticsArchiveDigest = await session.nativeRuntimeLogRelay.verifyProductionArchive(
      this.packageVersion,
      archiveId,
    );
    requireSuccess(await session.coordinator.unload(), 'cpu-unload');
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
  const smoke = new WindowsApplicationSmoke();
  try {
    const launcher: DevelopmentApplicationLauncher = (_executable, arguments_) => {
      const result = smoke.run(arguments_);
      return Promise.resolve({ waitForExit: () => result, terminate: () => undefined });
    };
    await createLocalWhisperDevelopmentSession(launcher).run(WORKSPACE_ROOT, 'win32');
  } finally {
    await cleanupOwnedRoot();
  }
  return {
    cpu: 'Pass',
    offlineReuse: 'Pass',
    cleanup: 'Pass',
    diagnosticsArchive: 'Pass',
    diagnosticsArchiveSha256: smoke.diagnosticsArchiveSha256,
    nativePrivacy: 'Pass',
  };
}

main()
  .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Task 24 application smoke failed'}\n`);
    process.exitCode = 1;
  });
