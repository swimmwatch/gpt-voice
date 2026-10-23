import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { MemoryBoundCheckSupervisor } from '../../../../scripts/local-whisper/alpha-smoke/MemoryBoundCheckSupervisor.mjs';

/** Supplies deterministic memory snapshots for owned-process lifecycle checks. */
class DeterministicSupervisor extends MemoryBoundCheckSupervisor {
  async snapshot() {
    return { remaining: 12 * 1024 ** 3, total: 32 * 1024 ** 3, swapUsed: 0, oom: 'oom 0' };
  }
  async groupRss() {
    return 0;
  }
}

it('collects a short-lived real child exit without missing close events', async () => {
  const result = await new DeterministicSupervisor().run(process.execPath, ['-e', 'process.exit(0)']);
  assert.equal(result.status, 'passed');
  assert.equal(result.exitCode, 0);
});

it('marks command failures failed rather than passed', async () => {
  const result = await new DeterministicSupervisor().run(process.execPath, ['-e', 'process.exit(7)']);
  assert.equal(result.status, 'failed');
  assert.equal(result.exitCode, 7);
});

it('blocks before spawning when available memory is below the reserve', async () => {
  const supervisor = new DeterministicSupervisor();
  supervisor.snapshot = async () => ({ remaining: 1024 ** 3, total: 32 * 1024 ** 3, swapUsed: 0, oom: 'oom 0' });
  const result = await supervisor.run('/does-not-exist', []);
  assert.equal(result.status, 'blocked');
});

it('cleans an owned worker when its leader exits during a slow initial resource sample', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'alpha-supervisor-orphan-'));
  const marker = path.join(root, 'worker.json');
  let worker = null;
  const readWorker = async () => {
    try {
      return JSON.parse(await readFile(marker, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  };
  const identity = async (pid) => {
    try {
      const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
      const fields = stat
        .slice(stat.lastIndexOf(')') + 2)
        .trim()
        .split(/\s+/);
      return fields[0] === 'Z' ? null : fields[19];
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  };
  const supervisor = new MemoryBoundCheckSupervisor();
  let samples = 0;
  supervisor.snapshot = async () => {
    if (++samples === 2) await new Promise((resolve) => setTimeout(resolve, 1_000));
    return { remaining: 12 * 1024 ** 3, total: 32 * 1024 ** 3, swapUsed: 0, oom: 'oom 0' };
  };
  try {
    const result = await supervisor.run(process.execPath, [
      '-e',
      `
      const { spawn } = require('node:child_process');
      const fs = require('node:fs');
      const worker = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
      worker.once('spawn', () => {
        const stat = fs.readFileSync('/proc/' + worker.pid + '/stat', 'utf8');
        const startTime = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\\s+/)[19];
        fs.writeFileSync(process.argv[1], JSON.stringify({ pid: worker.pid, startTime }), { mode: 0o600 });
        process.exit(0);
      });
    `,
      marker,
    ]);
    worker = await readWorker();
    assert.ok(worker);
    assert.equal(result.status, 'failed');
    assert.equal(await identity(worker.pid), null, 'Supervisor left its owned worker running');
  } finally {
    if (worker === null) worker = await readWorker();
    if (worker !== null && (await identity(worker.pid)) === worker.startTime) process.kill(worker.pid, 'SIGKILL');
    await rm(root, { recursive: true, force: true });
  }
});
