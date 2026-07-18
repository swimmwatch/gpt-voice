import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import en from '@main/i18n/en';
import ru from '@main/i18n/ru';
import uk from '@main/i18n/uk';
import be from '@main/i18n/be';
import { getAllTranslations, getLocale, getSupportedLocales, setLocale, t, type TranslationKey } from '@main/i18n';
import { ClaudeWebVoiceProviderErrorCode } from '@main/providers/ClaudeWebVoiceProvider';

const CLAUDE_WEB_ERROR_KEY_PREFIX = 'error.claudeWeb.';
const TRANSLATIONS_BY_LOCALE = { en, ru, uk, be } as const;

function getPlaceholders(message: string): string[] {
  return Array.from(message.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g), (match) => match[1]).sort();
}

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

  it('keeps placeholder names aligned with English in every locale', () => {
    const english = en as Readonly<Record<string, string>>;

    for (const [locale, translations] of Object.entries(TRANSLATIONS_BY_LOCALE)) {
      const dictionary = translations as Readonly<Record<string, string>>;
      for (const key of Object.keys(english)) {
        assert.deepEqual(
          getPlaceholders(dictionary[key] ?? ''),
          getPlaceholders(english[key] ?? ''),
          `${locale}:${key}`,
        );
      }
    }
  });

  it('localizes every Claude Web provider error code without sensitive placeholders', () => {
    const errorCodes = Object.values(ClaudeWebVoiceProviderErrorCode).sort();
    const localizedErrorCodes = Object.keys(en)
      .filter((key) => key.startsWith(CLAUDE_WEB_ERROR_KEY_PREFIX))
      .map((key) => key.slice(CLAUDE_WEB_ERROR_KEY_PREFIX.length))
      .sort();
    assert.deepEqual(localizedErrorCodes, errorCodes);

    for (const [locale, translations] of Object.entries(TRANSLATIONS_BY_LOCALE)) {
      const dictionary = translations as Readonly<Record<string, string>>;
      setLocale(locale);
      for (const errorCode of errorCodes) {
        const key = `${CLAUDE_WEB_ERROR_KEY_PREFIX}${errorCode}`;
        const message = dictionary[key];
        assert.equal(typeof message, 'string', `${locale}:${key}`);
        assert.equal(Boolean(message?.trim()), true, `${locale}:${key}`);
        assert.deepEqual(getPlaceholders(message ?? ''), [], `${locale}:${key}`);
        assert.equal(t(key as TranslationKey), message, `${locale}:${key}`);
      }
    }
  });

  it('keeps Claude Web guidance actionable without organization disclosure or replay claims', () => {
    assert.match(
      en['error.claudeWeb.organization-ambiguous'],
      /Make the intended organization active in Claude, then retry/,
    );
    assert.doesNotMatch(en['error.claudeWeb.organization-ambiguous'], /choose|list|uuid|identifier/i);
    assert.match(en['error.claudeWeb.malformed-event'], /private integration may have changed/i);
    assert.match(en['error.claudeWeb.malformed-event'], /revalidate/i);
    assert.match(en['error.claudeWeb.invalid-audio'], /compressed fallback audio cannot be sent/i);
    assert.doesNotMatch(en['error.claudeWeb.invalid-audio'], /sign in|authenticate/i);

    for (const key of [
      'error.claudeWeb.connect-timeout',
      'error.claudeWeb.first-event-timeout',
      'error.claudeWeb.overall-timeout',
      'error.claudeWeb.drain-timeout',
      'error.claudeWeb.cancelled',
    ] as const) {
      assert.doesNotMatch(en[key], /automatic|replay|resend/i);
    }

    const claudeKeys = Object.keys(en).filter((key) => key.includes('claudeWeb'));
    assert.equal(
      claudeKeys.some((key) => /personal|scope/i.test(key)),
      false,
    );
  });
});
