import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { LinuxAlphaSmokeFilesystem } from './LinuxAlphaSmokeFilesystem';

const INSTALLED_APPLICATION_PATH = '/opt/GPT-Voice/gpt-voice';
const NETWORK_NAMESPACE_EXECUTABLE = '/usr/bin/unshare';
const PROFILE_DIRECTORY_NAMES = Object.freeze(['config', 'cache', 'data', 'home', 'tmp']);
const GRAPHICAL_ENVIRONMENT_KEYS = Object.freeze([
  'DBUS_SESSION_BUS_ADDRESS',
  'DISPLAY',
  'LANG',
  'LC_ALL',
  'PATH',
  'WAYLAND_DISPLAY',
  'XAUTHORITY',
  'XDG_RUNTIME_DIR',
]);

interface LinuxApplicationChild {
  readonly pid?: number;
  readonly exitCode?: number | null;
  readonly signalCode?: string | null;
  once(event: 'error' | 'spawn', listener: () => void): void;
  unref(): void;
}

export interface LinuxApplicationLaunchReceipt {
  readonly processId: number;
  readonly startTime: string;
}

export interface LinuxApplicationOwnedGroup {
  readonly receipt: LinuxApplicationLaunchReceipt;
  readonly members: readonly LinuxApplicationLaunchReceipt[];
}

type LinuxApplicationSpawner = (
  executable: string,
  arguments_: readonly string[],
  options: Readonly<{ detached: boolean; env: NodeJS.ProcessEnv; shell: false; stdio: 'ignore' }>,
) => LinuxApplicationChild;

function fail(code: string): never {
  throw new Error(`ALPHA_SMOKE_LINUX_APPLICATION_${code}`);
}

/** Owns isolated profile creation and the exact online/offline application launches for one smoke attempt. */
export class LinuxIsolatedApplicationSession {
  private readonly children: {
    child: LinuxApplicationChild | null;
    receipt: LinuxApplicationLaunchReceipt;
    owned: Map<number, string>;
  }[] = [];
  public constructor(
    private readonly dependencies: Readonly<{
      environment?: Readonly<NodeJS.ProcessEnv>;
      spawn?: LinuxApplicationSpawner;
      readProcessStartIdentity?: (pid: number) => Promise<string | null>;
      workRoot: string;
    }>,
  ) {}

  public async launchOnline(): Promise<LinuxApplicationLaunchReceipt> {
    return await this.launch(INSTALLED_APPLICATION_PATH, []);
  }

  public async launchOffline(): Promise<LinuxApplicationLaunchReceipt> {
    return await this.launch(NETWORK_NAMESPACE_EXECUTABLE, [
      '--user',
      '--map-root-user',
      '--net',
      '--',
      INSTALLED_APPLICATION_PATH,
    ]);
  }

  private async launch(executable: string, arguments_: readonly string[]): Promise<LinuxApplicationLaunchReceipt> {
    const environment = await this.createIsolatedEnvironment();
    const child = (this.dependencies.spawn ?? spawn)(executable, arguments_, {
      detached: true,
      env: environment,
      shell: false,
      stdio: 'ignore',
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', () => reject(new Error('ALPHA_SMOKE_LINUX_APPLICATION_LAUNCH_FAILED')));
    });
    if (!child.pid) fail('PROCESS_ID_MISSING');
    const startTime = await this.startIdentity(child.pid);
    if (startTime === null) fail('PROCESS_IDENTITY_MISSING');
    const receipt = Object.freeze({ processId: child.pid, startTime });
    this.children.push({ child, receipt, owned: new Map([[receipt.processId, receipt.startTime]]) });
    await this.activeOwnedGroups();
    return receipt;
  }

