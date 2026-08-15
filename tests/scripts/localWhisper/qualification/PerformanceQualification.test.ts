import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST,
  LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
  LocalWhisperQualificationValidator,
} from '@scripts/local-whisper/qualification/QualificationContracts';
import {
  LocalWhisperPerformanceDocumentProducer,
  performanceSelectedModels,
  type PerformanceModelIdentity,
  type PerformancePrivateArtifact,
  type PerformanceQualificationBundle,
  type PerformanceQualificationSample,
} from '@scripts/local-whisper/qualification/PerformanceQualification';
import { createHostedPerformanceFixture } from '@scripts/local-whisper/qualification/PerformanceQualificationFixtures';
import { LocalWhisperPerformanceResultProducer } from '@scripts/local-whisper/qualification/PerformanceQualificationResultProducer';
import { LocalWhisperQualificationSourceBaselineVerifier } from '@scripts/local-whisper/qualification/QualificationSourceBaseline';

const workspaceRoot = path.resolve('.');
const qualificationRoot = path.join(workspaceRoot, 'docs/specs/local-whisper/qualification');
const validator = new LocalWhisperQualificationValidator(qualificationRoot);

type SuccessfulSample = Extract<PerformanceQualificationSample, { readonly status: 'success' }>;

function releaseModelSize(model: PerformanceModelIdentity): number {
  const releaseModel = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.find(
    ({ family, variant }) => family === model.family && variant === model.variant,
  );
  if (!releaseModel) throw new Error('Expected performance model in release matrix');
  return releaseModel.sizeBytes;
}

function candidateRows(result: Readonly<Record<string, unknown>>): readonly Readonly<Record<string, unknown>>[] {
  assert.ok(Array.isArray(result.candidateResults));
  return result.candidateResults as readonly Readonly<Record<string, unknown>>[];
}

function firstPassingWindow(result: Readonly<Record<string, unknown>>): number | null {
  const rows = candidateRows(result);
  for (const window of [1, 2, 4, 8] as const) {
    const modelRows = rows.filter(({ candidateWindow }) => candidateWindow === window);
    if (modelRows.length === 3 && modelRows.every(({ status }) => status === 'Pass')) return window;
  }
  return null;
}

function transformSuccessfulSamples(
  bundle: PerformanceQualificationBundle,
  transform: (sample: SuccessfulSample) => Pick<SuccessfulSample, 'endToEndNanoseconds' | 'phases' | 'resources'>,
): PerformanceQualificationBundle {
  const documents = new LocalWhisperPerformanceDocumentProducer(validator);
  const samples = bundle.samples.map((sample) => {
    if (sample.status === 'failed') return sample;
    const changed = transform(sample);
    return documents.produceSample(bundle.manifest, {
      cacheReceiptDigest: sample.cacheReceiptDigest,
      sampleId: sample.sampleId,
      model: sample.model,
      candidateWindow: sample.candidateWindow,
      cacheState: sample.cacheState,
      pairIndex: sample.pairIndex,
      runOrder: sample.runOrder,
      side: sample.side,
      status: 'success',
      ...changed,
    });
  });
  return documents.produceBundle(bundle.manifest, bundle.cacheReceipts, samples);
}

