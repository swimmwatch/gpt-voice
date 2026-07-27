import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { OpenAIApiSettingsRepository } from '@main/providers/openaiApiSettings';

const temporaryDirectories: string[] = [];

function createRepository(
  settingsFile: string,
  overrides: {
    readonly decrypt?: (encrypted: Buffer) => string;
    readonly encrypt?: (plainText: string) => Buffer;
    readonly isEncryptionAvailable?: () => boolean;
  } = {},
): OpenAIApiSettingsRepository {
  return new OpenAIApiSettingsRepository({
    fileSystem: fs,
    logger: { warn: () => undefined },
    secureStorage: {
      decrypt: overrides.decrypt ?? ((encrypted) => encrypted.toString('utf8')),
      encrypt: overrides.encrypt ?? ((plainText) => Buffer.from(plainText)),
      isEncryptionAvailable: overrides.isEncryptionAvailable ?? (() => true),
    },
    settingsFile,
  });
}

function createSettingsFile(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-openai-settings-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'settings.json');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('OpenAIApiSettingsRepository', () => {
  it('persists normalized settings and an encrypted API key without returning the secret', () => {
    const settingsFile = createSettingsFile();
    const repository = createRepository(settingsFile);

    const view = repository.save({
      apiKey: ' synthetic-secret ',
      language: 'en',
      prompt: ' prompt ',
      temperature: 0.25,
    });

    assert.equal(view.hasApiKey, true);
    assert.equal('apiKey' in view, false);
    assert.deepEqual(repository.getSettingsWithSecret(), {
      apiKey: 'synthetic-secret',
      language: 'en',
      model: 'whisper-1',
      prompt: 'prompt',
      temperature: 0.25,
    });
    const persisted = fs.readFileSync(settingsFile, 'utf8');
    assert.equal(persisted.includes('synthetic-secret'), false);
  });

  it('clears only the secret while retaining normalized settings', () => {
    const settingsFile = createSettingsFile();
    const repository = createRepository(settingsFile);
    repository.save({ apiKey: 'secret', language: 'uk', prompt: 'context' });

    assert.deepEqual(repository.clearApiKey(), {
      hasApiKey: false,
      language: 'uk',
      model: 'whisper-1',
      prompt: 'context',
      temperature: 0,
    });
    assert.equal(repository.getSettingsWithSecret().apiKey, '');
  });

  it('fails closed when secure storage is unavailable and isolates repository files', () => {
    const firstFile = createSettingsFile();
    const secondFile = createSettingsFile();
    const unavailable = createRepository(firstFile, { isEncryptionAvailable: () => false });
    const second = createRepository(secondFile);

    assert.throws(() => unavailable.save({ apiKey: 'secret' }), /Secure storage is not available/);
    second.save({ language: 'fr' });

    assert.equal(fs.existsSync(firstFile), false);
    assert.equal(second.getSettings().language, 'fr');
  });
});
