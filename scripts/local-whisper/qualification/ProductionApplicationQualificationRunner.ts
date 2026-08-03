import { readFile } from 'node:fs/promises';

import { LocalWhisperCoordinator } from '@main/localWhisper/coordinator/LocalWhisperCoordinator';
import type { DeferredLocalWhisperEnvironment } from '@main/localWhisper/ipc/createDeferredLocalWhisperEnvironment';
import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  toLocalWhisperOpaqueDeviceId,
  type LocalWhisperPublicSettings,
  type LocalWhisperRevisionId,
} from '@shared/localWhisper';

import { sha256File } from '../packaging/fileIntegrity';
import type { DirectEngineQualificationRunner } from './DirectEngineQualificationRunner';
import type { LinuxResourceSample, LinuxResourceSamplerSession, LinuxResourceSeries } from './LinuxResourceSampler';
import { qualificationMedian, qualificationWerPercentage, type QualificationLocale } from './QualificationMetrics';
import type { QualificationLinuxRowEvidence } from './QualificationResultProducer';

const ARTIFACT_TIMEOUT_MILLISECONDS = 30 * 60 * 1000;
const CANCELLATION_DELAY_MILLISECONDS = 25;
const LOAD_UNLOAD_CYCLES = 10;
const SEQUENTIAL_TRANSCRIPTIONS = 20;
const WER_DELTA_LIMIT_PERCENTAGE_POINTS = 1;
const MAXIMUM_BASE_RTF = 1;

export interface QualificationAudioFixture {
  readonly id: string;
  readonly filePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly durationNanoseconds: number;
  readonly language: 'en' | 'ru';
  readonly locale: QualificationLocale;
  readonly referenceText?: string;
}

export interface QualificationApplicationModel {
  readonly family: (typeof LOCAL_WHISPER_RELEASE_MODEL_MATRIX)[number]['family'];
  readonly variant: (typeof LOCAL_WHISPER_RELEASE_MODEL_MATRIX)[number]['variant'];
  readonly artifactRevision: LocalWhisperRevisionId;
  readonly filePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface QualificationApplicationRuntime {
  readonly backend: 'cpu' | 'cuda';
  readonly packRevision: LocalWhisperRevisionId;
}

export interface QualificationDirectEngine {
  readonly backend: 'cpu' | 'cuda';
  readonly executablePath: string;
  readonly runtimeLibraryPath?: string;
}

export interface QualificationSessionProcessEvent {
  readonly backend: 'cpu' | 'cuda';
  readonly launchMode: 'fullLoad' | 'probe' | 'registry';
  readonly pid: number;
}

export interface ProductionApplicationQualificationInput {
  readonly models: readonly QualificationApplicationModel[];
  readonly runtimes: readonly QualificationApplicationRuntime[];
  readonly directEngines: readonly QualificationDirectEngine[];
  readonly werFixtures: readonly QualificationAudioFixture[];
  readonly performanceFixtures: readonly QualificationAudioFixture[];
  readonly cpuThreads: number;
  readonly predecessorPassed: boolean;
  readonly stopArtifactServer: () => Promise<void>;
}

export interface ProductionApplicationQualificationDependencies {
  readonly createEnvironment: (
    onSessionProcessLaunched: (event: QualificationSessionProcessEvent) => void,
  ) => Promise<DeferredLocalWhisperEnvironment>;
  readonly directEngine: Pick<DirectEngineQualificationRunner, 'run'>;
  readonly resourceSampler: QualificationResourceSampler;
  readonly killOwnedProcess: (pid: number) => void;
  readonly wait: (milliseconds: number) => Promise<void>;
}

interface OwnedResourceSession {
  readonly backend: 'cpu' | 'cuda';
  readonly pid: number;
  readonly result: Promise<LinuxResourceSeries>;
}

interface QualificationResourceSampler {
  readonly start: (rootPid: number, backend: 'cpu' | 'cuda') => Pick<LinuxResourceSamplerSession, 'finish'>;
}

interface ApplicationSession {
  readonly coordinator: LocalWhisperCoordinator;
  readonly environment: DeferredLocalWhisperEnvironment;
}

function exactArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function requireSuccess<T>(
  result: { readonly success: true; readonly value: T } | { readonly success: false; readonly error: { code: string } },
  gate: string,
): T {
  if (!result.success) throw new Error(`${gate}:${result.error.code}`);
  return result.value;
}

function peakRam(samples: readonly LinuxResourceSample[]): number {
  return Math.max(...samples.map(({ ramBytes }) => ramBytes));
}

function peakVram(samples: readonly LinuxResourceSample[]): number {
  return Math.max(...samples.map(({ vramBytes }) => (vramBytes === 'notApplicable' ? 0 : vramBytes)));
}

function rowIdentity(
  model: Pick<QualificationApplicationModel, 'family' | 'variant'>,
  backend: 'cpu' | 'cuda',
): string {
  return `${backend}|${model.family}|${model.variant}`;
}

/** Starts privacy-safe samplers only for production full-load worker processes. */
class QualificationWorkerResourceObserver {
  private readonly sessions: OwnedResourceSession[] = [];

