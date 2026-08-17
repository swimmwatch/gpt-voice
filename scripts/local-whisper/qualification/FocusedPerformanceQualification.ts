import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';

import {
  LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE,
  LocalWhisperQualificationGraphProducer,
  type LocalWhisperPerformancePhaseId,
  type LocalWhisperPerformanceResourceId,
  type LocalWhisperQualificationValidator,
} from './QualificationContracts';
import {
  performanceRequiredPhaseIds,
  performanceRequiredResourceIds,
  type PerformanceBackend,
  type PerformanceCacheState,
  type PerformancePhaseMeasurement,
  type PerformancePrivateArtifact,
  type PerformanceResourceMeasurement,
} from './PerformanceQualification';

export const FOCUSED_PERFORMANCE_SCHEMA_VERSION = 4 as const;
export const FOCUSED_PERFORMANCE_CONTRACT_REVISION = 7 as const;
export const FOCUSED_PERFORMANCE_SAMPLES_PER_CELL = 3 as const;
export const FOCUSED_PERFORMANCE_FIVE_SECOND_OBJECTIVE_MILLISECONDS = 5_000 as const;
export const FOCUSED_PERFORMANCE_CACHE_STATES = ['cold', 'warm'] as const;

export interface FocusedPerformanceModelIdentity {
  readonly family: 'base';
  readonly variant: 'full';
  readonly sizeBytes: 147_951_465;
  readonly sha256: string;
}

export interface FocusedPerformanceModel extends FocusedPerformanceModelIdentity {
  readonly artifact: PerformancePrivateArtifact;
}

export interface FocusedPerformanceRunPlan {
  readonly schemaVersion: 4;
  readonly contractRevision: 7;
  readonly focusedPerformanceRunPlanDigest: string;
  readonly sourceRevision: string;
  readonly sourceProofDigest: string;
  readonly candidateCommit: string;
  readonly platform: 'linux';
  readonly architecture: 'x64';
  readonly backend: PerformanceBackend;
  readonly executionMode: 'representativeHost';
  readonly evidenceClaim: 'representativePerformance';
  readonly candidateSource: Readonly<{
    readonly relativePath: string;
    readonly commit: string;
    readonly sourceProofDigest: string;
    readonly instrumentationOverlaySha256: string;
    readonly derivedTreeManifestSha256: string;
    readonly executableArtifactSha256: string;
  }>;
  readonly qualificationCache: Readonly<{
    readonly snapshotDigest: string;
    readonly evidenceIdentityDigest: string;
    readonly entryCount: number;
    readonly fileCount: number;
    readonly sizeBytes: number;
  }>;
  readonly applicationArtifact: PerformancePrivateArtifact;
  readonly runtimeArtifact: PerformancePrivateArtifact;
  readonly model: FocusedPerformanceModel;
  readonly inputFixture: PerformancePrivateArtifact;
  readonly cachePreparationProcedure: 'linuxFileAdviceV1';
  readonly cacheStates: readonly ['cold', 'warm'];
  readonly successfulSamplesPerCell: 3;
  readonly runOrdering: 'coldThenWarm';
  readonly statistic: 'medianMinimumMaximum';
  readonly fiveSecondObjectiveMilliseconds: 5_000;
  readonly attemptTimeoutMilliseconds: number;
  readonly requiredPhaseIds: readonly LocalWhisperPerformancePhaseId[];
  readonly requiredResourceIds: readonly LocalWhisperPerformanceResourceId[];
  readonly sourceHashBaseline: typeof LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE;
}

export interface FocusedPerformanceManifest extends Omit<
  FocusedPerformanceRunPlan,
  | 'focusedPerformanceRunPlanDigest'
  | 'applicationArtifact'
  | 'runtimeArtifact'
  | 'inputFixture'
  | 'qualificationCache'
  | 'candidateSource'
  | 'attemptTimeoutMilliseconds'
  | 'model'
> {
  readonly focusedPerformanceManifestDigest: string;
  readonly focusedPerformanceRunPlanDigest: string;
  readonly instrumentationOverlaySha256: string;
}

