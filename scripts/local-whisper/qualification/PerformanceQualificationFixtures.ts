import { createHash } from 'node:crypto';

import type { LocalWhisperQualificationValidator } from './QualificationContracts';
import {
  LocalWhisperPerformanceDocumentProducer,
  type PerformanceBackend,
  type PerformanceCandidateWindow,
  type PerformancePhaseMeasurement,
  type PerformancePlatform,
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

function fixtureDigest(platform: PerformancePlatform, backend: PerformanceBackend): string {
  return createHash('sha256').update(`local-whisper-performance-v1|${platform}|${backend}`, 'utf8').digest('hex');
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
  readonly samples: readonly PerformanceQualificationSample[];
  readonly result: Readonly<Record<string, unknown>>;
}

/** Builds content-free deterministic fixtures used only to prove the hosted Linux/Windows contract lanes. */
export function createHostedPerformanceFixture(
  validator: LocalWhisperQualificationValidator,
  platform: PerformancePlatform,
  backend: PerformanceBackend,
): HostedPerformanceFixtureResult {
  const documents = new LocalWhisperPerformanceDocumentProducer(validator);
  const manifest = documents.produceManifest({
    platform,
    backend,
    executionMode: 'hostedFixture',
    inputFixtureDigest: fixtureDigest(platform, backend),
    plannedPairsPerCandidateCacheState: 6,
  });
  const samples: PerformanceQualificationSample[] = [];
  for (const candidateWindow of manifest.candidateWindows) {
    for (const cacheState of manifest.cacheStates) {
      for (let pairIndex = 1; pairIndex <= manifest.plannedPairsPerCandidateCacheState; pairIndex += 1) {
        const runOrder = pairIndex % 2 === 1 ? 'beforeThenAfter' : 'afterThenBefore';
        for (const side of ['before', 'after'] as const) {
          const sampleId = `${platform}-${backend}-${candidateWindow}-${cacheState}-${String(pairIndex).padStart(2, '0')}-${side}`;
          samples.push(
            pairIndex === manifest.plannedPairsPerCandidateCacheState
              ? documents.produceSample(manifest, {
                  sampleId,
                  candidateWindow,
                  cacheState,
                  pairIndex,
                  runOrder,
                  side,
                  status: 'failed',
                  failureReason: 'FIXTURE_SAMPLE_FAILED',
                })
              : documents.produceSample(manifest, {
                  sampleId,
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
  const result = new LocalWhisperPerformanceResultProducer(validator).produce(manifest, samples);
  return Object.freeze({ manifest, samples: Object.freeze(samples), result });
}
