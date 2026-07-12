import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import en from '@main/i18n/en';
import ru from '@main/i18n/ru';
import uk from '@main/i18n/uk';
import be from '@main/i18n/be';
import { getAllTranslations, getLocale, getSupportedLocales, setLocale, t } from '@main/i18n';

describe('i18n', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('lists the supported locales in registry order', () => {
    assert.deepEqual(getSupportedLocales(), ['en', 'ru', 'uk', 'be']);
  });

  it('falls back to English for an unsupported locale', () => {
    setLocale('missing');

    assert.equal(getLocale(), 'en');
    assert.equal(t('status.recording'), en['status.recording']);
  });

  it('returns translations from the active locale', () => {
    setLocale('ru');

    assert.equal(getLocale(), 'ru');
    assert.equal(t('status.recording'), ru['status.recording']);
  });

  it('replaces named parameters in translated strings', () => {
    setLocale('en');

    assert.equal(t('status.pressToRecord', { hotkey: 'F9' }), 'Press F9 to start recording');
  });

  it('uses distinct Command Dock labels for transcription and prettification', () => {
    assert.equal(en['mainDock.providerLabel'], 'Voice provider');
    assert.equal(en['modelMemory.ollamaGpu'], 'Prettify model');
  });

  it('keeps unresolved placeholders when a parameter is not provided', () => {
    setLocale('en');

    assert.equal(t('status.pressToRecord'), 'Press {hotkey} to start recording');
  });

  it('returns all translations for the current locale', () => {
    setLocale('uk');

    assert.deepEqual(getAllTranslations(), uk);
  });

  it('keeps every locale aligned with the English translation keys', () => {
    const expectedKeys = Object.keys(en).sort();

    for (const translations of [ru, uk, be]) {
      assert.deepEqual(Object.keys(translations).sort(), expectedKeys);
    }
  });
});
