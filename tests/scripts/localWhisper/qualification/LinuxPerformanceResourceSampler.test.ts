import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';

import { LinuxPerformanceResourceSampler } from '@scripts/local-whisper/qualification/LinuxPerformanceResourceSampler';

function processStartIdentity(stat: string): string {
  const tail = stat.slice(stat.lastIndexOf(') ') + 2).split(' ');
  const identity = tail[19];
  if (!identity) throw new Error('Fixture process identity unavailable');
  return identity;
}

async function registration(
  role: 'main' | 'guard' | 'worker',
  child: ChildProcessWithoutNullStreams,
  sequence: number,
) {
  if (!child.pid) throw new Error('Fixture process unavailable');
  const [stat, executable] = await Promise.all([
    readFile(`/proc/${String(child.pid)}/stat`, 'ascii'),
    readFile(`/proc/${String(child.pid)}/exe`),
  ]);
  return {
    schemaVersion: 1,
    kind: 'role',
    sequence,
    role,
    pid: child.pid,
    processStartIdentity: processStartIdentity(stat),
    executableSha256: createHash('sha256').update(executable).digest('hex'),
  } as const;
}

function sleepProcess(): ChildProcessWithoutNullStreams {
  return spawn('/usr/bin/sleep', ['0.4'], {
    cwd: '/',
    env: { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

describe('Linux performance role-aware resource sampler', () => {
  it('attributes PSS to exact registered roles and waits for ten zero-ownership samples', async () => {
    if (process.platform !== 'linux') return;
    const children = [sleepProcess(), sleepProcess(), sleepProcess()] as const;
    const events = new PassThrough();
    try {
      const registrations = await Promise.all([
        registration('main', children[0], 0),
        registration('guard', children[1], 1),
        registration('worker', children[2], 2),
      ]);
      const sampler = new LinuxPerformanceResourceSampler(
        path.resolve('scripts/local-whisper/qualification/linux_performance_resource_sampler.py'),
      );
      const session = sampler.start({
        rootPid: registrations[0].pid,
        backend: 'cpu',
        expectedMainExecutableSha256: registrations[0].executableSha256,
        eventStream: events,
      });
      await session.ready;
      for (const event of registrations) events.write(`${JSON.stringify(event)}\n`);
      events.end(`${JSON.stringify({ schemaVersion: 1, kind: 'terminal', sequence: 3, status: 'success' })}\n`);
      const proof = await session.finish();
      assert.deepEqual(
        proof.roleRegistrations.map(({ role, pid }) => ({ role, pid })),
        registrations.map(({ role, pid }) => ({ role, pid })),
      );
      assert.equal(proof.resources.length, 3);
      assert.equal(
        proof.resources.every(({ peakBytes }) => peakBytes > 0),
        true,
      );
      assert.equal(proof.processSettlementProof, 'ownedProcessTreeSettled');
      assert.equal(proof.unownedGpuAttribution, 'notApplicable');
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
    }
  });

  it('rejects duplicate role PIDs without returning raw identities or paths', async () => {
    if (process.platform !== 'linux') return;
    const children = [sleepProcess(), sleepProcess()] as const;
    const events = new PassThrough();
    try {
      const main = await registration('main', children[0], 0);
      const guard = { ...main, role: 'guard' as const, sequence: 1 };
      const worker = await registration('worker', children[1], 2);
      const session = new LinuxPerformanceResourceSampler(
        path.resolve('scripts/local-whisper/qualification/linux_performance_resource_sampler.py'),
      ).start({
        rootPid: main.pid,
        backend: 'cpu',
        expectedMainExecutableSha256: main.executableSha256,
        eventStream: events,
      });
      await session.ready;
      events.end(
        `${[main, guard, worker, { schemaVersion: 1, kind: 'terminal', sequence: 3, status: 'success' }]
          .map((event) => JSON.stringify(event))
          .join('\n')}\n`,
      );
      await assert.rejects(session.finish(), (error: unknown) => {
        assert.doesNotMatch(String(error), /\/proc|sleep|"pid"/u);
        return /event-role/u.test(String(error));
      });
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
    }
  });
});
