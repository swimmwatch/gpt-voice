import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PRETTIFY_SECTION_PATH = path.join(PROJECT_ROOT, 'src/renderer/components/settings/PrettifySection.tsx');
const EN_TRANSLATIONS_PATH = path.join(PROJECT_ROOT, 'src/main/i18n/en.ts');

describe('Prettify remote-provider privacy disclosure', () => {
  it('warns that selected text is sent to a non-loopback provider endpoint', () => {
    const section = readFileSync(PRETTIFY_SECTION_PATH, 'utf8');
    const translations = readFileSync(EN_TRANSLATIONS_PATH, 'utf8');

    assert.match(section, /prettify\.remoteProviderPrivacy/u);
    assert.match(translations, /Selected text and this prompt are sent to the configured provider endpoint\./u);
  });

  it('shows provider-specific CLI quota and experimental disclosures', () => {
    const section = readFileSync(PRETTIFY_SECTION_PATH, 'utf8');
    const translations = readFileSync(EN_TRANSLATIONS_PATH, 'utf8');

    assert.match(section, /prettify\.claudeCli\.privacy/u);
    assert.match(section, /prettify\.codexCli\.privacy/u);
    assert.match(section, /prettify\.codexCli\.experimentalHelp/u);
    assert.match(translations, /Anthropic Claude CLI account and may consume subscription or API quota/u);
    assert.match(translations, /OpenAI Codex CLI account and may consume subscription or API quota/u);
    assert.match(translations, /required no-tools and isolation controls/u);
  });

  it('renders HTTP-only controls behind explicit capability gates', () => {
    const section = readFileSync(PRETTIFY_SECTION_PATH, 'utf8');

    assert.match(section, /capabilities\.baseUrl && activeHttpSettings/u);
    assert.match(section, /capabilities\.apiKey && prettifySettings\.providerId === 'vllm'/u);
    assert.match(section, /capabilities\.httpGenerationControls &&/u);
    assert.match(section, /capabilities\.modelLifecycle && prettifySettings\.providerId === 'ollama'/u);
  });
});