  public constructor(private readonly sampler: QualificationResourceSampler) {}

  public onProcessLaunched = (event: QualificationSessionProcessEvent): void => {
    if (event.launchMode !== 'fullLoad') return;
    const session = this.sampler.start(event.pid, event.backend);
    const result = session.finish();
    void result.catch(() => undefined);
    this.sessions.push(
      Object.freeze({
        backend: event.backend,
        pid: event.pid,
        result,
      }),
    );
  };

  public get count(): number {
    return this.sessions.length;
  }

  public latestPid(backend: 'cpu' | 'cuda'): number {
    const latest = [...this.sessions].reverse().find((session) => session.backend === backend);
    if (!latest) throw new Error('Qualification worker process was not observed');
    return latest.pid;
  }

  public async finish(index: number, backend: 'cpu' | 'cuda'): Promise<LinuxResourceSeries> {
    const session = this.sessions[index];
    if (!session || session.backend !== backend) throw new Error('Qualification resource session is missing');
    return await session.result;
  }

  public async finishFrom(index: number): Promise<readonly LinuxResourceSeries[]> {
    return await Promise.all(this.sessions.slice(index).map(({ result }) => result));
  }
}

/** Exercises the real application coordinator and native worker graph for every Linux matrix row. */
export class ProductionApplicationQualificationRunner {
  public constructor(private readonly dependencies: ProductionApplicationQualificationDependencies) {}

  public async run(input: ProductionApplicationQualificationInput): Promise<readonly QualificationLinuxRowEvidence[]> {
    this.validateInput(input);
    let artifactServerStopped = false;
    const stopArtifactServer = async (): Promise<void> => {
      if (artifactServerStopped) return;
      artifactServerStopped = true;
      await input.stopArtifactServer();
    };
    try {
      await this.verifyFixtureIdentities([...input.werFixtures, ...input.performanceFixtures]);
      const installationObserver = new QualificationWorkerResourceObserver(this.dependencies.resourceSampler);
      const installation = await this.createSession(installationObserver);
      try {
        await this.installArtifacts(installation, input);
      } finally {
        await this.closeSession(installation);
      }
      await stopArtifactServer();

      const rows: QualificationLinuxRowEvidence[] = [];
      for (const model of input.models) {
        for (const backend of ['cpu', 'cuda'] as const) {
          rows.push(await this.runRow(input, model, backend));
        }
      }
      const expected = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.flatMap((model) =>
        (['cpu', 'cuda'] as const).map((backend) => `${backend}|${model.family}|${model.variant}`),
      );
      if (rows.some((row, index) => rowIdentity(row, row.backend) !== expected[index])) {
        throw new Error('Qualification application rows are not in canonical order');
      }
      return Object.freeze(rows);
    } finally {
      await stopArtifactServer();
    }
  }

