import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, readdir, realpath, rm } from 'node:fs/promises';
import * as path from 'node:path';

import {
  LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST,
  LocalWhisperQualificationValidator,
  qualificationCanonicalJson,
} from './QualificationContracts';
import {
  LocalWhisperPerformanceDocumentProducer,
  performanceSelectedModels,
  type PerformanceBackend,
  type PerformanceDerivedSourceReceipt,
  type PerformanceModelIdentity,
  type PerformancePrivateArtifact,
  type PerformanceQualificationRunPlan,
  type PerformanceSide,
} from './PerformanceQualification';
import { FocusedPerformanceDocumentProducer, type FocusedPerformanceRunPlan } from './FocusedPerformanceQualification';
import type {
  PerformanceDerivedSourceAuthority,
  PerformanceDerivedSourceProducer,
} from './PerformanceDerivedSourceProducer';
import type {
  FocusedLinuxPerformancePrivateInputPreflight,
  FocusedLinuxPerformancePrivateInputProof,
  LinuxPerformancePrivateInputPreflight,
  LinuxPerformancePrivateInputProof,
} from './LinuxPerformancePrivateInputs';
import type {
  PerformanceQualificationOverlayProducer,
  ReviewedPerformanceQualificationOverlay,
} from './PerformanceQualificationOverlay';
import type { QualificationSourceBaselineEvidence } from './QualificationSourceBaseline';

const COPY_BUFFER_BYTES = 1024 * 1024;
const MAXIMUM_COPY_BYTES = 8 * 1024 ** 3;
const ATTEMPT_TIMEOUT_MINIMUM = 1000;
const ATTEMPT_TIMEOUT_MAXIMUM = 3_600_000;
const MAXIMUM_CLEANUP_ENTRIES = 500_000;

export interface PerformanceAttemptBuildInput {
  readonly authority: PerformanceDerivedSourceAuthority;
  readonly side: PerformanceSide;
  readonly signal?: AbortSignal;
}

export interface PerformanceAttemptBuildResult {
  readonly executableRelativePath: string;
  readonly runtimeArtifacts: Readonly<
    Record<
      PerformanceBackend,
      Readonly<{ readonly relativePath: string; readonly sizeBytes: number; readonly sha256: string }>
    >
  >;
}

export interface PerformanceAttemptBuildPort {
  build(input: PerformanceAttemptBuildInput): Promise<PerformanceAttemptBuildResult>;
}

export interface LinuxPerformanceRunPlanOutput {
  readonly plans: Readonly<Record<PerformanceBackend, PerformanceQualificationRunPlan>>;
  readonly overlaySha256: string;
  readonly overlayManifestSha256: string;
}

export interface FocusedLinuxPerformanceRunPlanOutput {
  readonly plans: Readonly<Record<PerformanceBackend, FocusedPerformanceRunPlan>>;
  readonly overlaySha256: string;
  readonly overlayManifestSha256: string;
}

export class LinuxPerformanceRunPlanError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'LinuxPerformanceRunPlanError';
  }
}

function fail(code: string): never {
  throw new LinuxPerformanceRunPlanError(code);
}

