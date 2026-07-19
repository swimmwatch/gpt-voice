import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import en from '@main/i18n/en';
import ru from '@main/i18n/ru';
import be from '@main/i18n/be';
import uk from '@main/i18n/uk';
import es from '@main/i18n/es';
import ptBr from '@main/i18n/pt-BR';
import zh from '@main/i18n/zh';
import ja from '@main/i18n/ja';
import de from '@main/i18n/de';
import fr from '@main/i18n/fr';
import hi from '@main/i18n/hi';
import { getAllTranslations, getLocale, getSupportedLocales, setLocale, t, type TranslationKey } from '@main/i18n';
import { ClaudeWebVoiceProviderErrorCode } from '@main/providers/ClaudeWebVoiceProvider';
import { ClaudeCliPrettifyErrorCode } from '@main/services/prettifyClaudeCli';
import { CodexCliPrettifyErrorCode } from '@main/services/prettifyCodexCli';
import {
  CLAUDE_CLI_PRETTIFY_EFFORT_VALUES,
  CODEX_CLI_PRETTIFY_REASONING_EFFORT_VALUES,
  CODEX_CLI_PRETTIFY_VERBOSITY_VALUES,
} from '@shared/prettifySettings';
import { APP_LOCALE_IDS, type AppLocaleId } from '@shared/appLocale';

const CLAUDE_WEB_ERROR_KEY_PREFIX = 'error.claudeWeb.';
const TRANSLATIONS_BY_LOCALE = { en, ru, be, uk, es, 'pt-BR': ptBr, zh, ja, de, fr, hi } as const;
const NEW_LOCALE_IDS = ['es', 'pt-BR', 'zh', 'ja', 'de', 'fr', 'hi'] as const;
const ALLOWED_IDENTICAL_TRANSLATION_KEYS = new Set<TranslationKey>([
  'provider.claudeWeb.name',
  'providerSettings.login',
  'providerSettings.prompt',
  'providerSettings.language.auto',
  'appSettings.system',
  'appSettings.cloakBrowser',
  'appSettings.proxy',
  'appSettings.backgroundMode.visible',
  'appSettings.proxyServer',
  'appSettings.proxyGeoip',
  'mainDock.subtitle',
  'mainDock.prettifyEffort',
  'mainDock.prettifyExperimental',
  'modelMemory.vram',
  'settingsSection.system',
  'settingsSection.browser',
  'about.version',
  'about.copyright',
  'prettify.reasoning.standard',
  'prettify.provider.ollama',
  'prettify.provider.vllm',
  'prettify.provider.claudeCli',
  'prettify.provider.codexCli',
  'prettify.topP',
  'prettify.topK',
  'prettify.minP',
  'prettify.seed',
  'prettify.modelVramApprox',
  'tray.tooltip',
]);
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
  'prettify.cli.showModelOptions',
  'prettify.cli.statusUnchecked',
  'prettify.cli.statusChecking',
  'prettify.cli.statusAvailable',
  'prettify.cli.statusUnavailable',
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
const REQUIRED_MAIN_PRETTIFY_BAND_KEYS = [
  'mainDock.prettifyProviderLabel',
  'mainDock.prettifyModelLabel',
  'mainDock.prettifyNotConfigured',
  'mainDock.prettifyConfigured',
  'mainDock.prettifyEffort',
  'mainDock.prettifyExperimental',
  'mainDock.openPrettifySettings',
  'mainDock.prettifySaveFailed',
  'mainDock.prettifyLoad',
  'mainDock.prettifyFree',
] as const;
const REQUIRED_SYSTEM_LANGUAGE_KEYS = [
  'appSettings.system',
  'appSettings.language',
  'appSettings.languageHelp',
  'appSettings.languageSaving',
  'appSettings.languageSaveFailed',
  'settingsSection.system',
] as const;

function getPlaceholders(message: string): string[] {
  return Array.from(message.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g), (match) => match[1]).sort();
}

