import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  LinuxPerformanceAttemptBuildAdapter,
  type PerformanceAttemptBuildCachePort,
  type PerformanceAttemptBuildCommandInput,
  type PerformanceAttemptBuildCommandPort,
  type PerformanceAttemptResourceStagePort,
  type PerformanceAttemptRuntimePackPort,
} from '@scripts/local-whisper/qualification/LinuxPerformanceAttemptBuildAdapter';
import type { PerformanceDerivedSourceAuthority } from '@scripts/local-whisper/qualification/PerformanceDerivedSourceProducer';

class FixtureCommands implements PerformanceAttemptBuildCommandPort {
  public readonly calls: PerformanceAttemptBuildCommandInput[] = [];
  public failure = false;

  public async run(input: PerformanceAttemptBuildCommandInput): Promise<void> {
    this.calls.push(input);
    if (this.failure) throw new Error('fixture command failure');
  }
}

class FixtureCache implements PerformanceAttemptBuildCachePort {
  public calls = 0;

  public async stage(): Promise<void> {
    this.calls += 1;
  }
}

class FixtureResources implements PerformanceAttemptResourceStagePort {
  public calls = 0;

  public async stage(_workspaceRoot: string, resourcesPath: string): Promise<void> {
    this.calls += 1;
    await mkdir(resourcesPath, { recursive: true, mode: 0o700 });
    await writeFile(path.join(resourcesPath, 'fixture'), 'resource', { mode: 0o400 });
  }
}

class FixtureRuntimePacks implements PerformanceAttemptRuntimePackPort {
  public readonly profiles: string[] = [];

  public async produce(input: Parameters<PerformanceAttemptRuntimePackPort['produce']>[0]) {
    this.profiles.push(input.profileId);
    await mkdir(input.outputDirectory, { mode: 0o700 });
    const bytes = Buffer.from(`runtime-${input.profileId}`);
    const file = `${input.profileId}.tar.gz`;
    await writeFile(path.join(input.outputDirectory, file), bytes, { mode: 0o600 });
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return Object.freeze({
      schemaVersion: 1 as const,
      profileId: input.profileId,
      transferProfile: 'restricted-tar-gzip-v1' as const,
      archive: Object.freeze({ file, sizeBytes: bytes.byteLength, sha256, signatureInputSha256: sha256 }),
      expectedFiles: Object.freeze([]),
      evidence: Object.freeze({
        runtimeManifestSha256: '1'.repeat(64),
        provenanceSha256: '2'.repeat(64),
        sbomSha256: '3'.repeat(64),
        noticesSha256: '4'.repeat(64),
      }),
    });
  }
}

function authority(rootPath: string): PerformanceDerivedSourceAuthority {
  return Object.freeze({
    rootPath,
    side: 'after',
    parentCommit: '3'.repeat(40),
    sourceProofDigest: '4'.repeat(64),
    instrumentationOverlaySha256: '5'.repeat(64),
    derivedTreeManifestSha256: '6'.repeat(64),
  });
}

describe('Linux performance attempt build adapter', () => {
  it('builds helpers, both instrumented runtimes, and one mode-0500 SEA artifact through injected commands', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-attempt-build-'));
    try {
      const sourceRoot = path.join(root, 'source');
      await mkdir(sourceRoot, { mode: 0o700 });
      const commands = new FixtureCommands();
      const cache = new FixtureCache();
      const resources = new FixtureResources();
      const runtimes = new FixtureRuntimePacks();
      const adapter = new LinuxPerformanceAttemptBuildAdapter(root, {
        cache,
        commands,
        resources,
        runtimePacks: runtimes,
      });
      const result = await adapter.build({ authority: authority(sourceRoot), side: 'after' });
      assert.equal(commands.calls.length, 7);
      assert.equal(cache.calls, 1);
      assert.deepEqual(
        commands.calls.slice(0, 4).map(({ arguments: arguments_ }) => arguments_),
        [
          ['scripts/local-whisper/build-fs-guard.mjs'],
          ['scripts/local-whisper/build-launcher.mjs'],
          ['scripts/local-whisper/build-whisper-cpp-core.mjs', '--profile=linux-x64-cpu-baseline-v1'],
          ['scripts/local-whisper/build-whisper-cpp-cuda.mjs', '--profile=linux-x64-cuda-12.8.1-sm120a-v1'],
        ],
      );
      assert.deepEqual(runtimes.profiles, ['linux-x64-cpu-baseline-v1', 'linux-x64-cuda-12.8.1-sm120a-v1']);
      assert.equal(resources.calls, 1);
      assert.equal((await stat(path.join(sourceRoot, result.executableRelativePath))).mode & 0o777, 0o500);
      for (const artifact of Object.values(result.runtimeArtifacts)) {
        assert.equal((await stat(path.join(sourceRoot, artifact.relativePath))).mode & 0o777, 0o600);
        assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects cancellation, command failure, and reused output with stable content-free errors', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-attempt-build-failure-'));
    try {
      const sourceRoot = path.join(root, 'source');
      await mkdir(sourceRoot, { mode: 0o700 });
      const commands = new FixtureCommands();
      const adapter = new LinuxPerformanceAttemptBuildAdapter(root, {
        cache: new FixtureCache(),
        commands,
        resources: new FixtureResources(),
        runtimePacks: new FixtureRuntimePacks(),
      });
      const abort = new AbortController();
      abort.abort();
      await assert.rejects(adapter.build({ authority: authority(sourceRoot), side: 'after', signal: abort.signal }), {
        message: 'PERFORMANCE_ATTEMPT_BUILD_INPUT_INVALID',
      });
      commands.failure = true;
      await assert.rejects(adapter.build({ authority: authority(sourceRoot), side: 'after' }), {
        message: 'PERFORMANCE_ATTEMPT_BUILD_FAILED',
      });
      commands.failure = false;
      await assert.rejects(adapter.build({ authority: authority(sourceRoot), side: 'after' }), {
        message: 'PERFORMANCE_ATTEMPT_BUILD_OUTPUT_EXISTS',
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
