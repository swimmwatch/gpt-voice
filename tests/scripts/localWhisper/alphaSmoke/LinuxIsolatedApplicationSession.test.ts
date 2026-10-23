import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { LinuxIsolatedApplicationSession } from '@scripts/local-whisper/alpha-smoke/LinuxIsolatedApplicationSession';

interface LaunchCall {
  readonly arguments_: readonly string[];
  readonly environment: NodeJS.ProcessEnv;
  readonly executable: string;
}

class CapturingSpawner {
  public readonly calls: LaunchCall[] = [];

  public spawn = (
    executable: string,
    arguments_: readonly string[],
    options: Readonly<{ detached: boolean; env: NodeJS.ProcessEnv; shell: false; stdio: 'ignore' }>,
  ): { pid: number; once(event: 'error' | 'spawn', listener: () => void): void; unref(): void } => {
    this.calls.push(Object.freeze({ arguments_, environment: options.env, executable }));
    return {
      pid: 101,
      once: (event, listener) => {
        if (event === 'spawn') queueMicrotask(listener);
      },
      unref: () => undefined,
    };
  };
}

describe('LinuxIsolatedApplicationSession', () => {
  it('launches the installed application with a private profile and no inherited Electron activation', async () => {
    const workRoot = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-app-online-'));
    try {
      const spawner = new CapturingSpawner();
      const session = new LinuxIsolatedApplicationSession({
        environment: { DISPLAY: ':0', ELECTRON_RUN_AS_NODE: '1', PATH: '/usr/bin' },
        spawn: spawner.spawn,
        readProcessStartIdentity: async () => '1001',
        workRoot,
      });
      await session.launchOnline();

      assert.deepEqual(spawner.calls, [
        {
          arguments_: [],
          environment: {
            DISPLAY: ':0',
            HOME: path.join(workRoot, 'profile', 'home'),
            PATH: '/usr/bin',
            TMPDIR: path.join(workRoot, 'profile', 'tmp'),
            XDG_CACHE_HOME: path.join(workRoot, 'profile', 'cache'),
            XDG_CONFIG_HOME: path.join(workRoot, 'profile', 'config'),
            XDG_DATA_HOME: path.join(workRoot, 'profile', 'data'),
          },
          executable: '/opt/GPT-Voice/gpt-voice',
        },
      ]);
      assert.equal((await stat(path.join(workRoot, 'profile', 'config'))).mode & 0o777, 0o700);
    } finally {
      await rm(workRoot, { force: true, recursive: true });
    }
  });

  it('uses an isolated user and network namespace only for the offline restart', async () => {
    const workRoot = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-app-offline-'));
    try {
      const spawner = new CapturingSpawner();
      const session = new LinuxIsolatedApplicationSession({
        spawn: spawner.spawn,
        readProcessStartIdentity: async () => '1001',
        workRoot,
      });
      await session.launchOffline();
      assert.deepEqual(spawner.calls[0]?.executable, '/usr/bin/unshare');
      assert.deepEqual(spawner.calls[0]?.arguments_, [
        '--user',
        '--map-root-user',
        '--net',
        '--',
        '/opt/GPT-Voice/gpt-voice',
      ]);
    } finally {
      await rm(workRoot, { force: true, recursive: true });
    }
  });
});
