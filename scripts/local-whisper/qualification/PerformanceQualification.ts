import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';

import {
  LOCAL_WHISPER_PERFORMANCE_PHASES,
  LOCAL_WHISPER_PERFORMANCE_RESOURCES,
  LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE,
  LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
  LocalWhisperQualificationGraphProducer,
  type LocalWhisperPerformancePhaseId,
  type LocalWhisperPerformanceResourceId,
  type LocalWhisperQualificationValidator,
} from './QualificationContracts';
const PERFORMANCE_CANDIDATE_WINDOWS = [1, 2, 4, 8] as const;
const PERFORMANCE_CACHE_STATES = ['cold', 'warm'] as const;

export type PerformanceCandidateWindow = (typeof PERFORMANCE_CANDIDATE_WINDOWS)[number];
export type PerformanceCacheState = (typeof PERFORMANCE_CACHE_STATES)[number];
export type PerformanceExecutionMode = 'hostedFixture' | 'representativeHost';
export type PerformancePlatform = 'linux' | 'win32';
export type PerformanceBackend = 'cpu' | 'cuda';
export type PerformanceRunOrder = 'beforeThenAfter' | 'afterThenBefore';
export type PerformanceSide = 'before' | 'after';

export interface PerformancePhaseMeasurement {
  readonly id: LocalWhisperPerformancePhaseId;
  readonly sequence: number;
  readonly durationNanoseconds: number;
}

export interface PerformanceResourceMeasurement {
  readonly id: LocalWhisperPerformanceResourceId;
  readonly peakBytes: number;
}

export interface PerformanceQualificationManifest {
  readonly schemaVersion: 1;
  readonly contractRevision: 1;
  readonly performanceManifestDigest: string;
  readonly sourceRevision: string;
  readonly platform: PerformancePlatform;
  readonly architecture: 'x64';
  readonly backend: PerformanceBackend;
  readonly executionMode: PerformanceExecutionMode;
  readonly evidenceClaim: 'contractOnly' | 'representativePerformance';
  readonly inputFixtureDigest: string;
  readonly modelArtifacts: readonly {
    readonly family: 'base' | 'medium' | 'large-v3';
    readonly variant: 'full' | 'q5_0';
    readonly sha256: string;
  }[];
  readonly cacheStates: readonly PerformanceCacheState[];
  readonly candidateWindows: readonly PerformanceCandidateWindow[];
  readonly minimumSuccessfulPairs: 5;
  readonly plannedPairsPerCandidateCacheState: number;
  readonly runOrdering: 'alternatingBeforeAfter';
  readonly statistic: 'medianOfPairedPercentages';
  readonly uncertaintyMethod: 'medianAbsoluteDeviation';
  readonly samplingIntervalMilliseconds: number;
  readonly units: Readonly<{
    readonly phaseDuration: 'nanoseconds';
    readonly resourcePeak: 'bytes';
    readonly change: 'percent';
  }>;
  readonly requiredPhaseIds: readonly LocalWhisperPerformancePhaseId[];
  readonly requiredResourceIds: readonly LocalWhisperPerformanceResourceId[];
  readonly sourceHashBaseline: typeof LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE;
}

interface PerformanceSampleBase {
  readonly schemaVersion: 1;
  readonly contractRevision: 1;
  readonly performanceSampleDigest: string;
  readonly performanceManifestDigest: string;
  readonly sampleId: string;
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
      }
    | {
        readonly status: 'failed';
        readonly failureReason: string;
        readonly endToEndNanoseconds: null;
        readonly phases: readonly [];
        readonly resources: readonly [];
      }
  );

export interface PerformanceManifestSeed {
  readonly platform: PerformancePlatform;
  readonly backend: PerformanceBackend;
  readonly executionMode: PerformanceExecutionMode;
  readonly inputFixtureDigest: string;
  readonly plannedPairsPerCandidateCacheState?: number;
  readonly samplingIntervalMilliseconds?: number;
}

export type PerformanceSampleSeed = Omit<
  PerformanceSampleBase,
  'schemaVersion' | 'contractRevision' | 'performanceSampleDigest' | 'performanceManifestDigest'
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