function representativeRunPlanSeed() {
  const documents = new LocalWhisperPerformanceDocumentProducer(validator);
  const artifact = (relativePath: string, sha256 = 'a'.repeat(64), sizeBytes = 1) => ({
    relativePath,
    sizeBytes,
    sha256,
  });
  const baselineCommit = LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION;
  const candidateCommit = '3'.repeat(40);
  const instrumentationOverlaySha256 = 'b'.repeat(64);
  const beforeApplication = artifact('derived/before/app');
  const afterApplication = artifact('derived/after/app');
  const receipt = (side: 'before' | 'after', parentCommit: string, application: PerformancePrivateArtifact) =>
    documents.produceDerivedSourceReceipt({
      side,
      parentCommit,
      sourceProofDigest: LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST,
      instrumentationOverlaySha256,
      derivedTreeManifestSha256: side === 'before' ? 'c'.repeat(64) : 'd'.repeat(64),
      executableArtifactIdentity: Object.freeze({ sizeBytes: application.sizeBytes, sha256: application.sha256 }),
    });
  return {
    sourceRevision: LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
    sourceProofDigest: LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST,
    platform: 'linux' as const,
    backend: 'cpu' as const,
    executionMode: 'representativeHost' as const,
    evidenceClaim: 'representativePerformance' as const,
    baselineCommit,
    candidateCommit,
    sourceProof: artifact('proof/source.json', LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST),
    worktrees: {
      before: { relativePath: 'parents/before', commit: baselineCommit },
      after: { relativePath: 'parents/after', commit: candidateCommit },
    },
    derivedSources: {
      before: { relativePath: 'derived/before', receipt: receipt('before', baselineCommit, beforeApplication) },
      after: { relativePath: 'derived/after', receipt: receipt('after', candidateCommit, afterApplication) },
    },
    applicationArtifacts: {
      before: beforeApplication,
      after: afterApplication,
    },
    runtimeArtifacts: {
      before: artifact('derived/before/runtime'),
      after: artifact('derived/after/runtime'),
    },
    models: performanceSelectedModels().map((model, index) => ({
      ...model,
      artifact: artifact(`models/${index}.bin`, model.sha256, releaseModelSize(model)),
    })),
    inputFixture: artifact('inputs/audio.wav'),
    cachePreparation: {
      procedure: 'linuxFileAdviceV1' as const,
      cold: 'fileAdviceDontNeed' as const,
      warm: 'boundedSequentialRead' as const,
    },
    attemptTimeoutMilliseconds: 60_000,
  };
}