  public async waitForExit(timeoutMilliseconds: number): Promise<void> {
    const end = performance.now() + timeoutMilliseconds;
    for (;;) {
      if ((await this.activeOwnedGroups()).length === 0) return;
      if (performance.now() >= end) fail('EXIT_TIMEOUT');
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(250, Math.max(1, end - performance.now()))));
    }
  }

  public async snapshotOwnedGroups(): Promise<readonly LinuxApplicationOwnedGroup[]> {
    await this.activeOwnedGroups();
    return this.children.map(({ receipt, owned }) => ({
      receipt,
      members: [...owned].map(([processId, startTime]) => ({ processId, startTime })),
    }));
  }

  public async restoreOwnedGroups(groups: readonly LinuxApplicationOwnedGroup[]): Promise<void> {
    if (this.children.length !== 0) fail('RESTORE_STATE_INVALID');
    for (const group of groups)
      this.children.push({
        child: null,
        receipt: group.receipt,
        owned: new Map(group.members.map(({ processId, startTime }) => [processId, startTime])),
      });
    await this.activeOwnedGroups();
  }

  public async shutdown(timeoutMilliseconds = 60_000): Promise<void> {
    const end = performance.now() + timeoutMilliseconds;
    await this.signalOwnedGroups('SIGTERM');
    try {
      await this.waitForExit(Math.min(10_000, Math.max(1, timeoutMilliseconds / 2)));
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'ALPHA_SMOKE_LINUX_APPLICATION_EXIT_TIMEOUT') throw error;
    }
    await this.signalOwnedGroups('SIGKILL');
    await this.waitForExit(Math.max(0, end - performance.now()));
  }

  private async signalOwnedGroups(signal: 'SIGTERM' | 'SIGKILL'): Promise<void> {
    for (const group of await this.activeOwnedGroups()) {
      try {
        process.kill(-group, signal);
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) fail('SHUTDOWN_FAILED');
      }
    }
  }

  /** A detached session cannot be joined by ambient processes; retain identities before reparenting. */
  private async activeOwnedGroups(): Promise<number[]> {
    const snapshots: { pid: number; group: number; session: number; startTime: string; active: boolean }[] = [];
    for (const entry of await readdir('/proc')) {
      if (!/^\d+$/u.test(entry)) continue;
      try {
        const stat = await readFile(`/proc/${entry}/stat`, 'utf8');
        const fields = stat
          .slice(stat.lastIndexOf(')') + 2)
          .trim()
          .split(/\s+/u);
        snapshots.push({
          pid: Number(entry),
          group: Number(fields[2]),
          session: Number(fields[3]),
          startTime: fields[19],
          active: fields[0] !== 'Z',
        });
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && ['ENOENT', 'ESRCH'].includes(String(error.code))))
          throw error;
      }
    }
    const groups: number[] = [];
    for (const { receipt, owned } of this.children) {
      const members = snapshots.filter((row) => row.group === receipt.processId && row.session === receipt.processId);
      const proven = members.some((row) => owned.get(row.pid) === row.startTime);
      if (members.some((row) => row.active) && !proven) fail('PROCESS_OWNERSHIP_UNPROVEN');
      if (!proven) continue;
      for (const row of members) owned.set(row.pid, row.startTime);
      if (members.some((row) => row.active)) groups.push(receipt.processId);
    }
    return groups;
  }

  private async startIdentity(pid: number): Promise<string | null> {
    if (this.dependencies.readProcessStartIdentity) return await this.dependencies.readProcessStartIdentity(pid);
    try {
      const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
      const fields = stat
        .slice(stat.lastIndexOf(')') + 2)
        .trim()
        .split(/\s+/u);
      // Zombies have exited and cannot execute; the parent still reaps them.
      if (fields[0] === 'Z') return null;
      if (!/^\d+$/u.test(fields[19] ?? '')) fail('PROCESS_IDENTITY_INVALID');
      return fields[19];
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  private async createIsolatedEnvironment(): Promise<NodeJS.ProcessEnv> {
    const profileRoot = path.join(path.resolve(this.dependencies.workRoot), 'profile');
    const relative = path.relative(path.resolve(this.dependencies.workRoot), profileRoot);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) fail('PROFILE_PATH_INVALID');
    const directories = Object.fromEntries(PROFILE_DIRECTORY_NAMES.map((name) => [name, path.join(profileRoot, name)]));
    const filesystem = await LinuxAlphaSmokeFilesystem.openRoot(path.resolve(this.dependencies.workRoot));
    try {
      for (const name of PROFILE_DIRECTORY_NAMES) await filesystem.openChildDirectory(`profile/${name}`, true);
    } finally {
      await filesystem.dispose();
    }
    const inherited = this.dependencies.environment ?? process.env;
    const graphicalEnvironment = Object.fromEntries(
      GRAPHICAL_ENVIRONMENT_KEYS.flatMap((key) => {
        const value = inherited[key];
        return typeof value === 'string' && value.length > 0 ? [[key, value]] : [];
      }),
    );
    return {
      ...graphicalEnvironment,
      HOME: directories.home,
      TMPDIR: directories.tmp,
      XDG_CACHE_HOME: directories.cache,
      XDG_CONFIG_HOME: directories.config,
      XDG_DATA_HOME: directories.data,
    };
  }
}