export interface FocusedPerformanceCacheReceipt {
  readonly schemaVersion: 4;
  readonly contractRevision: 7;
  readonly focusedPerformanceCacheReceiptDigest: string;
  readonly focusedPerformanceRunPlanDigest: string;
  readonly focusedPerformanceManifestDigest: string;
  readonly sampleId: string;
  readonly cacheState: PerformanceCacheState;
  readonly sampleIndex: 1 | 2 | 3;
  readonly procedure: 'linuxFileAdviceV1';
  readonly inputSetDigest: string;
  readonly status: 'prepared' | 'failed';
  readonly reasonCode: string | null;
}

export type FocusedPerformanceSample = Readonly<{
  readonly schemaVersion: 4;
  readonly contractRevision: 7;
  readonly focusedPerformanceSampleDigest: string;
  readonly focusedPerformanceRunPlanDigest: string;
  readonly focusedPerformanceManifestDigest: string;
  readonly focusedPerformanceCacheReceiptDigest: string;
  readonly candidateCommit: string;
  readonly platform: 'linux';
  readonly backend: PerformanceBackend;
  readonly sampleId: string;
  readonly model: FocusedPerformanceModelIdentity;
  readonly cacheState: PerformanceCacheState;
  readonly sampleIndex: 1 | 2 | 3;
  readonly status: 'success' | 'failed';
  readonly failureReason: string | null;
  readonly endToEndNanoseconds: number | null;
  readonly phases: readonly PerformancePhaseMeasurement[];
  readonly resources: readonly PerformanceResourceMeasurement[];
  readonly processSettlementProof: 'ownedProcessTreeSettled' | null;
  readonly unownedProcessAttribution: 0 | null;
  readonly unownedGpuAttribution: 0 | 'notApplicable' | null;
}>;

export interface FocusedPerformanceBundle {
  readonly schemaVersion: 4;
  readonly contractRevision: 7;
  readonly focusedPerformanceBundleDigest: string;
  readonly focusedPerformanceRunPlanDigest: string;
  readonly focusedPerformanceManifestDigest: string;
  readonly platform: 'linux';
  readonly backend: PerformanceBackend;
  readonly manifest: FocusedPerformanceManifest;
  readonly cacheReceipts: readonly FocusedPerformanceCacheReceipt[];
  readonly samples: readonly FocusedPerformanceSample[];
}

function baseModelIdentity(): FocusedPerformanceModelIdentity {
  const model = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.find(
    (candidate) => candidate.family === 'base' && candidate.variant === 'full',
  );
  if (!model || model.sizeBytes !== 147_951_465) throw new Error('QUALIFICATION_FOCUSED_BASE_MODEL_INVALID');
  return Object.freeze({ family: 'base', variant: 'full', sizeBytes: 147_951_465, sha256: model.sha256 });
}

export function focusedPerformanceSampleId(cacheState: PerformanceCacheState, sampleIndex: 1 | 2 | 3): string {
  return `base-full-${cacheState}-${String(sampleIndex).padStart(2, '0')}`;
}