describe('i18n', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('lists the supported locales in registry order', () => {
    assert.deepEqual(getSupportedLocales(), APP_LOCALE_IDS);
  });

  it('falls back to English for an unsupported locale', () => {
    setLocale('missing' as AppLocaleId);

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
    assert.equal(en['mainDock.prettifyProviderLabel'], 'Prettify');
  });

  it('renders every main Prettify band message in each explicitly selected locale', () => {
    for (const locale of APP_LOCALE_IDS) {
      setLocale(locale);
      for (const key of REQUIRED_MAIN_PRETTIFY_BAND_KEYS) {
        const message = t(key);
        assert.equal(Boolean(message.trim()), true, `${locale}:${key}`);
        assert.notEqual(message, key, `${locale}:${key}`);
      }
    }
  });

  it('localizes every System language setting without runtime placeholders', () => {
    for (const locale of APP_LOCALE_IDS) {
      const dictionary = TRANSLATIONS_BY_LOCALE[locale] as Readonly<Record<string, string>>;
      for (const key of REQUIRED_SYSTEM_LANGUAGE_KEYS) {
        const message = dictionary[key];
        assert.equal(Boolean(message?.trim()), true, `${locale}:${key}`);
        assert.deepEqual(getPlaceholders(message ?? ''), [], `${locale}:${key}`);
      }
    }
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

    for (const locale of APP_LOCALE_IDS) {
      const dictionary = TRANSLATIONS_BY_LOCALE[locale] as Readonly<Record<string, string>>;
      assert.deepEqual(Object.keys(dictionary).sort(), expectedKeys, locale);
      for (const key of expectedKeys) {
        assert.equal(Boolean(dictionary[key]?.trim()), true, `${locale}:${key}`);
      }
    }
  });

  it('keeps placeholder names aligned with English in every locale', () => {
    const english = en as Readonly<Record<string, string>>;

    for (const locale of APP_LOCALE_IDS) {
      const dictionary = TRANSLATIONS_BY_LOCALE[locale] as Readonly<Record<string, string>>;
      for (const key of Object.keys(english)) {
        assert.deepEqual(
          getPlaceholders(dictionary[key] ?? ''),
          getPlaceholders(english[key] ?? ''),
          `${locale}:${key}`,
        );
      }
    }
  });

  it('rejects unexpected English duplicates in newly added locales', () => {
    const english = en as Readonly<Record<TranslationKey, string>>;

    for (const locale of NEW_LOCALE_IDS) {
      const dictionary = TRANSLATIONS_BY_LOCALE[locale] as Readonly<Record<TranslationKey, string>>;
      const unexpectedDuplicates = (Object.keys(english) as TranslationKey[]).filter(
        (key) => dictionary[key] === english[key] && !ALLOWED_IDENTICAL_TRANSLATION_KEYS.has(key),
      );
      assert.deepEqual(unexpectedDuplicates, [], locale);
    }
  });

  it('preserves provider brands and technical identifiers in every locale', () => {
    const requiredTerms = {
      'provider.claudeWeb.name': ['Claude Web'],
      'appSettings.cloakBrowser': ['CloakBrowser'],
      'mainDock.subtitle': ['GPT-Voice'],
      'appSettings.proxySocks5AuthWarning': ['SOCKS5'],
      'providerSettings.claudeWeb.languageDescription': ['BCP 47', 'Claude Web'],
      'prettify.provider.ollama': ['Ollama'],
      'prettify.provider.vllm': ['vLLM'],
      'prettify.provider.claudeCli': ['Claude CLI'],
      'prettify.provider.codexCli': ['Codex CLI'],
      'prettify.cli.executablePathHelp': ['PATH'],
      'prettify.claudeCli.privacy': ['Anthropic', 'Claude CLI', 'API'],
      'prettify.codexCli.privacy': ['OpenAI', 'Codex CLI', 'API'],
      'error.claudeWeb.invalid-audio': ['Claude Web', 'PCM'],
      'tray.tooltip': ['GPT-Voice'],
    } as const satisfies Partial<Record<TranslationKey, readonly string[]>>;

    for (const locale of APP_LOCALE_IDS) {
      const dictionary = TRANSLATIONS_BY_LOCALE[locale] as Readonly<Record<TranslationKey, string>>;
      for (const [key, terms] of Object.entries(requiredTerms)) {
        const message = dictionary[key as TranslationKey];
        for (const term of terms) assert.equal(message.includes(term), true, `${locale}:${key}:${term}`);
      }
    }

    const protectedTerms = [
      'GPT-Voice',
      'ChatGPT',
      'OpenAI',
      'Anthropic',
      'Claude Web',
      'Claude CLI',
      'Codex CLI',
      'Ollama',
      'vLLM',
      'CloakBrowser',
      'API',
      'CLI',
      'PATH',
      'BCP 47',
      'PCM',
      'SOCKS5',
      'GeoIP',
      'VRAM',
      'URL',
      'JSON',
    ] as const;
    const english = en as Readonly<Record<TranslationKey, string>>;
    for (const locale of NEW_LOCALE_IDS) {
      const dictionary = TRANSLATIONS_BY_LOCALE[locale] as Readonly<Record<TranslationKey, string>>;
      for (const key of Object.keys(english) as TranslationKey[]) {
        for (const term of protectedTerms) {
          if (!english[key].includes(term)) continue;
          assert.equal(dictionary[key].includes(term), true, `${locale}:${key}:${term}`);
        }
      }
    }
  });

  it('supports locale-sensitive dates and language display names for every locale', () => {
    const referenceDate = new Date(Date.UTC(2026, 6, 19, 12));

    for (const locale of APP_LOCALE_IDS) {
      const formattedDate = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
        year: 'numeric',
      }).format(referenceDate);
      const displayName = new Intl.DisplayNames([locale], { type: 'language' }).of(locale);
      assert.equal(Boolean(formattedDate.trim()), true, locale);
      assert.equal(Boolean(displayName?.trim()), true, locale);
    }
  });

  it('localizes every Claude Web provider error code without sensitive placeholders', () => {
    const errorCodes = Object.values(ClaudeWebVoiceProviderErrorCode).sort();
    const localizedErrorCodes = Object.keys(en)
      .filter((key) => key.startsWith(CLAUDE_WEB_ERROR_KEY_PREFIX))
      .map((key) => key.slice(CLAUDE_WEB_ERROR_KEY_PREFIX.length))
      .sort();
    assert.deepEqual(localizedErrorCodes, errorCodes);

    for (const locale of APP_LOCALE_IDS) {
      const dictionary = TRANSLATIONS_BY_LOCALE[locale] as Readonly<Record<string, string>>;
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

    for (const locale of APP_LOCALE_IDS) {
      const dictionary = TRANSLATIONS_BY_LOCALE[locale] as Readonly<Record<string, string>>;
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

    for (const locale of APP_LOCALE_IDS) {
      const dictionary = TRANSLATIONS_BY_LOCALE[locale] as Readonly<Record<string, string>>;
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
    assert.equal(en['prettify.provider.codexCli'], 'Codex CLI');
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
