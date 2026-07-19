import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import en from '@main/i18n/en';
import ru from '@main/i18n/ru';
import uk from '@main/i18n/uk';
import be from '@main/i18n/be';
import { getAllTranslations, getLocale, getSupportedLocales, setLocale, t, type TranslationKey } from '@main/i18n';
import { ClaudeWebVoiceProviderErrorCode } from '@main/providers/ClaudeWebVoiceProvider';
import { ClaudeCliPrettifyErrorCode } from '@main/services/prettifyClaudeCli';
import { CodexCliPrettifyErrorCode } from '@main/services/prettifyCodexCli';
import {
  CLAUDE_CLI_PRETTIFY_EFFORT_VALUES,
  CODEX_CLI_PRETTIFY_REASONING_EFFORT_VALUES,
  CODEX_CLI_PRETTIFY_VERBOSITY_VALUES,
} from '@shared/prettifySettings';

const CLAUDE_WEB_ERROR_KEY_PREFIX = 'error.claudeWeb.';
const TRANSLATIONS_BY_LOCALE = { en, ru, uk, be } as const;
const CLI_LOCALIZATION_KEY_PREFIXES = [
  'prettify.provider.claudeCli',
  'prettify.provider.codexCli',
  'prettify.cli.',
  'prettify.claudeCli.',
  'prettify.codexCli.',
  'error.prettify.cli.',
  'error.prettify.claudeCli.',
  'error.prettify.codexCli.',
] as const;
const REQUIRED_CLI_SETTINGS_KEYS = [
  'prettify.provider.claudeCli',
  'prettify.provider.codexCli',
  'prettify.cli.executablePath',
  'prettify.cli.executablePathHelp',
  'prettify.cli.model',
  'prettify.cli.modelHelp',
  'prettify.cli.timeout',
  'prettify.cli.timeoutHelp',
  'prettify.claudeCli.fallbackModel',
  'prettify.claudeCli.fallbackModelHelp',
  'prettify.claudeCli.effort',
  'prettify.claudeCli.effortHelp',
  'prettify.claudeCli.privacy',
  'prettify.codexCli.reasoningEffort',
  'prettify.codexCli.reasoningEffortHelp',
  'prettify.codexCli.verbosity',
  'prettify.codexCli.verbosityHelp',
  'prettify.codexCli.experimental',
  'prettify.codexCli.experimentalHelp',
  'prettify.codexCli.privacy',
  ...CLAUDE_CLI_PRETTIFY_EFFORT_VALUES.map((value) => `prettify.claudeCli.effort.${value}`),
  ...CODEX_CLI_PRETTIFY_REASONING_EFFORT_VALUES.map((value) => `prettify.codexCli.reasoningEffort.${value}`),
  ...CODEX_CLI_PRETTIFY_VERBOSITY_VALUES.map((value) => `prettify.codexCli.verbosity.${value}`),
] as const;
const REQUIRED_CLI_SUPPORT_ERROR_KEYS = [
  'error.prettify.cli.invalid-executable-path',
  'error.prettify.cli.output-limit',
  'error.prettify.cli.nonzero-exit',
  'error.prettify.claudeCli.invalid-model',
  'error.prettify.codexCli.invalid-model',
  'error.prettify.codexCli.schema-unavailable',
  'error.prettify.codexCli.no-tools-unavailable',
  'error.prettify.codexCli.model-discovery-failed',
] as const;

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

  it('localizes every CLI adapter error code without runtime placeholders', () => {
    const providerErrors = [
      {
        codes: Object.values(ClaudeCliPrettifyErrorCode),
        prefix: 'error.prettify.claudeCli.',
      },
      {
        codes: Object.values(CodexCliPrettifyErrorCode),
        prefix: 'error.prettify.codexCli.',
      },
    ] as const;

    for (const [locale, translations] of Object.entries(TRANSLATIONS_BY_LOCALE)) {
      const dictionary = translations as Readonly<Record<string, string>>;
      setLocale(locale);
      for (const { codes, prefix } of providerErrors) {
        for (const errorCode of codes) {
          const key = `${prefix}${errorCode}`;
          const message = dictionary[key];
          assert.equal(typeof message, 'string', `${locale}:${key}`);
          assert.equal(Boolean(message?.trim()), true, `${locale}:${key}`);
          assert.deepEqual(getPlaceholders(message ?? ''), [], `${locale}:${key}`);
          assert.equal(t(key as TranslationKey), message, `${locale}:${key}`);
        }
      }
    }
  });

  it('keeps every CLI setup and support message present, localized, and placeholder-free', () => {
    const requiredKeys = [...REQUIRED_CLI_SETTINGS_KEYS, ...REQUIRED_CLI_SUPPORT_ERROR_KEYS];
    const cliKeys = Object.keys(en).filter((key) =>
      CLI_LOCALIZATION_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
    );

    for (const key of requiredKeys) {
      assert.equal(cliKeys.includes(key), true, `en:${key}`);
    }

    for (const [locale, translations] of Object.entries(TRANSLATIONS_BY_LOCALE)) {
      const dictionary = translations as Readonly<Record<string, string>>;
      for (const key of cliKeys) {
        const message = dictionary[key];
        assert.equal(typeof message, 'string', `${locale}:${key}`);
        assert.equal(Boolean(message?.trim()), true, `${locale}:${key}`);
        assert.deepEqual(getPlaceholders(message ?? ''), [], `${locale}:${key}`);
      }
    }
  });

  it('keeps CLI privacy and experimental failure guidance safe and actionable', () => {
    assert.match(en['prettify.claudeCli.privacy'], /Selected text.*Anthropic Claude CLI account/i);
    assert.match(en['prettify.claudeCli.privacy'], /subscription or API quota/i);
    assert.match(en['prettify.codexCli.privacy'], /Selected text.*OpenAI Codex CLI account/i);
    assert.match(en['prettify.codexCli.privacy'], /subscription or API quota/i);
    assert.match(en['prettify.provider.codexCli'], /Experimental/i);
    assert.match(en['prettify.codexCli.experimentalHelp'], /no-tools/i);
    assert.match(en['prettify.codexCli.experimentalHelp'], /isolation/i);
    assert.match(en['prettify.codexCli.experimentalHelp'], /no bypass/i);
    assert.match(en['error.prettify.codexCli.schema-unavailable'], /unconstrained execution is disabled/i);
    assert.match(en['error.prettify.codexCli.no-tools-unavailable'], /remains unavailable/i);
    assert.match(en['error.prettify.codexCli.no-tools-unavailable'], /no bypass/i);

    for (const key of [
      'error.prettify.cli.output-limit',
      'error.prettify.claudeCli.cancelled',
      'error.prettify.claudeCli.timed-out',
      'error.prettify.codexCli.cancelled',
      'error.prettify.codexCli.timed-out',
    ] as const) {
      assert.match(en[key], /process was terminated/i, key);
      assert.match(en[key], /No automatic retry occurred/i, key);
    }

    for (const [key, message] of Object.entries(en)) {
      if (!key.startsWith('error.prettify.')) continue;
      assert.doesNotMatch(message, /stderr|stdout|cwd|username|organization|credential|raw output/i, key);
      assert.doesNotMatch(message, /\/home\/|[A-Z]:\\Users\\|https?:\/\//i, key);
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