describe('Local Whisper performance qualification', () => {
  it('reports three model rows per window without selecting from contract-only or single-platform evidence', () => {
    for (const [platform, backend] of [
      ['linux', 'cpu'],
      ['win32', 'cuda'],
    ] as const) {
      const fixture = createHostedPerformanceFixture(validator, platform, backend);
      assert.equal(fixture.samples.length, 288);
      assert.equal(fixture.cacheReceipts.length, 288);
      assert.equal(candidateRows(fixture.result).length, 12);
      assert.equal(firstPassingWindow(fixture.result), 4);
      assert.equal(fixture.result.selectedInFlightWindow, null);
      assert.equal(fixture.result.selectionStatus, 'fixtureOnly');
      assert.equal(fixture.result.evidenceClaim, 'contractOnly');
      assert.deepEqual(fixture.result.attemptCounts, { planned: 288, successful: 240, failed: 48 });
      assert.match(String(fixture.result.performanceResultDigest), /^[a-f0-9]{64}$/u);
      assert.equal(Object.isFrozen(fixture.bundle), true);
      assert.doesNotMatch(
        JSON.stringify(fixture.result),
        /relativePath|sampleId|failureReason|derivedSourceReceipts|executableArtifactIdentity/u,
      );
      for (const model of fixture.manifest.modelArtifacts) {
        assert.equal(JSON.stringify(fixture.result).includes(model.sha256), false);
      }
    }
  });

  it('fails each exact model/window/cache cell below 25 percent or when MAD overlaps the threshold', () => {
    const fixture = createHostedPerformanceFixture(validator, 'linux', 'cpu');
    const subThreshold = transformSuccessfulSamples(fixture.bundle, (sample) => ({
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
    const subThresholdResult = new LocalWhisperPerformanceResultProducer(validator).produce(subThreshold);
    assert.equal(
      candidateRows(subThresholdResult).every(({ status }) => status === 'Fail'),
      true,
    );

    const uncertaintyOverlap = transformSuccessfulSamples(fixture.bundle, (sample) => {
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
    const overlapResult = new LocalWhisperPerformanceResultProducer(validator).produce(uncertaintyOverlap);
    assert.equal(
      candidateRows(overlapResult).every(({ status }) => status === 'Fail'),
      true,
    );
  });

  it('rejects an end-to-end or resource regression beyond three percent after uncertainty', () => {
    const fixture = createHostedPerformanceFixture(validator, 'win32', 'cpu');
    const regressed = transformSuccessfulSamples(fixture.bundle, (sample) => ({
      endToEndNanoseconds: sample.endToEndNanoseconds,
      phases: sample.phases,
      resources: sample.resources.map((resource) =>
        sample.side === 'after' && resource.id === 'workerProcessPeakRss' ? { ...resource, peakBytes: 1100 } : resource,
      ),
    }));
    const result = new LocalWhisperPerformanceResultProducer(validator).produce(regressed);
    assert.equal(
      candidateRows(result).every(({ status }) => status === 'Fail'),
      true,
    );
    assert.equal(result.selectedInFlightWindow, null);
  });

  it('freezes representative commits, source proof, model artifacts, and the complete run plan', () => {
    const documents = new LocalWhisperPerformanceDocumentProducer(validator);
    const plan = documents.produceRunPlan(representativeRunPlanSeed());
    assert.equal(plan.schemaVersion, 3);
    assert.equal(plan.plannedPairsPerCandidateCacheState, 6);
    assert.equal(plan.models.length, 3);
    assert.match(plan.performanceRunPlanDigest, /^[a-f0-9]{64}$/u);
    assert.throws(
      () => documents.produceRunPlan({ ...representativeRunPlanSeed(), candidateCommit: 'short' }),
      /PERFORMANCERUNPLAN/u,
    );
    assert.throws(
      () =>
        documents.produceRunPlan({
          ...representativeRunPlanSeed(),
          sourceProofDigest: 'f'.repeat(64),
          sourceProof: { ...representativeRunPlanSeed().sourceProof, sha256: 'f'.repeat(64) },
        }),
      /CONTRACT_INVALID/u,
    );
    assert.throws(
      () => validator.validateDocument('performanceRunPlan', { ...plan, schemaVersion: 1 }),
      /PERFORMANCERUNPLAN|DIGEST/u,
    );
    assert.throws(
      () => validator.validateDocument('performanceRunPlan', { ...plan, executablePath: '/tmp/private-app' }),
      /PRIVATE_FIELD|PRIVATE_VALUE/u,
    );
    assert.throws(
      () =>
        documents.produceRunPlan({
          ...representativeRunPlanSeed(),
          inputFixture: { ...representativeRunPlanSeed().inputFixture, relativePath: '../escaped.wav' },
        }),
      /PERFORMANCERUNPLAN/u,
    );
  });

  it('rejects malformed, oversized, sensitive, negative, unknown, and out-of-order evidence', () => {
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
    const common = {
      cacheReceiptDigest: first.cacheReceiptDigest,
      sampleId: first.sampleId,
      model: first.model,
      candidateWindow: first.candidateWindow,
      cacheState: first.cacheState,
      pairIndex: first.pairIndex,
      runOrder: first.runOrder,
      side: first.side,
      status: 'success' as const,
      endToEndNanoseconds: first.endToEndNanoseconds,
      resources: first.resources,
    };
    assert.throws(
      () =>
        documents.produceSample(fixture.manifest, {
          ...common,
          phases: first.phases.map((phase, index) => (index === 0 ? { ...phase, durationNanoseconds: -1 } : phase)),
        }),
      /PERFORMANCESAMPLE/u,
    );
    assert.throws(
      () => documents.produceSample(fixture.manifest, { ...common, phases: [...first.phases].reverse() }),
      /PHASE_ORDER/u,
    );
    const unknown = structuredClone(first) as unknown as Record<string, unknown>;
    const phases = unknown.phases as Array<Record<string, unknown>>;
    phases[0]!.id = 'unknownPhase';
    assert.throws(() => validator.validateDocument('performanceSample', unknown), /PERFORMANCESAMPLE/u);
  });

  it('rejects missing, duplicate, mixed-model, mixed-commit, and out-of-order cells before analysis', () => {
    const fixture = createHostedPerformanceFixture(validator, 'linux', 'cpu');
    const documents = new LocalWhisperPerformanceDocumentProducer(validator);
    assert.throws(
      () => documents.produceBundle(fixture.manifest, fixture.cacheReceipts.slice(1), fixture.samples.slice(1)),
      /PERFORMANCEBUNDLE/u,
    );
    assert.throws(
      () =>
        documents.produceBundle(
          fixture.manifest,
          [fixture.cacheReceipts[0]!, ...fixture.cacheReceipts.slice(0, -1)],
          [fixture.samples[0]!, ...fixture.samples.slice(0, -1)],
        ),
      /DUPLICATE|CONTRACT_INVALID/u,
    );
    const second = fixture.samples[1]!;
    const mixedModel = documents.produceSample(fixture.manifest, {
      cacheReceiptDigest: second.cacheReceiptDigest,
      sampleId: second.sampleId,
      model: fixture.manifest.modelArtifacts[1]!,
      candidateWindow: second.candidateWindow,
      cacheState: second.cacheState,
      pairIndex: second.pairIndex,
      runOrder: second.runOrder,
      side: second.side,
      status: second.status,
      ...(second.status === 'success'
        ? {
            endToEndNanoseconds: second.endToEndNanoseconds,
            phases: second.phases,
            resources: second.resources,
          }
        : { failureReason: second.failureReason }),
    });
    assert.throws(
      () =>
        documents.produceBundle(fixture.manifest, fixture.cacheReceipts, [
          fixture.samples[0]!,
          mixedModel,
          ...fixture.samples.slice(2),
        ]),
      /CONTRACT_INVALID/u,
    );
    const otherManifest = documents.produceHostedManifest({
      platform: 'linux',
      backend: 'cpu',
      executionMode: 'hostedFixture',
      evidenceClaim: 'contractOnly',
      performanceRunPlanDigest: '9'.repeat(64),
      baselineCommit: 'f'.repeat(40),
      candidateCommit: 'e'.repeat(40),
      inputFixtureDigest: fixture.manifest.inputFixtureDigest,
      derivedSourceReceipts: Object.freeze({
        before: documents.produceDerivedSourceReceipt({
          side: 'before',
          parentCommit: 'f'.repeat(40),
          sourceProofDigest: fixture.manifest.sourceProofDigest,
          instrumentationOverlaySha256: fixture.manifest.instrumentationOverlaySha256,
          derivedTreeManifestSha256: fixture.manifest.derivedSourceReceipts.before.derivedTreeManifestSha256,
          executableArtifactIdentity: fixture.manifest.derivedSourceReceipts.before.executableArtifactIdentity,
        }),
        after: documents.produceDerivedSourceReceipt({
          side: 'after',
          parentCommit: 'e'.repeat(40),
          sourceProofDigest: fixture.manifest.sourceProofDigest,
          instrumentationOverlaySha256: fixture.manifest.instrumentationOverlaySha256,
          derivedTreeManifestSha256: fixture.manifest.derivedSourceReceipts.after.derivedTreeManifestSha256,
          executableArtifactIdentity: fixture.manifest.derivedSourceReceipts.after.executableArtifactIdentity,
        }),
      }),
    });
    const first = fixture.samples[0]!;
    const otherReceipt = documents.produceCacheReceipt(otherManifest, {
      sampleId: first.sampleId,
      cacheState: first.cacheState,
      inputSetDigest: '8'.repeat(64),
      status: 'prepared',
      reasonCode: null,
    });
    const mixedCommit = documents.produceSample(otherManifest, {
      cacheReceiptDigest: otherReceipt.performanceCacheReceiptDigest,
      sampleId: first.sampleId,
      model: first.model,
      candidateWindow: first.candidateWindow,
      cacheState: first.cacheState,
      pairIndex: first.pairIndex,
      runOrder: first.runOrder,
      side: first.side,
      status: first.status,
      ...(first.status === 'success'
        ? {
            endToEndNanoseconds: first.endToEndNanoseconds,
            phases: first.phases,
            resources: first.resources,
          }
        : { failureReason: first.failureReason }),
    });
    assert.throws(
      () =>
        documents.produceBundle(
          fixture.manifest,
          [otherReceipt, ...fixture.cacheReceipts.slice(1)],
          [mixedCommit, ...fixture.samples.slice(1)],
        ),
      /CONTRACT_INVALID/u,
    );
    const windows = createHostedPerformanceFixture(validator, 'win32', 'cpu');
    assert.throws(
      () =>
        documents.produceBundle(
          fixture.manifest,
          [windows.cacheReceipts[0]!, ...fixture.cacheReceipts.slice(1)],
          [windows.samples[0]!, ...fixture.samples.slice(1)],
        ),
      /CONTRACT_INVALID/u,
    );
    assert.throws(
      () =>
        documents.produceBundle(
          fixture.manifest,
          [fixture.cacheReceipts[1]!, fixture.cacheReceipts[0]!, ...fixture.cacheReceipts.slice(2)],
          [fixture.samples[1]!, fixture.samples[0]!, ...fixture.samples.slice(2)],
        ),
      /CONTRACT_INVALID/u,
    );
  });
});

describe('Local Whisper performance source baseline', () => {
  it('pins directory-result reuse to exactly seven Linux and six Windows hashes', () => {
    const evidence = new LocalWhisperQualificationSourceBaselineVerifier(workspaceRoot).verify();
    assert.deepEqual(evidence.fullModelHashes, { linux: 7, win32: 6 });
    assert.equal(evidence.sourceProofDigest, LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST);
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
