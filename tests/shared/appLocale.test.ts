import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APP_LOCALES, APP_LOCALE_IDS, DEFAULT_APP_LOCALE, isAppLocaleId, normalizeAppLocale } from '@shared/appLocale';

describe('application locale contract', () => {
  it('matches the CloakBrowser site locale order and native names', () => {
    assert.deepEqual(APP_LOCALE_IDS, ['en', 'ru', 'be', 'uk', 'es', 'pt-BR', 'zh', 'ja', 'de', 'fr', 'hi']);
    assert.deepEqual(
      APP_LOCALES.map(({ nativeName }) => nativeName),
      [
        'English',
        'Русский',
        'Беларуская',
        'Українська',
        'Español',
        'Português (Brasil)',
        '简体中文',
        '日本語',
        'Deutsch',
        'Français',
        'हिन्दी',
      ],
    );
    assert.equal(DEFAULT_APP_LOCALE, 'en');
  });

  it('validates only canonical public locale IDs', () => {
    for (const locale of APP_LOCALE_IDS) assert.equal(isAppLocaleId(locale), true, locale);
    for (const locale of ['pt_BR', 'pt-br', 'zh-CN', 'pt-PT', '', null]) {
      assert.equal(isAppLocaleId(locale), false, String(locale));
    }
  });

  it('normalizes exact regional IDs before supported base fallbacks', () => {
    assert.equal(normalizeAppLocale('pt-BR'), 'pt-BR');
    assert.equal(normalizeAppLocale('PT_br'), 'pt-BR');
    assert.equal(normalizeAppLocale('be-BY'), 'be');
    assert.equal(normalizeAppLocale('zh-CN'), 'zh');
    assert.equal(normalizeAppLocale('es-MX'), 'es');
    assert.equal(normalizeAppLocale('pt-PT'), null);
    assert.equal(normalizeAppLocale('pt'), null);
    assert.equal(normalizeAppLocale({ locale: 'fr' }), null);
  });
});
