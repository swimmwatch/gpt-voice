import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';

import {
  LOCAL_WHISPER_PERFORMANCE_PHASES,
  LOCAL_WHISPER_PERFORMANCE_RESOURCES,
  LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE,
  LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST,
  LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
  LocalWhisperQualificationGraphProducer,
  type LocalWhisperPerformancePhaseId,
  type LocalWhisperPerformanceResourceId,
  type LocalWhisperQualificationValidator,
} from './QualificationContracts';

export const PERFORMANCE_CANDIDATE_WINDOWS = [1, 2, 4, 8] as const;
export const PERFORMANCE_CACHE_STATES = ['cold', 'warm'] as const;
export const PERFORMANCE_PLANNED_PAIRS = 6 as const;
export const PERFORMANCE_MINIMUM_SUCCESSFUL_PAIRS = 5 as const;
export const PERFORMANCE_SAMPLING_INTERVAL_MILLISECONDS = 100 as const;
export const PERFORMANCE_ATTEMPT_COUNT = 288 as const;
export const PERFORMANCE_SCHEMA_VERSION = 3 as const;
export const PERFORMANCE_CONTRACT_REVISION = 3 as const;

export type PerformanceCandidateWindow = (typeof PERFORMANCE_CANDIDATE_WINDOWS)[number];
export type PerformanceCacheState = (typeof PERFORMANCE_CACHE_STATES)[number];
export type PerformanceExecutionMode = 'hostedFixture' | 'representativeHost';
export type PerformanceEvidenceClaim = 'contractOnly' | 'representativePerformance';
export type PerformancePlatform = 'linux' | 'win32';
export type PerformanceBackend = 'cpu' | 'cuda';
export type PerformanceRunOrder = 'beforeThenAfter' | 'afterThenBefore';
export type PerformanceSide = 'before' | 'after';
export type PerformanceModelFamily = 'base' | 'medium' | 'large-v3';
export type PerformanceModelVariant = 'full' | 'q5_0';

export interface PerformanceModelIdentity {
  readonly family: PerformanceModelFamily;
  readonly variant: PerformanceModelVariant;
  readonly sha256: string;
}

