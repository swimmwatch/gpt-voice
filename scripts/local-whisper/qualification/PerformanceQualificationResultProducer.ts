import {
  LocalWhisperQualificationGraphProducer,
  type LocalWhisperPerformancePhaseId,
  type LocalWhisperPerformanceResourceId,
  type LocalWhisperQualificationValidator,
} from './QualificationContracts';
import {
  PERFORMANCE_CONTRACT_REVISION,
  PERFORMANCE_SCHEMA_VERSION,
  type PerformanceCacheState,
  type PerformanceModelIdentity,
  type PerformanceQualificationBundle,
  type PerformanceQualificationManifest,
  type PerformanceQualificationSample,
} from './PerformanceQualification';
import {
  LOCAL_WHISPER_PERFORMANCE_MAXIMUM_CONSERVATIVE_REGRESSION_PERCENT,
  LOCAL_WHISPER_PERFORMANCE_MINIMUM_CONSERVATIVE_IMPROVEMENT_PERCENT,
  qualificationImprovementPercentage,
  qualificationPairedEstimate,
  qualificationRegressionPercentage,
} from './QualificationMetrics';

const INSTALLATION_TARGET_PHASES = ['installationPipeWait', 'installationWrite'] as const;

interface SuccessfulPair {
  readonly before: Extract<PerformanceQualificationSample, { readonly status: 'success' }>;
  readonly after: Extract<PerformanceQualificationSample, { readonly status: 'success' }>;
}

interface SamplePair {
  before?: PerformanceQualificationSample;
  after?: PerformanceQualificationSample;
}

function phaseDuration(sample: SuccessfulPair['before'], phaseId: LocalWhisperPerformancePhaseId): number {
  const phase = sample.phases.find(({ id }) => id === phaseId);
  if (!phase) throw new Error('QUALIFICATION_PERFORMANCE_PHASE_MISSING');
  return phase.durationNanoseconds;
}

function targetDuration(sample: SuccessfulPair['before']): number {
  return INSTALLATION_TARGET_PHASES.reduce((total, phaseId) => total + phaseDuration(sample, phaseId), 0);
}

function resourcePeak(sample: SuccessfulPair['before'], resourceId: LocalWhisperPerformanceResourceId): number {
  const resource = sample.resources.find(({ id }) => id === resourceId);
  if (!resource) throw new Error('QUALIFICATION_PERFORMANCE_RESOURCE_MISSING');
  return resource.peakBytes;
}

function modelKey(model: PerformanceModelIdentity): string {
  return `${model.family}|${model.variant}|${model.sha256}`;
}

function cellKey(model: PerformanceModelIdentity, candidateWindow: number, cacheState: PerformanceCacheState): string {
  return `${modelKey(model)}|${candidateWindow}|${cacheState}`;
}

/** Produces aggregate-only per-model/per-cache rows without selecting a production window. */
export class LocalWhisperPerformanceResultProducer {
  private readonly graph: LocalWhisperQualificationGraphProducer;

  public constructor(private readonly validator: LocalWhisperQualificationValidator) {
    this.graph = new LocalWhisperQualificationGraphProducer(validator);
  }

  public produce(bundle: PerformanceQualificationBundle): Readonly<Record<string, unknown>> {
    bundle = this.validator.validateAndFreezeDocument(
      'performanceBundle',
      bundle,
    ) as unknown as PerformanceQualificationBundle;
    const manifest = bundle.manifest;
    const groups = this.groupPairs(manifest, bundle.samples);
    const candidateResults = manifest.modelArtifacts.flatMap((model) =>
      manifest.candidateWindows.map((candidateWindow) => {
        const cacheResults = manifest.cacheStates.map((cacheState) =>
          this.produceCacheResult(manifest, groups, bundle.samples, model, candidateWindow, cacheState),
        );
        const reasonCodes = cacheResults.some(({ status }) => status === 'Fail') ? ['CACHE_CELL_FAILED'] : [];
        return Object.freeze({
          model: Object.freeze({ family: model.family, variant: model.variant }),
          candidateWindow,
          cacheResults,
          status: reasonCodes.length === 0 ? ('Pass' as const) : ('Fail' as const),
          reasonCodes,
        });
      }),
    );
    const successfulAttempts = bundle.samples.filter(({ status }) => status === 'success').length;
    return this.graph.freeze('performanceResult', {
      schemaVersion: PERFORMANCE_SCHEMA_VERSION,
      contractRevision: PERFORMANCE_CONTRACT_REVISION,
      performanceRunPlanDigest: bundle.performanceRunPlanDigest,
      performanceManifestDigest: bundle.performanceManifestDigest,
      performanceBundleDigest: bundle.performanceBundleDigest,
      baselineCommit: manifest.baselineCommit,
      candidateCommit: manifest.candidateCommit,
      sourceProofDigest: manifest.sourceProofDigest,
      instrumentationOverlaySha256: manifest.instrumentationOverlaySha256,
      platform: bundle.platform,
      architecture: 'x64',
      backend: bundle.backend,
      executionMode: bundle.executionMode,
      evidenceClaim: bundle.evidenceClaim,
      attemptCounts: Object.freeze({
        planned: bundle.samples.length,
        successful: successfulAttempts,
        failed: bundle.samples.length - successfulAttempts,
      }),
      candidateResults,
      selectedInFlightWindow: null,
      selectionStatus: bundle.evidenceClaim === 'contractOnly' ? 'fixtureOnly' : 'awaitingCrossPlatform',
      sourceHashBaseline: manifest.sourceHashBaseline,
    });
  }

