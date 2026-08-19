import { execFile } from 'node:child_process';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import * as fs from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { availableParallelism, freemem } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

import type {
  ArtifactHttpClient,
  ArtifactHttpClientRequest,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import {
  LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
  LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
  type LocalWhisperCatalogTrustPolicy,
} from '@main/localWhisper/catalog/LocalWhisperCatalogTypes';
import {
  LOCAL_WHISPER_RELEASE_MODEL_MATRIX,
  localWhisperUpstreamModelUrl,
} from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  NvidiaSmiExecutableResolver,
  NvidiaSmiHostInventory,
} from '@main/localWhisper/capability/NvidiaSmiHostInventory';
import { NvidiaSmiVramAvailability } from '@main/localWhisper/capability/NvidiaSmiVramAvailability';
import { LocalWhisperCoordinator } from '@main/localWhisper/coordinator/LocalWhisperCoordinator';
import {
  ProductionLocalWhisperEnvironmentFactory,
  type LocalWhisperProductionEnvironmentDependencies,
} from '@main/localWhisper/composition/createProductionLocalWhisperEnvironment';
import type { DeferredLocalWhisperEnvironment } from '@main/localWhisper/ipc/createDeferredLocalWhisperEnvironment';
import {
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  serializeCanonicalLocalWhisperCatalogJson,
  toLocalWhisperArtifactId,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperFailureCode,
  type LocalWhisperPublicSettings,
  type LocalWhisperRevisionId,
} from '@shared/localWhisper';
import type { LocalWhisperQualificationLoadStage } from '@main/localWhisper/composition/LocalWhisperProductionWorkerPort';
import type { ArtifactInstallationDiagnosticStage } from '@main/localWhisper/artifacts/StreamingArtifactExtractor';
import type {
  ManagedArtifactStagingCleanupFailure,
  ManagedArtifactStagingCleanupStep,
  ManagedArtifactStagingPromotionFailure,
  ManagedArtifactStagingPromotionStep,
} from '@main/localWhisper/filesystem/ManagedArtifactStore';

import { QualificationArtifactHttpClient } from './QualificationArtifactHttpClient';
import { LocalWhisperQualificationCatalogProducer } from './QualificationCatalogProducer';
import type {
  PerformanceAttemptApplicationInput,
  PerformanceAttemptApplicationPort,
  PerformanceAttemptApplicationResult,
} from './PerformanceQualificationAttemptRunner';
import { LinuxPerformanceAttemptProbe } from './LinuxPerformanceAttemptProbe';
import {
  PERFORMANCE_ATTEMPT_DIAGNOSTIC_DESCRIPTOR,
  performanceAttemptArtifactInstallationDiagnosticFrame,
  type PerformanceAttemptDiagnosticArtifactKind,
} from './PerformanceAttemptDiagnosticProtocol';
import { PerformanceRuntimeArchiveInspector } from './PerformanceRuntimeArchiveInspector';

const execFileAsync = promisify(execFile);
const RUNTIME_ORIGIN = 'https://127.0.0.1:44391';
const RUNTIME_FILE = 'performance-runtime.tar.gz';
const SOURCE_COMMIT = 'f049fff95a089aa9969deb009cdd4892b3e74916';
const ATTEMPT_VERSION = '3.0.0';
const MAXIMUM_PRIVATE_CLEANUP_ENTRIES = 100_000;

type AttemptApplicationStage =
  | 'PROBE'
  | 'RUNTIME_ARCHIVE'
  | 'CATALOG'
  | 'PRIVATE_ROOT'
  | 'ENVIRONMENT'
  | 'RUNTIME_INSTALL'
  | 'MODEL_INSTALL'
  | 'CUDA_DEVICE'
  | 'SETTINGS'
  | 'LOAD'
  | 'SHUTDOWN'
  | 'CLEANUP';

const SAFE_LOCAL_WHISPER_FAILURE_CODE = /^[A-Z][A-Z0-9_]{2,31}$/u;
const SAFE_ATTEMPT_FAILURE_CODE = /^[A-Z][A-Z0-9_]{2,63}$/u;
const STAGING_CLEANUP_STEPS: readonly ManagedArtifactStagingCleanupStep[] = [
  'inspect',
  'validate',
  'revalidate',
  'delete',
  'confirm',
  'remove',
];
const STAGING_CLEANUP_FAILURE_CODES: readonly ManagedArtifactStagingCleanupFailure['failureCode'][] = [
  'CONFLICT',
  'IDENTITY_CHANGED',
  'INVALID_INPUT',
  'NOT_FOUND',
  'UNSAFE_ENTRY',
  'UNSUPPORTED',
  'IO_FAILED',
  'STORE',
  'UNKNOWN',
];
const STAGING_PROMOTION_DIAGNOSTIC_CODES = [
  'ACCESS_DENIED',
  'BUSY',
  'CROSS_DEVICE',
  'INVALID_RESPONSE',
  'NOT_FOUND',
  'OTHER',
  'UNSUPPORTED',
] as const;
const STAGING_PROMOTION_STEPS: readonly ManagedArtifactStagingPromotionStep[] = ['inspect', 'validate', 'promote'];

