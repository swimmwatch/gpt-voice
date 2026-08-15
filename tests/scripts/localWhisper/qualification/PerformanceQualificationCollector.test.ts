import assert from 'node:assert/strict';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { describe, it } from 'node:test';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  LocalWhisperPerformanceCollector,
  PerformanceCollectionError,
  PerformanceQualificationPhaseParser,
  type PerformanceAttemptProcessInput,
  type PerformanceAttemptRequest,
  type PerformanceAttemptProcessPort,
  type PerformanceAttemptProcessSession,
  type PerformanceCachePreparationInput,
  type PerformanceCachePreparationPort,
  type PerformanceCollectionPlatformPort,
  type PerformanceResourcePort,
  type PerformanceResourceProof,
  type PerformanceResourceSession,
  type PreparedPerformanceArtifact,
  type PreparedPerformanceInputs,
} from '@scripts/local-whisper/qualification/PerformanceQualificationCollector';
import {
  LocalWhisperPerformanceDocumentProducer,
  performanceSelectedModels,
  type PerformanceModelIdentity,
  type PerformancePrivateArtifact,
  type PerformanceQualificationRunPlan,
} from '@scripts/local-whisper/qualification/PerformanceQualification';
import {
  LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST,
  LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION,
  LocalWhisperQualificationValidator,
} from '@scripts/local-whisper/qualification/QualificationContracts';
import { LocalWhisperPerformanceResultProducer } from '@scripts/local-whisper/qualification/PerformanceQualificationResultProducer';

const qualificationRoot = path.resolve('docs/specs/local-whisper/qualification');
const validator = new LocalWhisperQualificationValidator(qualificationRoot);

function releaseModelSize(model: PerformanceModelIdentity): number {
  const releaseModel = LOCAL_WHISPER_RELEASE_MODEL_MATRIX.find(
    ({ family, variant }) => family === model.family && variant === model.variant,
  );
  if (!releaseModel) throw new Error('Expected performance model in release matrix');
  return releaseModel.sizeBytes;
}

function artifact(relativePath: string, sha256 = 'a'.repeat(64), sizeBytes = 1): PerformancePrivateArtifact {
  return Object.freeze({ relativePath, sizeBytes, sha256 });
}

function plan(
  evidenceClaim: 'contractOnly' | 'representativePerformance' = 'contractOnly',
): PerformanceQualificationRunPlan {
  const documents = new LocalWhisperPerformanceDocumentProducer(validator);
  const baselineCommit =
    evidenceClaim === 'representativePerformance' ? LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION : '2'.repeat(40);
  const candidateCommit = '3'.repeat(40);
  const sourceProofDigest =
    evidenceClaim === 'representativePerformance' ? LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST : 'b'.repeat(64);
  const instrumentationOverlaySha256 = 'c'.repeat(64);
  const beforeApplication = artifact('derived/before/app');
  const afterApplication = artifact('derived/after/app');
  const derivedReceipt = (side: 'before' | 'after', parentCommit: string, application: PerformancePrivateArtifact) =>
    documents.produceDerivedSourceReceipt({
      side,
      parentCommit,
      sourceProofDigest,
      instrumentationOverlaySha256,
      derivedTreeManifestSha256: side === 'before' ? 'd'.repeat(64) : 'f'.repeat(64),
      executableArtifactIdentity: Object.freeze({ sizeBytes: application.sizeBytes, sha256: application.sha256 }),
    });
  return documents.produceRunPlan({
    sourceRevision:
      evidenceClaim === 'representativePerformance' ? LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION : '4'.repeat(40),
    sourceProofDigest,
    platform: 'linux',
    backend: 'cpu',
    executionMode: 'representativeHost',
    evidenceClaim,
    baselineCommit,
    candidateCommit,
    sourceProof: artifact('proof/source.json', sourceProofDigest),
    qualificationCache: {
      snapshotDigest: '1'.repeat(64),
      evidenceIdentityDigest: '2'.repeat(64),
      entryCount: 2,
      fileCount: 1,
      sizeBytes: 1,
    },
    worktrees: {
      before: { relativePath: 'parents/before', commit: baselineCommit },
      after: { relativePath: 'parents/after', commit: candidateCommit },
    },
    derivedSources: {
      before: {
        relativePath: 'derived/before',
        receipt: derivedReceipt('before', baselineCommit, beforeApplication),
      },
      after: {
        relativePath: 'derived/after',
        receipt: derivedReceipt('after', candidateCommit, afterApplication),
      },
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
      artifact: artifact(
        `models/${index}`,
        evidenceClaim === 'representativePerformance' ? model.sha256 : String(index + 5).repeat(64),
        evidenceClaim === 'representativePerformance' ? releaseModelSize(model) : 1,
      ),
    })),
    inputFixture: artifact('input/audio.wav', 'e'.repeat(64)),
    cachePreparation: {
      procedure: 'linuxFileAdviceV1',
      cold: 'fileAdviceDontNeed',
      warm: 'boundedSequentialRead',
    },
    attemptTimeoutMilliseconds: 1000,
  });
}

