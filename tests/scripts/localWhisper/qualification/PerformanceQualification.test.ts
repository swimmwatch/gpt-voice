import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LocalWhisperQualificationValidator } from '@scripts/local-whisper/qualification/QualificationContracts';
import {
  LocalWhisperPerformanceDocumentProducer,
  type PerformanceQualificationSample,
} from '@scripts/local-whisper/qualification/PerformanceQualification';
import { createHostedPerformanceFixture } from '@scripts/local-whisper/qualification/PerformanceQualificationFixtures';
import { LocalWhisperPerformanceResultProducer } from '@scripts/local-whisper/qualification/PerformanceQualificationResultProducer';
import { LocalWhisperQualificationSourceBaselineVerifier } from '@scripts/local-whisper/qualification/QualificationSourceBaseline';

const workspaceRoot = path.resolve('.');
const qualificationRoot = path.join(workspaceRoot, 'docs/specs/local-whisper/qualification');
const validator = new LocalWhisperQualificationValidator(qualificationRoot);

type SuccessfulSample = Extract<PerformanceQualificationSample, { readonly status: 'success' }>;

function selected(result: Readonly<Record<string, unknown>>): unknown {
  return result.selectedInFlightWindow;
}

function transformSuccessfulSamples(
  samples: readonly PerformanceQualificationSample[],
  manifest: ReturnType<LocalWhisperPerformanceDocumentProducer['produceManifest']>,
  transform: (sample: SuccessfulSample) => Pick<SuccessfulSample, 'endToEndNanoseconds' | 'phases' | 'resources'>,
): readonly PerformanceQualificationSample[] {
  const documents = new LocalWhisperPerformanceDocumentProducer(validator);
  return samples.map((sample) => {
    if (sample.status === 'failed') return sample;
    const changed = transform(sample);
    return documents.produceSample(manifest, {
      sampleId: sample.sampleId,
      candidateWindow: sample.candidateWindow,
      cacheState: sample.cacheState,
      pairIndex: sample.pairIndex,
      runOrder: sample.runOrder,
      side: sample.side,
      status: 'success',
      ...changed,
    });
  });
}

