import { createHash } from 'node:crypto';

import type { LocalWhisperPerformanceResourceId, LocalWhisperQualificationValidator } from './QualificationContracts';
import {
  LocalWhisperPerformanceDocumentProducer,
  performanceSchedule,
  type PerformanceBackend,
  type PerformanceCacheState,
  type PerformanceModelIdentity,
  type PerformancePhaseMeasurement,
  type PerformancePrivateArtifact,
  type PerformanceQualificationBundle,
  type PerformanceQualificationManifest,
  type PerformanceQualificationRunPlan,
  type PerformanceResourceMeasurement,
  type PerformanceSide,
} from './PerformanceQualification';

const MAXIMUM_ATTEMPT_OUTPUT_BYTES = 64 * 1024;
const REASON_CODE = /^[A-Z][A-Z0-9_]{2,63}$/u;
const PROCESS_START_IDENTITY = /^\w[\w.:-]{0,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const PERFORMANCE_PROCESS_ROLES = ['main', 'guard', 'worker'] as const;

export class PerformanceCollectionError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'PerformanceCollectionError';
  }
}

export interface PreparedPerformanceArtifact {
  readonly absolutePath: string;
  readonly identity: PerformancePrivateArtifact;
}

export interface PreparedPerformanceModel {
  readonly identity: PerformanceModelIdentity;
  readonly artifact: PreparedPerformanceArtifact;
}

export interface PreparedPerformanceInputs {
  readonly sourceProof: PreparedPerformanceArtifact;
  readonly parentWorktrees: Readonly<{ readonly before: string; readonly after: string }>;
  readonly derivedSources: Readonly<{ readonly before: string; readonly after: string }>;
  readonly applications: Readonly<{
    readonly before: PreparedPerformanceArtifact;
    readonly after: PreparedPerformanceArtifact;
  }>;
  readonly runtimes: Readonly<{
    readonly before: PreparedPerformanceArtifact;
    readonly after: PreparedPerformanceArtifact;
  }>;
  readonly models: readonly PreparedPerformanceModel[];
  readonly inputFixture: PreparedPerformanceArtifact;
}

export interface PerformanceCollectionPlatformPort {
  prepare(plan: PerformanceQualificationRunPlan): Promise<PreparedPerformanceInputs>;
  verifyUnchanged(plan: PerformanceQualificationRunPlan, inputs: PreparedPerformanceInputs): Promise<void>;
}

export interface PerformanceCachePreparationInput {
  readonly cacheState: PerformanceCacheState;
  readonly inputSetDigest: string;
  readonly files: readonly PreparedPerformanceArtifact[];
  readonly signal?: AbortSignal;
}

export interface PerformanceCachePreparationPort {
  prepare(input: PerformanceCachePreparationInput): Promise<void>;
}

export interface PerformanceAttemptProcessInput {
  readonly executablePath: string;
  readonly workingDirectory: string;
  readonly timeoutMilliseconds: number;
  readonly signal?: AbortSignal;
  readonly request: PerformanceAttemptRequest;
}

export interface PerformanceAttemptRequest {
  readonly schemaVersion: 3;
  readonly activationPurpose: 'qualification';
  readonly sampleId: string;
  readonly platform: PerformanceQualificationManifest['platform'];
  readonly backend: PerformanceBackend;
  readonly model: PerformanceModelIdentity;
  readonly candidateWindow: 1 | 2 | 4 | 8;
  readonly cacheState: PerformanceCacheState;
  readonly pairIndex: number;
  readonly runOrder: 'beforeThenAfter' | 'afterThenBefore';
  readonly side: PerformanceSide;
  readonly runtimePath: string;
  readonly modelPath: string;
  readonly inputFixturePath: string;
  readonly requiredPhaseIds: PerformanceQualificationManifest['requiredPhaseIds'];
  readonly derivedSourceReceiptDigest: string;
}

export interface PerformanceAttemptProcessSession {
  readonly rootPid: number;
  complete(): Promise<Buffer>;
  terminate(): Promise<void>;
}

export interface PerformanceAttemptProcessPort {
  start(input: PerformanceAttemptProcessInput): PerformanceAttemptProcessSession;
}

