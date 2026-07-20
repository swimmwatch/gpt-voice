import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CLAUDE_WEB_PRIVATE_FILE_MODE,
  CLAUDE_WEB_SETTINGS_FILE,
  getClaudeWebSettings,
  saveClaudeWebSettings,
} from '@main/providers/claudeWebSettings';
import {
  CLAUDE_WEB_PROVIDER_ID,
  DEFAULT_CLAUDE_WEB_SETTINGS,
  MAX_CLAUDE_WEB_LANGUAGE_LENGTH,
  getClaudeWebSettingsInputError,
  getClaudeWebSettingsUpdateInputError,
  normalizeClaudeWebSettings,
  suggestClaudeWebLanguage,
} from '@shared/claudeWebSettings';

const temporaryDirectories: string[] = [];

function createSettingsFile(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-claude-settings-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'settings.json');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('claudeWebSettings', () => {
  it('defines an isolated provider ID and deterministic default', () => {
    assert.equal(CLAUDE_WEB_PROVIDER_ID, 'claude-web');
    assert.deepEqual(normalizeClaudeWebSettings(), DEFAULT_CLAUDE_WEB_SETTINGS);
    assert.notEqual(path.basename(CLAUDE_WEB_SETTINGS_FILE), 'openai-api-settings.json');
    assert.notEqual(path.basename(CLAUDE_WEB_SETTINGS_FILE), 'chatgpt-session.json');
  });

  it('canonicalizes valid BCP-47 tags and trims surrounding whitespace', () => {
    assert.deepEqual(normalizeClaudeWebSettings({ language: '  EN-us  ' }), { language: 'en-US' });
    assert.deepEqual(normalizeClaudeWebSettings({ language: 'zh-hant-tw' }), { language: 'zh-Hant-TW' });
  });

  it('rejects invalid, blank, overlong, and malformed input', () => {
    assert.equal(getClaudeWebSettingsInputError([]), 'Claude Web settings must be an object');
    assert.equal(getClaudeWebSettingsInputError({ language: '' }), 'Claude language is required');
    assert.equal(
      getClaudeWebSettingsInputError({ language: 'x'.repeat(MAX_CLAUDE_WEB_LANGUAGE_LENGTH + 1) }),
      `Claude language must be at most ${MAX_CLAUDE_WEB_LANGUAGE_LENGTH} characters`,
    );
    assert.equal(
      getClaudeWebSettingsInputError({ language: 'en_US' }),
      'Claude language must be a valid BCP 47 language tag',
    );
    assert.equal(getClaudeWebSettingsInputError({ language: 42 }), 'Claude language must be a string');
    assert.throws(() => normalizeClaudeWebSettings({ language: 'not_a_locale' }));
  });

  it('accepts only the explicit language field at the renderer update boundary', () => {
    assert.equal(getClaudeWebSettingsUpdateInputError({ language: 'en-US' }), null);
    assert.equal(getClaudeWebSettingsUpdateInputError({}), 'Claude Web settings update must contain only language');
    assert.equal(
      getClaudeWebSettingsUpdateInputError({ language: 'en-US', organizationUuid: 'synthetic-organization' }),
      'Claude Web settings update must contain only language',
    );
    assert.equal(
      getClaudeWebSettingsUpdateInputError({ language: 'en-US', endpoint: 'synthetic-endpoint' }),
      'Claude Web settings update must contain only language',
    );
    assert.equal(getClaudeWebSettingsUpdateInputError({ language: 42 }), 'Claude language must be a string');
  });

  it('returns a canonical locale suggestion without mutating saved settings', () => {
    const settings = normalizeClaudeWebSettings({ language: 'en-US' });
    const suggestion = suggestClaudeWebLanguage('fr-fr');

    assert.equal(suggestion, 'fr-FR');
    assert.deepEqual(settings, { language: 'en-US' });
    assert.equal(suggestClaudeWebLanguage(''), null);
    assert.equal(suggestClaudeWebLanguage(undefined), null);
  });

  it('persists only schema metadata and canonical language with restrictive permissions', () => {
    const filePath = createSettingsFile();

    assert.deepEqual(saveClaudeWebSettings({ language: 'UK-ua' }, filePath), { language: 'uk-UA' });
    assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), {
      schemaVersion: 1,
      language: 'uk-UA',
    });
    assert.deepEqual(getClaudeWebSettings(filePath), { language: 'uk-UA' });

    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(filePath).mode & 0o777, CLAUDE_WEB_PRIVATE_FILE_MODE);
    }
  });

  it('falls back safely when settings are missing, malformed, or unsupported', () => {
    const filePath = createSettingsFile();
    assert.deepEqual(getClaudeWebSettings(filePath), DEFAULT_CLAUDE_WEB_SETTINGS);

    fs.writeFileSync(filePath, '{');
    assert.deepEqual(getClaudeWebSettings(filePath), DEFAULT_CLAUDE_WEB_SETTINGS);

    fs.writeFileSync(filePath, JSON.stringify({ schemaVersion: 2, language: 'fr-FR' }));
    assert.deepEqual(getClaudeWebSettings(filePath), DEFAULT_CLAUDE_WEB_SETTINGS);
  });
});
