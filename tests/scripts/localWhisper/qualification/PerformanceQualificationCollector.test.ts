import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  LocalWhisperPerformanceCollector,
  PerformanceCollectionError,
  PerformanceQualificationPhaseParser,
  type PerformanceAttemptProcessInput,
  type PerformanceAttemptProcessPort,
  type PerformanceAttemptProcessSession,
  type PerformanceCachePreparationInput,
  type PerformanceCachePreparationPort,
  type PerformanceCollectionPlatformPort,
  type PerformanceResourcePort,
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
  return documents.produceRunPlan({
    sourceRevision:
      evidenceClaim === 'representativePerformance' ? LOCAL_WHISPER_PERFORMANCE_SOURCE_REVISION : '4'.repeat(40),
    sourceProofDigest:
      evidenceClaim === 'representativePerformance' ? LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST : 'b'.repeat(64),
    platform: 'linux',
    backend: 'cpu',
    executionMode: 'representativeHost',
    evidenceClaim,
    baselineCommit: '2'.repeat(40),
    candidateCommit: '3'.repeat(40),
    sourceProof: artifact(
      'proof/source.json',
      evidenceClaim === 'representativePerformance' ? LOCAL_WHISPER_PERFORMANCE_SOURCE_PROOF_DIGEST : 'b'.repeat(64),
    ),
    worktrees: {
      before: { relativePath: 'before', commit: '2'.repeat(40) },
      after: { relativePath: 'after', commit: '3'.repeat(40) },
    },
    applicationArtifacts: {
      before: artifact('before/app'),
      after: artifact('after/app'),
    },
    runtimeArtifacts: {
      before: artifact('before/runtime'),
      after: artifact('after/runtime'),
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
      worktrees: Object.freeze({ before: '/private/before', after: '/private/after' }),
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

function output(request: Readonly<Record<string, unknown>>): Buffer {
  const phaseIds = request.requiredPhaseIds as readonly string[];
  const resourceIds = request.requiredResourceIds as readonly string[];
  const side = request.side;
  const window = request.candidateWindow as 1 | 2 | 4 | 8;
  const after = { 1: 800, 2: 770, 4: 700, 8: 650 }[window];
  return Buffer.from(
    `${JSON.stringify({
      schemaVersion: 2,
      status: 'success',
      failureReason: null,
      endToEndNanoseconds: 100_000,
      phases: phaseIds.map((id, sequence) => ({
        id,
        sequence,
        durationNanoseconds:
          id === 'installationPipeWait' || id === 'installationWrite' ? (side === 'before' ? 1000 : after) : 100,
      })),
      resources: resourceIds.map((id) => ({ id, peakBytes: 1024 })),
    })}\n`,
    'utf8',
  );
}

class FakeProcessSession implements PerformanceAttemptProcessSession {
  public readonly rootPid: number;
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

  public async finish() {
    return Object.freeze({
      processSettlementProof: 'ownedProcessTreeSettled' as const,
      unownedProcessAttribution: 0 as const,
      unownedGpuAttribution: 'notApplicable' as const,
    });
  }

  public terminate(): void {
    this.terminated = true;
  }
}

class FakeResources implements PerformanceResourcePort {
  public readonly sessions: FakeResourceSession[] = [];

  public start(): PerformanceResourceSession {
    const session = new FakeResourceSession();
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
});
