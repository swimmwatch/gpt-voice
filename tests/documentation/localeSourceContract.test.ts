import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseMkDocsConfiguration } from '../../scripts/mkdocs-configuration.mjs';

type TranslationManifest = {
  locales: Array<{
    status: string;
    tag: string;
  }>;
};

type MkDocsConfiguration = {
  nav?: unknown;
  plugins?: unknown[];
};

const projectRoot = process.cwd();
const guideRoot = path.join(projectRoot, 'docs', 'user-guide');
const completeStagedLocales = ['ru', 'be', 'uk', 'es', 'pt-BR', 'zh-CN', 'ja', 'de', 'fr', 'hi'] as const;
const bulkDraftLocales = ['uk', 'es', 'pt-BR', 'zh-CN', 'ja', 'de', 'fr', 'hi'] as const;
const protectedTerms = [
  'GPT-Voice',
  'ChatGPT Web',
  'OpenAI API',
  'Google Translate',
  'Ollama',
  'vLLM',
  'Electron safe storage',
  'CloakBrowser',
  'SOCKS5',
  'GeoIP',
] as const;
const russianStagedSources = {
  'getting-started.ru.md': [
    '# Первый запуск: подключите поставщика и расшифруйте речь',
    'ChatGPT Web',
    'OpenAI API',
    '`whisper-1`',
    '`F9`',
    '`F10`',
  ],
  'index.ru.md': ['# Документация GPT-Voice', 'GPT-Voice', 'ChatGPT Web', 'OpenAI API', 'Ollama', 'vLLM'],
  'install.ru.md': [
    '# Установка, обновление или удаление GPT-Voice',
    'SHA256SUMS-*.txt',
    'GPT-Voice Setup *.exe',
    'gpt-voice_*_amd64.deb',
    'GPT-Voice-*.AppImage',
  ],
  'install/windows.ru.md': ['# Windows', '`%APPDATA%\\GPT-Voice`'],
  'install/linux.ru.md': ['# Linux', '`~/.config/GPT-Voice`'],
  'install/macos.ru.md': ['# macOS', 'нет поддерживаемого пакета для macOS'],
  'guides/transcription.ru.md': [
    '# Запись и расшифровка речи',
    '`F9`',
    '`F10`',
    'ChatGPT Web',
    'OpenAI API',
    'При повторе микрофон не записывается заново.',
  ],
  'guides/providers.ru.md': [
    '# Выбор поставщика расшифровки и управление им',
    '`whisper-1`',
    'Electron safe storage',
    'Clear authentication',
  ],
  'guides/text-actions.ru.md': [
    '# Перевод и Prettify для выделенного текста',
    'Google Translate',
    'Ollama',
    'vLLM',
    '16,000',
    '`F11`',
    '`F12`',
    '`Escape`',
  ],
  'guides/history-and-tray.ru.md': [
    '# История расшифровок и системный трей',
    'SQLite',
    'Clear history',
    'Show GPT-Voice',
    'Quit',
  ],
  'settings/index.ru.md': [
    '# Обзор настроек',
    'Shortcuts',
    'Prettify',
    'Browser',
    'Network',
    'Unsaved changes',
    'Save changes',
    'Keep editing',
    'Discard changes',
  ],
  'settings/providers.ru.md': [
    '# Настройки поставщика',
    'ChatGPT Web',
    'OpenAI API',
    'Log in again',
    'Clear session',
    '`whisper-1`',
    '`0.05`',
    'Electron safe storage',
    'Clear API key',
  ],
  'settings/shortcuts.ru.md': [
    '# Настройки сочетаний клавиш',
    '`F9`',
    '`F10`',
    '`Escape`',
    '`F11`',
    '`F12`',
    '`Ctrl+F8`',
    'Ctrl+F9',
    'Translate',
    'Prettify',
    'Save changes',
  ],
  'settings/prettify.ru.md': [
    '# Настройки Prettify',
    'Ollama',
    'vLLM',
    '`http://127.0.0.1:11434`',
    '`http://127.0.0.1:8000/v1`',
    'Electron safe storage',
    'Clear API key',
    'Load model',
    'Free model',
    '`2147483647`',
    '4,000',
    'Save changes',
  ],
  'settings/browser.ru.md': [
    '# Настройки браузера',
    'CloakBrowser',
    'ChatGPT Web',
    'Default',
    'Careful',
    'Hidden',
    'Visible',
    '`en-US`',
    '`zh-TW`',
    'BCP 47',
    'IANA',
    'Proxy GeoIP controls locale and timezone',
  ],
  'settings/network.ru.md': [
    '# Настройки сети',
    'CloakBrowser',
    'Proxy enabled',
    'Proxy server',
    '`http://`',
    '`https://`',
    '`socks5://`',
    'Electron safe storage',
    'SOCKS5',
    'GeoIP',
    'Proxy GeoIP controls locale and timezone',
    'Save changes',
  ],
  'privacy.ru.md': [
    '# Конфиденциальность и данные',
    'ChatGPT Web',
    'OpenAI API',
    'Google Translate',
    'Ollama',
    'vLLM',
    '`gpt-voice.sqlite3`',
    'Electron safe storage',
    'Clear history',
    'Clear session',
    'Clear API key',
    '`%APPDATA%\\GPT-Voice`',
    '`~/.config/GPT-Voice`',
  ],
  'troubleshooting.ru.md': [
    '# Устранение неполадок',
    'Could not access microphone',
    'ChatGPT Web',
    'Connected',
    'Connect',
    'Clear session',
    'OpenAI API',
    '`whisper-1`',
    'Clear API key',
    'Prettify',
    'Ollama',
    'vLLM',
    'Load model',
    'Proxy enabled',
    '`socks5://`',
    'CloakBrowser',
    'GeoIP',
    'Copied to clipboard',
    '16 000',
  ],
  'faq.ru.md': [
    '# Частые вопросы',
    'ChatGPT Web',
    'OpenAI API',
    'Google Translate',
    'Ollama',
    'vLLM',
    'Translate',
    'Prettify',
    'SOCKS5',
    'Proxy GeoIP',
    'Clear history',
  ],
} as const;