export interface PerformancePrivateArtifact {
  readonly relativePath: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface PerformanceExecutableArtifactIdentity {
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface PerformanceDerivedSourceReceipt {
  readonly schemaVersion: 3;
  readonly contractRevision: 3;
  readonly performanceDerivedSourceReceiptDigest: string;
  readonly side: PerformanceSide;
  readonly parentCommit: string;
  readonly sourceProofDigest: string;
  readonly instrumentationOverlaySha256: string;
  readonly derivedTreeManifestSha256: string;
  readonly executableArtifactIdentity: PerformanceExecutableArtifactIdentity;
}

export interface PerformancePhaseMeasurement {
  readonly id: LocalWhisperPerformancePhaseId;
  readonly sequence: number;
  readonly durationNanoseconds: number;
}

export interface PerformanceResourceMeasurement {
  readonly id: LocalWhisperPerformanceResourceId;
  readonly peakBytes: number;
}

export interface PerformanceQualificationRunPlan {
  readonly schemaVersion: 3;
  readonly contractRevision: 3;
  readonly performanceRunPlanDigest: string;
  readonly sourceRevision: string;
  readonly sourceProofDigest: string;
  readonly platform: PerformancePlatform;
  readonly architecture: 'x64';
  readonly backend: PerformanceBackend;
  readonly executionMode: 'representativeHost';
  readonly evidenceClaim: PerformanceEvidenceClaim;
  readonly baselineCommit: string;
  readonly candidateCommit: string;
  readonly sourceProof: PerformancePrivateArtifact;
  readonly worktrees: Readonly<{
    readonly before: Readonly<{ readonly relativePath: string; readonly commit: string }>;
    readonly after: Readonly<{ readonly relativePath: string; readonly commit: string }>;
  }>;
  readonly derivedSources: Readonly<{
    readonly before: Readonly<{ readonly relativePath: string; readonly receipt: PerformanceDerivedSourceReceipt }>;
    readonly after: Readonly<{ readonly relativePath: string; readonly receipt: PerformanceDerivedSourceReceipt }>;
  }>;
  readonly applicationArtifacts: Readonly<{
    readonly before: PerformancePrivateArtifact;
    readonly after: PerformancePrivateArtifact;
  }>;
  readonly runtimeArtifacts: Readonly<{
    readonly before: PerformancePrivateArtifact;
    readonly after: PerformancePrivateArtifact;
  }>;
  readonly models: readonly Readonly<PerformanceModelIdentity & { readonly artifact: PerformancePrivateArtifact }>[];
  readonly inputFixture: PerformancePrivateArtifact;
  readonly cachePreparation: Readonly<{
    readonly procedure: 'linuxFileAdviceV1' | 'windowsFileCacheV1';
    readonly cold: 'fileAdviceDontNeed';
    readonly warm: 'boundedSequentialRead';
  }>;
  readonly cacheStates: readonly PerformanceCacheState[];
  readonly candidateWindows: readonly PerformanceCandidateWindow[];
  readonly minimumSuccessfulPairs: 5;
  readonly plannedPairsPerCandidateCacheState: 6;
  readonly runOrdering: 'alternatingBeforeAfter';
  readonly statistic: 'medianOfPairedPercentages';
  readonly uncertaintyMethod: 'medianAbsoluteDeviation';
  readonly samplingIntervalMilliseconds: 100;
  readonly attemptTimeoutMilliseconds: number;
  readonly units: Readonly<{
    readonly phaseDuration: 'nanoseconds';
    readonly resourcePeak: 'bytes';
    readonly change: 'percent';
  }>;
  readonly requiredPhaseIds: readonly LocalWhisperPerformancePhaseId[];
  readonly requiredResourceIds: readonly LocalWhisperPerformanceResourceId[];
  readonly sourceHashBaseline: typeof LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE;
}

export interface PerformanceQualificationManifest {
  readonly schemaVersion: 3;
  readonly contractRevision: 3;
  readonly performanceManifestDigest: string;
  readonly performanceRunPlanDigest: string;
  readonly sourceRevision: string;
  readonly sourceProofDigest: string;
  readonly baselineCommit: string;
  readonly candidateCommit: string;
  readonly instrumentationOverlaySha256: string;
  readonly derivedSourceReceipts: Readonly<{
    readonly before: PerformanceDerivedSourceReceipt;
    readonly after: PerformanceDerivedSourceReceipt;
  }>;
  readonly platform: PerformancePlatform;
  readonly architecture: 'x64';
  readonly backend: PerformanceBackend;
  readonly executionMode: PerformanceExecutionMode;
  readonly evidenceClaim: PerformanceEvidenceClaim;
  readonly inputFixtureDigest: string;
  readonly modelArtifacts: readonly PerformanceModelIdentity[];
  readonly cachePreparationProcedure: 'linuxFileAdviceV1' | 'windowsFileCacheV1';
  readonly cacheStates: readonly PerformanceCacheState[];
  readonly candidateWindows: readonly PerformanceCandidateWindow[];
  readonly minimumSuccessfulPairs: 5;
  readonly plannedPairsPerCandidateCacheState: 6;
  readonly runOrdering: 'alternatingBeforeAfter';
  readonly statistic: 'medianOfPairedPercentages';
  readonly uncertaintyMethod: 'medianAbsoluteDeviation';
  readonly samplingIntervalMilliseconds: 100;
  readonly units: Readonly<{
    readonly phaseDuration: 'nanoseconds';
    readonly resourcePeak: 'bytes';
    readonly change: 'percent';
  }>;
  readonly requiredPhaseIds: readonly LocalWhisperPerformancePhaseId[];
  readonly requiredResourceIds: readonly LocalWhisperPerformanceResourceId[];
  readonly sourceHashBaseline: typeof LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE;
}

export interface PerformanceCacheReceipt {
  readonly schemaVersion: 3;
  readonly contractRevision: 3;
  readonly performanceCacheReceiptDigest: string;
  readonly performanceRunPlanDigest: string;
  readonly performanceManifestDigest: string;
  readonly sampleId: string;
  readonly cacheState: PerformanceCacheState;
  readonly procedure: 'linuxFileAdviceV1' | 'windowsFileCacheV1';
  readonly inputSetDigest: string;
  readonly status: 'prepared' | 'failed';
  readonly reasonCode: string | null;
}

interface PerformanceSampleBase {
  readonly schemaVersion: 3;
  readonly contractRevision: 3;
  readonly performanceSampleDigest: string;
  readonly performanceRunPlanDigest: string;
  readonly performanceManifestDigest: string;
  readonly cacheReceiptDigest: string;
  readonly baselineCommit: string;
  readonly candidateCommit: string;
  readonly platform: PerformancePlatform;
  readonly backend: PerformanceBackend;
  readonly sampleId: string;
  readonly model: PerformanceModelIdentity;
  readonly candidateWindow: PerformanceCandidateWindow;
  readonly cacheState: PerformanceCacheState;
  readonly pairIndex: number;
  readonly runOrder: PerformanceRunOrder;
  readonly side: PerformanceSide;
}

export type PerformanceQualificationSample = PerformanceSampleBase &
  (
    | {
        readonly status: 'success';
        readonly failureReason: null;
        readonly endToEndNanoseconds: number;
        readonly phases: readonly PerformancePhaseMeasurement[];
        readonly resources: readonly PerformanceResourceMeasurement[];
        readonly processSettlementProof: 'ownedProcessTreeSettled';
        readonly unownedProcessAttribution: 0;
        readonly unownedGpuAttribution: 0 | 'notApplicable';
      }
    | {
        readonly status: 'failed';
        readonly failureReason: string;
        readonly endToEndNanoseconds: null;
        readonly phases: readonly [];
        readonly resources: readonly [];
        readonly processSettlementProof: null;
        readonly unownedProcessAttribution: null;
        readonly unownedGpuAttribution: null;
      }
  );

export interface PerformanceQualificationBundle {
  readonly schemaVersion: 3;
  readonly contractRevision: 3;
  readonly performanceBundleDigest: string;
  readonly performanceRunPlanDigest: string;
  readonly performanceManifestDigest: string;
  readonly platform: PerformancePlatform;
  readonly backend: PerformanceBackend;
  readonly executionMode: PerformanceExecutionMode;
  readonly evidenceClaim: PerformanceEvidenceClaim;
  readonly manifest: PerformanceQualificationManifest;
  readonly cacheReceipts: readonly PerformanceCacheReceipt[];
  readonly samples: readonly PerformanceQualificationSample[];
}

export type PerformanceRunPlanSeed = Omit<
  PerformanceQualificationRunPlan,
  | 'schemaVersion'
  | 'contractRevision'
  | 'performanceRunPlanDigest'
  | 'architecture'
  | 'cacheStates'
  | 'candidateWindows'
  | 'minimumSuccessfulPairs'
  | 'plannedPairsPerCandidateCacheState'
  | 'runOrdering'
  | 'statistic'
  | 'uncertaintyMethod'
  | 'samplingIntervalMilliseconds'
  | 'units'
  | 'requiredPhaseIds'
  | 'requiredResourceIds'
  | 'sourceHashBaseline'
>;

export interface PerformanceManifestSeed {
  readonly platform: PerformancePlatform;
  readonly backend: PerformanceBackend;
  readonly executionMode: 'hostedFixture';
  readonly evidenceClaim: 'contractOnly';
  readonly performanceRunPlanDigest: string;
  readonly baselineCommit: string;
  readonly candidateCommit: string;
  readonly inputFixtureDigest: string;
  readonly derivedSourceReceipts: Readonly<{
    readonly before: PerformanceDerivedSourceReceipt;
    readonly after: PerformanceDerivedSourceReceipt;
  }>;
  readonly sourceRevision?: string;
  readonly sourceProofDigest?: string;
}

export type PerformanceDerivedSourceReceiptSeed = Omit<
  PerformanceDerivedSourceReceipt,
  'schemaVersion' | 'contractRevision' | 'performanceDerivedSourceReceiptDigest'
>;

export type PerformanceSampleSeed = Omit<
  PerformanceSampleBase,
  | 'schemaVersion'
  | 'contractRevision'
  | 'performanceSampleDigest'
  | 'performanceRunPlanDigest'
  | 'performanceManifestDigest'
  | 'baselineCommit'
  | 'candidateCommit'
  | 'platform'
  | 'backend'
> &
  (
    | {
        readonly status: 'success';
        readonly endToEndNanoseconds: number;
        readonly phases: readonly PerformancePhaseMeasurement[];
        readonly resources: readonly PerformanceResourceMeasurement[];
      }
    | { readonly status: 'failed'; readonly failureReason: string }
  );

export type PerformanceCacheReceiptSeed = Omit<
  PerformanceCacheReceipt,
  | 'schemaVersion'
  | 'contractRevision'
  | 'performanceCacheReceiptDigest'
  | 'performanceRunPlanDigest'
  | 'performanceManifestDigest'
  | 'procedure'
>;

function digestField(value: unknown, field: string): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('QUALIFICATION_PERFORMANCE_DOCUMENT_INVALID');
  }
  const digest = (value as Readonly<Record<string, unknown>>)[field];
  if (typeof digest !== 'string') throw new Error('QUALIFICATION_PERFORMANCE_DOCUMENT_INVALID');
  return digest;
}