class AttemptApplicationFailure extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'AttemptApplicationFailure';
  }
}

async function atAttemptApplicationStage<T>(stage: AttemptApplicationStage, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AttemptApplicationFailure) throw error;
    if (error instanceof Error && SAFE_ATTEMPT_FAILURE_CODE.test(error.message)) {
      throw new AttemptApplicationFailure(error.message);
    }
    throw new AttemptApplicationFailure(`ATTEMPT_APPLICATION_${stage}_FAILED`);
  }
}

class RejectingArtifactHttpClient implements ArtifactHttpClient {
  public async open(_request: ArtifactHttpClientRequest): Promise<never> {
    throw new Error('ATTEMPT_NETWORK_ACCESS_REJECTED');
  }
}

function digest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Emits only fixed qualification state to the private parent and never lets logging affect an attempt. */
function publishArtifactInstallationDiagnostic(
  artifactKind: PerformanceAttemptDiagnosticArtifactKind,
  stage: ArtifactInstallationDiagnosticStage,
): void {
  try {
    fs.writeSync(
      PERFORMANCE_ATTEMPT_DIAGNOSTIC_DESCRIPTOR,
      performanceAttemptArtifactInstallationDiagnosticFrame({ artifactKind, stage }),
    );
  } catch {
    // The isolated runner may be invoked without its optional private diagnostic pipe.
  }
}

function diagnosticStageForLoadStage(stage: LocalWhisperQualificationLoadStage): ArtifactInstallationDiagnosticStage {
  switch (stage) {
    case 'MODEL_AUTHORITY':
      return 'modelAuthorityStarted';
    case 'RUNTIME_AUTHORITY':
      return 'runtimeAuthorityStarted';
    case 'WORKER_START':
      return 'workerStartRequested';
    case 'WARMUP':
      return 'warmupStarted';
    case 'AUTHORITY_REVALIDATION':
      return 'authorityRevalidationStarted';
  }
}

function diagnosticStageForLaunchAcknowledgment(
  outcome: Parameters<LinuxPerformanceAttemptProbe['recordNativeLaunchAcknowledgment']>[0],
): ArtifactInstallationDiagnosticStage {
  switch (outcome) {
    case 'ready':
      return 'nativeLaunchReady';
    case 'rejected':
      return 'nativeLaunchRejected';
    case 'closed':
      return 'nativeLaunchClosed';
    case 'malformed':
      return 'nativeLaunchMalformed';
    case 'error':
      return 'nativeLaunchError';
    case 'exited':
      return 'nativeLaunchExited';
    case 'timeout':
      return 'nativeLaunchTimeout';
  }
}

async function removeAttemptPrivateRoot(privateRoot: string): Promise<void> {
  let entries = 0;
  const makeWritable = async (candidate: string): Promise<void> => {
    entries += 1;
    if (entries > MAXIMUM_PRIVATE_CLEANUP_ENTRIES) throw new Error('ATTEMPT_PRIVATE_CLEANUP_FAILED');
    const metadata = await lstat(candidate);
    if (metadata.isSymbolicLink()) return;
    if (metadata.isDirectory()) {
      await chmod(candidate, 0o700);
      for (const name of await readdir(candidate)) await makeWritable(path.join(candidate, name));
      return;
    }
    if (!metadata.isFile()) throw new Error('ATTEMPT_PRIVATE_CLEANUP_FAILED');
    await chmod(candidate, 0o600);
  };
  await makeWritable(privateRoot);
  await rm(privateRoot, { force: true, recursive: true });
}

function runtimeRevision(backend: 'cpu' | 'cuda'): LocalWhisperRevisionId {
  const value = toLocalWhisperRevisionId(
    backend === 'cpu' ? 'whisper-cpp-linux-x64-cpu-baseline-v1' : 'whisper-cpp-linux-x64-cuda-12.8.1-sm120a-v1',
  );
  if (!value) throw new Error('ATTEMPT_RUNTIME_IDENTITY_INVALID');
  return value;
}

function modelRevision(family: string, variant: string): LocalWhisperRevisionId {
  const value = toLocalWhisperRevisionId(`whisper-cpp-${family}-${variant}-v1`);
  if (!value) throw new Error('ATTEMPT_MODEL_IDENTITY_INVALID');
  return value;
}

function requireSuccess<T>(
  result: { readonly success: true; readonly value: T } | { readonly success: false; readonly error: { code: string } },
  failureCodePrefix: string,
): T {
  if (!result.success) {
    const code = result.error.code;
    const failureCode = `${failureCodePrefix}_${code}`;
    if (!SAFE_LOCAL_WHISPER_FAILURE_CODE.test(code) || !SAFE_ATTEMPT_FAILURE_CODE.test(failureCode)) {
      throw new AttemptApplicationFailure('ATTEMPT_APPLICATION_RESULT_INVALID');
    }
    throw new AttemptApplicationFailure(failureCode);
  }
  return result.value;
}