function preparedArtifact(identity: PerformancePrivateArtifact): PreparedPerformanceArtifact {
  return Object.freeze({ absolutePath: `/private/${identity.relativePath}`, identity });
}

class FakePlatform implements PerformanceCollectionPlatformPort {
  public prepareCalls = 0;
  public verificationCalls = 0;

  public async prepare(input: PerformanceQualificationRunPlan): Promise<PreparedPerformanceInputs> {
    this.prepareCalls += 1;
    return Object.freeze({
      sourceProof: preparedArtifact(input.sourceProof),
      parentWorktrees: Object.freeze({ before: '/private/parents/before', after: '/private/parents/after' }),
      derivedSources: Object.freeze({ before: '/private/derived/before', after: '/private/derived/after' }),
      applications: Object.freeze({
        before: preparedArtifact(input.applicationArtifacts.before),
        after: preparedArtifact(input.applicationArtifacts.after),
      }),
      runtimes: Object.freeze({
        before: preparedArtifact(input.runtimeArtifacts.before),
        after: preparedArtifact(input.runtimeArtifacts.after),
      }),
      models: Object.freeze(
        input.models.map(({ family, variant, sha256, artifact: modelArtifact }) =>
          Object.freeze({
            identity: Object.freeze({ family, variant, sha256 }),
            artifact: preparedArtifact(modelArtifact),
          }),
        ),
      ),
      inputFixture: preparedArtifact(input.inputFixture),
    });
  }

  public async verifyUnchanged(): Promise<void> {
    this.verificationCalls += 1;
  }
}

class FakeCache implements PerformanceCachePreparationPort {
  public calls = 0;

  public constructor(private readonly failAt: number | null = null) {}

  public async prepare(_input: PerformanceCachePreparationInput): Promise<void> {
    this.calls += 1;
    if (this.calls === this.failAt) throw new PerformanceCollectionError('COLD_CACHE_PROOF_UNAVAILABLE');
  }
}

function output(request: PerformanceAttemptRequest): Buffer {
  const phaseIds = request.requiredPhaseIds;
  const side = request.side;
  const window = request.candidateWindow as 1 | 2 | 4 | 8;
  const after = { 1: 800, 2: 770, 4: 700, 8: 650 }[window];
  return Buffer.from(
    `${JSON.stringify({
      schemaVersion: 3,
      status: 'success',
      failureReason: null,
      endToEndNanoseconds: 100_000,
      phases: phaseIds.map((id, sequence) => ({
        id,
        sequence,
        durationNanoseconds:
          id === 'installationPipeWait' || id === 'installationWrite' ? (side === 'before' ? 1000 : after) : 100,
      })),
    })}\n`,
    'utf8',
  );
}

class FakeProcessSession implements PerformanceAttemptProcessSession {
  public readonly rootPid: number;
  public readonly eventStream = Readable.from([]);
  public terminated = false;

  public constructor(
    pid: number,
    private readonly result: Buffer | Error,
  ) {
    this.rootPid = pid;
  }

  public async complete(): Promise<Buffer> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }

  public async terminate(): Promise<void> {
    this.terminated = true;
  }
}

class FakeProcess implements PerformanceAttemptProcessPort {
  public readonly requests: PerformanceAttemptProcessInput[] = [];
  public readonly sessions: FakeProcessSession[] = [];
  public timeoutSampleId: string | null = null;
  public abortController: AbortController | null = null;

  public start(input: PerformanceAttemptProcessInput): PerformanceAttemptProcessSession {
    this.requests.push(input);
    const sampleId = String(input.request.sampleId);
    let result: Buffer | Error = output(input.request);
    if (sampleId === this.timeoutSampleId) result = new PerformanceCollectionError('ATTEMPT_TIMEOUT');
    if (this.abortController) {
      const controller = this.abortController;
      this.abortController = null;
      controller.abort();
      result = new PerformanceCollectionError('COLLECTION_CANCELLED');
    }
    const session = new FakeProcessSession(this.requests.length + 10, result);
    this.sessions.push(session);
    return session;
  }
}

