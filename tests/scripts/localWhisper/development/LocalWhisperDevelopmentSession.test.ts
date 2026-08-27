import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  DevelopmentElectronRuntimeResolver,
  LocalWhisperDevelopmentSession,
  developmentElectronEnvironment,
  type DevelopmentSessionDependencies,
} from '@scripts/local-whisper/development/LocalWhisperDevelopmentSession';

describe('LocalWhisperDevelopmentSession', () => {
  it('removes only Electron plain-Node mode from the inherited desktop environment', () => {
    assert.deepEqual(developmentElectronEnvironment({ DISPLAY: ':1', ELECTRON_RUN_AS_NODE: '1', LANG: 'C.UTF-8' }), {
      DISPLAY: ':1',
      LANG: 'C.UTF-8',
    });
  });

  it('isolates supported-platform application configuration from the inherited profile', () => {
    const inherited = {
      APPDATA: '/regular/app-data',
      ELECTRON_RUN_AS_NODE: '1',
      LOCALAPPDATA: '/regular/local-app-data',
      XDG_CONFIG_HOME: '/regular/config',
    };
    const configurationRoot = '/temporary/development-configuration';

    assert.deepEqual(developmentElectronEnvironment(inherited, configurationRoot, 'linux'), {
      APPDATA: '/regular/app-data',
      LOCALAPPDATA: '/regular/local-app-data',
      XDG_CONFIG_HOME: configurationRoot,
    });
    assert.deepEqual(developmentElectronEnvironment(inherited, configurationRoot, 'win32'), {
      APPDATA: configurationRoot,
      LOCALAPPDATA: configurationRoot,
      XDG_CONFIG_HOME: '/regular/config',
    });
  });

  it('resolves a lazily installed Electron runtime through the workspace package entrypoint', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-development-electron-'));
    const electronPackageRoot = path.join(root, 'node_modules', 'electron');
    const electronPath = path.join(
      electronPackageRoot,
      'dist',
      process.platform === 'win32' ? 'electron.exe' : 'electron',
    );
    try {
      await mkdir(path.dirname(electronPath), { recursive: true });
      await Promise.all([
        writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '2.4.0' }), { mode: 0o600 }),
        writeFile(
          path.join(electronPackageRoot, 'package.json'),
          JSON.stringify({ name: 'electron', version: '1.0.0', main: 'index.js' }),
          { mode: 0o600 },
        ),
        writeFile(path.join(electronPackageRoot, 'index.js'), `module.exports = ${JSON.stringify(electronPath)};\n`, {
          mode: 0o600,
        }),
        writeFile(electronPath, 'electron fixture', { mode: 0o700 }),
      ]);

      const resolver = new DevelopmentElectronRuntimeResolver();
      assert.equal(await resolver.resolve(root), electronPath);
      await chmod(electronPath, 0o600);
      if (process.platform === 'win32') {
        assert.equal(await resolver.resolve(root), electronPath);
      } else {
        await assert.rejects(resolver.resolve(root), /Electron runtime unavailable/u);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reuses private application state across sessions while removing ephemeral trust and descriptors', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'local-whisper-development-session-'));
    const electronPath = path.join(
      root,
      'node_modules',
      'electron',
      'dist',
      process.platform === 'win32' ? 'electron.exe' : 'electron',
    );
    await mkdir(path.dirname(electronPath), { recursive: true });
    await Promise.all([
      writeFile(path.join(root, 'package.json'), JSON.stringify({ version: '2.4.0-alpha.1' }), { mode: 0o600 }),
      writeFile(electronPath, 'electron fixture', { mode: 0o700 }),
    ]);
    const events: string[] = [];
    const descriptorPaths: string[] = [];
    const launchedConfigurationRoots: string[] = [];
    const launchedUserDataPaths: string[] = [];
    let launchCount = 0;
    const dependencies: DevelopmentSessionDependencies = {
      attestations: {
        load: async () => ({ keyId: 'qualification-development-public', publicKeyPem: 'public-key', runtimes: [] }),
      },
      descriptors: {
        produce: async ({ descriptorPath }) => {
          descriptorPaths.push(descriptorPath);
          await writeFile(descriptorPath, '{}', { mode: 0o600 });
          events.push('descriptor');
        },
      },
      resources: {
        stage: async (_workspace, resourcesPath) => {
          await mkdir(resourcesPath, { recursive: true });
          events.push('resources');
        },
      },
      runtimes: { load: async () => Object.freeze([]) },
      tls: {
        create: async () => ({
          certificatePem: 'certificate',
          certificateSha256: 'a'.repeat(64),
          privateKeyPem: 'private-key',
          destroy: async () => {
            events.push('tls-destroy');
          },
        }),
      },
      command: { run: async () => 'a'.repeat(40) },
      electron: { resolve: async () => electronPath },
      createServer: () => ({
        start: async () => {
          events.push('server-start');
          return { origin: 'https://127.0.0.1:39443' };
        },
        stop: async () => {
          events.push('server-stop');
        },
      }),
      launch: async (executable, arguments_, _cwd, environment) => {
        assert.equal(executable, electronPath);
        const userDataArgument = arguments_[0];
        const activationArgument = arguments_[2];
        assert.equal(userDataArgument?.startsWith('--user-data-dir='), true);
        assert.equal(activationArgument?.startsWith('--local-whisper-development-activation='), true);
        const userDataPath = userDataArgument?.slice('--user-data-dir='.length);
        const descriptorPath = activationArgument?.slice('--local-whisper-development-activation='.length);
        assert.ok(userDataPath);
        assert.ok(descriptorPath);
        const configurationRoot = process.platform === 'win32' ? environment.APPDATA : environment.XDG_CONFIG_HOME;
        assert.ok(configurationRoot);
        if (process.platform === 'win32') assert.equal(environment.LOCALAPPDATA, configurationRoot);
        assert.notEqual(path.dirname(descriptorPath), path.dirname(userDataPath));
        assert.equal(
          path.dirname(path.dirname(descriptorPath)),
          path.join(root, '.cache', 'local-whisper', 'development', 'sessions'),
        );
        launchedConfigurationRoots.push(configurationRoot);
        launchedUserDataPaths.push(userDataPath);
        const settingsPath = path.join(configurationRoot, 'GPT-Voice', 'local-whisper', 'settings.json');
        const electronStatePath = path.join(userDataPath, 'Local State');
        if (launchCount === 0) {
          await Promise.all([
            mkdir(path.dirname(settingsPath), { recursive: true, mode: 0o700 }),
            mkdir(userDataPath, { recursive: true, mode: 0o700 }),
          ]);
          await Promise.all([
            writeFile(settingsPath, 'saved-local-whisper-settings', { mode: 0o600 }),
            writeFile(electronStatePath, 'saved-electron-state', { mode: 0o600 }),
          ]);
        } else {
          assert.equal(await readFile(settingsPath, 'utf8'), 'saved-local-whisper-settings');
          assert.equal(await readFile(electronStatePath, 'utf8'), 'saved-electron-state');
        }
        launchCount += 1;
        events.push('launch');
        return {
          waitForExit: () => Promise.resolve(),
          terminate: () => undefined,
        };
      },
    };
    try {
      await new LocalWhisperDevelopmentSession(dependencies).run(root);
      await new LocalWhisperDevelopmentSession(dependencies).run(root);
      assert.deepEqual(events, [
        'resources',
        'server-start',
        'descriptor',
        'launch',
        'server-stop',
        'tls-destroy',
        'resources',
        'server-start',
        'descriptor',
        'launch',
        'server-stop',
        'tls-destroy',
      ]);
      assert.equal(launchCount, 2);
      assert.equal(launchedConfigurationRoots[0], launchedConfigurationRoots[1]);
      assert.equal(launchedUserDataPaths[0], launchedUserDataPaths[1]);
      assert.notEqual(launchedConfigurationRoots[0], launchedUserDataPaths[0]);
      assert.notEqual(descriptorPaths[0], descriptorPaths[1]);
      for (const descriptorPath of descriptorPaths) {
        await assert.rejects(readFile(descriptorPath), { code: 'ENOENT' });
      }
      const sessionsRoot = path.join(root, '.cache', 'local-whisper', 'development', 'sessions');
      assert.deepEqual(await readdir(sessionsRoot), []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