interface PerformanceArtifactOperationCompletion {
  readonly failureCode: LocalWhisperFailureCode | null;
  readonly operationId: string;
  readonly success: boolean;
}

/** Records one safe terminal artifact outcome for one private qualification attempt. */
class PerformanceArtifactOperationTracker {
  private readonly completed = new Map<string, PerformanceArtifactOperationCompletion>();
  private readonly waiters = new Map<string, (completion: PerformanceArtifactOperationCompletion) => void>();

  public record(completion: PerformanceArtifactOperationCompletion): void {
    if (
      !/^[\w-]{1,128}$/u.test(completion.operationId) ||
      (!completion.success &&
        (completion.failureCode === null || !SAFE_LOCAL_WHISPER_FAILURE_CODE.test(completion.failureCode)))
    ) {
      throw new AttemptApplicationFailure('ATTEMPT_ARTIFACT_COMPLETION_INVALID');
    }
    const normalized = Object.freeze({
      failureCode: completion.success ? null : completion.failureCode,
      operationId: completion.operationId,
      success: completion.success,
    });
    if (this.completed.has(normalized.operationId)) return;
    this.completed.set(normalized.operationId, normalized);
    const waiter = this.waiters.get(normalized.operationId);
    if (waiter) {
      this.waiters.delete(normalized.operationId);
      waiter(normalized);
    }
  }

  public async waitFor(operationId: string): Promise<void> {
    if (!/^[\w-]{1,128}$/u.test(operationId)) {
      throw new AttemptApplicationFailure('ATTEMPT_ARTIFACT_COMPLETION_INVALID');
    }
    const completion = this.completed.get(operationId) ?? (await this.awaitCompletion(operationId));
    if (completion.success) return;
    const failureCode = completion.failureCode;
    if (!failureCode || !SAFE_ATTEMPT_FAILURE_CODE.test(`ATTEMPT_ARTIFACT_${failureCode}`)) {
      throw new AttemptApplicationFailure('ATTEMPT_ARTIFACT_INSTALL_FAILED');
    }
    throw new AttemptApplicationFailure(`ATTEMPT_ARTIFACT_${failureCode}`);
  }

  private async awaitCompletion(operationId: string): Promise<PerformanceArtifactOperationCompletion> {
    return await new Promise<PerformanceArtifactOperationCompletion>((resolve) => {
      this.waiters.set(operationId, resolve);
      const completed = this.completed.get(operationId);
      if (completed) {
        this.waiters.delete(operationId);
        resolve(completed);
      }
    });
  }
}

