import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as path from 'node:path';
import { Readable } from 'node:stream';

import { FocusedPerformanceQualificationCollector } from '@scripts/local-whisper/qualification/FocusedPerformanceQualificationCollector';
import {
  FocusedPerformanceDocumentProducer,
  focusedPerformanceSchedule,
} from '@scripts/local-whisper/qualification/FocusedPerformanceQualification';
import {
  LocalWhisperQualificationValidator,
  qualificationCanonicalJson,
} from '@scripts/local-whisper/qualification/QualificationContracts';

const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
const candidateCommit = 'a'.repeat(40);
const sha = (value: string): string => value.repeat(64).slice(0, 64);
const artifact = (relativePath: string, value: string, sizeBytes = 1024) =>
  Object.freeze({ relativePath, sizeBytes, sha256: sha(value) });

function fixture(backend: 'cpu' | 'cuda' = 'cpu') {
  const validator = new LocalWhisperQualificationValidator(qualificationRoot);
  const documents = new FocusedPerformanceDocumentProducer(validator);
  const plan = documents.produceRunPlan({
    sourceRevision: candidateCommit,
    sourceProofDigest: sha('b'),
    candidateCommit,
    platform: 'linux',
    backend,
    executionMode: 'representativeHost',
    evidenceClaim: 'representativePerformance',
    candidateSource: Object.freeze({
      relativePath: 'derived-candidate',
      commit: candidateCommit,
      sourceProofDigest: sha('b'),
      instrumentationOverlaySha256: sha('c'),
      derivedTreeManifestSha256: sha('d'),
      executableArtifactSha256: sha('e'),
    }),
    qualificationCache: Object.freeze({
      snapshotDigest: sha('f'),
      evidenceIdentityDigest: sha('1'),
      entryCount: 2,
      fileCount: 1,
      sizeBytes: 1024,
    }),
    applicationArtifact: artifact('derived-candidate/app', 'e'),
    runtimeArtifact: artifact('derived-candidate/runtime', '2'),
    modelArtifact: artifact(
      'inputs/base-full.bin',
      '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
      147_951_465,
    ),
    inputFixture: artifact('inputs/fixture.wav', '3'),
    cachePreparationProcedure: 'linuxFileAdviceV1',
    attemptTimeoutMilliseconds: 30_000,
  });
  const manifest = documents.produceManifest(plan);
  const cacheReceipts = focusedPerformanceSchedule().map((cell) =>
    documents.produceCacheReceipt(manifest, {
      sampleId: cell.sampleId,
      cacheState: cell.cacheState,
      sampleIndex: cell.sampleIndex,
      inputSetDigest: sha('4'),
      status: 'prepared',
      reasonCode: null,
    }),
  );
  const samples = focusedPerformanceSchedule().map((cell, index) =>
    documents.produceSample(manifest, {
      focusedPerformanceCacheReceiptDigest: cacheReceipts[index]!.focusedPerformanceCacheReceiptDigest,
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
  return Object.freeze({ validator, documents, plan, manifest, cacheReceipts, samples });
}

describe('FocusedPerformanceQualification', () => {
  it('creates exactly three ordered Base candidate samples per cold and warm cell without a timing gate', () => {
    const value = fixture();
    assert.doesNotThrow(() =>
      value.validator.validateDocument('focusedPerformanceRunPlan', JSON.parse(qualificationCanonicalJson(value.plan))),
    );
    const bundle = value.documents.produceBundle(value.manifest, value.cacheReceipts, value.samples);
    const result = value.documents.produceResult(bundle);

    assert.deepEqual(
      bundle.samples.map(({ sampleId }) => sampleId),
      [
        'base-full-cold-01',
        'base-full-cold-02',
        'base-full-cold-03',
        'base-full-warm-01',
        'base-full-warm-02',
        'base-full-warm-03',
      ],
    );
    assert.equal(result.status, 'Pass');
    assert.equal(result.timingGate, 'informationalOnly');
    assert.deepEqual(
      (result.cells as readonly Readonly<Record<string, unknown>>[]).map(
        (cell) => cell.distanceFromFiveSecondsNanoseconds,
      ),
      [1_000_000_001, 1_000_000_004],
    );
  });

  it('rejects a paired-era model, a partial cell, and mismatched sample evidence', () => {
    const value = fixture('cuda');
    assert.throws(() =>
      value.validator.validateDocument('focusedPerformanceRunPlan', {
        ...value.plan,
        model: { ...value.plan.model, family: 'medium' },
      }),
    );
    assert.throws(() => value.documents.produceBundle(value.manifest, value.cacheReceipts.slice(0, 5), value.samples));
    assert.throws(() =>
      value.documents.produceBundle(
        value.manifest,
        value.cacheReceipts,
        value.samples.map((sample, index) => (index === 0 ? { ...sample, sampleIndex: 2 } : sample)),
      ),
    );
  });

  it('aggregates an incomplete successful-sample cell as a deterministic failed result', () => {
    const value = fixture();
    const first = value.samples[0]!;
    const failed = value.documents.produceSample(value.manifest, {
      focusedPerformanceCacheReceiptDigest: value.cacheReceipts[0]!.focusedPerformanceCacheReceiptDigest,
      sampleId: first.sampleId,
      cacheState: first.cacheState,
      sampleIndex: first.sampleIndex,
      status: 'failed',
      failureReason: 'ATTEMPT_TIMEOUT',
      endToEndNanoseconds: null,
      phases: [],
      resources: [],
    });
    const bundle = value.documents.produceBundle(value.manifest, value.cacheReceipts, [
      failed,
      ...value.samples.slice(1),
    ]);
    const result = value.documents.produceResult(bundle);
    const cells = result.cells as readonly Readonly<Record<string, unknown>>[];

    assert.equal(result.status, 'Fail');
    assert.equal(cells[0]!.status, 'Fail');
    assert.equal(cells[0]!.successfulSampleCount, 2);
    assert.equal(cells[0]!.failedSampleCount, 1);
  });

  it('collects six unpaired candidate attempts through the private compatibility transport only', async () => {
    const value = fixture();
    const prepared = Object.freeze({
      candidateSource: '/private/derived-candidate',
      application: Object.freeze({
        absolutePath: '/private/derived-candidate/app',
        identity: value.plan.applicationArtifact,
      }),
      runtime: Object.freeze({
        absolutePath: '/private/derived-candidate/runtime',
        identity: value.plan.runtimeArtifact,
      }),
      model: Object.freeze({ absolutePath: '/private/inputs/base-full.bin', identity: value.plan.model.artifact }),
      inputFixture: Object.freeze({ absolutePath: '/private/inputs/fixture.wav', identity: value.plan.inputFixture }),
    });
    const collector = new FocusedPerformanceQualificationCollector(value.validator, {
      platform: {
        prepareFocused: async () => prepared,
        verifyFocused: async () => undefined,
      },
      cache: { prepare: async () => undefined },
      process: {
        start: ({ request }) =>
          Object.freeze({
            rootPid: 42,
            eventStream: Readable.from([]),
            complete: async () =>
              Buffer.from(
                `${JSON.stringify({
                  schemaVersion: 3,
                  status: 'success',
                  failureReason: null,
                  endToEndNanoseconds: 6_000_000_000,
                  phases: request.requiredPhaseIds.map((id, sequence) => ({ id, sequence, durationNanoseconds: 1 })),
                })}\n`,
              ),
            terminate: async () => undefined,
          }),
      },
      resources: {
        start: ({ backend, expectedExecutableSha256, requiredResourceIds }) =>
          Object.freeze({
            finish: async () =>
              Object.freeze({
                resources: requiredResourceIds.map((id) => Object.freeze({ id, peakBytes: 1024 })),
                roleRegistrations: ['main', 'guard', 'worker'].map((role) =>
                  Object.freeze({
                    role: role as 'main' | 'guard' | 'worker',
                    pid: 42,
                    processStartIdentity: role,
                    executableSha256: expectedExecutableSha256,
                  }),
                ),
                processSettlementProof: 'ownedProcessTreeSettled',
                unownedProcessAttribution: 0,
                unownedGpuAttribution: backend === 'cpu' ? 'notApplicable' : 0,
                identityChanges: 0,
                lateRoleRegistrations: 0,
                liveOwnedProcessesAfterSettlement: 0,
              }),
            terminate: () => undefined,
          }),
      },
    });

    const bundle = await collector.collect(value.plan);
    assert.equal(bundle.samples.length, 6);
    assert.deepEqual(
      bundle.samples.map(({ sampleIndex }) => sampleIndex),
      [1, 2, 3, 1, 2, 3],
    );
    assert.equal(new FocusedPerformanceDocumentProducer(value.validator).produceResult(bundle).status, 'Pass');
  });
});