  private groupPairs(
    manifest: PerformanceQualificationManifest,
    samples: readonly PerformanceQualificationSample[],
  ): ReadonlyMap<string, readonly SuccessfulPair[]> {
    const pairs = new Map<string, SamplePair>();
    for (const sample of samples) {
      const key = `${cellKey(sample.model, sample.candidateWindow, sample.cacheState)}|${sample.pairIndex}`;
      const pair = pairs.get(key) ?? {};
      pair[sample.side] = sample;
      pairs.set(key, pair);
    }
    const successful = new Map<string, readonly SuccessfulPair[]>();
    for (const model of manifest.modelArtifacts) {
      for (const candidateWindow of manifest.candidateWindows) {
        for (const cacheState of manifest.cacheStates) {
          const cell = cellKey(model, candidateWindow, cacheState);
          const complete: SuccessfulPair[] = [];
          for (let pairIndex = 1; pairIndex <= manifest.plannedPairsPerCandidateCacheState; pairIndex += 1) {
            const pair = pairs.get(`${cell}|${pairIndex}`);
            if (!pair?.before || !pair.after) throw new Error('QUALIFICATION_PERFORMANCE_PAIR_SET_INCOMPLETE');
            if (pair.before.status === 'success' && pair.after.status === 'success') {
              complete.push(Object.freeze({ before: pair.before, after: pair.after }));
            }
          }
          successful.set(cell, Object.freeze(complete));
        }
      }
    }
    return successful;
  }

  private produceCacheResult(
    manifest: PerformanceQualificationManifest,
    groups: ReadonlyMap<string, readonly SuccessfulPair[]>,
    samples: readonly PerformanceQualificationSample[],
    model: PerformanceModelIdentity,
    candidateWindow: number,
    cacheState: PerformanceCacheState,
  ): Readonly<Record<string, unknown>> {
    const pairs = groups.get(cellKey(model, candidateWindow, cacheState)) ?? [];
    const successfulAttempts = samples.filter(
      (sample) =>
        modelKey(sample.model) === modelKey(model) &&
        sample.candidateWindow === candidateWindow &&
        sample.cacheState === cacheState &&
        sample.status === 'success',
    ).length;
    const failedAttempts = manifest.plannedPairsPerCandidateCacheState * 2 - successfulAttempts;
    if (pairs.length < manifest.minimumSuccessfulPairs) {
      return Object.freeze({
        cacheState,
        plannedPairs: manifest.plannedPairsPerCandidateCacheState,
        successfulPairs: pairs.length,
        failedAttempts,
        targetedComponent: null,
        guardrails: [],
        status: 'Fail' as const,
        reasonCodes: ['INSUFFICIENT_SUCCESSFUL_PAIRS'],
      });
    }
    const improvement = qualificationPairedEstimate(
      pairs.map(({ before, after }) =>
        qualificationImprovementPercentage(targetDuration(before), targetDuration(after)),
      ),
    );
    const conservativeImprovement = improvement.pointEstimatePercent - improvement.uncertaintyPercent;
    const targetedComponent = Object.freeze({
      ...improvement,
      conservativePercent: conservativeImprovement,
      status:
        conservativeImprovement >= LOCAL_WHISPER_PERFORMANCE_MINIMUM_CONSERVATIVE_IMPROVEMENT_PERCENT
          ? ('Pass' as const)
          : ('Fail' as const),
    });
    const guardrailMetrics: Array<{
      readonly id: 'endToEnd' | LocalWhisperPerformanceResourceId;
      readonly values: readonly number[];
    }> = [
      {
        id: 'endToEnd',
        values: pairs.map(({ before, after }) =>
          qualificationRegressionPercentage(before.endToEndNanoseconds, after.endToEndNanoseconds),
        ),
      },
      ...manifest.requiredResourceIds.map((id) => ({
        id,
        values: pairs.map(({ before, after }) =>
          qualificationRegressionPercentage(resourcePeak(before, id), resourcePeak(after, id)),
        ),
      })),
    ];
    const guardrails = guardrailMetrics.map(({ id, values }) => {
      const estimate = qualificationPairedEstimate(values);
      const upperBoundPercent = estimate.pointEstimatePercent + estimate.uncertaintyPercent;
      return Object.freeze({
        id,
        ...estimate,
        upperBoundPercent,
        status:
          upperBoundPercent <= LOCAL_WHISPER_PERFORMANCE_MAXIMUM_CONSERVATIVE_REGRESSION_PERCENT
            ? ('Pass' as const)
            : ('Fail' as const),
      });
    });
    const reasonCodes: string[] = [];
    if (targetedComponent.status === 'Fail') reasonCodes.push('CONSERVATIVE_IMPROVEMENT_BELOW_THRESHOLD');
    if (guardrails.some(({ status }) => status === 'Fail')) reasonCodes.push('RESOURCE_OR_END_TO_END_REGRESSION');
    return Object.freeze({
      cacheState,
      plannedPairs: manifest.plannedPairsPerCandidateCacheState,
      successfulPairs: pairs.length,
      failedAttempts,
      targetedComponent,
      guardrails,
      status: reasonCodes.length === 0 ? ('Pass' as const) : ('Fail' as const),
      reasonCodes,
    });
  }
}