async function installArtifact(
  environment: DeferredLocalWhisperEnvironment,
  coordinator: LocalWhisperCoordinator,
  kind: 'model' | 'runtime',
  revision: LocalWhisperRevisionId,
  tracker: PerformanceArtifactOperationTracker,
  primaryFailureCode?: () => string | null,
  stagingCleanupStep?: () => string | null,
  stagingCleanupFailure?: () => ManagedArtifactStagingCleanupFailure | null,
  stagingPromotionFailure?: () => ManagedArtifactStagingPromotionFailure | null,
): Promise<void> {
  const current = environment.facts.snapshot.artifacts.find(
    (artifact) => artifact.kind === kind && artifact.revision === revision,
  );
  if (!current || !['Missing', 'Failed', 'Resumable'].includes(current.state)) {
    throw new Error('ATTEMPT_ARTIFACT_STATE_INVALID');
  }
  const epochs = coordinator.snapshot.epochs;
  const started = await environment.artifacts.execute({
    kind: current.state === 'Missing' ? 'download' : current.state === 'Resumable' ? 'resume' : 'retry',
    artifactKind: current.kind,
    artifactId: current.id,
    artifactRevision: current.revision,
    expectedSnapshotRevision: coordinator.snapshot.snapshotRevision,
    expectedConfigurationEpoch: epochs.configuration,
    expectedInventoryEpoch: epochs.inventory,
  });
  if (!started.success || !started.operationId) throw new Error('ATTEMPT_ARTIFACT_START_FAILED');
  try {
    await tracker.waitFor(started.operationId);
  } catch (error) {
    const sourceCode =
      error instanceof Error && SAFE_ATTEMPT_FAILURE_CODE.test(error.message)
        ? error.message
        : 'ATTEMPT_ARTIFACT_INSTALL_FAILED';
    const primaryCode = primaryFailureCode?.();
    const cleanupStep = stagingCleanupStep?.();
    const cleanupFailure = stagingCleanupFailure?.();
    const promotionFailure = stagingPromotionFailure?.();
    const isSafeCleanupFailure =
      cleanupFailure !== null &&
      cleanupFailure !== undefined &&
      STAGING_CLEANUP_STEPS.includes(cleanupFailure.step) &&
      STAGING_CLEANUP_FAILURE_CODES.includes(cleanupFailure.failureCode);
    const isSafePromotionFailure =
      promotionFailure !== null &&
      promotionFailure !== undefined &&
      STAGING_CLEANUP_FAILURE_CODES.includes(promotionFailure.failureCode);
    const promotionDiagnosticCode = promotionFailure?.promotionDiagnosticCode;
    const promotionStep = promotionFailure?.step;
    const isSafePromotionStep = promotionStep !== undefined && STAGING_PROMOTION_STEPS.includes(promotionStep);
    const isSafePromotionDiagnostic =
      promotionDiagnosticCode !== undefined && STAGING_PROMOTION_DIAGNOSTIC_CODES.includes(promotionDiagnosticCode);
    const artifactTransferFailure =
      sourceCode === 'ATTEMPT_ARTIFACT_CLEANUP_FAILED' || sourceCode === 'ATTEMPT_ARTIFACT_INSTALL_FAILED';
    const failureCode =
      artifactTransferFailure &&
      primaryCode !== null &&
      primaryCode !== undefined &&
      SAFE_LOCAL_WHISPER_FAILURE_CODE.test(primaryCode)
        ? primaryCode === 'CLEANUP_FAILED' &&
          cleanupStep !== null &&
          cleanupStep !== undefined &&
          /^[A-Z]+$/u.test(cleanupStep)
          ? isSafePromotionFailure
            ? isSafePromotionStep
              ? isSafePromotionDiagnostic
                ? `ATTEMPT_${kind.toUpperCase()}_STAGING_${promotionStep.toUpperCase()}_${promotionDiagnosticCode}_FAILED`
                : `ATTEMPT_${kind.toUpperCase()}_STAGING_${promotionStep.toUpperCase()}_${promotionFailure.failureCode}_FAILED`
              : `ATTEMPT_${kind.toUpperCase()}_STAGING_PROMOTE_${promotionFailure.failureCode}_FAILED`
            : isSafeCleanupFailure
              ? `ATTEMPT_${kind.toUpperCase()}_STAGING_${cleanupFailure.step.toUpperCase()}_${cleanupFailure.failureCode}_FAILED`
              : `ATTEMPT_${kind.toUpperCase()}_STAGING_${cleanupStep}_FAILED`
          : `ATTEMPT_${kind.toUpperCase()}_ARTIFACT_PRIMARY_${primaryCode}`
        : `ATTEMPT_${kind.toUpperCase()}_${sourceCode.slice('ATTEMPT_'.length)}`;
    if (SAFE_ATTEMPT_FAILURE_CODE.test(failureCode)) throw new AttemptApplicationFailure(failureCode);
    throw new AttemptApplicationFailure('ATTEMPT_ARTIFACT_INSTALL_FAILED');
  }
}

interface AttemptCatalog {
  readonly document: Buffer;
  readonly policy: LocalWhisperCatalogTrustPolicy;
  readonly runtimeRevision: LocalWhisperRevisionId;
  readonly modelRevision: LocalWhisperRevisionId;
  readonly artifactHttpClient: ArtifactHttpClient;
}

export interface PerformanceAttemptCatalogAuthority {
  readonly document: Buffer;
  readonly policy: LocalWhisperCatalogTrustPolicy;
  readonly runtimeRevision: LocalWhisperRevisionId;
  readonly modelRevision: LocalWhisperRevisionId;
  readonly modelSourceUrl: string;
}

