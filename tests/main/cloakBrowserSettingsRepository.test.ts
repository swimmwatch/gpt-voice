/* eslint-disable max-classes-per-file -- the repository fixture owns its isolated in-memory adapter. */
import assert from 'node:assert/strict';
import type * as fs from 'node:fs';
import { describe, it } from 'node:test';
import { CloakBrowserSettingsRepository } from '@main/cloakBrowserSettings';
import { writeTextFileAtomically } from '@main/translationSettings';
import { TestAppConfigStore } from './appConfigTestUtils';

class MemoryCloakBrowserSettingsFileSystem {
  public readonly files = new Map<string, string>();
  public failRename = false;
  public failWrite = false;
  public readCount = 0;
  public writeCount = 0;

  public existsSync(filePath: fs.PathLike): boolean {
    return this.files.has(String(filePath));
  }

  public readFileSync(filePath: fs.PathOrFileDescriptor, _encoding: BufferEncoding): string {
    this.readCount += 1;
    const contents = this.files.get(String(filePath));
    if (contents === undefined) throw new Error('missing synthetic settings file');
    return contents;
  }

  public writeFileSync(filePath: fs.PathOrFileDescriptor, data: string, _options?: fs.WriteFileOptions): void {
    this.writeCount += 1;
    if (this.failWrite) throw new Error('synthetic atomic write failure');
    this.files.set(String(filePath), data);
  }

  public renameSync(oldPath: fs.PathLike, newPath: fs.PathLike): void {
    if (this.failRename) throw new Error('synthetic atomic rename failure');
    const source = String(oldPath);
    const contents = this.files.get(source);
    if (contents === undefined) throw new Error('missing synthetic temporary file');
    this.files.set(String(newPath), contents);
    this.files.delete(source);
  }

  public rmSync(filePath: fs.PathLike): void {
    this.files.delete(String(filePath));
  }
}

class CloakBrowserSettingsRepositoryFixture {
  public readonly config = new TestAppConfigStore();
  public readonly fileSystem = new MemoryCloakBrowserSettingsFileSystem();
  public readonly repository: CloakBrowserSettingsRepository;
  public readonly settingsFile: string;

  public constructor(settingsFile = '/synthetic/cloakbrowser-settings.json') {
    this.settingsFile = settingsFile;
    this.repository = new CloakBrowserSettingsRepository({
      config: this.config,
      fileSystem: this.fileSystem,
      logger: { warn: () => undefined },
      secureStorage: {
        decrypt: (value) => value.toString('utf8').replace(/^encrypted:/u, ''),
        encrypt: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
        isEncryptionAvailable: () => true,
      },
      settingsFile,
      writeFileAtomically: (filePath, contents) =>
        writeTextFileAtomically(filePath, contents, {
          createTemporaryPath: (target) => `${target}.tmp`,
          fileSystem: this.fileSystem,
        }),
    });
  }
}

describe('CloakBrowserSettingsRepository', () => {
  it('constructs without storage access and resolves defaults from the injected config', () => {
    const fixture = new CloakBrowserSettingsRepositoryFixture();

    assert.equal(fixture.fileSystem.readCount, 0);
    assert.equal(fixture.fileSystem.writeCount, 0);

    const settings = fixture.repository.getView();
    assert.equal(settings.fingerprintSeed, '12345');
    assert.equal(settings.proxy.hasPassword, false);
    assert.equal(fixture.fileSystem.writeCount, 0);
  });

  it('defers prepared settings persistence and never exposes a plaintext proxy password', () => {
    const fixture = new CloakBrowserSettingsRepositoryFixture();
    const prepared = fixture.repository.prepare({
      backgroundMode: 'visible',
      proxy: {
        enabled: true,
        password: 'private-proxy-password',
        server: 'http://127.0.0.1:8080',
        username: 'proxy-user',
      },
    });

    assert.equal(fixture.fileSystem.writeCount, 0);
    assert.equal(prepared.settings.proxy.hasPassword, true);
    assert.equal(prepared.settingsWithSecret.proxy.password, 'private-proxy-password');

    prepared.persist();
    const stored = fixture.fileSystem.files.get(fixture.settingsFile) ?? '';
    assert.equal(fixture.fileSystem.writeCount, 1);
    assert.equal(stored.includes('private-proxy-password'), false);
    assert.equal(fixture.repository.getWithSecret().proxy.password, 'private-proxy-password');
    assert.equal(fixture.repository.getView().proxy.hasPassword, true);
  });

  it('clears secrets and keeps independently constructed repositories isolated', () => {
    const first = new CloakBrowserSettingsRepositoryFixture('/first/cloakbrowser.json');
    const second = new CloakBrowserSettingsRepositoryFixture('/second/cloakbrowser.json');

    first.repository.save({
      proxy: {
        enabled: true,
        password: 'first-private-password',
        server: 'http://127.0.0.1:8080',
      },
    });
    assert.equal(first.repository.getWithSecret().proxy.password, 'first-private-password');
    assert.equal(second.repository.getWithSecret().proxy.password, '');

    first.repository.save({ proxy: { clearPassword: true } });
    assert.equal(first.repository.getWithSecret().proxy.password, '');
    assert.equal(first.repository.getView().proxy.hasPassword, false);
    assert.equal(second.fileSystem.files.size, 0);
  });

  it('rejects SOCKS5 credentials before mutating storage', () => {
    const fixture = new CloakBrowserSettingsRepositoryFixture();

    assert.throws(
      () =>
        fixture.repository.save({
          proxy: {
            enabled: true,
            password: 'private-proxy-password',
            server: 'socks5://127.0.0.1:1080',
          },
        }),
      /SOCKS5 proxy username\/password is not supported/,
    );
    assert.equal(fixture.fileSystem.writeCount, 0);
    assert.equal(fixture.fileSystem.files.size, 0);
  });

  it('preserves the authoritative file and snapshot when the atomic temporary write fails', () => {
    const fixture = new CloakBrowserSettingsRepositoryFixture();
    fixture.repository.save({ backgroundMode: 'visible' });
    const authoritativeFile = fixture.fileSystem.files.get(fixture.settingsFile);
    const authoritativeSettings = fixture.repository.getView();
    fixture.fileSystem.failWrite = true;

    assert.throws(() => fixture.repository.save({ backgroundMode: 'hidden' }), /synthetic atomic write failure/u);

    assert.equal(fixture.fileSystem.files.get(fixture.settingsFile), authoritativeFile);
    assert.deepEqual(fixture.repository.getView(), authoritativeSettings);
    assert.equal(fixture.fileSystem.files.has(`${fixture.settingsFile}.tmp`), false);
  });

  it('preserves the authoritative file and removes the temporary file when atomic replacement fails', () => {
    const fixture = new CloakBrowserSettingsRepositoryFixture();
    fixture.repository.save({ backgroundMode: 'visible' });
    const authoritativeFile = fixture.fileSystem.files.get(fixture.settingsFile);
    const authoritativeSettings = fixture.repository.getView();
    fixture.fileSystem.failRename = true;

    assert.throws(() => fixture.repository.save({ backgroundMode: 'hidden' }), /synthetic atomic rename failure/u);

    assert.equal(fixture.fileSystem.files.get(fixture.settingsFile), authoritativeFile);
    assert.deepEqual(fixture.repository.getView(), authoritativeSettings);
    assert.equal(fixture.fileSystem.files.has(`${fixture.settingsFile}.tmp`), false);
  });
});