function digestField(value: unknown, field: string): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('QUALIFICATION_PERFORMANCE_DOCUMENT_INVALID');
  }
  const digest = (value as Readonly<Record<string, unknown>>)[field];
  if (typeof digest !== 'string') throw new Error('QUALIFICATION_PERFORMANCE_DOCUMENT_INVALID');
  return digest;
}

function requiredPhaseIds(
  platform: PerformancePlatform,
  backend: PerformanceBackend,
): LocalWhisperPerformancePhaseId[] {
  return LOCAL_WHISPER_PERFORMANCE_PHASES.map(({ id }) => id).filter(
    (id) =>
      !(platform === 'win32' && id === 'nativeAuthorityDigest') && !(backend === 'cpu' && id === 'gpuUploadAllocation'),
  );
}

function requiredResourceIds(backend: PerformanceBackend): LocalWhisperPerformanceResourceId[] {
  return LOCAL_WHISPER_PERFORMANCE_RESOURCES.map(({ id }) => id).filter(
    (id) => !(backend === 'cpu' && id === 'gpuPeakVram'),
  );
}

function selectedModels(): PerformanceQualificationManifest['modelArtifacts'] {
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

/** Produces digest-linked immutable performance manifests and samples through qualification-v2 validation. */
export class LocalWhisperPerformanceDocumentProducer {
  private readonly graph: LocalWhisperQualificationGraphProducer;

  public constructor(private readonly validator: LocalWhisperQualificationValidator) {
    this.graph = new LocalWhisperQualificationGraphProducer(validator);
  }

  public produceManifest(seed: PerformanceManifestSeed): PerformanceQualificationManifest {
    const document = this.graph.freeze('performanceManifest', {
      schemaVersion: 1,
      contractRevision: 1,
      sourceRevision: LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
      platform: seed.platform,
      architecture: 'x64',
      backend: seed.backend,
      executionMode: seed.executionMode,
      evidenceClaim: seed.executionMode === 'hostedFixture' ? 'contractOnly' : 'representativePerformance',
      inputFixtureDigest: seed.inputFixtureDigest,
      modelArtifacts: selectedModels(),
      cacheStates: PERFORMANCE_CACHE_STATES,
      candidateWindows: PERFORMANCE_CANDIDATE_WINDOWS,
      minimumSuccessfulPairs: 5,
      plannedPairsPerCandidateCacheState: seed.plannedPairsPerCandidateCacheState ?? 6,
      runOrdering: 'alternatingBeforeAfter',
      statistic: 'medianOfPairedPercentages',
      uncertaintyMethod: 'medianAbsoluteDeviation',
      samplingIntervalMilliseconds: seed.samplingIntervalMilliseconds ?? 100,
      units: Object.freeze({ phaseDuration: 'nanoseconds', resourcePeak: 'bytes', change: 'percent' }),
      requiredPhaseIds: requiredPhaseIds(seed.platform, seed.backend),
      requiredResourceIds: requiredResourceIds(seed.backend),
      sourceHashBaseline: LOCAL_WHISPER_PERFORMANCE_SOURCE_HASH_BASELINE,
    });
    return document as unknown as PerformanceQualificationManifest;
  }

  public produceSample(
    manifest: PerformanceQualificationManifest,
    seed: PerformanceSampleSeed,
  ): PerformanceQualificationSample {
    this.validator.validateDocument('performanceManifest', manifest);
    const common = {
      schemaVersion: 1,
      contractRevision: 1,
      performanceManifestDigest: manifest.performanceManifestDigest,
      sampleId: seed.sampleId,
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
          })
        : this.graph.freeze('performanceSample', {
            ...common,
            status: 'failed',
            failureReason: seed.failureReason,
            endToEndNanoseconds: null,
            phases: [],
            resources: [],
          });
    return document as unknown as PerformanceQualificationSample;
  }
}

export function performanceDocumentDigest(value: unknown, field: string): string {
  return digestField(value, field);
}