const belarusianStagedSources = {
  'getting-started.be.md': [
    '# Першы запуск: падключыце пастаўшчыка і расшыфруйце маўленне',
    'ChatGPT Web',
    'OpenAI API',
    '`whisper-1`',
    '`F9`',
    '`F10`',
    'Copied to clipboard',
  ],
  'index.be.md': ['# Дакументацыя GPT-Voice', 'GPT-Voice', 'ChatGPT Web', 'OpenAI API', 'Ollama', 'vLLM'],
  'install.be.md': [
    '# Усталяванне, абнаўленне або выдаленне GPT-Voice',
    'SHA256SUMS-*.txt',
    'GPT-Voice Setup *.exe',
    'gpt-voice_*_amd64.deb',
    'GPT-Voice-*.AppImage',
  ],
  'install/windows.be.md': ['# Windows', '`%APPDATA%\\GPT-Voice`'],
  'install/linux.be.md': ['# Linux', '`~/.config/GPT-Voice`'],
  'install/macos.be.md': ['# macOS', 'Падтрыманага выпуску для macOS цяпер няма'],
  'guides/transcription.be.md': [
    '# Запіс і расшыфроўка',
    '`F9`',
    '`F10`',
    'ChatGPT Web',
    'OpenAI API',
    'Паўтор не запісвае мікрафон наноў.',
  ],
  'guides/providers.be.md': [
    '# Выбар пастаўшчыка расшыфроўкі і кіраванне ім',
    '`whisper-1`',
    'Electron safe storage',
    'Clear authentication',
  ],
  'guides/text-actions.be.md': [
    '# Пераклад і Prettify для вылучанага тэксту',
    'Google Translate',
    'Ollama',
    'vLLM',
    '16,000',
    '`F11`',
    '`F12`',
    '`Escape`',
  ],
  'guides/history-and-tray.be.md': [
    '# Гісторыя расшыфровак і сістэмны трэй',
    'SQLite',
    'Clear history',
    'Show GPT-Voice',
    'Quit',
  ],
  'settings/index.be.md': [
    '# Агляд налад',
    'Shortcuts',
    'Prettify',
    'Browser',
    'Network',
    'Unsaved changes',
    'Save changes',
    'Keep editing',
    'Discard changes',
  ],
  'settings/providers.be.md': [
    '# Налады пастаўшчыка',
    'ChatGPT Web',
    'OpenAI API',
    'Log in again',
    'Clear session',
    '`whisper-1`',
    '`0.05`',
    'Electron safe storage',
    'Clear API key',
  ],
  'settings/shortcuts.be.md': [
    '# Налады спалучэнняў клавіш',
    '`F9`',
    '`F10`',
    '`Escape`',
    '`F11`',
    '`F12`',
    '`Ctrl+F8`',
    'Ctrl+F9',
    'Translate',
    'Prettify',
    'Save changes',
  ],
  'settings/prettify.be.md': [
    '# Налады Prettify',
    'Ollama',
    'vLLM',
    '`http://127.0.0.1:11434`',
    '`http://127.0.0.1:8000/v1`',
    'Electron safe storage',
    'Clear API key',
    'Load model',
    'Free model',
    '`2147483647`',
    '4,000',
    'Save changes',
  ],
  'settings/browser.be.md': [
    '# Налады браўзера',
    'CloakBrowser',
    'ChatGPT Web',
    'Default',
    'Careful',
    'Hidden',
    'Visible',
    '`en-US`',
    '`zh-TW`',
    'BCP 47',
    'IANA',
    'Proxy GeoIP controls locale and timezone',
  ],
  'settings/network.be.md': [
    '# Налады сеткі',
    'CloakBrowser',
    'Proxy enabled',
    'Proxy server',
    '`http://`',
    '`https://`',
    '`socks5://`',
    'Electron safe storage',
    'SOCKS5',
    'GeoIP',
    'Proxy GeoIP controls locale and timezone',
    'Save changes',
  ],
  'privacy.be.md': [
    '# Канфідэнцыяльнасць і даныя',
    'ChatGPT Web',
    'OpenAI API',
    'Google Translate',
    'Ollama',
    'vLLM',
    '`gpt-voice.sqlite3`',
    'Electron safe storage',
    'Clear history',
    'Clear session',
    'Clear API key',
    '`%APPDATA%\\GPT-Voice`',
    '`~/.config/GPT-Voice`',
  ],
  'troubleshooting.be.md': [
    '# Устараненне непаладак',
    'Could not access microphone',
    'ChatGPT Web',
    'Connected',
    'Connect',
    'Clear session',
    'OpenAI API',
    '`whisper-1`',
    'Clear API key',
    'Prettify',
    'Ollama',
    'vLLM',
    'Load model',
    'Proxy enabled',
    '`socks5://`',
    'CloakBrowser',
    'GeoIP',
    'Copied to clipboard',
    '16,000',
  ],
  'faq.be.md': [
    '# Частыя пытанні',
    'ChatGPT Web',
    'OpenAI API',
    'Google Translate',
    'Ollama',
    'vLLM',
    'Translate',
    'Prettify',
    'SOCKS5',
    'Proxy GeoIP',
    'Clear history',
  ],
} as const;