export interface PerformanceResourceProof {
  readonly resources: readonly PerformanceResourceMeasurement[];
  readonly roleRegistrations: readonly PerformanceRoleRegistration[];
  readonly processSettlementProof: string;
  readonly unownedProcessAttribution: number;
  readonly unownedGpuAttribution: number | 'notApplicable';
  readonly identityChanges: number;
  readonly lateRoleRegistrations: number;
  readonly liveOwnedProcessesAfterSettlement: number;
}

export type PerformanceProcessRole = (typeof PERFORMANCE_PROCESS_ROLES)[number];

export interface PerformanceRoleRegistration {
  readonly role: PerformanceProcessRole;
  readonly pid: number;
  readonly processStartIdentity: string;
  readonly executableSha256: string;
}

export interface PerformanceResourceSession {
  finish(): Promise<PerformanceResourceProof>;
  terminate(): void;
}

export interface PerformanceResourcePort {
  start(
    input: Readonly<{
      readonly rootPid: number;
      readonly backend: PerformanceBackend;
      readonly expectedExecutableSha256: string;
      readonly requiredResourceIds: readonly LocalWhisperPerformanceResourceId[];
    }>,
  ): PerformanceResourceSession;
}

export type PerformanceAttemptOutcome =
  | Readonly<{
      status: 'success';
      endToEndNanoseconds: number;
      phases: readonly PerformancePhaseMeasurement[];
    }>
  | Readonly<{ status: 'failed'; failureReason: string }>;

export interface PerformancePhasePort {
  parse(output: Buffer, manifest: PerformanceQualificationManifest): PerformanceAttemptOutcome;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, 'en'));
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right, 'en'));
  return JSON.stringify(actual) === JSON.stringify(sortedExpected);
}

function safeInteger(value: unknown, minimum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

/** Parses one bounded content-free qualification hook response. */
export class PerformanceQualificationPhaseParser implements PerformancePhasePort {
  public parse(output: Buffer, manifest: PerformanceQualificationManifest): PerformanceAttemptOutcome {
    if (
      output.byteLength === 0 ||
      output.byteLength > MAXIMUM_ATTEMPT_OUTPUT_BYTES ||
      output[output.byteLength - 1] !== 0x0a ||
      output.subarray(0, -1).includes(0x0a) ||
      output.includes(0x0d)
    ) {
      throw new PerformanceCollectionError('ATTEMPT_OUTPUT_INVALID');
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(output)) as unknown;
    } catch {
      throw new PerformanceCollectionError('ATTEMPT_OUTPUT_INVALID');
    }
    if (
      !isRecord(value) ||
      !exactKeys(value, ['schemaVersion', 'status', 'failureReason', 'endToEndNanoseconds', 'phases']) ||
      value.schemaVersion !== 3 ||
      !Array.isArray(value.phases)
    ) {
      throw new PerformanceCollectionError('ATTEMPT_OUTPUT_INVALID');
    }
    if (value.status === 'failed') {
      if (
        typeof value.failureReason !== 'string' ||
        !REASON_CODE.test(value.failureReason) ||
        value.endToEndNanoseconds !== null ||
        value.phases.length !== 0
      ) {
        throw new PerformanceCollectionError('ATTEMPT_OUTPUT_INVALID');
      }
      return Object.freeze({ status: 'failed', failureReason: value.failureReason });
    }
    if (
      value.status !== 'success' ||
      value.failureReason !== null ||
      !safeInteger(value.endToEndNanoseconds, 1) ||
      value.phases.length !== manifest.requiredPhaseIds.length
    ) {
      throw new PerformanceCollectionError('ATTEMPT_OUTPUT_INVALID');
    }
    const phases = value.phases.map((entry, sequence) => {
      if (
        !isRecord(entry) ||
        !exactKeys(entry, ['id', 'sequence', 'durationNanoseconds']) ||
        entry.id !== manifest.requiredPhaseIds[sequence] ||
        entry.sequence !== sequence ||
        !safeInteger(entry.durationNanoseconds, 1)
      ) {
        throw new PerformanceCollectionError('ATTEMPT_OUTPUT_INVALID');
      }
      return Object.freeze({
        id: entry.id as PerformancePhaseMeasurement['id'],
        sequence,
        durationNanoseconds: entry.durationNanoseconds,
      });
    });
    return Object.freeze({
      status: 'success',
      endToEndNanoseconds: value.endToEndNanoseconds,
      phases: Object.freeze(phases),
    });
  }
}