class FakeResourceSession implements PerformanceResourceSession {
  public terminated = false;

  public constructor(
    private readonly input: Parameters<PerformanceResourcePort['start']>[0],
    private readonly failure: ResourceProofFailure | null,
  ) {}

  public async finish(): Promise<PerformanceResourceProof> {
    let resources = Object.freeze(this.input.requiredResourceIds.map((id) => Object.freeze({ id, peakBytes: 1024 })));
    let roleRegistrations = Object.freeze(
      (['main', 'guard', 'worker'] as const).map((role, index) =>
        Object.freeze({
          role,
          pid: this.input.rootPid + index,
          processStartIdentity: `fixture-${String(this.input.rootPid)}-${role}`,
          executableSha256: this.input.expectedExecutableSha256,
        }),
      ),
    );
    if (this.failure === 'missingRole') roleRegistrations = Object.freeze(roleRegistrations.slice(0, -1));
    if (this.failure === 'reusedPid') {
      roleRegistrations = Object.freeze(
        roleRegistrations.map((registration, index) =>
          index === 1 ? Object.freeze({ ...registration, pid: this.input.rootPid }) : registration,
        ),
      );
    }
    if (this.failure === 'wrongExecutable') {
      roleRegistrations = Object.freeze(
        roleRegistrations.map((registration, index) =>
          index === 0 ? Object.freeze({ ...registration, executableSha256: 'f'.repeat(64) }) : registration,
        ),
      );
    }
    if (this.failure === 'resourceOrder') resources = Object.freeze([...resources].reverse());
    return Object.freeze({
      resources,
      roleRegistrations,
      processSettlementProof: 'ownedProcessTreeSettled' as const,
      unownedProcessAttribution: 0 as const,
      unownedGpuAttribution: 'notApplicable' as const,
      identityChanges: this.failure === 'identityChange' ? 1 : 0,
      lateRoleRegistrations: this.failure === 'lateRegistration' ? 1 : 0,
      liveOwnedProcessesAfterSettlement: this.failure === 'liveOwnership' ? 1 : 0,
    });
  }

  public terminate(): void {
    this.terminated = true;
  }
}

type ResourceProofFailure =
  | 'missingRole'
  | 'reusedPid'
  | 'wrongExecutable'
  | 'identityChange'
  | 'lateRegistration'
  | 'liveOwnership'
  | 'resourceOrder';

class FakeResources implements PerformanceResourcePort {
  public readonly sessions: FakeResourceSession[] = [];

  public constructor(public failureOnce: ResourceProofFailure | null = null) {}

  public start(input: Parameters<PerformanceResourcePort['start']>[0]): PerformanceResourceSession {
    const session = new FakeResourceSession(input, this.failureOnce);
    this.failureOnce = null;
    this.sessions.push(session);
    return session;
  }
}

function collector(input: {
  readonly platform: FakePlatform;
  readonly cache: FakeCache;
  readonly process: FakeProcess;
  readonly resources: FakeResources;
}): LocalWhisperPerformanceCollector {
  return new LocalWhisperPerformanceCollector(validator, {
    ...input,
    phases: new PerformanceQualificationPhaseParser(),
  });
}

