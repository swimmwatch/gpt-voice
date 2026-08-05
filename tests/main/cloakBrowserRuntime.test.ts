import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import type { BrowserContext } from 'playwright-core';
import { CloakBrowserRuntimeLoader, type CloakBrowserApi } from '@main/cloakbrowser';

const TEST_CONTEXT = {} as BrowserContext;

class TestVerificationError extends Error {}

interface CreateApiOptions {
  readonly binaryInfo?: () => { readonly binaryPath: string; readonly installed: boolean };
  readonly ensureBinary?: () => Promise<string>;
}

function createApi(launches: string[], options: CreateApiOptions = {}): CloakBrowserApi {
  return {
    BinaryVerificationError: TestVerificationError,
    binaryInfo: options.binaryInfo ?? (() => ({ binaryPath: '/synthetic/cache/chrome', installed: false })),
    ensureBinary: options.ensureBinary ?? (async () => '/synthetic/cache/chrome'),
    launchContext: async () => {
      launches.push('context');
      return TEST_CONTEXT;
    },
    launchPersistentContext: async () => {
      launches.push('persistent');
      return TEST_CONTEXT;
    },
  };
}

describe('CloakBrowserRuntimeLoader', () => {
  it('configures the packaged binary and caches one import promise', async () => {
    const environment: NodeJS.ProcessEnv = {};
    const launches: string[] = [];
    const logs: unknown[][] = [];
    let imports = 0;
    const resourcesPath = '/synthetic/resources';
    const executablePath = path.join(resourcesPath, 'cloakbrowser', 'chrome');
    const loader = new CloakBrowserRuntimeLoader({
      environment,
      fileSystem: { existsSync: (filePath) => filePath === executablePath },
      importModule: async (specifier) => {
        imports += 1;
        assert.equal(specifier, 'cloakbrowser');
        return createApi(launches);
      },
      isPackaged: true,
      logger: {
        info: (...args) => logs.push(args),
        warn: (...args) => logs.push(args),
      },
      platform: 'linux',
      resourcesPath,
    });

    await loader.launchContext();
    await loader.launchPersistentContext({ userDataDir: '/synthetic/profile' });

    assert.equal(imports, 1);
    assert.deepEqual(launches, ['context', 'persistent']);
    assert.equal(environment.CLOAKBROWSER_AUTO_UPDATE, 'false');
    assert.equal(environment.CLOAKBROWSER_BINARY_PATH, executablePath);
    assert.equal(logs.length, 1);
  });

  it('preserves an explicit binary path and does not inspect the filesystem', () => {
    const environment: NodeJS.ProcessEnv = {
      CLOAKBROWSER_BINARY_PATH: '/synthetic/custom/chrome',
    };
    let existsCalls = 0;
    const loader = new CloakBrowserRuntimeLoader({
      environment,
      fileSystem: {
        existsSync: () => {
          existsCalls += 1;
          return false;
        },
      },
      importModule: async () => createApi([]),
      isPackaged: true,
      logger: { info: () => undefined, warn: () => undefined },
      platform: 'linux',
      resourcesPath: '/synthetic/resources',
    });

    loader.configure();

    assert.equal(existsCalls, 0);
    assert.equal(environment.CLOAKBROWSER_AUTO_UPDATE, 'false');
    assert.equal(environment.CLOAKBROWSER_BINARY_PATH, '/synthetic/custom/chrome');
  });

  it('keeps separate imports and environment state between loaders', async () => {
    let firstImports = 0;
    let secondImports = 0;
    const createLoader = (environment: NodeJS.ProcessEnv, onImport: () => void) =>
      new CloakBrowserRuntimeLoader({
        environment,
        fileSystem: { existsSync: () => false },
        importModule: async () => {
          onImport();
          return createApi([]);
        },
        isPackaged: false,
        logger: { info: () => undefined, warn: () => undefined },
        platform: 'linux',
        resourcesPath: '/synthetic/resources',
      });
    const firstEnvironment: NodeJS.ProcessEnv = {};
    const secondEnvironment: NodeJS.ProcessEnv = {};
    const first = createLoader(firstEnvironment, () => {
      firstImports += 1;
    });
    const second = createLoader(secondEnvironment, () => {
      secondImports += 1;
    });

    await first.launchContext();
    await second.launchContext();

    assert.equal(firstImports, 1);
    assert.equal(secondImports, 1);
    assert.deepEqual(firstEnvironment, {});
    assert.deepEqual(secondEnvironment, {});
  });

  it('prepares the bundled executable without importing or installing a runtime', async () => {
    const environment: NodeJS.ProcessEnv = {};
    const resourcesPath = '/synthetic/resources';
    const executablePath = path.join(resourcesPath, 'cloakbrowser', 'chrome');
    const loader = new CloakBrowserRuntimeLoader({
      environment,
      fileSystem: { existsSync: (filePath) => filePath === executablePath },
      importModule: async () => {
        throw new Error('The bundled executable must avoid import');
      },
      isPackaged: true,
      logger: { info: () => undefined, warn: () => undefined },
      platform: 'linux',
      resourcesPath,
    });

    assert.deepEqual(await loader.prepare(), { failureCode: null, success: true });
    assert.equal(environment.CLOAKBROWSER_BINARY_PATH, executablePath);
  });

  it('prepares an existing vendor cache without installing again', async () => {
    const cachedBinaryPath = '/synthetic/cache/chrome';
    let installCalls = 0;
    const loader = new CloakBrowserRuntimeLoader({
      environment: {},
      fileSystem: { existsSync: (filePath) => filePath === cachedBinaryPath },
      importModule: async () =>
        createApi([], {
          binaryInfo: () => ({ binaryPath: cachedBinaryPath, installed: true }),
          ensureBinary: async () => {
            installCalls += 1;
            return cachedBinaryPath;
          },
        }),
      isPackaged: false,
      logger: { info: () => undefined, warn: () => undefined },
      platform: 'linux',
      resourcesPath: '/synthetic/resources',
    });

    assert.deepEqual(await loader.prepare(), { failureCode: null, success: true });
    assert.equal(installCalls, 0);
  });

  it('installs a missing runtime once and verifies the resulting executable exists', async () => {
    const installedBinaryPath = '/synthetic/cache/installed-chrome';
    const existingPaths = new Set<string>();
    let installCalls = 0;
    const loader = new CloakBrowserRuntimeLoader({
      environment: {},
      fileSystem: { existsSync: (filePath) => existingPaths.has(filePath) },
      importModule: async () =>
        createApi([], {
          ensureBinary: async () => {
            installCalls += 1;
            existingPaths.add(installedBinaryPath);
            return installedBinaryPath;
          },
        }),
      isPackaged: false,
      logger: { info: () => undefined, warn: () => undefined },
      platform: 'linux',
      resourcesPath: '/synthetic/resources',
    });

    assert.deepEqual(await loader.prepare(), { failureCode: null, success: true });
    assert.equal(installCalls, 1);
  });

  it('does not report success when the installer result is absent', async () => {
    const loader = new CloakBrowserRuntimeLoader({
      environment: {},
      fileSystem: { existsSync: () => false },
      importModule: async () => createApi([], { ensureBinary: async () => '/synthetic/cache/missing-chrome' }),
      isPackaged: false,
      logger: { info: () => undefined, warn: () => undefined },
      platform: 'linux',
      resourcesPath: '/synthetic/resources',
    });

    assert.deepEqual(await loader.prepare(), { failureCode: 'installation-failed', success: false });
  });

  it('maps binary verification failures to a safe verification status', async () => {
    const loader = new CloakBrowserRuntimeLoader({
      environment: {},
      fileSystem: { existsSync: () => false },
      importModule: async () =>
        createApi([], {
          ensureBinary: async () => {
            throw new TestVerificationError('/private/cache/chrome');
          },
        }),
      isPackaged: false,
      logger: { info: () => undefined, warn: () => undefined },
      platform: 'linux',
      resourcesPath: '/synthetic/resources',
    });

    assert.deepEqual(await loader.prepare(), { failureCode: 'verification-failed', success: false });
  });

  it('maps cache inspection and installation errors to safe failures', async () => {
    const cacheInspectionLoader = new CloakBrowserRuntimeLoader({
      environment: {},
      fileSystem: { existsSync: () => false },
      importModule: async () =>
        createApi([], {
          binaryInfo: () => {
            throw new TestVerificationError('/private/cache/chrome');
          },
        }),
      isPackaged: false,
      logger: { info: () => undefined, warn: () => undefined },
      platform: 'linux',
      resourcesPath: '/synthetic/resources',
    });
    const genericFailureLoader = new CloakBrowserRuntimeLoader({
      environment: {},
      fileSystem: { existsSync: () => false },
      importModule: async () =>
        createApi([], {
          ensureBinary: async () => {
            throw new Error('/private/cache/chrome');
          },
        }),
      isPackaged: false,
      logger: { info: () => undefined, warn: () => undefined },
      platform: 'linux',
      resourcesPath: '/synthetic/resources',
    });

    assert.deepEqual(await cacheInspectionLoader.prepare(), { failureCode: 'verification-failed', success: false });
    assert.deepEqual(await genericFailureLoader.prepare(), { failureCode: 'installation-failed', success: false });
  });
});