function validateResourceProof(
  proof: PerformanceResourceProof,
  input: Readonly<{
    readonly rootPid: number;
    readonly backend: PerformanceBackend;
    readonly expectedExecutableSha256: string;
    readonly requiredResourceIds: readonly LocalWhisperPerformanceResourceId[];
  }>,
): readonly PerformanceResourceMeasurement[] {
  if (
    !isRecord(proof) ||
    !exactKeys(proof, [
      'resources',
      'roleRegistrations',
      'processSettlementProof',
      'unownedProcessAttribution',
      'unownedGpuAttribution',
      'identityChanges',
      'lateRoleRegistrations',
      'liveOwnedProcessesAfterSettlement',
    ]) ||
    !Array.isArray(proof.roleRegistrations) ||
    !Array.isArray(proof.resources) ||
    proof.processSettlementProof !== 'ownedProcessTreeSettled' ||
    proof.unownedProcessAttribution !== 0 ||
    proof.unownedGpuAttribution !== (input.backend === 'cpu' ? 'notApplicable' : 0) ||
    proof.identityChanges !== 0 ||
    proof.lateRoleRegistrations !== 0 ||
    proof.liveOwnedProcessesAfterSettlement !== 0 ||
    proof.roleRegistrations.length !== PERFORMANCE_PROCESS_ROLES.length ||
    proof.resources.length !== input.requiredResourceIds.length
  ) {
    throw new PerformanceCollectionError('RESOURCE_ATTRIBUTION_INVALID');
  }
  const pids = new Set<number>();
  const startIdentities = new Set<string>();
  for (const [index, registration] of proof.roleRegistrations.entries()) {
    if (
      !isRecord(registration) ||
      !exactKeys(registration, ['role', 'pid', 'processStartIdentity', 'executableSha256']) ||
      registration.role !== PERFORMANCE_PROCESS_ROLES[index] ||
      !safeInteger(registration.pid, 2) ||
      (index === 0 && registration.pid !== input.rootPid) ||
      !PROCESS_START_IDENTITY.test(registration.processStartIdentity) ||
      registration.executableSha256 !== input.expectedExecutableSha256 ||
      !SHA256.test(registration.executableSha256) ||
      pids.has(registration.pid) ||
      startIdentities.has(registration.processStartIdentity)
    ) {
      throw new PerformanceCollectionError('RESOURCE_ROLE_ATTRIBUTION_INVALID');
    }
    pids.add(registration.pid);
    startIdentities.add(registration.processStartIdentity);
  }
  const resources: PerformanceResourceMeasurement[] = [];
  for (const [index, resource] of proof.resources.entries()) {
    if (
      !isRecord(resource) ||
      !exactKeys(resource, ['id', 'peakBytes']) ||
      resource.id !== input.requiredResourceIds[index] ||
      !safeInteger(resource.peakBytes, 0)
    ) {
      throw new PerformanceCollectionError('RESOURCE_MEASUREMENT_INVALID');
    }
    resources.push(
      Object.freeze({
        id: resource.id as PerformanceResourceMeasurement['id'],
        peakBytes: resource.peakBytes,
      }),
    );
  }
  return Object.freeze(resources);
}

function inputSetDigest(files: readonly PreparedPerformanceArtifact[]): string {
  const identities = files.map(({ identity }) => `${identity.sha256}|${identity.sizeBytes}`).sort();
  return createHash('sha256').update(JSON.stringify(identities), 'utf8').digest('hex');
}

function failureCode(error: unknown): string {
  if (error instanceof PerformanceCollectionError && REASON_CODE.test(error.code)) return error.code;
  return 'ATTEMPT_FAILED';
}