export function focusedPerformanceSchedule(): readonly Readonly<{
  readonly cacheState: PerformanceCacheState;
  readonly sampleIndex: 1 | 2 | 3;
  readonly sampleId: string;
}>[] {
  return Object.freeze(
    FOCUSED_PERFORMANCE_CACHE_STATES.flatMap((cacheState) =>
      ([1, 2, 3] as const).map((sampleIndex) =>
        Object.freeze({ cacheState, sampleIndex, sampleId: focusedPerformanceSampleId(cacheState, sampleIndex) }),
      ),
    ),
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[1] ?? 0;
}

/** Produces the revision-7 candidate-only documents; legacy v3 records remain read-only historical evidence. */
export class FocusedPerformanceDocumentProducer {
  private readonly graph: LocalWhisperQualificationGraphProducer;

  public constructor(private readonly validator: LocalWhisperQualificationValidator) {
    this.graph = new LocalWhisperQualificationGraphProducer(validator);
  }

  public produceRunPlan(
    seed: Omit<
      FocusedPerformanceRunPlan,
      | 'schemaVersion'
      | 'contractRevision'
      | 'focusedPerformanceRunPlanDigest'
      | 'architecture'
      | 'cacheStates'
      | 'successfulSamplesPerCell'
      | 'runOrdering'
      | 'statistic'
      | 'fiveSecondObjectiveMilliseconds'
      | 'requiredPhaseIds'
      | 'requiredResourceIds'
      | 'sourceHashBaseline'
      | 'model'
    > & { readonly modelArtifact: PerformancePrivateArtifact },
  ): FocusedPerformanceRunPlan {
    const { modelArtifact, ...planSeed } = seed;
    const model = Object.freeze({ ...baseModelIdentity(), artifact: modelArtifact });
    return this.graph.freeze('focusedPerformanceRunPlan', {
      schemaVersion: FOCUSED_PERFORMANCE_SCHEMA_VERSION,
      contractRevision: FOCUSED_PERFORMANCE_CONTRACT_REVISION,
      ...planSeed,
      architecture: 'x64',
      model,
      cacheStates: FOCUSED_PERFORMANCE_CACHE_STATES,
      successfulSamplesPerCell: FOCUSED_PERFORMANCE_SAMPLES_PER_CELL,
      runOrdering: 'coldThenWarm',
      statistic: 'medianMinimumMaximum',
      fiveSecondObjectiveMilliseconds: FOCUSED_PERFORMANCE_FIVE_SECOND_OBJECTIVE_MILLISECONDS,
      requiredPhaseIds: performanceRequiredPhaseIds('linux', planSeed.backend),
      requiredResourceIds: performanceRequiredResourceIds(planSeed.backend),
      sourceHashBaseline: LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE,
    }) as unknown as FocusedPerformanceRunPlan;
  }

  public produceManifest(plan: FocusedPerformanceRunPlan): FocusedPerformanceManifest {
    this.validator.validateDocument('focusedPerformanceRunPlan', plan);
    return this.graph.freeze('focusedPerformanceManifest', {
      schemaVersion: FOCUSED_PERFORMANCE_SCHEMA_VERSION,
      contractRevision: FOCUSED_PERFORMANCE_CONTRACT_REVISION,
      focusedPerformanceRunPlanDigest: plan.focusedPerformanceRunPlanDigest,
      sourceRevision: plan.sourceRevision,
      sourceProofDigest: plan.sourceProofDigest,
      candidateCommit: plan.candidateCommit,
      platform: plan.platform,
      architecture: plan.architecture,
      backend: plan.backend,
      executionMode: plan.executionMode,
      evidenceClaim: plan.evidenceClaim,
      instrumentationOverlaySha256: plan.candidateSource.instrumentationOverlaySha256,
      model: Object.freeze({
        family: plan.model.family,
        variant: plan.model.variant,
        sizeBytes: plan.model.sizeBytes,
        sha256: plan.model.sha256,
      }),
      cachePreparationProcedure: plan.cachePreparationProcedure,
      cacheStates: plan.cacheStates,
      successfulSamplesPerCell: plan.successfulSamplesPerCell,
      runOrdering: plan.runOrdering,
      statistic: plan.statistic,
      fiveSecondObjectiveMilliseconds: plan.fiveSecondObjectiveMilliseconds,
      requiredPhaseIds: plan.requiredPhaseIds,
      requiredResourceIds: plan.requiredResourceIds,
      sourceHashBaseline: plan.sourceHashBaseline,
    }) as unknown as FocusedPerformanceManifest;
  }

  public produceCacheReceipt(
    manifest: FocusedPerformanceManifest,
    seed: Omit<
      FocusedPerformanceCacheReceipt,
      | 'schemaVersion'
      | 'contractRevision'
      | 'focusedPerformanceCacheReceiptDigest'
      | 'focusedPerformanceRunPlanDigest'
      | 'focusedPerformanceManifestDigest'
      | 'procedure'
    >,
  ): FocusedPerformanceCacheReceipt {
    return this.graph.freeze('focusedPerformanceCacheReceipt', {
      schemaVersion: FOCUSED_PERFORMANCE_SCHEMA_VERSION,
      contractRevision: FOCUSED_PERFORMANCE_CONTRACT_REVISION,
      focusedPerformanceRunPlanDigest: manifest.focusedPerformanceRunPlanDigest,
      focusedPerformanceManifestDigest: manifest.focusedPerformanceManifestDigest,
      procedure: manifest.cachePreparationProcedure,
      ...seed,
    }) as unknown as FocusedPerformanceCacheReceipt;
  }

  public produceSample(
    manifest: FocusedPerformanceManifest,
    seed: Omit<
      FocusedPerformanceSample,
      | 'schemaVersion'
      | 'contractRevision'
      | 'focusedPerformanceSampleDigest'
      | 'focusedPerformanceRunPlanDigest'
      | 'focusedPerformanceManifestDigest'
      | 'candidateCommit'
      | 'platform'
      | 'backend'
      | 'model'
      | 'processSettlementProof'
      | 'unownedProcessAttribution'
      | 'unownedGpuAttribution'
    >,
  ): FocusedPerformanceSample {
    const success = seed.status === 'success';
    return this.graph.freeze('focusedPerformanceSample', {
      schemaVersion: FOCUSED_PERFORMANCE_SCHEMA_VERSION,
      contractRevision: FOCUSED_PERFORMANCE_CONTRACT_REVISION,
      focusedPerformanceRunPlanDigest: manifest.focusedPerformanceRunPlanDigest,
      focusedPerformanceManifestDigest: manifest.focusedPerformanceManifestDigest,
      candidateCommit: manifest.candidateCommit,
      platform: manifest.platform,
      backend: manifest.backend,
      model: manifest.model,
      ...seed,
      processSettlementProof: success ? 'ownedProcessTreeSettled' : null,
      unownedProcessAttribution: success ? 0 : null,
      unownedGpuAttribution: success ? (manifest.backend === 'cpu' ? 'notApplicable' : 0) : null,
    }) as unknown as FocusedPerformanceSample;
  }

  public produceBundle(
    manifest: FocusedPerformanceManifest,
    cacheReceipts: readonly FocusedPerformanceCacheReceipt[],
    samples: readonly FocusedPerformanceSample[],
  ): FocusedPerformanceBundle {
    return this.graph.freeze('focusedPerformanceBundle', {
      schemaVersion: FOCUSED_PERFORMANCE_SCHEMA_VERSION,
      contractRevision: FOCUSED_PERFORMANCE_CONTRACT_REVISION,
      focusedPerformanceRunPlanDigest: manifest.focusedPerformanceRunPlanDigest,
      focusedPerformanceManifestDigest: manifest.focusedPerformanceManifestDigest,
      platform: manifest.platform,
      backend: manifest.backend,
      manifest,
      cacheReceipts,
      samples,
    }) as unknown as FocusedPerformanceBundle;
  }

  public produceResult(bundle: FocusedPerformanceBundle): Readonly<Record<string, unknown>> {
    this.validator.validateDocument('focusedPerformanceBundle', bundle);
    const cells = FOCUSED_PERFORMANCE_CACHE_STATES.map((cacheState) => {
      const samples = bundle.samples.filter((sample) => sample.cacheState === cacheState);
      const successful = samples.filter((sample) => sample.status === 'success' && sample.endToEndNanoseconds !== null);
      const durations = successful.map((sample) => sample.endToEndNanoseconds ?? 0);
      const minimum = durations.length === 3 ? Math.min(...durations) : 0;
      const maximum = durations.length === 3 ? Math.max(...durations) : 0;
      const medianDuration = durations.length === 3 ? median(durations) : 0;
      return Object.freeze({
        cacheState,
        sampleCount: samples.length,
        successfulSampleCount: successful.length,
        failedSampleCount: samples.length - successful.length,
        orderedSampleIds: samples.map((sample) => sample.sampleId),
        durationsNanoseconds: durations,
        medianNanoseconds: medianDuration,
        minimumNanoseconds: minimum,
        maximumNanoseconds: maximum,
        distanceFromFiveSecondsNanoseconds: Math.abs(
          medianDuration - FOCUSED_PERFORMANCE_FIVE_SECOND_OBJECTIVE_MILLISECONDS * 1_000_000,
        ),
        timingGate: 'informationalOnly',
        status: successful.length === FOCUSED_PERFORMANCE_SAMPLES_PER_CELL ? 'Pass' : 'Fail',
      });
    });
    return this.graph.freeze('focusedPerformanceResult', {
      schemaVersion: FOCUSED_PERFORMANCE_SCHEMA_VERSION,
      contractRevision: FOCUSED_PERFORMANCE_CONTRACT_REVISION,
      focusedPerformanceRunPlanDigest: bundle.focusedPerformanceRunPlanDigest,
      focusedPerformanceManifestDigest: bundle.focusedPerformanceManifestDigest,
      focusedPerformanceBundleDigest: bundle.focusedPerformanceBundleDigest,
      candidateCommit: bundle.manifest.candidateCommit,
      platform: bundle.platform,
      backend: bundle.backend,
      model: bundle.manifest.model,
      cells,
      status: cells.every((cell) => cell.status === 'Pass') ? 'Pass' : 'Fail',
      timingGate: 'informationalOnly',
    });
  }
}

/** Creates deterministic contract-only evidence for local schema and statistic verification, never host acceptance. */
export function createFocusedPerformanceFixture(
  validator: LocalWhisperQualificationValidator,
  backend: PerformanceBackend,
): Readonly<{ readonly bundle: FocusedPerformanceBundle; readonly result: Readonly<Record<string, unknown>> }> {
  const hash = (character: string): string => character.repeat(64);
  const artifact = (relativePath: string, sizeBytes: number, sha256: string): PerformancePrivateArtifact =>
    Object.freeze({ relativePath, sizeBytes, sha256 });
  const candidateCommit = 'a'.repeat(40);
  const documents = new FocusedPerformanceDocumentProducer(validator);
  const plan = documents.produceRunPlan({
    sourceRevision: candidateCommit,
    sourceProofDigest: hash('b'),
    candidateCommit,
    platform: 'linux',
    backend,
    executionMode: 'representativeHost',
    evidenceClaim: 'representativePerformance',
    candidateSource: Object.freeze({
      relativePath: 'fixture/derived-candidate',
      commit: candidateCommit,
      sourceProofDigest: hash('b'),
      instrumentationOverlaySha256: hash('c'),
      derivedTreeManifestSha256: hash('d'),
      executableArtifactSha256: hash('e'),
    }),
    qualificationCache: Object.freeze({
      snapshotDigest: hash('f'),
      evidenceIdentityDigest: hash('1'),
      entryCount: 2,
      fileCount: 1,
      sizeBytes: 1024,
    }),
    applicationArtifact: artifact('fixture/derived-candidate/application', 1024, hash('e')),
    runtimeArtifact: artifact('fixture/derived-candidate/runtime', 1024, hash('2')),
    modelArtifact: artifact(
      'fixture/inputs/base-full.bin',
      147_951_465,
      '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    ),
    inputFixture: artifact('fixture/inputs/fixture.wav', 1024, hash('3')),
    cachePreparationProcedure: 'linuxFileAdviceV1',
    attemptTimeoutMilliseconds: 30_000,
  });
  const manifest = documents.produceManifest(plan);
  const receipts = focusedPerformanceSchedule().map((cell) =>
    documents.produceCacheReceipt(manifest, {
      sampleId: cell.sampleId,
      cacheState: cell.cacheState,
      sampleIndex: cell.sampleIndex,
      inputSetDigest: hash('4'),
      status: 'prepared',
      reasonCode: null,
    }),
  );
  const samples = focusedPerformanceSchedule().map((cell, index) =>
    documents.produceSample(manifest, {
      focusedPerformanceCacheReceiptDigest: receipts[index]!.focusedPerformanceCacheReceiptDigest,
      sampleId: cell.sampleId,
      cacheState: cell.cacheState,
      sampleIndex: cell.sampleIndex,
      status: 'success',
      failureReason: null,
      endToEndNanoseconds: 6_000_000_000 + index,
      phases: manifest.requiredPhaseIds.map((id, sequence) => ({ id, sequence, durationNanoseconds: sequence + 1 })),
      resources: manifest.requiredResourceIds.map((id) => ({ id, peakBytes: 1024 })),
    }),
  );
  const bundle = documents.produceBundle(manifest, receipts, samples);
  return Object.freeze({ bundle, result: documents.produceResult(bundle) });
}