describe('LocalWhisperPerformanceCollector', () => {
  it('keeps cache and timeout failures in their exact cells while completing all 288 attempts', async () => {
    const platform = new FakePlatform();
    const cache = new FakeCache(1);
    const processes = new FakeProcess();
    processes.timeoutSampleId = 'base-full-1-cold-01-after';
    const resources = new FakeResources();
    const bundle = await collector({ platform, cache, process: processes, resources }).collect(plan());
    assert.equal(bundle.samples.length, 288);
    assert.equal(cache.calls, 288);
    assert.equal(processes.requests.length, 287);
    assert.equal(bundle.samples[0]!.sampleId, 'base-full-1-cold-01-before');
    assert.equal(bundle.samples[0]!.failureReason, 'COLD_CACHE_PROOF_UNAVAILABLE');
    assert.equal(bundle.samples[1]!.sampleId, 'base-full-1-cold-01-after');
    assert.equal(bundle.samples[1]!.failureReason, 'ATTEMPT_TIMEOUT');
    assert.equal(bundle.samples[2]!.sampleId, 'base-full-1-cold-02-after');
    assert.equal(
      processes.sessions.every(({ terminated }) => terminated),
      true,
    );
    assert.equal(
      resources.sessions.every(({ terminated }) => terminated),
      true,
    );
    assert.equal(platform.verificationCalls, 1);
  });

  it('cancels owned work without a partial bundle and permits a clean retry', async () => {
    const platform = new FakePlatform();
    const cache = new FakeCache();
    const processes = new FakeProcess();
    const resources = new FakeResources();
    const instance = collector({ platform, cache, process: processes, resources });
    const abort = new AbortController();
    processes.abortController = abort;
    await assert.rejects(instance.collect(plan(), abort.signal), /COLLECTION_CANCELLED/u);
    assert.equal(processes.sessions[0]!.terminated, true);
    assert.equal(resources.sessions[0]!.terminated, true);
    const retry = await instance.collect(plan());
    assert.equal(retry.samples.length, 288);
    assert.equal(platform.prepareCalls, 2);
    assert.equal(platform.verificationCalls, 2);
  });

  it('turns malformed bounded hook output into one content-free failed attempt', async () => {
    const platform = new FakePlatform();
    const cache = new FakeCache();
    const processes = new FakeProcess();
    const originalStart = processes.start.bind(processes);
    processes.start = (input): PerformanceAttemptProcessSession => {
      if (processes.requests.length === 0) {
        processes.requests.push(input);
        const session = new FakeProcessSession(10, Buffer.from('{"privatePath":"/home/private"}\n'));
        processes.sessions.push(session);
        return session;
      }
      return originalStart(input);
    };
    const resources = new FakeResources();
    const bundle = await collector({ platform, cache, process: processes, resources }).collect(plan());
    assert.equal(bundle.samples[0]!.failureReason, 'ATTEMPT_OUTPUT_INVALID');
    assert.equal(JSON.stringify(bundle.samples[0]).includes('/home/private'), false);
  });

  it('rejects process-owned resource rows from the phase-only response contract', async () => {
    const processes = new FakeProcess();
    const originalStart = processes.start.bind(processes);
    processes.start = (input): PerformanceAttemptProcessSession => {
      if (processes.requests.length !== 0) return originalStart(input);
      processes.requests.push(input);
      const response = JSON.parse(output(input.request).toString('utf8')) as Readonly<Record<string, unknown>>;
      const session = new FakeProcessSession(
        10,
        Buffer.from(`${JSON.stringify({ ...response, resources: [] })}\n`, 'utf8'),
      );
      processes.sessions.push(session);
      return session;
    };
    const bundle = await collector({
      platform: new FakePlatform(),
      cache: new FakeCache(),
      process: processes,
      resources: new FakeResources(),
    }).collect(plan());
    assert.equal(bundle.samples[0]!.status, 'failed');
    assert.equal(bundle.samples[0]!.failureReason, 'ATTEMPT_OUTPUT_INVALID');
    assert.equal(bundle.samples[1]!.status, 'success');
  });

  it('keeps Linux-only representative evidence awaiting cross-platform selection', async () => {
    const platform = new FakePlatform();
    const cache = new FakeCache();
    const processes = new FakeProcess();
    const resources = new FakeResources();
    const bundle = await collector({ platform, cache, process: processes, resources }).collect(
      plan('representativePerformance'),
    );
    const result = new LocalWhisperPerformanceResultProducer(validator).produce(bundle);
    assert.equal(result.evidenceClaim, 'representativePerformance');
    assert.equal(result.selectionStatus, 'awaitingCrossPlatform');
    assert.equal(result.selectedInFlightWindow, null);
  });

  it('fails one exact cell for missing, reused, changed, late, live, or misordered resource ownership', async () => {
    for (const failure of [
      'missingRole',
      'reusedPid',
      'wrongExecutable',
      'identityChange',
      'lateRegistration',
      'liveOwnership',
      'resourceOrder',
    ] as const) {
      const resources = new FakeResources(failure);
      const bundle = await collector({
        platform: new FakePlatform(),
        cache: new FakeCache(),
        process: new FakeProcess(),
        resources,
      }).collect(plan());
      assert.equal(bundle.samples[0]!.status, 'failed');
      assert.match(String(bundle.samples[0]!.failureReason), /^RESOURCE_/u);
      assert.equal(bundle.samples[1]!.status, 'success');
      assert.doesNotMatch(JSON.stringify(bundle.samples[0]), /fixture-|pid|role|executable/u);
    }
  });
});