export function performanceRequiredPhaseIds(
  platform: PerformancePlatform,
  backend: PerformanceBackend,
): LocalWhisperPerformancePhaseId[] {
  return LOCAL_WHISPER_PERFORMANCE_PHASES.map(({ id }) => id).filter(
    (id) =>
      !(platform === 'win32' && id === 'nativeAuthorityDigest') && !(backend === 'cpu' && id === 'gpuUploadAllocation'),
  );
}

export function performanceRequiredResourceIds(backend: PerformanceBackend): LocalWhisperPerformanceResourceId[] {
  return LOCAL_WHISPER_PERFORMANCE_RESOURCES.map(({ id }) => id).filter(
    (id) => !(backend === 'cpu' && id === 'gpuPeakVram'),
  );
}

export function performanceSelectedModels(): readonly PerformanceModelIdentity[] {
  return Object.freeze(
    (
      [
        ['base', 'full'],
        ['medium', 'full'],
        ['large-v3', 'q5_0'],
      ] as const
    ).map(([family, variant]) => {
      const model = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.find(
        (candidate) => candidate.family === family && candidate.variant === variant,
      );
      if (!model) throw new Error('QUALIFICATION_PERFORMANCE_MODEL_MATRIX_INVALID');
      return Object.freeze({ family, variant, sha256: model.sha256 });
    }),
  );
}

