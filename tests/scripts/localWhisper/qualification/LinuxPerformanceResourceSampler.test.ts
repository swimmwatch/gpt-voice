import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import { Readable } from 'node:stream';

import { LinuxPerformanceResourceSamplerSession } from '@scripts/local-whisper/qualification/LinuxPerformanceResourceSampler';

describe('LinuxPerformanceResourceSamplerSession', () => {
  it('closes its owned forwarding channel after the attempt result is complete', async () => {
    const proof = JSON.stringify({
      schemaVersion: 3,
      sampleIntervalMilliseconds: 100,
      ramAlgorithm: 'proc-smaps-rollup-pss-registered-role-start-identity-v1',
      vramAlgorithm: 'notApplicable',
      resources: {
        mainProcessPeakRss: 1,
        guardProcessPeakRss: 2,
        workerProcessPeakRss: 3,
        gpuPeakVram: 'notApplicable',
      },
      roleRegistrations: ['main', 'guard', 'worker'].map((role, index) => ({
        role,
        pid: index + 2,
        processStartIdentity: String(index + 1),
        executableSha256: 'a'.repeat(64),
      })),
      processSettlementProof: 'ownedProcessTreeSettled',
      settledZeroOwnershipSamples: 10,
      unownedProcessAttribution: 0,
      unownedGpuAttribution: 'notApplicable',
      identityChanges: 0,
      lateRoleRegistrations: 0,
      liveOwnedProcessesAfterSettlement: 0,
    });
    const child = spawn(
      process.execPath,
      [
        '-e',
        `process.stdin.resume(); process.stdin.once('end', () => process.stdout.end(${JSON.stringify(`${proof}\n`)}));`,
      ],
      { stdio: 'pipe' },
    );
    const eventStream = new Readable({ read: () => undefined });
    const session = new LinuxPerformanceResourceSamplerSession(
      child,
      'cpu',
      eventStream,
      Readable.from([Buffer.from('READY\n', 'ascii')]),
      1_000,
    );

    const result = await session.finish();

    assert.deepEqual(
      result.resources.map(({ peakBytes }) => peakBytes),
      [1, 2, 3],
    );
  });

  it('bounds sampler completion and terminates its owned sampler process', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => undefined, 1_000)'], { stdio: 'pipe' });
    const exited = once(child, 'exit');
    const session = new LinuxPerformanceResourceSamplerSession(
      child,
      'cpu',
      Readable.from([]),
      Readable.from([Buffer.from('READY\n', 'ascii')]),
      1_000,
    );

    await assert.rejects(session.finish(), (error: unknown) => {
      return error instanceof Error && error.message === 'RESOURCE_SAMPLER_TIMEOUT';
    });
    await exited;
  });
});