const ukrainianStagedSources = {
  'index.uk.md': ['# Документація GPT-Voice', 'GPT-Voice', 'ChatGPT Web', 'OpenAI API', 'Ollama', 'vLLM', 'Prettify'],
  'install.uk.md': [
    '# Встановлення, оновлення або видалення GPT-Voice',
    'SHA256SUMS-*.txt',
    'GPT-Voice Setup *.exe',
    'gpt-voice_*_amd64.deb',
    'gpt-voice-*.x86_64.rpm',
    'GPT-Voice-*.AppImage',
  ],
  'install/windows.uk.md': ['# Windows', '`%APPDATA%\\GPT-Voice`'],
  'install/linux.uk.md': ['# Linux', '`~/.config/GPT-Voice`'],
  'install/macos.uk.md': ['# macOS', 'немає підтримуваного пакета для macOS'],
  'getting-started.uk.md': [
    '# Перше використання: підключіть постачальника та розшифруйте мовлення',
    'ChatGPT Web',
    'OpenAI API',
    '`whisper-1`',
    'Electron safe storage',
    '`F9`',
    '`F10`',
    'Copied to clipboard',
  ],
  'guides/transcription.uk.md': [
    '# Записування й розшифрування',
    '`F9`',
    '`F10`',
    'ChatGPT Web',
    'OpenAI API',
    'Повторна спроба не записує мікрофон повторно.',
  ],
  'guides/providers.uk.md': [
    '# Вибір постачальника розшифрування та керування ним',
    '`whisper-1`',
    'Electron safe storage',
    'Clear authentication',
    'ChatGPT Web',
    'OpenAI API',
  ],
  'guides/text-actions.uk.md': [
    '# Переклад і Prettify для виділеного тексту',
    'Google Translate',
    'Ollama',
    'vLLM',
    '16,000',
    '`F11`',
    '`F12`',
    '`Escape`',
  ],
  'guides/history-and-tray.uk.md': [
    '# Історія розшифровок і системний трей',
    'SQLite',
    'Clear history',
    'Show GPT-Voice',
    'Quit',
  ],
  'settings/index.uk.md': [
    '# Огляд налаштувань',
    'Shortcuts',
    'Prettify',
    'Browser',
    'Network',
    'Unsaved changes',
    'Save changes',
    'Keep editing',
    'Discard changes',
  ],
} as const;