/** Creates the signed catalog and matching runtime authority for a single performance attempt. */
export function createPerformanceAttemptCatalogAuthority(
  input: PerformanceAttemptApplicationInput,
  archive: Awaited<ReturnType<PerformanceRuntimeArchiveInspector['inspect']>>,
): PerformanceAttemptCatalogAuthority {
  const expectedProfile =
    input.request.backend === 'cpu' ? 'linux-x64-cpu-baseline-v1' : 'linux-x64-cuda-12.8.1-sm120a-v1';
  if (archive.profileId !== expectedProfile) throw new Error('ATTEMPT_RUNTIME_IDENTITY_INVALID');
  const selectedModel = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.find(
    ({ family, variant, sha256 }) =>
      family === input.request.model.family &&
      variant === input.request.model.variant &&
      sha256 === input.request.model.sha256,
  );
  if (!selectedModel || selectedModel.sizeBytes !== input.artifacts.model.sizeBytes) {
    throw new Error('ATTEMPT_MODEL_IDENTITY_INVALID');
  }
  const keyPair = generateKeyPairSync('ed25519');
  const privatePem = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicPem = keyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const keyIdText = `performance-${digest(publicPem).slice(0, 24)}`;
  const keyId = toLocalWhisperArtifactId(keyIdText);
  const originId = toLocalWhisperArtifactId('qualification-runtime-origin');
  const appRevision = toLocalWhisperRevisionId(`app-v${ATTEMPT_VERSION}`);
  if (!keyId || !originId || !appRevision) throw new Error('ATTEMPT_CATALOG_IDENTITY_INVALID');
  const archiveSignature = sign(null, Buffer.from(input.artifacts.runtime.sha256, 'hex'), privatePem).toString(
    'base64',
  );
  const runtimeSeeds = (['cpu', 'cuda'] as const).map((backend) => ({
    backend,
    platform: 'linux' as const,
    architecture: 'x64' as const,
    archiveFileName: RUNTIME_FILE,
    archiveSizeBytes: input.artifacts.runtime.sizeBytes,
    archiveSha256: input.artifacts.runtime.sha256,
    archiveSignature,
    buildRevision: archive.runtimeBuildDigest,
    packRevision: runtimeRevision(backend),
    expectedFiles: archive.expectedFiles,
    prerequisites: backend === 'cpu' ? ['glibc-2.31'] : ['nvidia-driver-r570', 'cuda-runtime-12.8.1'],
    provenanceId: `qualification-${backend}-runtime-provenance`,
    sbomRevision: `qualification-${backend}-runtime-sbom-v1`,
    noticeIds: [`qualification-${backend}-runtime-notice`],
    licenseIds: ['mit-license'],
  }));
  const payload = new LocalWhisperQualificationCatalogProducer().produce({
    platform: 'linux',
    candidateSemVer: ATTEMPT_VERSION,
    catalogRevision: 'performance-catalog-v3',
    qualificationKeyId: keyIdText,
    runtimeOriginId: 'qualification-runtime-origin',
    runtimeOrigin: RUNTIME_ORIGIN,
    sourceCommit: SOURCE_COMMIT,
    runtimes: runtimeSeeds,
    qualificationStatus: 'planned',
    executionMode: 'representativeQualification',
    workerProtocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  });
  const payloadBytes = Buffer.from(serializeCanonicalLocalWhisperCatalogJson(payload), 'utf8');
  const document = Buffer.from(
    serializeCanonicalLocalWhisperCatalogJson({
      schemaVersion: LOCAL_WHISPER_CATALOG_ENVELOPE_SCHEMA_VERSION,
      algorithm: LOCAL_WHISPER_CATALOG_SIGNATURE_ALGORITHM,
      keyId: keyIdText,
      payloadBase64: payloadBytes.toString('base64'),
      signatureBase64: sign(null, payloadBytes, privatePem).toString('base64'),
    }),
    'utf8',
  );
  const policy: LocalWhisperCatalogTrustPolicy = Object.freeze({
    purpose: 'qualification',
    publicKeys: Object.freeze([Object.freeze({ keyId, publicKeyPem: publicPem })]),
    origins: Object.freeze([
      Object.freeze({ id: originId, origin: RUNTIME_ORIGIN }),
      Object.freeze({
        id: toLocalWhisperArtifactId('public-hugging-face-model-origin')!,
        origin: 'https://huggingface.co',
      }),
    ]),
    appRevision,
    workerProtocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  });
  return Object.freeze({
    document,
    policy,
    runtimeRevision: runtimeRevision(input.request.backend),
    modelRevision: modelRevision(selectedModel.family, selectedModel.variant),
    modelSourceUrl: localWhisperUpstreamModelUrl(selectedModel.file),
  });
}

async function attemptCatalog(
  input: PerformanceAttemptApplicationInput,
  archive: Awaited<ReturnType<PerformanceRuntimeArchiveInspector['inspect']>>,
): Promise<AttemptCatalog> {
  const authority = createPerformanceAttemptCatalogAuthority(input, archive);
  const artifactHttpClient = await QualificationArtifactHttpClient.create(
    [
      {
        url: `${RUNTIME_ORIGIN}/runtime/${RUNTIME_FILE}`,
        filePath: input.artifacts.runtime.absolutePath,
        sizeBytes: input.artifacts.runtime.sizeBytes,
        sha256: input.artifacts.runtime.sha256,
      },
      {
        url: authority.modelSourceUrl,
        filePath: input.artifacts.model.absolutePath,
        sizeBytes: input.artifacts.model.sizeBytes,
        sha256: input.artifacts.model.sha256,
      },
    ],
    new RejectingArtifactHttpClient(),
  );
  return Object.freeze({
    document: authority.document,
    policy: authority.policy,
    runtimeRevision: authority.runtimeRevision,
    modelRevision: authority.modelRevision,
    artifactHttpClient,
  });
}

