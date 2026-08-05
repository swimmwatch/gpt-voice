import assert from 'node:assert/strict';
import type * as fs from 'node:fs';
import { describe, it } from 'node:test';
import { AppConfigStore, resolveAppConfigPaths, type AppConfigFileSystem } from '@main/config';

const TEST_FINGERPRINT_SEED = '12345';

class MemoryConfigFileSystem implements AppConfigFileSystem {
  public constructor(
    private readonly configFile: string,
    private readonly contents: string | null,
  ) {}

  public cpSync(_source: fs.PathLike, _destination: fs.PathLike, _options?: fs.CopySyncOptions): void {}

  public existsSync(filePath: fs.PathLike): boolean {
    return String(filePath) === this.configFile && this.contents !== null;
  }

  public mkdirSync(_path: fs.PathLike, _options?: fs.MakeDirectoryOptions): undefined {
    return undefined;
  }

  public readFileSync(_path: fs.PathOrFileDescriptor, _encoding: BufferEncoding): string {
    return this.contents ?? '';
  }

  public renameSync(_oldPath: fs.PathLike, _newPath: fs.PathLike): void {}

  public rmSync(_path: fs.PathLike, _options?: fs.RmDirOptions): void {}

  public writeFileSync(_file: fs.PathOrFileDescriptor, _data: string, _options?: fs.WriteFileOptions): void {}
}

function createStore(persisted: Record<string, unknown> | null): {
  readonly store: AppConfigStore;
  readonly writes: string[];
} {
  const paths = resolveAppConfigPaths({
    environment: { XDG_CONFIG_HOME: '/synthetic-config' },
    homeDirectory: () => '/synthetic-home',
    platform: 'linux',
  });
  const writes: string[] = [];
  const store = new AppConfigStore({
    fileSystem: new MemoryConfigFileSystem(paths.configFile, persisted === null ? null : JSON.stringify(persisted)),
    generateFingerprintSeed: () => TEST_FINGERPRINT_SEED,
    generatePrettifyProfileUuid: () => '00000000-0000-0000-0000-000000000001',
    logger: { error: () => undefined, info: () => undefined, warn: () => undefined },
    paths,
    writeFileAtomically: (_filePath, contents) => writes.push(contents),
  });
  return { store, writes };
}

describe('AppConfigStore provider selection', () => {
  it('persists an intentionally unselected fresh profile across a following launch', () => {
    const first = createStore(null);
    first.store.load();

    assert.equal(first.store.getSnapshot().provider, null);
    const persisted = JSON.parse(first.writes[first.writes.length - 1] ?? '') as Record<string, unknown>;
    assert.equal(persisted.provider, null);

    const second = createStore(persisted);
    second.store.load();
    assert.equal(second.store.getSnapshot().provider, null);
  });

  it('keeps configured providers and normalizes only legacy missing provider properties', () => {
    const configured = createStore({ fingerprintSeed: TEST_FINGERPRINT_SEED, provider: 'openai-api' });
    configured.store.load();
    assert.equal(configured.store.getSnapshot().provider, 'openai-api');

    const legacy = createStore({ fingerprintSeed: TEST_FINGERPRINT_SEED });
    legacy.store.load();
    assert.equal(legacy.store.getSnapshot().provider, 'chatgpt');
  });
});
