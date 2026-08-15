import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Writable } from 'node:stream';
import { describe, it } from 'node:test';

import {
  PerformanceQualificationAttemptRunner,
  parsePerformanceAttemptRequest,
  type PerformanceAttemptApplicationInput,
  type PerformanceAttemptApplicationPort,
} from '@scripts/local-whisper/qualification/PerformanceQualificationAttemptRunner';
import { PerformanceQualificationEventWriter } from '@scripts/local-whisper/qualification/PerformanceQualificationEventProtocol';
import {
  performanceRequiredPhaseIds,
  performanceSelectedModels,
} from '@scripts/local-whisper/qualification/PerformanceQualification';
import type { PerformanceAttemptRequest } from '@scripts/local-whisper/qualification/PerformanceQualificationCollector';
import {
  LOCAL_WHISPER_PERFORMANCE_PHASES,
  qualificationCanonicalJson,
} from '@scripts/local-whisper/qualification/QualificationContracts';

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

class EventBuffer extends Writable {
  public readonly chunks: Buffer[] = [];
  public override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }
}

function emitProof(input: PerformanceAttemptApplicationInput): void {
  const output = new EventBuffer();
  const writer = new PerformanceQualificationEventWriter(output);
  for (const [index, role] of (['main', 'guard', 'worker'] as const).entries()) {
    writer.role({
      role,
      pid: 100 + index,
      processStartIdentity: `start-${String(index)}`,
      executableSha256: String(index + 1).repeat(64),
    });
  }
  for (const { id } of LOCAL_WHISPER_PERFORMANCE_PHASES) {
    if (input.request.backend === 'cpu' && id === 'gpuUploadAllocation') writer.phase(id, null, 'notApplicable');
    else writer.phase(id, 100 + input.effectiveInstallationWindow);
  }
  writer.success();
  input.publishEvent(Buffer.concat(output.chunks));
}

class FixtureApplication implements PerformanceAttemptApplicationPort {
  public readonly windows: number[] = [];
  public constructor(private readonly mutate?: (input: PerformanceAttemptApplicationInput) => Promise<void>) {}
  public async run(input: PerformanceAttemptApplicationInput) {
    this.windows.push(input.effectiveInstallationWindow);
    emitProof(input);
    await this.mutate?.(input);
    return { endToEndNanoseconds: 1234 };
  }
}

async function fixtureRequest(
  root: string,
  side: 'before' | 'after' = 'after',
): Promise<{ readonly request: PerformanceAttemptRequest; readonly bytes: Buffer; readonly modelPath: string }> {
  const runtime = Buffer.from('runtime-archive');
  const model = Buffer.from('model-bytes');
  const input = Buffer.from('wav-fixture');
  const runtimePath = path.join(root, 'runtime.tar.gz');
  const modelPath = path.join(root, 'model.bin');
  const inputPath = path.join(root, 'input.wav');
  await Promise.all([writeFile(runtimePath, runtime), writeFile(modelPath, model), writeFile(inputPath, input)]);
  const selected = performanceSelectedModels()[0]!;
  const request = Object.freeze({
    schemaVersion: 3 as const,
    activationPurpose: 'qualification' as const,
    sampleId: `base-full-8-cold-01-${side}`,
    platform: 'linux' as const,
    backend: 'cpu' as const,
    model: Object.freeze({ ...selected, sha256: sha256(model) }),
    candidateWindow: 8 as const,
    cacheState: 'cold' as const,
    pairIndex: 1,
    runOrder: 'beforeThenAfter' as const,
    side,
    runtimeArtifact: Object.freeze({
      absolutePath: runtimePath,
      sizeBytes: runtime.byteLength,
      sha256: sha256(runtime),
    }),
    modelArtifact: Object.freeze({ absolutePath: modelPath, sizeBytes: model.byteLength, sha256: sha256(model) }),
    inputFixture: Object.freeze({ absolutePath: inputPath, sizeBytes: input.byteLength, sha256: sha256(input) }),
    requiredPhaseIds: performanceRequiredPhaseIds('linux', 'cpu'),
    derivedSourceReceiptDigest: 'a'.repeat(64),
  }) satisfies PerformanceAttemptRequest;
  return {
    request,
    bytes: Buffer.from(`${qualificationCanonicalJson(request)}\n`, 'utf8'),
    modelPath,
  };
}

describe('performance qualification attempt runner', () => {
  it('authenticates three no-follow files and forces baseline serial while applying candidate windows only after', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-attempt-'));
    try {
      const before = await fixtureRequest(root, 'before');
      const application = new FixtureApplication();
      const runner = new PerformanceQualificationAttemptRunner(application);
      const forwarded: Buffer[] = [];
      const beforeResponse = await runner.run(before.bytes, (frame) => forwarded.push(frame));
      assert.equal(beforeResponse.status, 'success');
      const after = await fixtureRequest(root, 'after');
      const afterResponse = await runner.run(after.bytes, (frame) => forwarded.push(frame));
      assert.equal(afterResponse.status, 'success');
      assert.deepEqual(application.windows, [1, 8]);
      assert.equal(beforeResponse.phases.length, performanceRequiredPhaseIds('linux', 'cpu').length);
      assert.equal(forwarded.length, 2);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects noncanonical, extra, oversized, symlinked, or identity-mismatched input without path disclosure', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-attempt-invalid-'));
    try {
      const fixture = await fixtureRequest(root);
      const parsed = JSON.parse(fixture.bytes.toString('utf8')) as Record<string, unknown>;
      const invalid = [
        Buffer.from(`${JSON.stringify(parsed, null, 2)}\n`),
        Buffer.from(`${JSON.stringify({ ...parsed, privatePath: '/secret' })}\n`),
        Buffer.concat([fixture.bytes.subarray(0, -1), Buffer.from('\n{}\n')]),
        Buffer.alloc(64 * 1024 + 1, 0x61),
      ];
      for (const bytes of invalid)
        assert.throws(() => parsePerformanceAttemptRequest(bytes), /ATTEMPT_REQUEST_INVALID/u);

      const linkPath = path.join(root, 'model-link.bin');
      await symlink(fixture.modelPath, linkPath);
      const linked = {
        ...fixture.request,
        modelArtifact: { ...fixture.request.modelArtifact, absolutePath: linkPath },
      };
      const linkedResponse = await new PerformanceQualificationAttemptRunner(new FixtureApplication()).run(
        Buffer.from(`${qualificationCanonicalJson(linked)}\n`),
        () => undefined,
      );
      assert.equal(linkedResponse.failureReason, 'ATTEMPT_ARTIFACT_INVALID');
      assert.doesNotMatch(JSON.stringify(linkedResponse), /local-whisper-attempt|model-link/u);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('fails closed when an authenticated artifact changes during execution and permits a clean retry', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-attempt-change-'));
    try {
      const fixture = await fixtureRequest(root);
      const mutating = new PerformanceQualificationAttemptRunner(
        new FixtureApplication(async () => {
          await writeFile(fixture.modelPath, Buffer.from('MODEL-bytes'));
        }),
      );
      const failed = await mutating.run(fixture.bytes, () => undefined);
      assert.equal(failed.status, 'failed');
      assert.equal(failed.failureReason, 'ATTEMPT_ARTIFACT_CHANGED');

      const retry = await fixtureRequest(root);
      const success = await new PerformanceQualificationAttemptRunner(new FixtureApplication()).run(
        retry.bytes,
        () => undefined,
      );
      assert.equal(success.status, 'success');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