async function nvidiaCommand(executablePath: string, arguments_: readonly string[]): Promise<string> {
  const result = await execFileAsync(executablePath, [...arguments_], {
    encoding: 'utf8',
    env: { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
    maxBuffer: 16 * 1024,
    timeout: 10_000,
    windowsHide: true,
  });
  return result.stdout;
}

/** Drives one real qualification-purpose production install/load/warm-up graph. */
export class LinuxPerformanceAttemptApplication implements PerformanceAttemptApplicationPort {
  public async run(input: PerformanceAttemptApplicationInput): Promise<PerformanceAttemptApplicationResult> {
    if (process.platform !== 'linux' || input.request.platform !== 'linux') {
      throw new Error('ATTEMPT_PLATFORM_INVALID');
    }
    const probe = new LinuxPerformanceAttemptProbe(input.request.backend, input.publishEvent, (stage) =>
      publishArtifactInstallationDiagnostic('model', stage),
    );
    let loadStage: LocalWhisperQualificationLoadStage = 'MODEL_AUTHORITY';
    await atAttemptApplicationStage('PROBE', async () => await probe.registerMain());
    const archive = await atAttemptApplicationStage(
      'RUNTIME_ARCHIVE',
      async () => await new PerformanceRuntimeArchiveInspector().inspect(input.artifacts.runtime.absolutePath),
    );
    const catalog = await atAttemptApplicationStage('CATALOG', async () => await attemptCatalog(input, archive));
    const privateRoot = await atAttemptApplicationStage(
      'PRIVATE_ROOT',
      async () => await mkdtemp(path.join(path.dirname(process.execPath), '.attempt-')),
    );
    const resolvedPrivateRoot = path.resolve(privateRoot);
    const privatePrefix = `${path.dirname(process.execPath)}${path.sep}.attempt-`;
    if (!resolvedPrivateRoot.startsWith(privatePrefix)) {
      await atAttemptApplicationStage('CLEANUP', async () => await rm(privateRoot, { force: true, recursive: true }));
      throw new Error('ATTEMPT_PRIVATE_ROOT_INVALID');
    }
    let environment: DeferredLocalWhisperEnvironment | null = null;
    let coordinator: LocalWhisperCoordinator | null = null;
    try {
      const { configurationRoot, homeRoot, dataRoot } = await atAttemptApplicationStage('PRIVATE_ROOT', async () => {
        await fs.promises.chmod(privateRoot, 0o700);
        const configurationRoot = path.join(privateRoot, 'config');
        const homeRoot = path.join(privateRoot, 'home');
        const dataRoot = path.join(privateRoot, 'data');
        await Promise.all(
          [configurationRoot, homeRoot, dataRoot].map(async (directory) => {
            await mkdir(directory, { recursive: true, mode: 0o700 });
            await fs.promises.chmod(directory, 0o700);
          }),
        );
        return Object.freeze({ configurationRoot, homeRoot, dataRoot });
      });
      const command = { run: nvidiaCommand };
      const inventory = new NvidiaSmiHostInventory({
        platform: 'linux',
        environment: process.env,
        pathExists: fs.existsSync,
        command,
      });
      const vram = new NvidiaSmiVramAvailability(
        command,
        new NvidiaSmiExecutableResolver({
          platform: 'linux',
          environment: process.env,
          pathExists: fs.existsSync,
        }),
      );
      let sequence = 0;
      let artifactPrimaryFailure: string | null = null;
      let artifactInstallationKind: PerformanceAttemptDiagnosticArtifactKind | null = null;
      let stagingCleanupStep: string | null = null;
      let stagingCleanupFailure: ManagedArtifactStagingCleanupFailure | null = null;
      let stagingPromotionFailure: ManagedArtifactStagingPromotionFailure | null = null;
      const artifactOperationTracker = new PerformanceArtifactOperationTracker();
      const started = process.hrtime.bigint();
      const qualificationHooks = {
        artifactHttpClient: catalog.artifactHttpClient,
        onArtifactTransferFailure: ({ primaryCode }: { readonly primaryCode: string }) => {
          artifactPrimaryFailure = primaryCode;
        },
        onArtifactInstallationStage: (stage: ArtifactInstallationDiagnosticStage) => {
          publishArtifactInstallationDiagnostic(artifactInstallationKind ?? 'model', stage);
        },
        onArtifactOperationCompleted: (event: PerformanceArtifactOperationCompletion) => {
          if (artifactInstallationKind) {
            publishArtifactInstallationDiagnostic(artifactInstallationKind, 'operationCompletionObserved');
          }
          artifactOperationTracker.record(event);
          if (artifactInstallationKind) {
            publishArtifactInstallationDiagnostic(artifactInstallationKind, 'operationCompletionRecorded');
          }
        },
        onStagingCleanupStep: (step: 'inspect' | 'validate' | 'revalidate' | 'delete' | 'confirm' | 'remove') => {
          stagingCleanupStep = step.toUpperCase();
        },
        onStagingCleanupFailure: (failure: ManagedArtifactStagingCleanupFailure) => {
          if (
            STAGING_CLEANUP_STEPS.includes(failure.step) &&
            STAGING_CLEANUP_FAILURE_CODES.includes(failure.failureCode)
          ) {
            stagingCleanupFailure = Object.freeze({
              failureCode: failure.failureCode,
              step: failure.step,
            });
          }
        },
        onStagingPromotionFailure: (failure: ManagedArtifactStagingPromotionFailure) => {
          if (
            STAGING_CLEANUP_FAILURE_CODES.includes(failure.failureCode) &&
            STAGING_PROMOTION_STEPS.includes(failure.step)
          ) {
            stagingPromotionFailure = Object.freeze({
              failureCode: failure.failureCode,
              step: failure.step,
              ...(failure.promotionDiagnosticCode &&
              STAGING_PROMOTION_DIAGNOSTIC_CODES.includes(failure.promotionDiagnosticCode)
                ? { promotionDiagnosticCode: failure.promotionDiagnosticCode }
                : {}),
            });
          }
        },
        onNativeLauncherAcknowledgment: (outcome) => {
          probe.recordNativeLaunchAcknowledgment(outcome);
          publishArtifactInstallationDiagnostic('model', diagnosticStageForLaunchAcknowledgment(outcome));
        },
        onSessionProcessLaunched: (
          event: Parameters<
            NonNullable<
              NonNullable<
                LocalWhisperProductionEnvironmentDependencies['qualificationHooks']
              >['onSessionProcessLaunched']
            >
          >[0],
        ) => {
          if (event.backend !== input.request.backend || event.launchMode !== 'fullLoad') {
            throw new Error('ATTEMPT_PROCESS_ROLE_INVALID');
          }
          publishArtifactInstallationDiagnostic('model', 'sessionProcessLaunched');
          void probe.registerGuard(event.pid);
        },
        onLoadStage: (stage: LocalWhisperQualificationLoadStage) => {
          loadStage = stage;
          publishArtifactInstallationDiagnostic('model', diagnosticStageForLoadStage(stage));
        },
      };
      environment = await atAttemptApplicationStage(
        'ENVIRONMENT',
        async () =>
          await new ProductionLocalWhisperEnvironmentFactory(
            {
              appRevision: String(catalog.policy.appRevision),
              architecture: 'x64',
              availableMemoryBytes: freemem,
              availableVramBytes: (identity) => vram.availableBytes(identity),
              configurationRoot,
              environment: Object.freeze({
                HOME: homeRoot,
                XDG_DATA_HOME: dataRoot,
                LANG: 'C.UTF-8',
                LC_ALL: 'C.UTF-8',
                PATH: '/usr/bin:/bin',
              }),
              fileSystem: {
                chmodSync: fs.chmodSync,
                existsSync: fs.existsSync,
                mkdirSync: fs.mkdirSync,
                readFileSync: fs.readFileSync,
                renameSync: fs.renameSync,
                rmSync: fs.rmSync,
                unlinkSync: fs.unlinkSync,
                writeFileSync: fs.writeFileSync,
              },
              homeDirectory: () => homeRoot,
              logicalProcessorCount: availableParallelism(),
              nextRequestId: () => `performance-attempt-${++sequence}`,
              now: Date.now,
              openPath: () => Promise.resolve(''),
              pid: process.pid,
              platform: 'linux',
              qualificationHooks,
              randomNonce: () => randomBytes(24).toString('base64url'),
              randomBytes: (size) => randomBytes(size),
              readNvidiaInventory: () => inventory.read(),
              readFile: async (filePath) => await readFile(filePath),
              resourcesPath: path.join(path.dirname(process.execPath), 'resources'),
              spawnProcess: probe.instrumentedSpawn(),
            },
            { activationPurpose: 'qualification', document: catalog.document, trustPolicy: catalog.policy },
          ).create(),
      );
      if (environment.facts.snapshot.catalogRevision === null) throw new Error('ATTEMPT_ENVIRONMENT_UNAVAILABLE');
      coordinator = new LocalWhisperCoordinator(environment.coordinator);
      artifactPrimaryFailure = null;
      stagingCleanupStep = null;
      stagingCleanupFailure = null;
      stagingPromotionFailure = null;
      artifactInstallationKind = 'runtime';
      try {
        await atAttemptApplicationStage(
          'RUNTIME_INSTALL',
          async () =>
            await installArtifact(
              environment,
              coordinator,
              'runtime',
              catalog.runtimeRevision,
              artifactOperationTracker,
              () => artifactPrimaryFailure,
              () => stagingCleanupStep,
              () => stagingCleanupFailure,
              () => stagingPromotionFailure,
            ),
        );
        publishArtifactInstallationDiagnostic('runtime', 'operationCompletionAwaited');
      } finally {
        artifactInstallationKind = null;
      }
      artifactPrimaryFailure = null;
      stagingCleanupStep = null;
      stagingCleanupFailure = null;
      stagingPromotionFailure = null;
      artifactInstallationKind = 'model';
      try {
        await atAttemptApplicationStage(
          'MODEL_INSTALL',
          async () =>
            await installArtifact(
              environment,
              coordinator,
              'model',
              catalog.modelRevision,
              artifactOperationTracker,
              () => artifactPrimaryFailure,
              () => stagingCleanupStep,
              () => stagingCleanupFailure,
              () => stagingPromotionFailure,
            ),
        );
        publishArtifactInstallationDiagnostic('model', 'operationCompletionAwaited');
      } finally {
        artifactInstallationKind = null;
      }
      let deviceId = null;
      if (input.request.backend === 'cuda') {
        deviceId = await atAttemptApplicationStage('CUDA_DEVICE', async () => {
          await environment.refreshDevices(coordinator.snapshot.epochs.configuration);
          const device = environment.facts.snapshot.options.find(
            (option) => option.group === 'device' && option.available,
          );
          const deviceId = device ? toLocalWhisperOpaqueDeviceId(device.id) : null;
          if (!deviceId) throw new Error('ATTEMPT_CUDA_DEVICE_UNAVAILABLE');
          return deviceId;
        });
      }
      const current = coordinator.snapshot;
      const gpuExecution =
        input.request.side === 'before'
          ? { target: 'gpu', backend: 'cuda', deviceId, cpuThreads: LOCAL_WHISPER_AUTO_CPU_THREADS }
          : { target: 'gpu', backend: 'cuda', deviceId, gpuCpuThreads: LOCAL_WHISPER_AUTO_CPU_THREADS };
      const candidate = {
        ...current.settings,
        runtimeRevision: catalog.runtimeRevision,
        model: {
          family: input.request.model.family,
          revision: catalog.modelRevision,
          variant: input.request.model.variant,
        },
        language: 'en',
        decoding: { strategy: 'greedy', temperatureHundredths: 0 },
        execution:
          input.request.backend === 'cpu' ? { target: 'cpu', backend: 'cpu', cpuThreads: 'auto' } : gpuExecution,
      } as unknown as LocalWhisperPublicSettings;
      publishArtifactInstallationDiagnostic('model', 'settingsApplyStarted');
      await atAttemptApplicationStage('SETTINGS', async () => {
        requireSuccess(
          await coordinator.applySettingsTransaction({
            kind: 'save',
            candidate,
            promptMutation: { kind: 'clear' },
            expectedConfigurationEpoch: current.epochs.configuration,
            expectedInventoryEpoch: current.epochs.inventory,
          }),
          'ATTEMPT_SETTINGS',
        );
      });
      publishArtifactInstallationDiagnostic('model', 'settingsApplied');
      await atAttemptApplicationStage('LOAD', async () => {
        publishArtifactInstallationDiagnostic('model', 'loadRequested');
        probe.beginLoadProofs();
        const result = await coordinator.loadNow();
        if (!result.success) {
          publishArtifactInstallationDiagnostic('model', 'nativeDiagnosticsFlushStarted');
          const nativeDiagnostics = await probe.flushNativeDiagnostics();
          publishArtifactInstallationDiagnostic(
            'model',
            nativeDiagnostics === 'settled' ? 'nativeDiagnosticsFlushCompleted' : 'nativeDiagnosticsFlushTimedOut',
          );
        }
        if (!result.success && result.error.code === 'WORKER_START_FAILED') {
          throw new AttemptApplicationFailure(
            `ATTEMPT_LOAD_ACK_${probe.nativeLaunchAcknowledgmentState.toUpperCase()}_${probe.nativeLaunchDiagnostic.toUpperCase()}`,
          );
        }
        if (!result.success && result.error.code === 'WORKER_CRASHED') {
          throw new AttemptApplicationFailure(
            `ATTEMPT_LOAD_WORKER_CRASHED_${probe.nativeLaunchAcknowledgmentState.toUpperCase()}_${probe.nativeLaunchDiagnostic.toUpperCase()}_${probe.nativeWorkerExecution.toUpperCase()}_${probe.nativeWorkerDiagnostic.toUpperCase()}`,
          );
        }
        requireSuccess(result, `ATTEMPT_LOAD_${loadStage}`);
      });
      const endToEndNanoseconds = Number(process.hrtime.bigint() - started);
      if (!Number.isSafeInteger(endToEndNanoseconds) || endToEndNanoseconds < 1) {
        throw new Error('ATTEMPT_DURATION_INVALID');
      }
      await atAttemptApplicationStage('SHUTDOWN', async () => {
        await coordinator.shutdown();
        await environment.dispose();
      });
      coordinator = null;
      environment = null;
      await atAttemptApplicationStage('PROBE', async () => await probe.finish());
      return Object.freeze({ endToEndNanoseconds });
    } finally {
      await coordinator?.shutdown().catch(() => undefined);
      await environment?.dispose().catch(() => undefined);
      await atAttemptApplicationStage('CLEANUP', async () => await removeAttemptPrivateRoot(resolvedPrivateRoot));
    }
  }
}