  private validateInput(input: ProductionApplicationQualificationInput): void {
    const modelKeys = input.models.map(({ family, variant }) => `${family}|${variant}`);
    const expectedModels = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.map(({ family, variant }) => `${family}|${variant}`);
    const exactModels = input.models.every((model, index) => {
      const expected = LOCAL_WHISPER_RELEASE_MODEL_MATRIX[index];
      return expected && expected.sizeBytes === model.sizeBytes && expected.sha256 === model.sha256;
    });
    const runtimeBackends = input.runtimes.map(({ backend }) => backend).sort();
    const directEngineBackends = input.directEngines.map(({ backend }) => backend).sort();
    if (
      process.platform !== 'linux' ||
      !input.predecessorPassed ||
      modelKeys.length !== expectedModels.length ||
      modelKeys.some((key, index) => key !== expectedModels[index]) ||
      !exactModels ||
      runtimeBackends.join('|') !== 'cpu|cuda' ||
      directEngineBackends.join('|') !== 'cpu|cuda' ||
      input.werFixtures.length === 0 ||
      input.werFixtures.some((fixture) => !fixture.referenceText) ||
      input.performanceFixtures.length !== 5 ||
      input.performanceFixtures.some(({ durationNanoseconds }) => durationNanoseconds !== 60_000_000_000) ||
      !Number.isSafeInteger(input.cpuThreads) ||
      input.cpuThreads <= 0
    ) {
      throw new Error('Qualification application input is incomplete');
    }
  }

  private async installArtifacts(
    session: ApplicationSession,
    input: ProductionApplicationQualificationInput,
  ): Promise<void> {
    const revisions = [
      ...input.runtimes.map(({ packRevision }) => ({ kind: 'runtime' as const, revision: packRevision })),
      ...input.models.map(({ artifactRevision }) => ({ kind: 'model' as const, revision: artifactRevision })),
    ];
    for (const target of revisions) await this.installArtifact(session, target.kind, target.revision);
  }

  private async installArtifact(
    session: ApplicationSession,
    kind: 'model' | 'runtime',
    revision: LocalWhisperRevisionId,
  ): Promise<void> {
    const current = session.environment.facts.snapshot.artifacts.find(
      (artifact) => artifact.kind === kind && artifact.revision === revision,
    );
    if (!current) throw new Error('Qualification catalog artifact is missing');
    if (current.state === 'Installed') return;
    if (current.state !== 'Missing' && current.state !== 'Failed' && current.state !== 'Resumable') {
      throw new Error(`Qualification artifact is not installable:${current.state}`);
    }
    const epochs = session.coordinator.snapshot.epochs;
    const commandKind = current.state === 'Missing' ? 'download' : current.state === 'Resumable' ? 'resume' : 'retry';
    const started = await session.environment.artifacts.execute({
      kind: commandKind,
      artifactKind: current.kind,
      artifactId: current.id,
      artifactRevision: current.revision,
      expectedSnapshotRevision: session.coordinator.snapshot.snapshotRevision,
      expectedConfigurationEpoch: epochs.configuration,
      expectedInventoryEpoch: epochs.inventory,
    });
    if (!started.success) throw new Error(`Qualification artifact start failed:${started.code ?? 'UNKNOWN'}`);
    await this.waitForArtifact(session.environment, current.id);
  }