export function performanceExpectedRunOrder(pairIndex: number): PerformanceRunOrder {
  return pairIndex % 2 === 1 ? 'beforeThenAfter' : 'afterThenBefore';
}

export function performanceOrderedSides(runOrder: PerformanceRunOrder): readonly PerformanceSide[] {
  return runOrder === 'beforeThenAfter' ? ['before', 'after'] : ['after', 'before'];
}

export function performanceSampleId(input: {
  readonly model: PerformanceModelIdentity;
  readonly candidateWindow: PerformanceCandidateWindow;
  readonly cacheState: PerformanceCacheState;
  readonly pairIndex: number;
  readonly side: PerformanceSide;
}): string {
  return `${input.model.family}-${input.model.variant}-${input.candidateWindow}-${input.cacheState}-${String(input.pairIndex).padStart(2, '0')}-${input.side}`;
}

export interface PerformanceScheduleCell {
  readonly sampleId: string;
  readonly model: PerformanceModelIdentity;
  readonly candidateWindow: PerformanceCandidateWindow;
  readonly cacheState: PerformanceCacheState;
  readonly pairIndex: number;
  readonly runOrder: PerformanceRunOrder;
  readonly side: PerformanceSide;
}

/** Expands the frozen model/window/cache/pair/side order into exactly 288 immutable cells. */
export function performanceSchedule(
  manifest: Pick<
    PerformanceQualificationManifest,
    'modelArtifacts' | 'candidateWindows' | 'cacheStates' | 'plannedPairsPerCandidateCacheState'
  >,
): readonly PerformanceScheduleCell[] {
  return Object.freeze(
    manifest.modelArtifacts.flatMap((model) =>
      manifest.candidateWindows.flatMap((candidateWindow) =>
        manifest.cacheStates.flatMap((cacheState) =>
          Array.from({ length: manifest.plannedPairsPerCandidateCacheState }, (_unused, index) => index + 1).flatMap(
            (pairIndex) => {
              const runOrder = performanceExpectedRunOrder(pairIndex);
              return performanceOrderedSides(runOrder).map((side) =>
                Object.freeze({
                  sampleId: performanceSampleId({ model, candidateWindow, cacheState, pairIndex, side }),
                  model,
                  candidateWindow,
                  cacheState,
                  pairIndex,
                  runOrder,
                  side,
                }),
              );
            },
          ),
        ),
      ),
    ),
  );
}

