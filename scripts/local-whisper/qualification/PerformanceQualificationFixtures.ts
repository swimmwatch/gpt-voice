import { createHash } from 'node:crypto';

import type { LocalWhisperQualificationValidator } from './QualificationContracts';
import {
  LocalWhisperPerformanceDocumentProducer,
  performanceExpectedRunOrder,
  performanceOrderedSides,
  performanceSampleId,
  type PerformanceBackend,
  type PerformanceCacheReceipt,
  type PerformanceCandidateWindow,
  type PerformancePhaseMeasurement,
  type PerformancePlatform,
  type PerformanceQualificationBundle,
  type PerformanceQualificationManifest,
  type PerformanceQualificationSample,
  type PerformanceResourceMeasurement,
  type PerformanceSide,
} from './PerformanceQualification';
import { LocalWhisperPerformanceResultProducer } from './PerformanceQualificationResultProducer';

const AFTER_TARGET_PHASE_NANOSECONDS: Readonly<Record<PerformanceCandidateWindow, number>> = Object.freeze({
  1: 800,
  2: 770,
  4: 700,
  8: 650,
});
const FIXTURE_BASELINE_COMMIT = '0'.repeat(40);
const FIXTURE_CANDIDATE_COMMIT = '1'.repeat(40);

function fixtureDigest(platform: PerformancePlatform, backend: PerformanceBackend, purpose: string): string {
  return createHash('sha256')
    .update(`local-whisper-performance-v2|${platform}|${backend}|${purpose}`, 'utf8')
    .digest('hex');
}

function phases(
  manifest: PerformanceQualificationManifest,
  candidateWindow: PerformanceCandidateWindow,
  side: PerformanceSide,
): readonly PerformancePhaseMeasurement[] {
  return Object.freeze(
    manifest.requiredPhaseIds.map((id, sequence) =>
      Object.freeze({
        id,
        sequence,
        durationNanoseconds:
          id === 'installationPipeWait' || id === 'installationWrite'
            ? side === 'before'
              ? 1000
              : AFTER_TARGET_PHASE_NANOSECONDS[candidateWindow]
            : 100,
      }),
    ),
  );
}

function resources(manifest: PerformanceQualificationManifest): readonly PerformanceResourceMeasurement[] {
  return Object.freeze(manifest.requiredResourceIds.map((id) => Object.freeze({ id, peakBytes: 1024 })));
}

export interface HostedPerformanceFixtureResult {
  readonly manifest: PerformanceQualificationManifest;
  readonly cacheReceipts: readonly PerformanceCacheReceipt[];
  readonly samples: readonly PerformanceQualificationSample[];
  readonly bundle: PerformanceQualificationBundle;
  readonly result: Readonly<Record<string, unknown>>;
}

/** Builds content-free deterministic schema-v2 fixtures that can never claim representative selection. */
export function createHostedPerformanceFixture(
  validator: LocalWhisperQualificationValidator,
  platform: PerformancePlatform,
  backend: PerformanceBackend,
): HostedPerformanceFixtureResult {
  const documents = new LocalWhisperPerformanceDocumentProducer(validator);
  const manifest = documents.produceHostedManifest({
    platform,
    backend,
    executionMode: 'hostedFixture',
    evidenceClaim: 'contractOnly',
    performanceRunPlanDigest: fixtureDigest(platform, backend, 'run-plan'),
    baselineCommit: FIXTURE_BASELINE_COMMIT,
    candidateCommit: FIXTURE_CANDIDATE_COMMIT,
    inputFixtureDigest: fixtureDigest(platform, backend, 'input'),
  });
  const cacheReceipts: PerformanceCacheReceipt[] = [];
  const samples: PerformanceQualificationSample[] = [];
  for (const model of manifest.modelArtifacts) {
    for (const candidateWindow of manifest.candidateWindows) {
      for (const cacheState of manifest.cacheStates) {
        for (let pairIndex = 1; pairIndex <= manifest.plannedPairsPerCandidateCacheState; pairIndex += 1) {
          const runOrder = performanceExpectedRunOrder(pairIndex);
          for (const side of performanceOrderedSides(runOrder)) {
            const sampleId = performanceSampleId({ model, candidateWindow, cacheState, pairIndex, side });
            const receipt = documents.produceCacheReceipt(manifest, {
              sampleId,
              cacheState,
              inputSetDigest: fixtureDigest(platform, backend, `${sampleId}-cache`),
              status: 'prepared',
              reasonCode: null,
            });
            cacheReceipts.push(receipt);
            samples.push(
              pairIndex === manifest.plannedPairsPerCandidateCacheState
                ? documents.produceSample(manifest, {
                    cacheReceiptDigest: receipt.performanceCacheReceiptDigest,
                    sampleId,
                    model,
                    candidateWindow,
                    cacheState,
                    pairIndex,
                    runOrder,
                    side,
                    status: 'failed',
                    failureReason: 'FIXTURE_SAMPLE_FAILED',
                  })
                : documents.produceSample(manifest, {
                    cacheReceiptDigest: receipt.performanceCacheReceiptDigest,
                    sampleId,
                    model,
                    candidateWindow,
                    cacheState,
                    pairIndex,
                    runOrder,
                    side,
                    status: 'success',
                    endToEndNanoseconds: 100_000,
                    phases: phases(manifest, candidateWindow, side),
                    resources: resources(manifest),
                  }),
            );
          }
        }
      }
    }
  }
  const bundle = documents.produceBundle(manifest, cacheReceipts, samples);
  const result = new LocalWhisperPerformanceResultProducer(validator).produce(bundle);
  return Object.freeze({
    manifest,
    cacheReceipts: Object.freeze(cacheReceipts),
    samples: Object.freeze(samples),
    bundle,
    result,
  });
}
