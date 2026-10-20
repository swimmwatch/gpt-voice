import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { setInterval, clearInterval, setTimeout, clearTimeout } from 'node:timers';

const GIB = 1024 ** 3;
const SAMPLE_INTERVAL_MS = 5_000;
const TERMINATION_GRACE_MS = 10_000;
const SWAP_GROWTH_LIMIT = 512 * 1024 ** 2;
const OWNERSHIP_GUARDIAN_SOURCE = `
  import { spawn } from 'node:child_process';
  // Remain the session leader until the parent has inspected and released the owned group.
  const keepAlive = setInterval(() => {}, 1000);
  process.on('message', (message) => {
    if (message === 'release') { clearInterval(keepAlive); process.exit(0); }
  });
  const child = spawn(process.argv[1], process.argv.slice(2), { shell: false, stdio: 'inherit' });
  let sent = false;
  const complete = (exitCode, signal, spawnFailed) => {
    if (!sent) { sent = true; process.send?.({ exitCode, signal, spawnFailed }); }
  };
  child.once('error', () => complete(null, null, true));
  child.once('close', (code, signal) => complete(code, signal, false));
`;

/** Runs one owned process group, never selecting or signalling ambient processes. */
export class MemoryBoundCheckSupervisor {
  async snapshot() {
    const document = await readFile('/proc/meminfo', 'utf8');
    const fields = Object.fromEntries(
      [...document.matchAll(/^(\w+):\s+(\d+) kB$/gm)].map((match) => [match[1], Number(match[2]) * 1024]),
    );
    const membership = (await readFile('/proc/self/cgroup', 'utf8'))
      .split('\n')
      .find((line) => line.startsWith('0::'))
      ?.slice(3);
    let remaining = fields.MemAvailable;
    let total = fields.MemTotal;
    let oom = null;
    if (membership && !membership.split('/').includes('..')) {
      // Ancestor limits also constrain a nested cgroup.
      let relative = membership;
      for (;;) {
        const root = `/sys/fs/cgroup${relative === '/' ? '' : relative}`;
        try {
          const maximum = (await readFile(`${root}/memory.max`, 'utf8')).trim();
          const current = Number((await readFile(`${root}/memory.current`, 'utf8')).trim());
          if (maximum !== 'max' && Number.isFinite(Number(maximum)) && Number.isFinite(current)) {
            total = Math.min(total, Number(maximum));
            remaining = Math.min(remaining, Math.max(0, Number(maximum) - current));
          }
          if (oom === null) oom = (await readFile(`${root}/memory.events`, 'utf8')).trim();
        } catch (error) {
          if (!['ENOENT', 'EACCES'].includes(error.code)) throw error;
        }
        if (relative === '/') break;
        relative = relative.slice(0, relative.lastIndexOf('/')) || '/';
      }
    }
    if (![remaining, total, fields.SwapTotal, fields.SwapFree].every(Number.isFinite))
      throw new Error('CHECK_MEMORY_SNAPSHOT_INVALID');
    return { remaining, total, swapUsed: fields.SwapTotal - fields.SwapFree, oom };
  }

  async groupRss(groupId) {
    let rss = 0;
    for (const entry of await readdir('/proc')) {
      if (!/^\d+$/.test(entry)) continue;
      try {
        const stat = await readFile(`/proc/${entry}/stat`, 'utf8');
        const fields = stat
          .slice(stat.lastIndexOf(')') + 2)
          .trim()
          .split(/\s+/);
        if (Number(fields[2]) !== groupId) continue;
        const status = await readFile(`/proc/${entry}/status`, 'utf8');
        rss += Number(/^VmRSS:\s+(\d+) kB$/m.exec(status)?.[1] ?? 0) * 1024;
      } catch (error) {
        if (!['ENOENT', 'ESRCH', 'EACCES'].includes(error.code)) throw error;
      }
    }
    return rss;
  }

