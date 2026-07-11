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
});