function cancellationRequested(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/** Owns one serial 288-attempt qualification collection and all injected lifecycle ports. */
export class LocalWhisperPerformanceCollector {
  private collecting = false;

  public constructor(
    private readonly validator: LocalWhisperQualificationValidator,
    private readonly ports: Readonly<{
      readonly platform: PerformanceCollectionPlatformPort;
      readonly cache: PerformanceCachePreparationPort;
      readonly process: PerformanceAttemptProcessPort;
      readonly phases: PerformancePhasePort;
      readonly resources: PerformanceResourcePort;
    }>,
  ) {}

  public async collect(
    plan: PerformanceQualificationRunPlan,
    signal?: AbortSignal,
  ): Promise<PerformanceQualificationBundle> {
    if (this.collecting) throw new PerformanceCollectionError('COLLECTION_ALREADY_ACTIVE');
    this.collecting = true;
    let prepared: PreparedPerformanceInputs | null = null;
    try {
      plan = this.validator.validateAndFreezeDocument(
        'performanceRunPlan',
        plan,
      ) as unknown as PerformanceQualificationRunPlan;
      if (cancellationRequested(signal)) throw new PerformanceCollectionError('COLLECTION_CANCELLED');
      prepared = await this.ports.platform.prepare(plan);
      const documents = new LocalWhisperPerformanceDocumentProducer(this.validator);
      const manifest = documents.produceManifestFromRunPlan(plan);
      const receipts = [];
      const samples = [];
      for (const cell of performanceSchedule(manifest)) {
        if (cancellationRequested(signal)) throw new PerformanceCollectionError('COLLECTION_CANCELLED');
        const { sampleId, model, candidateWindow, cacheState, pairIndex, runOrder, side } = cell;
        const preparedModel = prepared.models.find(
          ({ identity }) =>
            identity.family === model.family && identity.variant === model.variant && identity.sha256 === model.sha256,
        );
        if (!preparedModel) throw new PerformanceCollectionError('COLLECTION_INPUT_INVALID');
        const application = prepared.applications[side];
        const runtime = prepared.runtimes[side];
        const files = Object.freeze([application, runtime, preparedModel.artifact, prepared.inputFixture]);
        const cacheInputDigest = inputSetDigest(files);
        try {
          await this.ports.cache.prepare({
            cacheState,
            inputSetDigest: cacheInputDigest,
            files,
            ...(signal ? { signal } : {}),
          });
        } catch (error) {
          if (cancellationRequested(signal)) throw new PerformanceCollectionError('COLLECTION_CANCELLED');
          const reasonCode = failureCode(error);
          const receipt = documents.produceCacheReceipt(manifest, {
            sampleId,
            cacheState,
            inputSetDigest: cacheInputDigest,
            status: 'failed',
            reasonCode,
          });
          receipts.push(receipt);
          samples.push(
            documents.produceSample(manifest, {
              cacheReceiptDigest: receipt.performanceCacheReceiptDigest,
              sampleId,
              model,
              candidateWindow,
              cacheState,
              pairIndex,
              runOrder,
              side,
              status: 'failed',
              failureReason: reasonCode,
            }),
          );
          continue;
        }
        const receipt = documents.produceCacheReceipt(manifest, {
          sampleId,
          cacheState,
          inputSetDigest: cacheInputDigest,
          status: 'prepared',
          reasonCode: null,
        });
        receipts.push(receipt);
        const sample = await this.collectAttempt({
          plan,
          manifest,
          prepared,
          application,
          runtime,
          model,
          preparedModel,
          candidateWindow,
          cacheState,
          pairIndex,
          runOrder,
          side,
          sampleId,
          cacheReceiptDigest: receipt.performanceCacheReceiptDigest,
          ...(signal ? { signal } : {}),
        });
        samples.push(sample);
      }
      await this.ports.platform.verifyUnchanged(plan, prepared);
      return documents.produceBundle(manifest, receipts, samples);
    } catch (error) {
      if (prepared) {
        try {
          await this.ports.platform.verifyUnchanged(plan, prepared);
        } catch {
          throw new PerformanceCollectionError('COLLECTION_INPUT_CHANGED');
        }
      }
      throw error;
    } finally {
      this.collecting = false;
    }
  }

  private async collectAttempt(input: {
    readonly plan: PerformanceQualificationRunPlan;
    readonly manifest: PerformanceQualificationManifest;
    readonly prepared: PreparedPerformanceInputs;
    readonly application: PreparedPerformanceArtifact;
    readonly runtime: PreparedPerformanceArtifact;
    readonly model: PerformanceModelIdentity;
    readonly preparedModel: PreparedPerformanceModel;
    readonly candidateWindow: 1 | 2 | 4 | 8;
    readonly cacheState: PerformanceCacheState;
    readonly pairIndex: number;
    readonly runOrder: 'beforeThenAfter' | 'afterThenBefore';
    readonly side: PerformanceSide;
    readonly sampleId: string;
    readonly cacheReceiptDigest: string;
    readonly signal?: AbortSignal;
  }) {
    const documents = new LocalWhisperPerformanceDocumentProducer(this.validator);
    let processSession: PerformanceAttemptProcessSession | null = null;
    let resourceSession: PerformanceResourceSession | null = null;
    try {
      processSession = this.ports.process.start({
        executablePath: input.application.absolutePath,
        workingDirectory: input.prepared.derivedSources[input.side],
        timeoutMilliseconds: input.plan.attemptTimeoutMilliseconds,
        ...(input.signal ? { signal: input.signal } : {}),
        request: Object.freeze({
          schemaVersion: 3,
          activationPurpose: 'qualification',
          sampleId: input.sampleId,
          platform: input.manifest.platform,
          backend: input.manifest.backend,
          model: input.model,
          candidateWindow: input.candidateWindow,
          cacheState: input.cacheState,
          pairIndex: input.pairIndex,
          runOrder: input.runOrder,
          side: input.side,
          runtimePath: input.runtime.absolutePath,
          modelPath: input.preparedModel.artifact.absolutePath,
          inputFixturePath: input.prepared.inputFixture.absolutePath,
          requiredPhaseIds: input.manifest.requiredPhaseIds,
          derivedSourceReceiptDigest:
            input.manifest.derivedSourceReceipts[input.side].performanceDerivedSourceReceiptDigest,
        }),
      });
      const resourceInput = Object.freeze({
        rootPid: processSession.rootPid,
        backend: input.manifest.backend,
        expectedExecutableSha256: input.application.identity.sha256,
        requiredResourceIds: input.manifest.requiredResourceIds,
      });
      resourceSession = this.ports.resources.start(resourceInput);
      const output = await processSession.complete();
      const outcome = this.ports.phases.parse(output, input.manifest);
      const resourceProof = await resourceSession.finish();
      const resources = validateResourceProof(resourceProof, resourceInput);
      if (outcome.status === 'failed') {
        return documents.produceSample(input.manifest, {
          cacheReceiptDigest: input.cacheReceiptDigest,
          sampleId: input.sampleId,
          model: input.model,
          candidateWindow: input.candidateWindow,
          cacheState: input.cacheState,
          pairIndex: input.pairIndex,
          runOrder: input.runOrder,
          side: input.side,
          status: 'failed',
          failureReason: outcome.failureReason,
        });
      }
      return documents.produceSample(input.manifest, {
        cacheReceiptDigest: input.cacheReceiptDigest,
        sampleId: input.sampleId,
        model: input.model,
        candidateWindow: input.candidateWindow,
        cacheState: input.cacheState,
        pairIndex: input.pairIndex,
        runOrder: input.runOrder,
        side: input.side,
        status: 'success',
        endToEndNanoseconds: outcome.endToEndNanoseconds,
        phases: outcome.phases,
        resources,
      });
    } catch (error) {
      if (cancellationRequested(input.signal)) throw new PerformanceCollectionError('COLLECTION_CANCELLED');
      return documents.produceSample(input.manifest, {
        cacheReceiptDigest: input.cacheReceiptDigest,
        sampleId: input.sampleId,
        model: input.model,
        candidateWindow: input.candidateWindow,
        cacheState: input.cacheState,
        pairIndex: input.pairIndex,
        runOrder: input.runOrder,
        side: input.side,
        status: 'failed',
        failureReason: failureCode(error),
      });
    } finally {
      resourceSession?.terminate();
      await processSession?.terminate().catch(() => undefined);
    }
  }
}

/** Frozen interface-only placeholder until Packet 15 supplies Windows process/cache/resource APIs. */
export class WindowsPerformanceCollectionAdapterUnavailable implements PerformanceCollectionPlatformPort {
  public async prepare(_plan: PerformanceQualificationRunPlan): Promise<PreparedPerformanceInputs> {
    throw new PerformanceCollectionError('WINDOWS_ADAPTER_UNAVAILABLE');
  }

  public async verifyUnchanged(
    _plan: PerformanceQualificationRunPlan,
    _inputs: PreparedPerformanceInputs,
  ): Promise<void> {
    throw new PerformanceCollectionError('WINDOWS_ADAPTER_UNAVAILABLE');
  }
}