/** Produces digest-linked immutable schema-v3 performance documents. */
export class LocalWhisperPerformanceDocumentProducer {
  private readonly graph: LocalWhisperQualificationGraphProducer;

  public constructor(private readonly validator: LocalWhisperQualificationValidator) {
    this.graph = new LocalWhisperQualificationGraphProducer(validator);
  }

  public produceRunPlan(seed: PerformanceRunPlanSeed): PerformanceQualificationRunPlan {
    const document = this.graph.freeze('performanceRunPlan', {
      schemaVersion: PERFORMANCE_SCHEMA_VERSION,
      contractRevision: PERFORMANCE_CONTRACT_REVISION,
      ...seed,
      architecture: 'x64',
      cacheStates: PERFORMANCE_CACHE_STATES,
      candidateWindows: PERFORMANCE_CANDIDATE_WINDOWS,
      minimumSuccessfulPairs: PERFORMANCE_MINIMUM_SUCCESSFUL_PAIRS,
      plannedPairsPerCandidateCacheState: PERFORMANCE_PLANNED_PAIRS,
      runOrdering: 'alternatingBeforeAfter',
      statistic: 'medianOfPairedPercentages',
      uncertaintyMethod: 'medianAbsoluteDeviation',
      samplingIntervalMilliseconds: PERFORMANCE_SAMPLING_INTERVAL_MILLISECONDS,
      units: Object.freeze({ phaseDuration: 'nanoseconds', resourcePeak: 'bytes', change: 'percent' }),
      requiredPhaseIds: performanceRequiredPhaseIds(seed.platform, seed.backend),
      requiredResourceIds: performanceRequiredResourceIds(seed.backend),
      sourceHashBaseline: LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE,
    });
    return document as unknown as PerformanceQualificationRunPlan;
  }