  async run(executable, arguments_) {
    const first = await this.snapshot();
    if (first.remaining < Math.max(4 * GIB, first.total * 0.15)) {
      return {
        status: 'blocked',
        reason: 'insufficient_memory_before_start',
        exitCode: null,
        minimumAvailableBytes: first.remaining,
      };
    }
    const child = spawn(
      process.execPath,
      ['--input-type=module', '--eval', OWNERSHIP_GUARDIAN_SOURCE, '--', executable, ...arguments_],
      {
        detached: true,
        shell: false,
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      },
    );
    const closed = new Promise((resolve) => {
      child.once('error', resolve);
      child.once('close', resolve);
    });
    const completion = new Promise((resolve) => {
      child.once('message', resolve);
      child.once('error', () => resolve({ exitCode: null, signal: null, spawnFailed: true }));
      child.once('close', (exitCode, signal) => resolve({ exitCode, signal, spawnFailed: false }));
    });
    let stopped = false;
    let reason = null;
    let minimumAvailableBytes = first.remaining;
    let maximumObservedRssBytes = 0;
    let final = first;
    let lowSamples = 0;
    let sampling = false;
    let escalation = null;
    let cleanupComplete = Promise.resolve();
    let leaderStartTime = null;
    let activeMembers = [];
    const captured = new Map();
    const groupStillOwned = async () => {
      let leaderAlive = false;
      try {
        const stat = await readFile(`/proc/${child.pid}/stat`, 'utf8');
        const fields = stat
          .slice(stat.lastIndexOf(')') + 2)
          .trim()
          .split(/\s+/);
        if (leaderStartTime === null) leaderStartTime = fields[19];
        leaderAlive = fields[19] === leaderStartTime && Number(fields[2]) === child.pid;
      } catch (error) {
        if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
      }
      const members = [];
      for (const entry of await readdir('/proc')) {
        if (!/^\d+$/.test(entry)) continue;
        try {
          const stat = await readFile(`/proc/${entry}/stat`, 'utf8');
          const fields = stat
            .slice(stat.lastIndexOf(')') + 2)
            .trim()
            .split(/\s+/);
          if (Number(fields[2]) !== child.pid || Number(fields[3]) !== child.pid) continue;
          members.push({ pid: entry, startTime: fields[19], active: fields[0] !== 'Z' });
        } catch (error) {
          if (!['ENOENT', 'ESRCH', 'EACCES'].includes(error.code)) throw error;
        }
      }
      const proven = leaderAlive || members.some((member) => captured.get(member.pid) === member.startTime);
      if (proven) for (const member of members) captured.set(member.pid, member.startTime);
      activeMembers = members.filter((member) => member.active);
      return proven;
    };
    const stop = (cause) => {
      if (stopped || !child.pid) return;
      stopped = true;
      reason = cause;
      cleanupComplete = (async () => {
        if (!(await groupStillOwned())) return;
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch (error) {
          if (error.code !== 'ESRCH') reason = 'termination_failed';
        }
        const end = performance.now() + TERMINATION_GRACE_MS;
        while (performance.now() < end) {
          await groupStillOwned();
          if (activeMembers.length === 0) return;
          await new Promise((resolve) => {
            escalation = setTimeout(resolve, 200);
          });
        }
        if (!(await groupStillOwned())) return;
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
          if (error.code !== 'ESRCH') reason = 'termination_failed';
        }
      })();
    };
    const sample = async () => {
      if (sampling) return;
      sampling = true;
      try {
        final = await this.snapshot();
        if (child.pid) await groupStillOwned();
        minimumAvailableBytes = Math.min(minimumAvailableBytes, final.remaining);
        maximumObservedRssBytes = Math.max(maximumObservedRssBytes, await this.groupRss(child.pid));
        lowSamples = final.remaining < Math.max(2 * GIB, final.total * 0.08) ? lowSamples + 1 : 0;
        if (lowSamples >= 2) stop('memory_pressure');
      } catch {
        stop('memory_monitor_failed');
      } finally {
        sampling = false;
      }
    };
    const timer = setInterval(() => {
      void sample();
    }, SAMPLE_INTERVAL_MS);
    const interrupt = () => stop('supervisor_interrupted');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    try {
      await sample();
      const outcome = await completion;
      clearInterval(timer);
      if (child.pid) await groupStillOwned();
      if (activeMembers.some((member) => Number(member.pid) !== child.pid)) stop('owned_process_group_unfinished');
      else if (!stopped && child.connected) child.send('release');
      await cleanupComplete;
      await closed;
      await groupStillOwned();
      if (activeMembers.length > 0) {
        stopped = true;
        reason = 'owned_process_cleanup_incomplete';
      }
      final = await this.snapshot();
      minimumAvailableBytes = Math.min(minimumAvailableBytes, final.remaining);
      const swapGrowthBytes = final.swapUsed - first.swapUsed;
      return {
        ...outcome,
        status:
          !stopped && !outcome.spawnFailed && outcome.exitCode === 0 && outcome.signal === null ? 'passed' : 'failed',
        reason,
        minimumAvailableBytes,
        maximumObservedRssBytes,
        swapGrowthBytes,
        nextCheckBlocked:
          final.remaining < Math.max(4 * GIB, final.total * 0.15) || swapGrowthBytes >= SWAP_GROWTH_LIMIT,
        oomBefore: first.oom,
        oomAfter: final.oom,
      };
    } finally {
      clearInterval(timer);
      if (escalation) clearTimeout(escalation);
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [executable, ...arguments_] = process.argv.slice(2);
  if (!executable) throw new Error('CHECK_COMMAND_REQUIRED');
  const result = await new MemoryBoundCheckSupervisor().run(executable, arguments_);
  process.stderr.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.status === 'passed' && !result.nextCheckBlocked ? 0 : 1;
}