describe('Local Whisper performance qualification', () => {
  it('selects the smallest qualifying fixture window and retains failed samples without a hardware claim', () => {
    for (const [platform, backend] of [
      ['linux', 'cpu'],
      ['win32', 'cuda'],
    ] as const) {
      const fixture = createHostedPerformanceFixture(validator, platform, backend);
      assert.equal(selected(fixture.result), 4);
      assert.equal(fixture.result.selectionStatus, 'fixtureOnly');
      assert.equal(fixture.result.evidenceClaim, 'contractOnly');
      assert.equal((fixture.result.failedSamples as readonly unknown[]).length, 16);
      assert.match(String(fixture.result.performanceResultDigest), /^[a-f0-9]{64}$/u);
      assert.equal(Object.isFrozen(fixture.manifest), true);
      assert.equal(Object.isFrozen(fixture.result), true);
    }
  });

  it('fails closed below 25 percent and when MAD uncertainty overlaps the threshold', () => {
    const fixture = createHostedPerformanceFixture(validator, 'linux', 'cpu');
    const subThreshold = transformSuccessfulSamples(fixture.samples, fixture.manifest, (sample) => ({
      endToEndNanoseconds: sample.endToEndNanoseconds,
      resources: sample.resources,
      phases: sample.phases.map((phase) =>
        sample.side === 'after' &&
        sample.candidateWindow >= 4 &&
        (phase.id === 'installationPipeWait' || phase.id === 'installationWrite')
          ? { ...phase, durationNanoseconds: 800 }
          : phase,
      ),
    }));
    assert.equal(
      new LocalWhisperPerformanceResultProducer(validator).produce(fixture.manifest, subThreshold).selectionStatus,
      'blocked',
    );

    const uncertaintyOverlap = transformSuccessfulSamples(fixture.samples, fixture.manifest, (sample) => {
      const improvement = [10, 20, 30, 40, 50][sample.pairIndex - 1] ?? 0;
      const afterDuration = 1000 * (1 - improvement / 100);
      return {
        endToEndNanoseconds: sample.endToEndNanoseconds,
        resources: sample.resources,
        phases: sample.phases.map((phase) =>
          sample.side === 'after' &&
          sample.candidateWindow >= 4 &&
          (phase.id === 'installationPipeWait' || phase.id === 'installationWrite')
            ? { ...phase, durationNanoseconds: afterDuration }
            : phase,
        ),
      };
    });
    assert.equal(
      new LocalWhisperPerformanceResultProducer(validator).produce(fixture.manifest, uncertaintyOverlap)
        .selectionStatus,
      'blocked',
    );
  });

  it('rejects a resource regression beyond three percent after uncertainty', () => {
    const fixture = createHostedPerformanceFixture(validator, 'win32', 'cpu');
    const regressed = transformSuccessfulSamples(fixture.samples, fixture.manifest, (sample) => ({
      endToEndNanoseconds: sample.endToEndNanoseconds,
      phases: sample.phases,
      resources: sample.resources.map((resource) =>
        sample.side === 'after' && resource.id === 'workerProcessPeakRss' ? { ...resource, peakBytes: 1100 } : resource,
      ),
    }));
    const result = new LocalWhisperPerformanceResultProducer(validator).produce(fixture.manifest, regressed);
    assert.equal(result.selectionStatus, 'blocked');
    assert.equal(selected(result), null);
  });

  it('rejects missing, malformed, oversized, sensitive, negative, unknown, and out-of-order evidence', () => {
    const fixture = createHostedPerformanceFixture(validator, 'linux', 'cpu');
    const first = fixture.samples.find((sample): sample is SuccessfulSample => sample.status === 'success');
    if (!first) throw new Error('Expected a successful performance fixture');
    const documents = new LocalWhisperPerformanceDocumentProducer(validator);
    assert.throws(
      () => validator.validateDocument('performanceManifest', { ...fixture.manifest, sourceRevision: 'bad' }),
      /PERFORMANCEMANIFEST|DIGEST/u,
    );
    assert.throws(
      () => validator.validateDocument('performanceManifest', { ...fixture.manifest, deviceId: 'private-device' }),
      /PRIVATE_FIELD/u,
    );
    assert.throws(
      () => validator.validateDocument('performanceSample', { payload: 'x'.repeat(1024 * 1024 + 1) }),
      /OVERSIZED/u,
    );
    assert.throws(
      () =>
        documents.produceSample(fixture.manifest, {
          sampleId: 'negative-duration',
          candidateWindow: 1,
          cacheState: 'cold',
          pairIndex: 1,
          runOrder: 'beforeThenAfter',
          side: 'before',
          status: 'success',
          endToEndNanoseconds: 1,
          phases: first.phases.map((phase, index) => (index === 0 ? { ...phase, durationNanoseconds: -1 } : phase)),
          resources: first.resources,
        }),
      /PERFORMANCESAMPLE/u,
    );
    assert.throws(
      () =>
        documents.produceSample(fixture.manifest, {
          sampleId: 'out-of-order',
          candidateWindow: 1,
          cacheState: 'cold',
          pairIndex: 1,
          runOrder: 'beforeThenAfter',
          side: 'before',
          status: 'success',
          endToEndNanoseconds: 1,
          phases: [...first.phases].reverse(),
          resources: first.resources,
        }),
      /PHASE_ORDER/u,
    );
    const unknown = structuredClone(first) as unknown as Record<string, unknown>;
    const phases = unknown.phases as Array<Record<string, unknown>>;
    const phase = phases[0];
    if (!phase) throw new Error('Expected a phase fixture');
    phase.id = 'unknownPhase';
    assert.throws(() => validator.validateDocument('performanceSample', unknown), /PERFORMANCESAMPLE/u);
  });

  it('rejects incomplete locked pair sets instead of replacing failures', () => {
    const fixture = createHostedPerformanceFixture(validator, 'linux', 'cpu');
    assert.throws(
      () => new LocalWhisperPerformanceResultProducer(validator).produce(fixture.manifest, fixture.samples.slice(1)),
      /PAIR_SET_INCOMPLETE/u,
    );
  });
});

describe('Local Whisper performance source baseline', () => {
  it('pins directory-result reuse to exactly seven Linux and six Windows hashes', () => {
    const evidence = new LocalWhisperQualificationSourceBaselineVerifier(workspaceRoot).verify();
    assert.deepEqual(evidence.fullModelHashes, { linux: 7, win32: 6 });
    assert.match(evidence.sourceProofDigest, /^[a-f0-9]{64}$/u);
  });

  it('rejects an unexplained affected-source drift', () => {
    const verifier = new LocalWhisperQualificationSourceBaselineVerifier(workspaceRoot, (filePath) => {
      const source = readFileSync(filePath, 'utf8');
      return filePath.endsWith('NativeLauncherProcessOwner.ts')
        ? source.replace('await authority.modelGuardAuthority?.revalidate();', 'await Promise.resolve();')
        : source;
    });
    assert.throws(() => verifier.verify(), /SOURCE_BASIS_DRIFT|SOURCE_PROOF_DRIFT/u);
  });
});