  public produceManifestFromRunPlan(plan: PerformanceQualificationRunPlan): PerformanceQualificationManifest {
    this.validator.validateDocument('performanceRunPlan', plan);
    const document = this.graph.freeze('performanceManifest', {
      schemaVersion: PERFORMANCE_SCHEMA_VERSION,
      contractRevision: PERFORMANCE_CONTRACT_REVISION,
      performanceRunPlanDigest: plan.performanceRunPlanDigest,
      sourceRevision: plan.sourceRevision,
      sourceProofDigest: plan.sourceProofDigest,
      baselineCommit: plan.baselineCommit,
      candidateCommit: plan.candidateCommit,
      instrumentationOverlaySha256: plan.derivedSources.before.receipt.instrumentationOverlaySha256,
      derivedSourceReceipts: Object.freeze({
        before: plan.derivedSources.before.receipt,
        after: plan.derivedSources.after.receipt,
      }),
      platform: plan.platform,
      architecture: plan.architecture,
      backend: plan.backend,
      executionMode: plan.executionMode,
      evidenceClaim: plan.evidenceClaim,
      inputFixtureDigest: plan.inputFixture.sha256,
      modelArtifacts: plan.models.map(({ family, variant, sha256 }) => ({ family, variant, sha256 })),
      cachePreparationProcedure: plan.cachePreparation.procedure,
      cacheStates: plan.cacheStates,
      candidateWindows: plan.candidateWindows,
      minimumSuccessfulPairs: plan.minimumSuccessfulPairs,
      plannedPairsPerCandidateCacheState: plan.plannedPairsPerCandidateCacheState,
      runOrdering: plan.runOrdering,
      statistic: plan.statistic,
      uncertaintyMethod: plan.uncertaintyMethod,
      samplingIntervalMilliseconds: plan.samplingIntervalMilliseconds,
      units: plan.units,
      requiredPhaseIds: plan.requiredPhaseIds,
      requiredResourceIds: plan.requiredResourceIds,
      sourceHashBaseline: plan.sourceHashBaseline,
    });
    return document as unknown as PerformanceQualificationManifest;
  }

  public produceHostedManifest(seed: PerformanceManifestSeed): PerformanceQualificationManifest {
    const document = this.graph.freeze('performanceManifest', {
      schemaVersion: PERFORMANCE_SCHEMA_VERSION,
      contractRevision: PERFORMANCE_CONTRACT_REVISION,
      performanceRunPlanDigest: seed.performanceRunPlanDigest,
      sourceRevision: seed.sourceRevision ?? LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
      sourceProofDigest: seed.sourceProofDigest ?? LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST,
      baselineCommit: seed.baselineCommit,
      candidateCommit: seed.candidateCommit,
      instrumentationOverlaySha256: seed.derivedSourceReceipts.before.instrumentationOverlaySha256,
      derivedSourceReceipts: seed.derivedSourceReceipts,
      platform: seed.platform,
      architecture: 'x64',
      backend: seed.backend,
      executionMode: seed.executionMode,
      evidenceClaim: seed.evidenceClaim,
      inputFixtureDigest: seed.inputFixtureDigest,
      modelArtifacts: performanceSelectedModels(),
      cachePreparationProcedure: seed.platform === 'linux' ? 'linuxFileAdviceV1' : 'windowsFileCacheV1',
      cacheStates: PERFORMANCE_CACHE_STATES,
      candidateWindows: PERFORMANCE_CANDIDATE_WINDOWS,
      minimumSuccessfulPairs: PERFORMANCE_MINIMUM_SUCCESSFUL_PAIRS,
      plannedPairsPerCandidateCacheState: PERFORMANCE_PLANNED_PAIRS,
      runOrdering: 'alternatingBeforeAfter',
      statistic: 'medianOfPairedPercentages',
      uncertaintyMethod: 'medianAbsoluteDeviation',
      samplingIntervalMilliseconds: PERFORMANCE_SAMPLING_INTERVAL_MILLISECONDS,
      units: Object.freeze({ phaseDuration: 'nanoseconds', resourcePeak: 'bytes', change: 'percent' }),
      requiredPhaseIds: performanceRequiredPhaseIds(seed.platform, seed.backend),
      requiredResourceIds: performanceRequiredResourceIds(seed.backend),
      sourceHashBaseline: LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE,
    });
    return document as unknown as PerformanceQualificationManifest;
  }

