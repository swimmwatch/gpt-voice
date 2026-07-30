/* eslint-disable max-classes-per-file -- the storage fixture owns its isolated in-memory adapter. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type * as fs from 'node:fs';
import { mergePrettifySettingsForStorage, PrettifySettingsStorage } from '@main/services/prettifySettingsStorage';
import { DEFAULT_PRETTIFY_SETTINGS } from '@shared/prettifySettings';
import { TestAppConfigStore } from './appConfigTestUtils';

class MemoryPrettifySettingsFileSystem {
  public readonly files = new Map<string, string>();

  public existsSync(filePath: fs.PathLike): boolean {
    return this.files.has(String(filePath));
  }

  public readFileSync(filePath: fs.PathOrFileDescriptor, _encoding: BufferEncoding): string {
    const contents = this.files.get(String(filePath));
    if (contents === undefined) throw new Error('missing synthetic settings file');
    return contents;
  }

  public writeFileSync(filePath: fs.PathOrFileDescriptor, data: string, _options?: fs.WriteFileOptions): void {
    this.files.set(String(filePath), data);
  }
}

class PrettifySettingsStorageFixture {
  public readonly config = new TestAppConfigStore();
  public readonly fileSystem = new MemoryPrettifySettingsFileSystem();
  public readonly settingsFile: string;
  public readonly storage: PrettifySettingsStorage;

  public constructor(settingsFile = '/synthetic/prettify-settings.json') {
    this.settingsFile = settingsFile;
    this.storage = new PrettifySettingsStorage({
      config: this.config,
      fileSystem: this.fileSystem,
      logger: { warn: () => undefined },
      secureStorage: {
        decrypt: (value) => value.toString('utf8').replace(/^encrypted:/u, ''),
        encrypt: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
        isEncryptionAvailable: () => true,
      },
      settingsFile,
    });
  }
}

describe('prettify settings storage', () => {
  it('deep-merges non-secret CLI fields without replacing encrypted vLLM-key state', () => {
    const current = {
      ...DEFAULT_PRETTIFY_SETTINGS,
      claudeCli: {
        executablePath: '/opt/Claude CLI/claude',
        model: 'claude-sonnet',
        fallbackModel: 'claude-haiku',
        effort: 'medium' as const,
        timeoutSeconds: 240,
      },
      codexCli: {
        executablePath: '/opt/Codex CLI/codex',
        model: 'gpt-5.6',
        reasoningEffort: 'high' as const,
        timeoutSeconds: 180,
        verbosity: 'medium' as const,
      },
      vllm: {
        ...DEFAULT_PRETTIFY_SETTINGS.vllm,
        baseUrl: 'https://models.example.com/v1',
        hasApiKey: true,
        model: 'remote-model',
      },
    };

    const merged = mergePrettifySettingsForStorage(
      current,
      {
        providerId: 'codex-cli',
        claudeCli: { model: ' claude-opus ' },
        codexCli: { timeoutSeconds: 300 },
      },
      true,
    );

    assert.deepEqual(merged.claudeCli, {
      executablePath: '/opt/Claude CLI/claude',
      model: 'claude-opus',
      fallbackModel: 'claude-haiku',
      effort: 'medium',
      timeoutSeconds: 240,
    });
    assert.deepEqual(merged.codexCli, {
      executablePath: '/opt/Codex CLI/codex',
      model: 'gpt-5.6',
      reasoningEffort: 'high',
      timeoutSeconds: 300,
      verbosity: 'medium',
    });
    assert.equal(merged.providerId, 'codex-cli');
    assert.deepEqual(merged.vllm, {
      baseUrl: 'https://models.example.com/v1',
      model: 'remote-model',
      hasApiKey: true,
    });
  });

  it('persists provider settings and keeps encrypted API keys outside the config snapshot', () => {
    const fixture = new PrettifySettingsStorageFixture();

    const saved = fixture.storage.save({
      providerId: 'vllm',
      vllm: {
        apiKey: 'private-api-key',
        baseUrl: 'https://models.example.com/v1',
        model: 'remote-model',
      },
    });
    const storedSecret = fixture.fileSystem.files.get(fixture.settingsFile) ?? '';

    assert.equal(saved.providerId, 'vllm');
    assert.equal(saved.vllm.hasApiKey, true);
    assert.equal(storedSecret.includes('private-api-key'), false);
    assert.equal(fixture.storage.getWithSecret().vllm.apiKey, 'private-api-key');
    assert.equal(fixture.config.getSnapshot().prettifySettings.vllm.hasApiKey, true);
    assert.equal('apiKey' in fixture.config.getSnapshot().prettifySettings.vllm, false);
  });

  it('rejects stale renderer payloads that contain a prompt without mutating settings', () => {
    const fixture = new PrettifySettingsStorageFixture();
    const before = fixture.config.getSnapshot().prettifySettings;

    assert.throws(
      () =>
        fixture.storage.save({
          prompt: 'private stale prompt',
          providerId: 'vllm',
        } as never),
      /prettify-provider-settings-unknown-property/u,
    );
    assert.deepEqual(fixture.config.getSnapshot().prettifySettings, before);
  });

  it('clears encrypted keys and keeps independently constructed stores isolated', () => {
    const first = new PrettifySettingsStorageFixture('/first/settings.json');
    const second = new PrettifySettingsStorageFixture('/second/settings.json');

    first.storage.save({ vllm: { apiKey: 'first-private-key' } });
    assert.equal(first.storage.getWithSecret().vllm.apiKey, 'first-private-key');
    assert.equal(second.storage.getWithSecret().vllm.apiKey, '');

    first.storage.save({ vllm: { clearApiKey: true } });
    assert.equal(first.storage.getWithSecret().vllm.apiKey, '');
    assert.equal(first.storage.getView().vllm.hasApiKey, false);
    assert.equal(second.fileSystem.files.size, 0);
  });

  it('rejects unsafe provider URLs before mutating settings or secret storage', () => {
    const fixture = new PrettifySettingsStorageFixture();
    const before = fixture.config.getSnapshot().prettifySettings;

    assert.throws(
      () =>
        fixture.storage.save({
          providerId: 'vllm',
          vllm: {
            apiKey: 'private-api-key',
            baseUrl: 'http://models.example.com/v1',
          },
        }),
      /Non-local provider URLs must use HTTPS/,
    );
    assert.equal(fixture.fileSystem.files.size, 0);
    assert.deepEqual(fixture.config.getSnapshot().prettifySettings, before);
  });
});
