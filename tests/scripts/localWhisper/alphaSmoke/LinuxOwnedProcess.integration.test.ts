import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { it } from 'node:test';
import { LinuxApplicationProcessVerifier } from '@scripts/local-whisper/alpha-smoke/LinuxApplicationProcessVerifier';
import type { LinuxAlphaSmokeCommandPort } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeCommandRunner';
import { LinuxIsolatedApplicationSession } from '@scripts/local-whisper/alpha-smoke/LinuxIsolatedApplicationSession';

async function activeProcessIdentity(pid: number): Promise<string | null> {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
    const fields = stat
      .slice(stat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/u);
    return fields[0] === 'Z' ? null : (fields[19] ?? null);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

it('does not report exit while a captured owned worker survives its leader', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'alpha-owned-orphan-'));
  const marker = path.join(root, 'worker.json');
  let leader: ReturnType<typeof spawn> | null = null;
  let worker: Readonly<{ pid: number; startTime: string }> | null = null;
  const lifecycle: { exit: Promise<unknown> | null } = { exit: null };
  try {
    const session = new LinuxIsolatedApplicationSession({
      workRoot: root,
      spawn: (_executable, _arguments, options) => {
        leader = spawn(
          process.execPath,
          [
            '-e',
            `
          const { spawn } = require('node:child_process');
          const fs = require('node:fs');
            const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: 'ignore' });
          child.once('spawn', () => {
            const stat = fs.readFileSync('/proc/' + child.pid + '/stat', 'utf8');
            const startTime = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\\s+/)[19];
            fs.writeFileSync(process.argv[1], JSON.stringify({ pid: child.pid, startTime }), { mode: 0o600 });
          });
          process.on('SIGUSR2', () => process.exit(0));
          setInterval(() => {}, 1000);
        `,
            marker,
          ],
          options,
        );
        lifecycle.exit = once(leader, 'exit');
        return leader;
      },
    });
    const receipt = await session.launchOnline();
    const deadline = performance.now() + 5_000;
    while (worker === null) {
      try {
        worker = JSON.parse(await readFile(marker, 'utf8')) as { pid: number; startTime: string };
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        assert.ok(performance.now() < deadline, 'Owned worker marker was not created');
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    assert.equal(await activeProcessIdentity(worker.pid), worker.startTime);
    // Capture ownership while the leader is alive, before deliberately orphaning the worker.
    await assert.rejects(session.waitForExit(50), /EXIT_TIMEOUT/u);
    const savedGroups = await session.snapshotOwnedGroups();
    assert.equal(await activeProcessIdentity(receipt.processId), receipt.startTime);
    process.kill(receipt.processId, 'SIGUSR2');
    await lifecycle.exit;
    assert.equal(await activeProcessIdentity(worker.pid), worker.startTime);
    await assert.rejects(session.waitForExit(50), /EXIT_TIMEOUT/u);
    const resumed = new LinuxIsolatedApplicationSession({ workRoot: root });
    await resumed.restoreOwnedGroups(savedGroups);
    await resumed.shutdown(1_000);
    assert.equal(await activeProcessIdentity(worker.pid), null);
  } finally {
    if (worker !== null && (await activeProcessIdentity(worker.pid)) === worker.startTime)
      process.kill(worker.pid, 'SIGKILL');
    if (leader !== null) {
      const ownedLeader = leader as ReturnType<typeof spawn>;
      if (ownedLeader.exitCode === null && ownedLeader.signalCode === null) ownedLeader.kill('SIGKILL');
    }
    await lifecycle.exit;
    await rm(root, { recursive: true, force: true });
  }
});

it('refuses a reused PID identity without signalling the unrelated live group', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'alpha-reused-pid-'));
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
  const exit = once(child, 'exit');
  try {
    await once(child, 'spawn');
    assert.ok(child.pid);
    const startTime = await activeProcessIdentity(child.pid);
    assert.ok(startTime);
    const staleReceipt = { processId: child.pid, startTime: (BigInt(startTime) + 1n).toString() };
    const resumed = new LinuxIsolatedApplicationSession({ workRoot: root });
    await assert.rejects(
      resumed.restoreOwnedGroups([{ receipt: staleReceipt, members: [staleReceipt] }]),
      /PROCESS_OWNERSHIP_UNPROVEN/u,
    );
    assert.equal(await activeProcessIdentity(child.pid), startTime);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exit;
    await rm(root, { recursive: true, force: true });
  }
});

it('observes and releases a real owned Linux child using kernel process identity', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  const exit = once(child, 'exit');
  try {
    await once(child, 'spawn');
    assert.ok(child.pid);
    const stat = await readFile(`/proc/${child.pid}/stat`, 'utf8');
    const startTime = stat
      .slice(stat.lastIndexOf(')') + 2)
      .trim()
      .split(/\s+/u)[19];
    const commands: LinuxAlphaSmokeCommandPort = {
      run: async () => '',
      runBytes: async () => Buffer.alloc(0),
      runStreaming: async () => undefined,
    };
    const verifier = new LinuxApplicationProcessVerifier({ commands });
    await verifier.registerApplication({ processId: child.pid, startTime });
    assert.ok((await verifier.captureOwnedWorkers()).has(child.pid));
    await assert.rejects(verifier.assertOwnedProcessesExited(), /OWNED_PROCESS_ACTIVE/u);
    child.kill('SIGTERM');
    await exit;
    await verifier.assertOwnedProcessesExited();
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await exit;
  }
});