function getI18nPlugin(configuration: MkDocsConfiguration): Record<string, unknown> {
  const plugin = configuration.plugins?.find(
    (candidate): candidate is { i18n: Record<string, unknown> } =>
      typeof candidate === 'object' && candidate !== null && 'i18n' in candidate,
  );
  assert.ok(plugin, 'MkDocs must configure mkdocs-static-i18n.');
  return plugin.i18n;
}

function collectNavigationSources(node: unknown): string[] {
  if (typeof node === 'string') {
    return node.endsWith('.md') ? [node] : [];
  }
  if (Array.isArray(node)) {
    return node.flatMap(collectNavigationSources);
  }
  if (typeof node === 'object' && node !== null) {
    return Object.values(node).flatMap(collectNavigationSources);
  }
  return [];
}

function expectedRussianStagedSources(configuration: MkDocsConfiguration): string[] {
  return collectNavigationSources(configuration.nav)
    .map((source) => source.replace(/\.md$/u, '.ru.md'))
    .sort();
}

function expectedBelarusianStagedSources(configuration: MkDocsConfiguration): string[] {
  return collectNavigationSources(configuration.nav)
    .map((source) => source.replace(/\.md$/u, '.be.md'))
    .sort();
}

function expectedStagedSources(configuration: MkDocsConfiguration, locale: string): string[] {
  return collectNavigationSources(configuration.nav)
    .map((source) => source.replace(/\.md$/u, `.${locale}.md`))
    .sort();
}

function countOccurrences(source: string, fragment: string): number {
  return source.split(fragment).length - 1;
}

