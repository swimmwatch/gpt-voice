import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FORM_SOURCE_PATH = path.join(PROJECT_ROOT, 'src/renderer/components/ProviderSettingsForm.tsx');
const SEARCHABLE_SELECT_SOURCE_PATH = path.join(PROJECT_ROOT, 'src/renderer/components/SearchableSelectInput.tsx');

describe('provider settings form contracts', () => {
  it('keeps each current provider on its explicit settings contract', () => {
    const source = readFileSync(FORM_SOURCE_PATH, 'utf8');

    assert.match(source, /saveProviderSettings\(CLAUDE_WEB_PROVIDER_ID, \{\s*language: claudeWebLanguage,/u);
    assert.match(source, /apiKey,\s*language: openAIApiLanguage,\s*model: openAIApiModel,\s*prompt,\s*temperature,/u);
    assert.match(source, /clearProviderAuth\(provider\.id\)/u);
    assert.match(source, /data-slot="provider-session-settings"/u);
    assert.match(source, /data-slot="provider-api-settings"/u);
    assert.match(source, /providerSettings\.apiKeyStatus/u);
    assert.match(source, /settings\.hasApiKey \? 'providerSettings\.apiKeySaved'/u);
    assert.match(source, /providerSettings\.apiKeyReplacePlaceholder/u);
    assert.match(source, /data-slot="provider-claude-settings"/u);
    assert.match(source, /<SearchableSelectInput/u);
    assert.match(source, /OPENAI_API_TRANSCRIPTION_MODELS\.map/u);
    assert.match(source, /allowCustomValue=\{false\}/u);
  });

  it('provides searchable combobox semantics and keyboard selection', () => {
    const source = readFileSync(SEARCHABLE_SELECT_SOURCE_PATH, 'utf8');

    assert.match(source, /role="combobox"/u);
    assert.match(source, /role="listbox"/u);
    assert.match(source, /role="option"/u);
    assert.match(source, /event\.key === 'ArrowDown'/u);
    assert.match(source, /event\.key === 'ArrowUp'/u);
    assert.match(source, /event\.key === 'Enter'/u);
    assert.match(source, /event\.key === 'Escape'/u);
  });

  it('closes only after successful editable-settings saves', () => {
    const source = readFileSync(FORM_SOURCE_PATH, 'utf8');

    assert.equal((source.match(/\bonClose\(\);/gu) || []).length, 2);
    assert.doesNotMatch(source, /common\.close/u);
  });
});
