import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { DEFAULT_APP_LOCALE, resolveStartupLocale } from '@main/startupLocale';

const SUPPORTED_LOCALES = ['en', 'ru', 'be', 'uk', 'es', 'pt-BR', 'zh', 'ja', 'de', 'fr', 'hi'] as const;
const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('startup locale resolution', () => {
  it('preserves a supported locale that was explicitly selected', () => {
    assert.equal(resolveStartupLocale('uk', true, SUPPORTED_LOCALES), 'uk');
    assert.equal(resolveStartupLocale('be-BY', true, SUPPORTED_LOCALES), 'be');
    assert.equal(resolveStartupLocale('pt_BR', true, SUPPORTED_LOCALES), 'pt-BR');
    assert.equal(resolveStartupLocale('zh-CN', true, SUPPORTED_LOCALES), 'zh');
  });

  it('starts in English when a legacy locale was not explicitly selected', () => {
    assert.equal(resolveStartupLocale('uk', false, SUPPORTED_LOCALES), DEFAULT_APP_LOCALE);
    assert.equal(resolveStartupLocale('be-BY', false, SUPPORTED_LOCALES), 'en');
    assert.equal(resolveStartupLocale(undefined, false, SUPPORTED_LOCALES), 'en');
  });

  it('falls back to English for invalid explicit locale values', () => {
    assert.equal(resolveStartupLocale('pt-PT', true, SUPPORTED_LOCALES), DEFAULT_APP_LOCALE);
    assert.equal(resolveStartupLocale('missing', true, SUPPORTED_LOCALES), DEFAULT_APP_LOCALE);
    assert.equal(resolveStartupLocale({ locale: 'uk' }, true, SUPPORTED_LOCALES), 'en');
  });

  it('persists only locales marked by an explicit renderer choice', () => {
    const config = readFileSync(path.join(PROJECT_ROOT, 'src/main/config.ts'), 'utf8');
    const main = readFileSync(path.join(PROJECT_ROOT, 'src/main/main.ts'), 'utf8');

    assert.match(config, /localeExplicit: currentLocaleWasExplicitlySelected/u);
    assert.match(config, /locale && localeExplicit === true/u);
    assert.match(config, /currentLocaleWasExplicitlySelected = true/u);
    assert.match(main, /hasExplicitLocalePreference\(\)/u);
  });
});