  public produceDerivedSourceReceipt(seed: PerformanceDerivedSourceReceiptSeed): PerformanceDerivedSourceReceipt {
    const document = this.graph.freeze('performanceDerivedSourceReceipt', {
      schemaVersion: PERFORMANCE_SCHEMA_VERSION,
      contractRevision: PERFORMANCE_CONTRACT_REVISION,
      ...seed,
    });
    return document as unknown as PerformanceDerivedSourceReceipt;
  }

  public produceCacheReceipt(
    manifest: PerformanceQualificationManifest,
    seed: PerformanceCacheReceiptSeed,
  ): PerformanceCacheReceipt {
    this.validator.validateDocument('performanceManifest', manifest);
    const document = this.graph.freeze('performanceCacheReceipt', {
      schemaVersion: PERFORMANCE_SCHEMA_VERSION,
      contractRevision: PERFORMANCE_CONTRACT_REVISION,
      performanceRunPlanDigest: manifest.performanceRunPlanDigest,
      performanceManifestDigest: manifest.performanceManifestDigest,
      procedure: manifest.cachePreparationProcedure,
      ...seed,
    });
    return document as unknown as PerformanceCacheReceipt;
  }

  public produceSample(
    manifest: PerformanceQualificationManifest,
    seed: PerformanceSampleSeed,
  ): PerformanceQualificationSample {
    this.validator.validateDocument('performanceManifest', manifest);
    const common = {
      schemaVersion: PERFORMANCE_SCHEMA_VERSION,
      contractRevision: PERFORMANCE_CONTRACT_REVISION,
      performanceRunPlanDigest: manifest.performanceRunPlanDigest,
      performanceManifestDigest: manifest.performanceManifestDigest,
      baselineCommit: manifest.baselineCommit,
      candidateCommit: manifest.candidateCommit,
      platform: manifest.platform,
      backend: manifest.backend,
      cacheReceiptDigest: seed.cacheReceiptDigest,
      sampleId: seed.sampleId,
      model: seed.model,
      candidateWindow: seed.candidateWindow,
      cacheState: seed.cacheState,
      pairIndex: seed.pairIndex,
      runOrder: seed.runOrder,
      side: seed.side,
    } as const;
    const document =
      seed.status === 'success'
        ? this.graph.freeze('performanceSample', {
            ...common,
            status: 'success',
            failureReason: null,
            endToEndNanoseconds: seed.endToEndNanoseconds,
            phases: seed.phases,
            resources: seed.resources,
            processSettlementProof: 'ownedProcessTreeSettled',
            unownedProcessAttribution: 0,
            unownedGpuAttribution: manifest.backend === 'cpu' ? 'notApplicable' : 0,
          })
        : this.graph.freeze('performanceSample', {
            ...common,
            status: 'failed',
            failureReason: seed.failureReason,
            endToEndNanoseconds: null,
            phases: [],
            resources: [],
            processSettlementProof: null,
            unownedProcessAttribution: null,
            unownedGpuAttribution: null,
          });
    return document as unknown as PerformanceQualificationSample;
  }

  public produceBundle(
    manifest: PerformanceQualificationManifest,
    cacheReceipts: readonly PerformanceCacheReceipt[],
    samples: readonly PerformanceQualificationSample[],
  ): PerformanceQualificationBundle {
    const document = this.graph.freeze('performanceBundle', {
      schemaVersion: PERFORMANCE_SCHEMA_VERSION,
      contractRevision: PERFORMANCE_CONTRACT_REVISION,
      performanceRunPlanDigest: manifest.performanceRunPlanDigest,
      performanceManifestDigest: manifest.performanceManifestDigest,
      platform: manifest.platform,
      backend: manifest.backend,
      executionMode: manifest.executionMode,
      evidenceClaim: manifest.evidenceClaim,
      manifest,
      cacheReceipts,
      samples,
    });
    return document as unknown as PerformanceQualificationBundle;
  }
}

export function performanceDocumentDigest(value: unknown, field: string): string {
  return digestField(value, field);
}