function relativeToPrivateParent(privateParent: string, absolutePath: string): string {
  const relative = path.relative(privateParent, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail('PERFORMANCE_PLAN_PATH_INVALID');
  return relative.split(path.sep).join('/');
}

export interface PerformanceRunPlanArtifactCopyInput {
  readonly sourcePath: string;
  readonly expectedSizeBytes: number;
  readonly expectedSha256: string;
  readonly destinationPath: string;
  readonly signal?: AbortSignal;
}

async function copyAuthenticatedFile(
  input: Readonly<PerformanceRunPlanArtifactCopyInput>,
): Promise<PerformancePrivateArtifact> {
  if (
    !Number.isSafeInteger(input.expectedSizeBytes) ||
    input.expectedSizeBytes < 1 ||
    input.expectedSizeBytes > MAXIMUM_COPY_BYTES ||
    !/^[a-f0-9]{64}$/u.test(input.expectedSha256)
  ) {
    fail('PERFORMANCE_PLAN_ARTIFACT_INVALID');
  }
  if (input.signal?.aborted) fail('PERFORMANCE_PLAN_CANCELLED');
  const source = await open(input.sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() =>
    fail('PERFORMANCE_PLAN_ARTIFACT_INVALID'),
  );
  let destination: Awaited<ReturnType<typeof open>> | null = null;
  try {
    const sourceMetadata = await source.stat().catch(() => fail('PERFORMANCE_PLAN_ARTIFACT_INVALID'));
    if (!sourceMetadata.isFile() || sourceMetadata.size !== input.expectedSizeBytes) {
      fail('PERFORMANCE_PLAN_ARTIFACT_INVALID');
    }
    destination = await open(
      input.destinationPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    ).catch(() => fail('PERFORMANCE_PLAN_OUTPUT_EXISTS'));
    const digest = createHash('sha256');
    const buffer = Buffer.allocUnsafe(Math.min(COPY_BUFFER_BYTES, input.expectedSizeBytes));
    let offset = 0;
    while (offset < input.expectedSizeBytes) {
      if (input.signal?.aborted) fail('PERFORMANCE_PLAN_CANCELLED');
      const length = Math.min(buffer.byteLength, input.expectedSizeBytes - offset);
      const { bytesRead } = await source
        .read(buffer, 0, length, offset)
        .catch(() => fail('PERFORMANCE_PLAN_ARTIFACT_INVALID'));
      if (bytesRead !== length) fail('PERFORMANCE_PLAN_ARTIFACT_INVALID');
      digest.update(buffer.subarray(0, bytesRead));
      let written = 0;
      while (written < bytesRead) {
        const result = await destination
          .write(buffer, written, bytesRead - written, offset + written)
          .catch(() => fail('PERFORMANCE_PLAN_WRITE_FAILED'));
        if (result.bytesWritten <= 0) fail('PERFORMANCE_PLAN_WRITE_FAILED');
        written += result.bytesWritten;
      }
      offset += bytesRead;
    }
    if (digest.digest('hex') !== input.expectedSha256) fail('PERFORMANCE_PLAN_ARTIFACT_INVALID');
    await destination.sync().catch(() => fail('PERFORMANCE_PLAN_WRITE_FAILED'));
    return Object.freeze({
      relativePath: '',
      sizeBytes: input.expectedSizeBytes,
      sha256: input.expectedSha256,
    });
  } finally {
    await Promise.all([source.close().catch(() => undefined), destination?.close().catch(() => undefined)]);
  }
}

async function writePrivateJson(filePath: string, value: unknown): Promise<void> {
  const bytes = Buffer.from(`${qualificationCanonicalJson(value)}\n`, 'utf8');
  const handle = await open(
    filePath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  ).catch(() => fail('PERFORMANCE_PLAN_OUTPUT_EXISTS'));
  try {
    await handle.writeFile(bytes).catch(() => fail('PERFORMANCE_PLAN_WRITE_FAILED'));
    await handle.sync().catch(() => fail('PERFORMANCE_PLAN_WRITE_FAILED'));
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function removeCreatedPrivateRoot(privateParent: string, privateRunRoot: string): Promise<void> {
  if (path.dirname(privateRunRoot) !== privateParent) fail('PERFORMANCE_PLAN_CLEANUP_FAILED');
  let entries = 0;
  const makeWritable = async (candidate: string): Promise<void> => {
    entries += 1;
    if (entries > MAXIMUM_CLEANUP_ENTRIES) fail('PERFORMANCE_PLAN_CLEANUP_FAILED');
    const metadata = await lstat(candidate).catch(() => fail('PERFORMANCE_PLAN_CLEANUP_FAILED'));
    if (metadata.isSymbolicLink()) return;
    if (metadata.isDirectory()) {
      await chmod(candidate, 0o700).catch(() => fail('PERFORMANCE_PLAN_CLEANUP_FAILED'));
      const names = await readdir(candidate).catch(() => fail('PERFORMANCE_PLAN_CLEANUP_FAILED'));
      for (const name of names) await makeWritable(path.join(candidate, name));
      return;
    }
    if (!metadata.isFile()) fail('PERFORMANCE_PLAN_CLEANUP_FAILED');
    await chmod(candidate, 0o600).catch(() => fail('PERFORMANCE_PLAN_CLEANUP_FAILED'));
  };
  await makeWritable(privateRunRoot);
  await rm(privateRunRoot, { force: true, recursive: true }).catch(() => fail('PERFORMANCE_PLAN_CLEANUP_FAILED'));
}

/** Owns one private derivation/build and emits digest-linked CPU/CUDA plans. */
export class LinuxPerformanceRunPlanProducer {
  private producing = false;

  public constructor(
    private readonly validator: LocalWhisperQualificationValidator,
    private readonly ports: Readonly<{
      readonly preflight: Pick<LinuxPerformancePrivateInputPreflight, 'verify'>;
      readonly focusedPreflight?: Pick<FocusedLinuxPerformancePrivateInputPreflight, 'verify'>;
      readonly overlay: Pick<PerformanceQualificationOverlayProducer, 'produce'>;
      readonly sourceBaseline: Readonly<{ verify(): QualificationSourceBaselineEvidence }>;
      readonly createDerivation: (overlay: ReviewedPerformanceQualificationOverlay) => PerformanceDerivedSourceProducer;
      readonly builder: PerformanceAttemptBuildPort;
      readonly copyArtifact?: (
        input: Readonly<PerformanceRunPlanArtifactCopyInput>,
      ) => Promise<PerformancePrivateArtifact>;
    }>,
  ) {}

  public async produce(
    input: Readonly<{
      readonly workspaceRoot: string;
      readonly cacheRoot: string;
      readonly privateParent: string;
      readonly privateRunRoot: string;
      readonly baselineWorktree: string;
      readonly candidateWorktree: string;
      readonly candidateCommit: string;
      readonly attemptTimeoutMilliseconds: number;
      readonly signal?: AbortSignal;
    }>,
  ): Promise<LinuxPerformanceRunPlanOutput> {
    if (this.producing) fail('PERFORMANCE_PLAN_ALREADY_ACTIVE');
    this.producing = true;
    let createdRoot: string | null = null;
    let createdRootParent: string | null = null;
    try {
      this.validateInput(input);
      const proof = await this.ports.preflight.verify(input);
      const baseline = this.ports.sourceBaseline.verify();
      if (baseline.sourceProofDigest !== LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST) {
        fail('PERFORMANCE_PLAN_SOURCE_PROOF_INVALID');
      }
      await this.authenticateParentWorktrees(proof, input.baselineWorktree, input.candidateWorktree);
      await mkdir(proof.privateRunRoot, { mode: 0o700 }).catch(() => fail('PERFORMANCE_PLAN_ROOT_CREATE_FAILED'));
      createdRoot = proof.privateRunRoot;
      createdRootParent = proof.privateParent;
      await chmod(proof.privateRunRoot, 0o700).catch(() => fail('PERFORMANCE_PLAN_ROOT_CREATE_FAILED'));
      const overlay = await this.ports.overlay.produce(input.workspaceRoot);
      const derivation = this.ports.createDerivation(overlay);
      const authorities = await this.derivePair(derivation, proof, input, baseline);
      const beforeBuild = await this.ports.builder.build({
        authority: authorities.before,
        side: 'before',
        ...(input.signal ? { signal: input.signal } : {}),
      });
      this.throwIfCancelled(input.signal);
      const builds = Object.freeze({
        before: beforeBuild,
        after: await this.ports.builder.build({
          authority: authorities.after,
          side: 'after',
          ...(input.signal ? { signal: input.signal } : {}),
        }),
      });
      const receipts = Object.freeze({
        before: await derivation.bindExecutable(authorities.before, builds.before.executableRelativePath),
        after: await derivation.bindExecutable(authorities.after, builds.after.executableRelativePath),
      });
      this.throwIfCancelled(input.signal);
      const sourceProof = await this.writeSourceProof(proof, baseline.sourceProofBytes, input.signal);
      const inputs = await this.copyInputs(proof, input.signal);
      const applications = Object.freeze({
        before: this.executableArtifact(
          proof,
          authorities.before,
          builds.before.executableRelativePath,
          receipts.before,
        ),
        after: this.executableArtifact(proof, authorities.after, builds.after.executableRelativePath, receipts.after),
      });
      const runtimes = Object.freeze({
        cpu: Object.freeze({
          before: this.builtArtifact(proof, authorities.before, builds.before.runtimeArtifacts.cpu),
          after: this.builtArtifact(proof, authorities.after, builds.after.runtimeArtifacts.cpu),
        }),
        cuda: Object.freeze({
          before: this.builtArtifact(proof, authorities.before, builds.before.runtimeArtifacts.cuda),
          after: this.builtArtifact(proof, authorities.after, builds.after.runtimeArtifacts.cuda),
        }),
      });
      const plans = Object.freeze({
        cpu: this.plan(
          input,
          proof,
          baseline,
          authorities,
          receipts,
          applications,
          runtimes.cpu,
          inputs,
          sourceProof,
          'cpu',
        ),
        cuda: this.plan(
          input,
          proof,
          baseline,
          authorities,
          receipts,
          applications,
          runtimes.cuda,
          inputs,
          sourceProof,
          'cuda',
        ),
      });
      this.throwIfCancelled(input.signal);
      await Promise.all([
        writePrivateJson(path.join(proof.privateRunRoot, 'derived-source-before-v3.json'), receipts.before),
        writePrivateJson(path.join(proof.privateRunRoot, 'derived-source-after-v3.json'), receipts.after),
        writePrivateJson(path.join(proof.privateRunRoot, 'performance-run-plan-linux-cpu-v3.json'), plans.cpu),
        writePrivateJson(path.join(proof.privateRunRoot, 'performance-run-plan-linux-cuda-v3.json'), plans.cuda),
      ]);
      createdRoot = null;
      createdRootParent = null;
      return Object.freeze({ plans, overlaySha256: overlay.sha256, overlayManifestSha256: overlay.manifestSha256 });
    } catch (error) {
      if (createdRoot && createdRootParent) {
        try {
          await removeCreatedPrivateRoot(createdRootParent, createdRoot);
        } catch {
          fail('PERFORMANCE_PLAN_CLEANUP_FAILED');
        }
      }
      throw error;
    } finally {
      this.producing = false;
    }
  }

  /** Builds and records exactly one candidate source/application graph for revision-7 qualification. */
  public async produceFocused(
    input: Readonly<{
      readonly workspaceRoot: string;
      readonly cacheRoot: string;
      readonly privateParent: string;
      readonly privateRunRoot: string;
      readonly candidateWorktree: string;
      readonly candidateCommit: string;
      readonly attemptTimeoutMilliseconds: number;
      readonly signal?: AbortSignal;
    }>,
  ): Promise<FocusedLinuxPerformanceRunPlanOutput> {
    if (this.producing) fail('PERFORMANCE_PLAN_ALREADY_ACTIVE');
    this.producing = true;
    let createdRoot: string | null = null;
    let createdRootParent: string | null = null;
    let failureStage = 'INPUT';
    try {
      this.validateInput(input);
      failureStage = 'PREFLIGHT';
      const proof = await (this.ports.focusedPreflight ?? this.ports.preflight).verify(input);
      failureStage = 'SOURCE_BASELINE';
      const baseline = this.ports.sourceBaseline.verify();
      if (baseline.sourceProofDigest !== LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST) {
        fail('PERFORMANCE_PLAN_SOURCE_PROOF_INVALID');
      }
      failureStage = 'PARENT_AUTHENTICATION';
      await this.authenticateCandidateWorktree(proof, input.candidateWorktree);
      failureStage = 'ROOT_CREATION';
      await mkdir(proof.privateRunRoot, { mode: 0o700 }).catch(() => fail('PERFORMANCE_PLAN_ROOT_CREATE_FAILED'));
      createdRoot = proof.privateRunRoot;
      createdRootParent = proof.privateParent;
      await chmod(proof.privateRunRoot, 0o700).catch(() => fail('PERFORMANCE_PLAN_ROOT_CREATE_FAILED'));
      failureStage = 'OVERLAY';
      const overlay = await this.ports.overlay.produce(input.workspaceRoot);
      const derivation = this.ports.createDerivation(overlay);
      failureStage = 'DERIVATION';
      const authority = await derivation.derive({
        privateRoot: proof.privateRunRoot,
        parentRoot: input.candidateWorktree,
        parentCommit: input.candidateCommit,
        destinationName: 'derived-candidate',
        sourceProofDigest: baseline.sourceProofDigest,
        side: 'after',
        ...(input.signal ? { signal: input.signal } : {}),
      });
      failureStage = 'BUILD';
      const build = await this.ports.builder.build({
        authority,
        side: 'after',
        ...(input.signal ? { signal: input.signal } : {}),
      });
      failureStage = 'RECEIPT';
      const receipt = await derivation.bindExecutable(authority, build.executableRelativePath);
      failureStage = 'SOURCE_PROOF';
      const sourceProof = await this.writeSourceProof(proof, baseline.sourceProofBytes, input.signal);
      failureStage = 'INPUT_COPY';
      const inputs = await this.copyFocusedInputs(proof, input.signal);
      failureStage = 'PLAN';
      const application = this.executableArtifact(proof, authority, build.executableRelativePath, receipt);
      const runtimes = Object.freeze({
        cpu: this.builtArtifact(proof, authority, build.runtimeArtifacts.cpu),
        cuda: this.builtArtifact(proof, authority, build.runtimeArtifacts.cuda),
      });
      const plans = Object.freeze({
        cpu: this.focusedPlan(input, proof, baseline, authority, receipt, application, runtimes.cpu, inputs, 'cpu'),
        cuda: this.focusedPlan(input, proof, baseline, authority, receipt, application, runtimes.cuda, inputs, 'cuda'),
      });
      this.throwIfCancelled(input.signal);
      failureStage = 'OUTPUT_WRITE';
      await Promise.all([
        writePrivateJson(path.join(proof.privateRunRoot, 'source-proof-v4.json'), sourceProof),
        writePrivateJson(path.join(proof.privateRunRoot, 'performance-run-plan-linux-cpu-v4.json'), plans.cpu),
        writePrivateJson(path.join(proof.privateRunRoot, 'performance-run-plan-linux-cuda-v4.json'), plans.cuda),
      ]);
      createdRoot = null;
      createdRootParent = null;
      return Object.freeze({ plans, overlaySha256: overlay.sha256, overlayManifestSha256: overlay.manifestSha256 });
    } catch (error) {
      if (createdRoot && createdRootParent) {
        try {
          await removeCreatedPrivateRoot(createdRootParent, createdRoot);
        } catch {
          fail('PERFORMANCE_PLAN_CLEANUP_FAILED');
        }
      }
      const code = error instanceof Error ? error.message : '';
      if (/^(?:PERFORMANCE|PRIVATE|QUALIFICATION|SOURCE)_[A-Z0-9_:.-]+$/u.test(code)) throw error;
      fail(`PERFORMANCE_PLAN_${failureStage}_FAILED`);
    } finally {
      this.producing = false;
    }
  }

  private validateInput(
    input: Readonly<{
      readonly candidateCommit: string;
      readonly attemptTimeoutMilliseconds: number;
      readonly signal?: AbortSignal;
    }>,
  ): void {
    if (
      process.platform !== 'linux' ||
      !/^[a-f0-9]{40}$/u.test(input.candidateCommit) ||
      !Number.isSafeInteger(input.attemptTimeoutMilliseconds) ||
      input.attemptTimeoutMilliseconds < ATTEMPT_TIMEOUT_MINIMUM ||
      input.attemptTimeoutMilliseconds > ATTEMPT_TIMEOUT_MAXIMUM ||
      input.signal?.aborted
    ) {
      fail('PERFORMANCE_PLAN_INPUT_INVALID');
    }
  }

  private throwIfCancelled(signal: AbortSignal | undefined): void {
    if (signal?.aborted) fail('PERFORMANCE_PLAN_CANCELLED');
  }

  private async authenticateParentWorktrees(
    proof: LinuxPerformancePrivateInputProof,
    before: string,
    after: string,
  ): Promise<void> {
    for (const candidate of [before, after]) {
      const canonical = await realpath(candidate).catch(() => fail('PERFORMANCE_PLAN_PARENT_INVALID'));
      relativeToPrivateParent(proof.privateParent, canonical);
      if (canonical === proof.privateRunRoot || canonical.startsWith(`${proof.privateRunRoot}${path.sep}`)) {
        fail('PERFORMANCE_PLAN_PARENT_INVALID');
      }
    }
  }

  private async authenticateCandidateWorktree(
    proof: Pick<FocusedLinuxPerformancePrivateInputProof, 'privateParent' | 'privateRunRoot'>,
    candidate: string,
  ): Promise<void> {
    const canonical = await realpath(candidate).catch(() => fail('PERFORMANCE_PLAN_PARENT_INVALID'));
    relativeToPrivateParent(proof.privateParent, canonical);
    if (canonical === proof.privateRunRoot || canonical.startsWith(`${proof.privateRunRoot}${path.sep}`)) {
      fail('PERFORMANCE_PLAN_PARENT_INVALID');
    }
  }

  private async derivePair(
    derivation: PerformanceDerivedSourceProducer,
    proof: LinuxPerformancePrivateInputProof,
    input: Readonly<{
      readonly baselineWorktree: string;
      readonly candidateWorktree: string;
      readonly candidateCommit: string;
      readonly signal?: AbortSignal;
    }>,
    baseline: QualificationSourceBaselineEvidence,
  ) {
    const common = {
      privateRoot: proof.privateRunRoot,
      sourceProofDigest: baseline.sourceProofDigest,
      ...(input.signal ? { signal: input.signal } : {}),
    };
    return Object.freeze({
      before: await derivation.derive({
        ...common,
        parentRoot: input.baselineWorktree,
        parentCommit: baseline.sourceRevision,
        destinationName: 'derived-before',
        side: 'before',
      }),
      after: await derivation.derive({
        ...common,
        parentRoot: input.candidateWorktree,
        parentCommit: input.candidateCommit,
        destinationName: 'derived-after',
        side: 'after',
      }),
    });
  }

  private async writeSourceProof(
    proof: Pick<FocusedLinuxPerformancePrivateInputProof, 'privateParent' | 'privateRunRoot'>,
    bytes: Buffer,
    signal?: AbortSignal,
  ): Promise<PerformancePrivateArtifact> {
    this.throwIfCancelled(signal);
    const destination = path.join(proof.privateRunRoot, 'source-proof-v3.json');
    const handle = await open(destination, 'wx', 0o600).catch(() => fail('PERFORMANCE_PLAN_OUTPUT_EXISTS'));
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close().catch(() => undefined);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST) fail('PERFORMANCE_PLAN_SOURCE_PROOF_INVALID');
    return Object.freeze({
      relativePath: relativeToPrivateParent(proof.privateParent, destination),
      sizeBytes: bytes.byteLength,
      sha256,
    });
  }

  private async copyInputs(proof: LinuxPerformancePrivateInputProof, signal?: AbortSignal) {
    const inputRoot = path.join(proof.privateRunRoot, 'inputs');
    await mkdir(inputRoot, { mode: 0o700 });
    const models = [];
    for (const selected of performanceSelectedModels()) {
      const model = proof.loaded.application.models.find(
        ({ family, variant, sha256 }) =>
          family === selected.family && variant === selected.variant && sha256 === selected.sha256,
      );
      if (!model) fail('PERFORMANCE_PLAN_MODEL_INVALID');
      const destination = path.join(inputRoot, `model-${selected.family}-${selected.variant}.bin`);
      const copied = await this.copyArtifact({
        sourcePath: model.filePath,
        expectedSizeBytes: model.sizeBytes,
        expectedSha256: model.sha256,
        destinationPath: destination,
        ...(signal ? { signal } : {}),
      });
      models.push(
        Object.freeze({
          ...selected,
          artifact: Object.freeze({
            ...copied,
            relativePath: relativeToPrivateParent(proof.privateParent, destination),
          }),
        }),
      );
    }
    const fixture = proof.loaded.application.performanceFixtures[0];
    if (!fixture) fail('PERFORMANCE_PLAN_FIXTURE_INVALID');
    const fixtureDestination = path.join(inputRoot, 'performance-input.wav');
    const copiedFixture = await this.copyArtifact({
      sourcePath: fixture.filePath,
      expectedSizeBytes: fixture.sizeBytes,
      expectedSha256: fixture.sha256,
      destinationPath: fixtureDestination,
      ...(signal ? { signal } : {}),
    });
    return Object.freeze({
      models: Object.freeze(models),
      inputFixture: Object.freeze({
        ...copiedFixture,
        relativePath: relativeToPrivateParent(proof.privateParent, fixtureDestination),
      }),
    });
  }

  private async copyFocusedInputs(
    proof: Pick<FocusedLinuxPerformancePrivateInputProof, 'privateParent' | 'privateRunRoot' | 'loaded'>,
    signal?: AbortSignal,
  ) {
    const inputRoot = path.join(proof.privateRunRoot, 'inputs');
    await mkdir(inputRoot, { mode: 0o700 });
    const selected = performanceSelectedModels().find(({ family, variant }) => family === 'base' && variant === 'full');
    const model = proof.loaded.application.models.find(
      (candidate) =>
        candidate.family === 'base' &&
        candidate.variant === 'full' &&
        candidate.sizeBytes === 147_951_465 &&
        candidate.sha256 === selected?.sha256,
    );
    if (!selected || !model) fail('PERFORMANCE_PLAN_MODEL_INVALID');
    const modelDestination = path.join(inputRoot, 'model-base-full.bin');
    const copiedModel = await this.copyArtifact({
      sourcePath: model.filePath,
      expectedSizeBytes: model.sizeBytes,
      expectedSha256: model.sha256,
      destinationPath: modelDestination,
      ...(signal ? { signal } : {}),
    });
    const fixture = proof.loaded.application.performanceFixtures[0];
    if (!fixture) fail('PERFORMANCE_PLAN_FIXTURE_INVALID');
    const fixtureDestination = path.join(inputRoot, 'performance-input.wav');
    const copiedFixture = await this.copyArtifact({
      sourcePath: fixture.filePath,
      expectedSizeBytes: fixture.sizeBytes,
      expectedSha256: fixture.sha256,
      destinationPath: fixtureDestination,
      ...(signal ? { signal } : {}),
    });
    return Object.freeze({
      modelArtifact: Object.freeze({
        ...copiedModel,
        relativePath: relativeToPrivateParent(proof.privateParent, modelDestination),
      }),
      inputFixture: Object.freeze({
        ...copiedFixture,
        relativePath: relativeToPrivateParent(proof.privateParent, fixtureDestination),
      }),
    });
  }

  private builtArtifact(
    proof: Pick<FocusedLinuxPerformancePrivateInputProof, 'privateParent'>,
    authority: PerformanceDerivedSourceAuthority,
    artifact: Readonly<{ readonly relativePath: string; readonly sizeBytes: number; readonly sha256: string }>,
  ): PerformancePrivateArtifact {
    const absolutePath = path.resolve(authority.rootPath, artifact.relativePath);
    const relative = path.relative(authority.rootPath, absolutePath);
    if (
      !relative ||
      relative.startsWith('..') ||
      path.isAbsolute(relative) ||
      !Number.isSafeInteger(artifact.sizeBytes) ||
      artifact.sizeBytes < 1 ||
      !/^[a-f0-9]{64}$/u.test(artifact.sha256)
    ) {
      fail('PERFORMANCE_PLAN_RUNTIME_INVALID');
    }
    return Object.freeze({
      relativePath: relativeToPrivateParent(proof.privateParent, absolutePath),
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
    });
  }

  private executableArtifact(
    proof: Pick<FocusedLinuxPerformancePrivateInputProof, 'privateParent'>,
    authority: PerformanceDerivedSourceAuthority,
    executableRelativePath: string,
    receipt: Readonly<{
      readonly executableArtifactIdentity: Readonly<{ readonly sizeBytes: number; readonly sha256: string }>;
    }>,
  ): PerformancePrivateArtifact {
    return Object.freeze({
      relativePath: relativeToPrivateParent(
        proof.privateParent,
        path.resolve(authority.rootPath, executableRelativePath),
      ),
      sizeBytes: receipt.executableArtifactIdentity.sizeBytes,
      sha256: receipt.executableArtifactIdentity.sha256,
    });
  }

  private async copyArtifact(
    input: Readonly<PerformanceRunPlanArtifactCopyInput>,
  ): Promise<PerformancePrivateArtifact> {
    return await (this.ports.copyArtifact ?? copyAuthenticatedFile)(input);
  }

  private focusedPlan(
    input: Readonly<{ readonly candidateCommit: string; readonly attemptTimeoutMilliseconds: number }>,
    proof: Pick<FocusedLinuxPerformancePrivateInputProof, 'privateParent' | 'cacheSnapshot' | 'evidenceIdentityDigest'>,
    baseline: QualificationSourceBaselineEvidence,
    authority: PerformanceDerivedSourceAuthority,
    receipt: PerformanceDerivedSourceReceipt,
    applicationArtifact: PerformancePrivateArtifact,
    runtimeArtifact: PerformancePrivateArtifact,
    inputs: Readonly<{
      readonly modelArtifact: PerformancePrivateArtifact;
      readonly inputFixture: PerformancePrivateArtifact;
    }>,
    backend: PerformanceBackend,
  ): FocusedPerformanceRunPlan {
    return new FocusedPerformanceDocumentProducer(this.validator).produceRunPlan({
      sourceRevision: input.candidateCommit,
      sourceProofDigest: baseline.sourceProofDigest,
      candidateCommit: input.candidateCommit,
      platform: 'linux',
      backend,
      executionMode: 'representativeHost',
      evidenceClaim: 'representativePerformance',
      candidateSource: Object.freeze({
        relativePath: relativeToPrivateParent(proof.privateParent, authority.rootPath),
        commit: input.candidateCommit,
        sourceProofDigest: baseline.sourceProofDigest,
        instrumentationOverlaySha256: receipt.instrumentationOverlaySha256,
        derivedTreeManifestSha256: receipt.derivedTreeManifestSha256,
        executableArtifactSha256: receipt.executableArtifactIdentity.sha256,
      }),
      qualificationCache: Object.freeze({
        snapshotDigest: proof.cacheSnapshot.digest,
        evidenceIdentityDigest: proof.evidenceIdentityDigest,
        entryCount: proof.cacheSnapshot.entryCount,
        fileCount: proof.cacheSnapshot.fileCount,
        sizeBytes: proof.cacheSnapshot.sizeBytes,
      }),
      applicationArtifact,
      runtimeArtifact,
      modelArtifact: inputs.modelArtifact,
      inputFixture: inputs.inputFixture,
      cachePreparationProcedure: 'linuxFileAdviceV1',
      attemptTimeoutMilliseconds: input.attemptTimeoutMilliseconds,
    });
  }

  private plan(
    input: Readonly<{
      readonly baselineWorktree: string;
      readonly candidateWorktree: string;
      readonly candidateCommit: string;
      readonly attemptTimeoutMilliseconds: number;
    }>,
    proof: LinuxPerformancePrivateInputProof,
    baseline: QualificationSourceBaselineEvidence,
    authorities: Readonly<Record<PerformanceSide, PerformanceDerivedSourceAuthority>>,
    receipts: Readonly<Record<PerformanceSide, PerformanceDerivedSourceReceipt>>,
    applications: Readonly<Record<PerformanceSide, PerformancePrivateArtifact>>,
    runtimes: Readonly<Record<PerformanceSide, PerformancePrivateArtifact>>,
    inputs: Readonly<{
      readonly models: readonly Readonly<
        PerformanceModelIdentity & { readonly artifact: PerformancePrivateArtifact }
      >[];
      readonly inputFixture: PerformancePrivateArtifact;
    }>,
    sourceProof: PerformancePrivateArtifact,
    backend: PerformanceBackend,
  ): PerformanceQualificationRunPlan {
    return new LocalWhisperPerformanceDocumentProducer(this.validator).produceRunPlan({
      sourceRevision: baseline.sourceRevision,
      sourceProofDigest: baseline.sourceProofDigest,
      platform: 'linux',
      backend,
      executionMode: 'representativeHost',
      evidenceClaim: 'representativePerformance',
      baselineCommit: baseline.sourceRevision,
      candidateCommit: input.candidateCommit,
      sourceProof,
      qualificationCache: Object.freeze({
        snapshotDigest: proof.cacheSnapshot.digest,
        evidenceIdentityDigest: proof.evidenceIdentityDigest,
        entryCount: proof.cacheSnapshot.entryCount,
        fileCount: proof.cacheSnapshot.fileCount,
        sizeBytes: proof.cacheSnapshot.sizeBytes,
      }),
      worktrees: Object.freeze({
        before: Object.freeze({
          relativePath: relativeToPrivateParent(proof.privateParent, input.baselineWorktree),
          commit: baseline.sourceRevision,
        }),
        after: Object.freeze({
          relativePath: relativeToPrivateParent(proof.privateParent, input.candidateWorktree),
          commit: input.candidateCommit,
        }),
      }),
      derivedSources: Object.freeze({
        before: Object.freeze({
          relativePath: relativeToPrivateParent(proof.privateParent, authorities.before.rootPath),
          receipt: receipts.before,
        }),
        after: Object.freeze({
          relativePath: relativeToPrivateParent(proof.privateParent, authorities.after.rootPath),
          receipt: receipts.after,
        }),
      }),
      applicationArtifacts: applications,
      runtimeArtifacts: runtimes,
      models: inputs.models,
      inputFixture: inputs.inputFixture,
      cachePreparation: Object.freeze({
        procedure: 'linuxFileAdviceV1',
        cold: 'fileAdviceDontNeed',
        warm: 'boundedSequentialRead',
      }),
      attemptTimeoutMilliseconds: input.attemptTimeoutMilliseconds,
    });
  }
}
