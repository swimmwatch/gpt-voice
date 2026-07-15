import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseMkDocsConfiguration } from '../../scripts/mkdocs-configuration.mjs';

type TranslationManifest = {
  locales: Array<{
    pages: unknown[];
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
    '`%APPDATA%\\GPT-Voice`',
    '`~/.config/GPT-Voice`',
  ],
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

test('stages the Russian guide sources without enabling fallback publication', async () => {
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
  assert.equal(russianRecord.status, 'blocked');
  assert.deepEqual(russianRecord.pages, []);
  assert.equal(i18n.build_only_locale, 'en');
});

test('rejects a missing Russian source or an attempt to publish its incomplete batch', async () => {
  const sources = new Map(
    await Promise.all(
      Object.keys(russianStagedSources).map(
        async (filename) => [filename, await readFile(path.join(guideRoot, filename), 'utf8')] as const,
      ),
    ),
  );

  assert.throws(() => assertRussianStagedSources(new Map(sources).set('guides/transcription.ru.md', '')));
});

test('stages the Belarusian core and workflow batches without enabling fallback publication', async () => {
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
  const i18n = getI18nPlugin(parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration);
  const belarusianRecord = manifest.locales.find(({ tag }) => tag === 'be');

  assertBelarusianStagedSources(sources);
  assert.ok(belarusianRecord, 'Translation manifest must retain the Belarusian locale record.');
  assert.equal(belarusianRecord.status, 'blocked');
  assert.deepEqual(belarusianRecord.pages, []);
  assert.equal(i18n.build_only_locale, 'en');
});

test('rejects a missing staged Belarusian source', async () => {
  const sources = new Map(
    await Promise.all(
      Object.keys(belarusianStagedSources).map(
        async (filename) => [filename, await readFile(path.join(guideRoot, filename), 'utf8')] as const,
      ),
    ),
  );

  assert.throws(() => assertBelarusianStagedSources(new Map(sources).set('guides/transcription.be.md', '')));
});