  private async waitForArtifact(
    environment: DeferredLocalWhisperEnvironment,
    artifactId: (typeof environment.facts.snapshot.artifacts)[number]['id'],
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let unsubscribe = (): void => undefined;
      const timeout = setTimeout(
        () => finish(new Error('Qualification artifact installation timed out')),
        ARTIFACT_TIMEOUT_MILLISECONDS,
      );
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribe();
        if (error) reject(error);
        else resolve();
      };
      const inspect = (facts: DeferredLocalWhisperEnvironment['facts']['snapshot']): void => {
        const artifact = facts.artifacts.find(({ id }) => id === artifactId);
        const progress = facts.progress.find((entry) => entry.artifactId === artifactId);
        if (artifact?.state === 'Installed') finish();
        else if (progress?.failure) finish(new Error(`Qualification artifact failed:${progress.failure.code}`));
        else if (artifact && ['Blocked', 'Corrupt', 'Failed'].includes(artifact.state)) {
          finish(new Error(`Qualification artifact failed:${artifact.state}`));
        }
      };
      unsubscribe = environment.facts.subscribe(inspect);
      inspect(environment.facts.snapshot);
    });
  }

  private async runRow(
    input: ProductionApplicationQualificationInput,
    model: QualificationApplicationModel,
    backend: 'cpu' | 'cuda',
  ): Promise<QualificationLinuxRowEvidence> {
    const runtime = input.runtimes.find((entry) => entry.backend === backend);
    const directEngine = input.directEngines.find((entry) => entry.backend === backend);
    if (!runtime || !directEngine) throw new Error('Qualification backend input is missing');
    const observer = new QualificationWorkerResourceObserver(this.dependencies.resourceSampler);
    const initialSessionIndex = observer.count;
    const session = await this.createSession(observer);
    let primarySeries: LinuxResourceSeries;
    let applicationWer: number;
    let directWer: number;
    let medianRtf: number | null;
    try {
      await this.selectRow(session, model, runtime);
      directWer = await this.directWer(input, model, backend, directEngine);
      requireSuccess(await session.coordinator.loadNow(), 'load');
      if (observer.count !== initialSessionIndex + 1) throw new Error('Qualification load ownership is ambiguous');
      applicationWer = await this.applicationWer(session.coordinator, input.werFixtures);
      if (Math.abs(applicationWer - directWer) > WER_DELTA_LIMIT_PERCENTAGE_POINTS) {
        throw new Error('Qualification WER parity failed');
      }
      medianRtf =
        model.family === 'base' ? await this.applicationRtf(session.coordinator, input.performanceFixtures) : null;
      if (medianRtf !== null && medianRtf > MAXIMUM_BASE_RTF) throw new Error('Qualification base RTF failed');
      await this.sequentialTranscriptions(session.coordinator, input.werFixtures[0]!);
      await this.verifyCancellation(session.coordinator, input.performanceFixtures[0]!);
      await this.verifyCrashReload(session.coordinator, observer, backend, input.werFixtures[0]!);
      primarySeries = await observer.finish(initialSessionIndex, backend);
      await this.verifyProviderSwitch(session.coordinator);
      requireSuccess(await session.coordinator.loadNow(), 'providerSwitchReload');
      await session.coordinator.handleSuspend();
      await session.coordinator.handleResume();
      requireSuccess(await session.coordinator.loadNow(), 'suspendResumeReload');
      requireSuccess(await session.coordinator.unload(), 'unload');
      await this.verifyRepetitions(session.coordinator);
      requireSuccess(await session.coordinator.loadNow(), 'appExitLoad');
      requireSuccess(await session.coordinator.shutdown(), 'appExit');
    } finally {
      await this.closeSession(session);
    }
    await observer.finishFrom(initialSessionIndex + 1);
    await this.verifyOfflineRestart(input, model, runtime, observer);
    const peakRamBytes = peakRam(primarySeries.samples);
    const peakVramBytes = backend === 'cpu' ? 'notApplicable' : peakVram(primarySeries.samples);
    return Object.freeze({
      family: model.family,
      variant: model.variant,
      backend,
      status: 'Pass',
      reasonCode: 'QUALIFIED',
      applicationWerPercentage: applicationWer,
      directWerPercentage: directWer,
      peakRamBytes,
      peakVramBytes,
      medianRtf,
      gates: Object.freeze({
        load: 'Pass',
        warmup: 'Pass',
        parity: 'Pass',
        resources: 'Pass',
        cancellation: 'Pass',
        crashReload: 'Pass',
        unload: 'Pass',
        providerSwitch: 'Pass',
        suspendResume: 'Pass',
        appExit: 'Pass',
        offlineRestart: 'Pass',
        repetitions: 'Pass',
        predecessor: 'Pass',
      }),
      resourceSamples: primarySeries.samples,
    });
  }

  private async createSession(observer: QualificationWorkerResourceObserver): Promise<ApplicationSession> {
    const environment = await this.dependencies.createEnvironment(observer.onProcessLaunched);
    if (environment.facts.snapshot.catalogRevision === null) {
      await environment.dispose();
      throw new Error('Qualification production application environment is unavailable');
    }
    return Object.freeze({ environment, coordinator: new LocalWhisperCoordinator(environment.coordinator) });
  }

  private async closeSession(session: ApplicationSession): Promise<void> {
    await session.coordinator.shutdown().catch(() => undefined);
    await session.environment.dispose();
  }

  private async selectRow(
    session: ApplicationSession,
    model: QualificationApplicationModel,
    runtime: QualificationApplicationRuntime,
  ): Promise<void> {
    let deviceId = null;
    if (runtime.backend === 'cuda') {
      await session.environment.refreshDevices(session.coordinator.snapshot.epochs.configuration);
      const device = session.environment.facts.snapshot.options.find(
        (option) => option.group === 'device' && option.available,
      );
      deviceId = device ? toLocalWhisperOpaqueDeviceId(device.id) : null;
      if (!deviceId) throw new Error('Qualification CUDA device is unavailable');
    }
    const current = session.coordinator.snapshot;
    const candidate: LocalWhisperPublicSettings = {
      ...current.settings,
      runtimeRevision: runtime.packRevision,
      model: { family: model.family, revision: model.artifactRevision, variant: model.variant },
      language: 'en',
      decoding: { strategy: 'greedy', temperatureHundredths: 0 },
      execution:
        runtime.backend === 'cpu'
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
      'selectRow',
    );
  }

  private async selectLanguage(coordinator: LocalWhisperCoordinator, language: 'en' | 'ru'): Promise<void> {
    if (coordinator.snapshot.settings.language === language) return;
    const current = coordinator.snapshot;
    requireSuccess(
      await coordinator.applySettingsTransaction({
        kind: 'save',
        candidate: { ...current.settings, language },
        promptMutation: { kind: 'unchanged' },
        expectedConfigurationEpoch: current.epochs.configuration,
        expectedInventoryEpoch: current.epochs.inventory,
      }),
      'selectLanguage',
    );
  }

  private async transcribe(coordinator: LocalWhisperCoordinator, fixture: QualificationAudioFixture): Promise<string> {
    await this.selectLanguage(coordinator, fixture.language);
    const bytes = await readFile(fixture.filePath);
    const result = await coordinator.transcribe({
      dispatch: coordinator.captureDispatchSnapshot(),
      buffer: exactArrayBuffer(bytes),
      mimeType: 'audio/wav',
    });
    return requireSuccess(result, `transcribe-${fixture.id}`);
  }

  private async directWer(
    input: ProductionApplicationQualificationInput,
    model: QualificationApplicationModel,
    backend: 'cpu' | 'cuda',
    engine: QualificationDirectEngine,
  ): Promise<number> {
    const rows = [];
    for (const fixture of input.werFixtures) {
      const result = await this.dependencies.directEngine.run({
        executablePath: engine.executablePath,
        ...(engine.runtimeLibraryPath ? { runtimeLibraryPath: engine.runtimeLibraryPath } : {}),
        modelPath: model.filePath,
        modelSizeBytes: model.sizeBytes,
        modelSha256: model.sha256,
        wavPath: fixture.filePath,
        wavSizeBytes: fixture.sizeBytes,
        wavSha256: fixture.sha256,
        family: model.family,
        variant: model.variant,
        language: fixture.language,
        cpuThreads: input.cpuThreads,
        backend,
        selectedOrdinal: backend === 'cpu' ? null : 0,
      });
      rows.push({ locale: fixture.locale, reference: fixture.referenceText!, hypothesis: result.transcript });
    }
    return qualificationWerPercentage(rows);
  }

  private async applicationWer(
    coordinator: LocalWhisperCoordinator,
    fixtures: readonly QualificationAudioFixture[],
  ): Promise<number> {
    const rows = [];
    for (const fixture of fixtures) {
      rows.push({
        locale: fixture.locale,
        reference: fixture.referenceText!,
        hypothesis: await this.transcribe(coordinator, fixture),
      });
    }
    return qualificationWerPercentage(rows);
  }

  private async applicationRtf(
    coordinator: LocalWhisperCoordinator,
    fixtures: readonly QualificationAudioFixture[],
  ): Promise<number> {
    await this.transcribe(coordinator, fixtures[0]!);
    const values = [];
    for (const fixture of fixtures) {
      const started = process.hrtime.bigint();
      await this.transcribe(coordinator, fixture);
      const duration = Number(process.hrtime.bigint() - started);
      values.push(duration / fixture.durationNanoseconds);
    }
    return qualificationMedian(values);
  }

  private async sequentialTranscriptions(
    coordinator: LocalWhisperCoordinator,
    fixture: QualificationAudioFixture,
  ): Promise<void> {
    for (let index = 0; index < SEQUENTIAL_TRANSCRIPTIONS; index += 1) await this.transcribe(coordinator, fixture);
  }

  private async verifyCancellation(
    coordinator: LocalWhisperCoordinator,
    fixture: QualificationAudioFixture,
  ): Promise<void> {
    await this.selectLanguage(coordinator, fixture.language);
    const bytes = await readFile(fixture.filePath);
    const transcription = coordinator.transcribe({
      dispatch: coordinator.captureDispatchSnapshot(),
      buffer: exactArrayBuffer(bytes),
      mimeType: 'audio/wav',
    });
    await this.dependencies.wait(CANCELLATION_DELAY_MILLISECONDS);
    requireSuccess(await coordinator.cancel(), 'cancellationRequest');
    const result = await transcription;
    if (result.success || result.error.code !== 'CANCELLED') throw new Error('Qualification cancellation failed');
  }

  private async verifyCrashReload(
    coordinator: LocalWhisperCoordinator,
    observer: QualificationWorkerResourceObserver,
    backend: 'cpu' | 'cuda',
    fixture: QualificationAudioFixture,
  ): Promise<void> {
    this.dependencies.killOwnedProcess(observer.latestPid(backend));
    await this.dependencies.wait(CANCELLATION_DELAY_MILLISECONDS);
    const result = await coordinator.transcribe({
      dispatch: coordinator.captureDispatchSnapshot(),
      buffer: exactArrayBuffer(await readFile(fixture.filePath)),
      mimeType: 'audio/wav',
    });
    if (result.success || !['WORKER_CRASHED', 'TRANSCRIPTION_FAILED'].includes(result.error.code)) {
      throw new Error('Qualification crash detection failed');
    }
    requireSuccess(await coordinator.loadNow(), 'crashReload');
  }

  private async verifyProviderSwitch(coordinator: LocalWhisperCoordinator): Promise<void> {
    requireSuccess(await coordinator.prepareProviderSwitch('openai'), 'providerSwitch');
  }

  private async verifyRepetitions(coordinator: LocalWhisperCoordinator): Promise<void> {
    for (let index = 0; index < LOAD_UNLOAD_CYCLES; index += 1) {
      requireSuccess(await coordinator.loadNow(), 'repetitionLoad');
      requireSuccess(await coordinator.unload(), 'repetitionUnload');
    }
  }

  private async verifyOfflineRestart(
    input: ProductionApplicationQualificationInput,
    model: QualificationApplicationModel,
    runtime: QualificationApplicationRuntime,
    observer: QualificationWorkerResourceObserver,
  ): Promise<void> {
    const start = observer.count;
    const session = await this.createSession(observer);
    try {
      await this.selectRow(session, model, runtime);
      requireSuccess(await session.coordinator.loadNow(), 'offlineRestartLoad');
      await this.transcribe(session.coordinator, input.werFixtures[0]!);
      requireSuccess(await session.coordinator.unload(), 'offlineRestartUnload');
    } finally {
      await this.closeSession(session);
    }
    await observer.finishFrom(start);
  }

  public async verifyFixtureIdentities(fixtures: readonly QualificationAudioFixture[]): Promise<void> {
    for (const fixture of fixtures) {
      const bytes = await readFile(fixture.filePath);
      if (bytes.byteLength !== fixture.sizeBytes || (await sha256File(fixture.filePath)) !== fixture.sha256) {
        throw new Error('Qualification audio fixture identity changed');
      }
    }
  }
}
