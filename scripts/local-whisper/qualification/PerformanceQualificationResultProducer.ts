import {
  LocalWhisperQualificationGraphProducer,
  type LocalWhisperPerformancePhaseId,
  type LocalWhisperPerformanceResourceId,
  type LocalWhisperQualificationValidator,
} from './QualificationContracts';
import {
  type PerformanceQualificationManifest,
  type PerformanceQualificationSample,
  type PerformanceRunOrder,
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

function expectedRunOrder(pairIndex: number): PerformanceRunOrder {
  return pairIndex % 2 === 1 ? 'beforeThenAfter' : 'afterThenBefore';
}

/** Applies the frozen paired median/MAD thresholds and deterministic [1,2,4,8] window selection. */
export class LocalWhisperPerformanceResultProducer {
  private readonly graph: LocalWhisperQualificationGraphProducer;

  public constructor(private readonly validator: LocalWhisperQualificationValidator) {
    this.graph = new LocalWhisperQualificationGraphProducer(validator);
  }

  public produce(
    manifest: PerformanceQualificationManifest,
    samples: readonly PerformanceQualificationSample[],
  ): Readonly<Record<string, unknown>> {
    manifest = this.validator.validateAndFreezeDocument(
      'performanceManifest',
      manifest,
    ) as unknown as PerformanceQualificationManifest;
    samples = samples.map(
      (sample) =>
        this.validator.validateAndFreezeDocument(
          'performanceSample',
          sample,
        ) as unknown as PerformanceQualificationSample,
    );
    if (samples.length === 0 || samples.length > 512) throw new Error('QUALIFICATION_PERFORMANCE_SAMPLE_SET_INVALID');
    const sampleIds = new Set<string>();
    const sampleDigests = new Set<string>();
    const groups = new Map<string, SamplePair>();
    const failedSamples: Array<{ readonly sampleId: string; readonly reasonCode: string }> = [];
    for (const sample of samples) {
      if (
        sample.performanceManifestDigest !== manifest.performanceManifestDigest ||
        !manifest.candidateWindows.includes(sample.candidateWindow) ||
        !manifest.cacheStates.includes(sample.cacheState) ||
        sample.pairIndex > manifest.plannedPairsPerCandidateCacheState ||
        sample.runOrder !== expectedRunOrder(sample.pairIndex) ||
        sampleIds.has(sample.sampleId) ||
        sampleDigests.has(sample.performanceSampleDigest)
      ) {
        throw new Error('QUALIFICATION_PERFORMANCE_SAMPLE_SET_INVALID');
      }
      sampleIds.add(sample.sampleId);
      sampleDigests.add(sample.performanceSampleDigest);
      if (sample.status === 'success') {
        if (
          JSON.stringify(sample.phases.map(({ id }) => id)) !== JSON.stringify(manifest.requiredPhaseIds) ||
          JSON.stringify(sample.resources.map(({ id }) => id)) !== JSON.stringify(manifest.requiredResourceIds)
        ) {
          throw new Error('QUALIFICATION_PERFORMANCE_METRIC_SET_INVALID');
        }
      } else {
        failedSamples.push(Object.freeze({ sampleId: sample.sampleId, reasonCode: sample.failureReason }));
      }
      const key = `${sample.candidateWindow}|${sample.cacheState}|${sample.pairIndex}`;
      const pair = groups.get(key) ?? {};
      if (pair[sample.side]) throw new Error('QUALIFICATION_PERFORMANCE_DUPLICATE_SAMPLE_SIDE');
      pair[sample.side] = sample;
      groups.set(key, pair);
    }

    const successfulPairs = new Map<string, SuccessfulPair[]>();
    for (const candidateWindow of manifest.candidateWindows) {
      for (const cacheState of manifest.cacheStates) {
        const key = `${candidateWindow}|${cacheState}`;
        const complete: SuccessfulPair[] = [];
        for (let pairIndex = 1; pairIndex <= manifest.plannedPairsPerCandidateCacheState; pairIndex += 1) {
          const pair = groups.get(`${key}|${pairIndex}`);
          if (!pair?.before || !pair.after) throw new Error('QUALIFICATION_PERFORMANCE_PAIR_SET_INCOMPLETE');
          if (pair.before.runOrder !== pair.after.runOrder) {
            throw new Error('QUALIFICATION_PERFORMANCE_PAIR_ORDER_INVALID');
          }
          if (pair.before.status === 'success' && pair.after.status === 'success') {
            complete.push(Object.freeze({ before: pair.before, after: pair.after }));
          }
        }
        successfulPairs.set(key, complete);
      }
    }

    const candidateResults = manifest.candidateWindows.map((candidateWindow) => {
      const cold = successfulPairs.get(`${candidateWindow}|cold`) ?? [];
      const warm = successfulPairs.get(`${candidateWindow}|warm`) ?? [];
      const pairs = [...cold, ...warm];
      const counts = Object.freeze({ cold: cold.length, warm: warm.length });
      if (cold.length < manifest.minimumSuccessfulPairs || warm.length < manifest.minimumSuccessfulPairs) {
        return Object.freeze({
          candidateWindow,
          successfulPairsByCacheState: counts,
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
        candidateWindow,
        successfulPairsByCacheState: counts,
        targetedComponent,
        guardrails,
        status: reasonCodes.length === 0 ? ('Pass' as const) : ('Fail' as const),
        reasonCodes,
      });
    });
    const selectedInFlightWindow = candidateResults.find(({ status }) => status === 'Pass')?.candidateWindow ?? null;
    return this.graph.freeze('performanceResult', {
      schemaVersion: 1,
      contractRevision: 1,
      performanceManifestDigest: manifest.performanceManifestDigest,
      platform: manifest.platform,
      backend: manifest.backend,
      executionMode: manifest.executionMode,
      evidenceClaim: manifest.evidenceClaim,
      sampleDigests: [...sampleDigests].sort((left, right) => left.localeCompare(right, 'en')),
      failedSamples: failedSamples.sort((left, right) => left.sampleId.localeCompare(right.sampleId, 'en')),
      candidateResults,
      selectedInFlightWindow,
      selectionStatus:
        selectedInFlightWindow === null
          ? 'blocked'
          : manifest.executionMode === 'hostedFixture'
            ? 'fixtureOnly'
            : 'selected',
      sourceHashBaseline: manifest.sourceHashBaseline,
    });
  }
}