function markdownCodeSpans(source: string): string[] {
  return source.match(/`[^`\n]+`/gu) ?? [];
}

function markdownLinkDestinations(source: string): string[] {
  return Array.from(source.matchAll(/\]\(([^\n)]+)\)/gu), ([, destination]) => destination);
}

function localizedDestination(destination: string): string {
  return destination === 'assets/generated/icons/gpt-voice-wordmark.svg'
    ? `/gpt-voice/docs/${destination}`
    : destination;
}

function assertProtectedSourceParity(filename: string, englishSource: string, localizedSource: string): void {
  for (const term of protectedTerms) {
    const requiredCount = countOccurrences(englishSource, term);
    if (requiredCount > 0) {
      assert.ok(
        countOccurrences(localizedSource, term) >= requiredCount,
        `${filename} must preserve every ${term} occurrence from its English source.`,
      );
    }
  }

  for (const codeSpan of markdownCodeSpans(englishSource)) {
    assert.ok(localizedSource.includes(codeSpan), `${filename} must preserve ${codeSpan}.`);
  }

  for (const destination of markdownLinkDestinations(englishSource)) {
    assert.ok(
      localizedSource.includes(`](${localizedDestination(destination)})`),
      `${filename} must preserve link destination ${localizedDestination(destination)}.`,
    );
  }
}

function assertRussianStagedSources(sources: ReadonlyMap<string, string>): void {
  for (const [filename, requiredFragments] of Object.entries(russianStagedSources)) {
    const source = sources.get(filename) ?? '';
    for (const fragment of requiredFragments) {
      assert.ok(source.includes(fragment), `${filename} must preserve ${fragment}.`);
    }
  }
}

function assertBelarusianStagedSources(sources: ReadonlyMap<string, string>): void {
  for (const [filename, requiredFragments] of Object.entries(belarusianStagedSources)) {
    const source = sources.get(filename) ?? '';
    for (const fragment of requiredFragments) {
      assert.ok(source.includes(fragment), `${filename} must preserve ${fragment}.`);
    }
  }
}

function assertUkrainianStagedSources(sources: ReadonlyMap<string, string>): void {
  for (const [filename, requiredFragments] of Object.entries(ukrainianStagedSources)) {
    const source = sources.get(filename) ?? '';
    for (const fragment of requiredFragments) {
      assert.ok(source.includes(fragment), `${filename} must preserve ${fragment}.`);
    }
  }
}

test('publishes the complete Russian guide sources without fallback publication', async () => {
  const [sources, manifestSource, configurationSource] = await Promise.all([
    Promise.all(
      Object.keys(russianStagedSources).map(
        async (filename) => [filename, await readFile(path.join(guideRoot, filename), 'utf8')] as const,
      ),
    ).then((entries) => new Map(entries)),
    readFile(path.join(guideRoot, 'data', 'translation-manifest.json'), 'utf8'),
    readFile(path.join(projectRoot, 'mkdocs.yml'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestSource) as TranslationManifest;
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;
  const i18n = getI18nPlugin(configuration);
  const russianRecord = manifest.locales.find(({ tag }) => tag === 'ru');

  assert.deepEqual(Object.keys(russianStagedSources).sort(), expectedRussianStagedSources(configuration));
  assertRussianStagedSources(sources);
  assert.ok(russianRecord, 'Translation manifest must retain the Russian locale record.');
  assert.equal(russianRecord.status, 'approved');
  assert.equal(i18n.build_only_locale, undefined);
});

test('rejects a missing Russian source', async () => {
  const sources = new Map(
    await Promise.all(
      Object.keys(russianStagedSources).map(
        async (filename) => [filename, await readFile(path.join(guideRoot, filename), 'utf8')] as const,
      ),
    ),
  );

  assert.throws(() => assertRussianStagedSources(new Map(sources).set('guides/transcription.ru.md', '')));
});

test('publishes the complete Belarusian guide sources without fallback publication', async () => {
  const [sources, manifestSource, configurationSource] = await Promise.all([
    Promise.all(
      Object.keys(belarusianStagedSources).map(
        async (filename) => [filename, await readFile(path.join(guideRoot, filename), 'utf8')] as const,
      ),
    ).then((entries) => new Map(entries)),
    readFile(path.join(guideRoot, 'data', 'translation-manifest.json'), 'utf8'),
    readFile(path.join(projectRoot, 'mkdocs.yml'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestSource) as TranslationManifest;
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;
  const i18n = getI18nPlugin(configuration);
  const belarusianRecord = manifest.locales.find(({ tag }) => tag === 'be');

  assert.deepEqual(Object.keys(belarusianStagedSources).sort(), expectedBelarusianStagedSources(configuration));
  assertBelarusianStagedSources(sources);
  assert.ok(belarusianRecord, 'Translation manifest must retain the Belarusian locale record.');
  assert.equal(belarusianRecord.status, 'approved');
  assert.equal(i18n.build_only_locale, undefined);
});

test('rejects a missing Belarusian source', async () => {
  const sources = new Map(
    await Promise.all(
      Object.keys(belarusianStagedSources).map(
        async (filename) => [filename, await readFile(path.join(guideRoot, filename), 'utf8')] as const,
      ),
    ),
  );

  assert.throws(() => assertBelarusianStagedSources(new Map(sources).set('privacy.be.md', '')));
});

test('publishes the Ukrainian source batches without fallback publication', async () => {
  const [sources, manifestSource, configurationSource] = await Promise.all([
    Promise.all(
      Object.keys(ukrainianStagedSources).map(
        async (filename) => [filename, await readFile(path.join(guideRoot, filename), 'utf8')] as const,
      ),
    ).then((entries) => new Map(entries)),
    readFile(path.join(guideRoot, 'data', 'translation-manifest.json'), 'utf8'),
    readFile(path.join(projectRoot, 'mkdocs.yml'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestSource) as TranslationManifest;
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;
  const i18n = getI18nPlugin(configuration);
  const ukrainianRecord = manifest.locales.find(({ tag }) => tag === 'uk');

  assertUkrainianStagedSources(sources);
  assert.ok(ukrainianRecord, 'Translation manifest must retain the Ukrainian locale record.');
  assert.equal(ukrainianRecord.status, 'approved');
  assert.equal(i18n.build_only_locale, undefined);
});

test('rejects a missing staged Ukrainian source', async () => {
  const sources = new Map(
    await Promise.all(
      Object.keys(ukrainianStagedSources).map(
        async (filename) => [filename, await readFile(path.join(guideRoot, filename), 'utf8')] as const,
      ),
    ),
  );

  assert.throws(() => assertUkrainianStagedSources(new Map(sources).set('settings/index.uk.md', '')));
});

test('publishes complete approved source sets for every remaining guide locale', async () => {
  const configurationSource = await readFile(path.join(projectRoot, 'mkdocs.yml'), 'utf8');
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;
  const i18n = getI18nPlugin(configuration);

  for (const locale of completeStagedLocales) {
    const expectedSources = expectedStagedSources(configuration, locale);
    const sources = await Promise.all(
      expectedSources.map(
        async (filename) => [filename, await readFile(path.join(guideRoot, filename), 'utf8')] as const,
      ),
    );

    assert.equal(sources.length, expectedSources.length, `${locale} must stage every public guide source.`);
    for (const [filename, source] of sources) {
      assert.ok(source.startsWith('#') || source.startsWith('<'), `${filename} must retain document content.`);
      assert.ok(
        !source.includes('ZXQPH') && !source.includes('[[[X'),
        `${filename} must not expose draft placeholders.`,
      );
    }
  }

  assert.equal(i18n.build_only_locale, undefined);
});

test('preserves protected literals in every bulk translation draft', async () => {
  const configurationSource = await readFile(path.join(projectRoot, 'mkdocs.yml'), 'utf8');
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;
  const englishSources = expectedStagedSources(configuration, 'en').map((filename) =>
    filename.replace(/\.en\.md$/u, '.md'),
  );

  for (const filename of englishSources) {
    const englishSource = await readFile(path.join(guideRoot, filename), 'utf8');
    for (const locale of bulkDraftLocales) {
      const localizedFilename = filename.replace(/\.md$/u, `.${locale}.md`);
      const localizedSource = await readFile(path.join(guideRoot, localizedFilename), 'utf8');
      assertProtectedSourceParity(localizedFilename, englishSource, localizedSource);
    }
  }
});

test('rejects a missing protected literal in a bulk translation draft', () => {
  assert.throws(() => assertProtectedSourceParity('index.es.md', 'GPT-Voice uses ChatGPT Web.', 'GPT-Voice uses it.'));
});
