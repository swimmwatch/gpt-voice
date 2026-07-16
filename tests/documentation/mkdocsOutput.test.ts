import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseMkDocsConfiguration } from '../../scripts/mkdocs-configuration.mjs';
import { getDocumentationRoute, localeRegistry } from '../../src/landing-page/content/locale-registry';

type MkDocsConfiguration = {
  docs_dir?: unknown;
  extra?: unknown;
  extra_css?: unknown;
  nav?: unknown;
  repo_url?: unknown;
  site_dir?: unknown;
  site_url?: unknown;
  theme?: unknown;
};

const projectRoot = process.cwd();
const configurationPath = path.join(projectRoot, 'mkdocs.yml');
const outputDirectory = path.join(projectRoot, 'build', 'github-pages', 'docs');
const canonicalUrl = 'https://swimmwatch.github.io/gpt-voice/docs/';
const expectedNavigation = [
  { Overview: 'index.md' },
  { 'Install, update, or remove': 'install.md' },
  { 'First use': 'getting-started.md' },
  { 'Record and transcribe': 'guides/transcription.md' },
  { Providers: 'guides/providers.md' },
  { 'Text actions': 'guides/text-actions.md' },
  { 'History and tray': 'guides/history-and-tray.md' },
  {
    Settings: [
      { Overview: 'settings/index.md' },
      { 'Provider settings': 'settings/providers.md' },
      { 'Shortcut settings': 'settings/shortcuts.md' },
      { 'Prettify settings': 'settings/prettify.md' },
      { 'Browser settings': 'settings/browser.md' },
      { 'Network settings': 'settings/network.md' },
    ],
  },
  {
    Support: [{ 'Privacy and data': 'privacy.md' }, { Troubleshooting: 'troubleshooting.md' }, { FAQ: 'faq.md' }],
  },
];
const prohibitedPathFragments = [
  '.agents/',
  'docs/agent-guides/',
  'docs/researches/',
  'docs/specs/',
  'locales.json',
  'tasks/handoff.md',
  'translation-manifest.json',
  'access-token.json',
  'chatgpt-session.json',
  'openai-api-settings.json',
];
const expectedPaletteVariables = {
  '--md-accent-fg-color': '#3674e5',
  '--md-code-bg-color': '#12171c',
  '--md-code-font': "'JetBrains Mono Variable', 'Roboto Mono', monospace",
  '--md-default-bg-color': '#080b0e',
  '--md-default-bg-color--light': '#12171c',
  '--md-default-fg-color': '#f6f7f8',
  '--md-default-fg-color--light': '#a4adb7',
  '--md-default-fg-color--lighter': '#2a333d',
  '--md-primary-bg-color': '#ffffff',
  '--md-primary-fg-color': '#2b60cb',
  '--md-primary-fg-color--light': '#3674e5',
  '--md-text-font':
    "'Ubuntu Sans Variable', 'Noto Sans SC Variable', 'Noto Sans JP Variable', 'Noto Sans Devanagari Variable', Ubuntu, system-ui, sans-serif",
  '--md-typeset-a-color': '#3674e5',
} as const;
const expectedFontImports = [
  "@import url('../generated/fonts/noto-sans-sc-wght.css');",
  "@import url('../generated/fonts/noto-sans-jp-wght.css');",
  "@import url('../generated/fonts/noto-sans-devanagari-wght.css');",
];
const expectedMaterialFeatures = [
  'navigation.tracking',
  'navigation.tabs',
  'navigation.tabs.sticky',
  'navigation.footer',
  'navigation.sections',
  'navigation.top',
  'navigation.path',
  'toc.follow',
  'search.suggest',
  'search.highlight',
  'search.share',
  'content.code.copy',
  'content.code.annotate',
  'content.code.select',
  'content.tabs.link',
  'content.tooltips',
];
const approvedVisualSelectors = [
  '.md-typeset .md-button',
  '.md-typeset .guide-wordmark',
  '.md-typeset .guide-wordmark img',
  '.md-typeset .guide-actions',
  '.md-typeset .guide-actions p',
  '.md-typeset .product-screenshot',
  '.md-typeset .product-screenshot > a',
  '.md-typeset .product-screenshot img',
  '.md-typeset .product-screenshot figcaption',
  '.md-typeset .grid.cards > ul > li',
  '.md-typeset code',
].sort();

function normalizeCssValue(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function parseCssDeclarations(block: string): Record<string, string> {
  return Object.fromEntries(
    block
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separatorIndex = declaration.indexOf(':');
        assert.notEqual(separatorIndex, -1, `Invalid CSS declaration: ${declaration}`);
        return [declaration.slice(0, separatorIndex).trim(), normalizeCssValue(declaration.slice(separatorIndex + 1))];
      }),
  );
}

function assertMaterialThemeContract(configuration: MkDocsConfiguration, stylesheet: string): void {
  const theme = configuration.theme as Record<string, unknown>;
  assert.equal(theme.name, 'material');
  assert.deepEqual(theme.palette, { accent: 'custom', primary: 'custom', scheme: 'slate' });
  assert.equal(theme.font, false);
  assert.equal(theme.logo, 'assets/generated/icons/gpt-voice.png');
  assert.equal(theme.favicon, 'assets/generated/icons/gpt-voice.png');
  assert.deepEqual(theme.features, expectedMaterialFeatures);

  const imports = stylesheet.match(/^@import .+;$/gmu) ?? [];
  assert.deepEqual(imports, expectedFontImports, 'Only the approved local locale-font stylesheets may be imported.');

  const blocks = Array.from(
    stylesheet.replace(/^@import .+;\n/gmu, '').matchAll(/([^{}]+)\{([^{}]*)\}/gu),
    ([, selector, declarations]) => ({ declarations, selector: selector.trim() }),
  );
  const fontFaces = blocks.filter(({ selector }) => selector === '@font-face');
  assert.equal(fontFaces.length, 2, 'The palette stylesheet may define only the two approved local font faces.');
  for (const { declarations } of fontFaces) {
    const fontFace = parseCssDeclarations(declarations);
    assert.deepEqual(Object.keys(fontFace).sort(), ['font-display', 'font-family', 'font-style', 'font-weight', 'src']);
    assert.equal(fontFace['font-display'], 'swap');
    assert.equal(fontFace['font-style'], 'normal');
    assert.match(
      fontFace.src,
      /^url\('\.\.\/generated\/fonts\/(?:ubuntu-sans|jetbrains-mono)-latin-wght-normal\.woff2'\) format\('woff2'\)$/u,
    );
  }

  const palette = blocks.find(({ selector }) => selector === "[data-md-color-scheme='slate']");
  assert.ok(palette, "The palette must target Material's slate scheme.");
  assert.deepEqual(parseCssDeclarations(palette.declarations), expectedPaletteVariables);

  const visualSelectors = blocks
    .map(({ selector }) => selector)
    .filter((selector) => selector !== '@font-face' && selector !== "[data-md-color-scheme='slate']")
    .sort();
  assert.deepEqual(
    visualSelectors,
    approvedVisualSelectors,
    'Only the approved reference-derived content selectors may customize Material.',
  );
}

function assertPublicGuideConfiguration(configuration: MkDocsConfiguration): void {
  assert.equal(configuration.docs_dir, 'docs/user-guide', 'MkDocs must read only the public guide source.');
  assert.equal(configuration.site_dir, 'build/github-pages/docs', 'MkDocs must write only the Pages docs subpath.');
  assert.equal(configuration.site_url, canonicalUrl, 'MkDocs must use the canonical documentation URL.');
  assert.ok(Array.isArray(configuration.nav), 'MkDocs must use explicit navigation.');
  assert.deepEqual(configuration.nav, expectedNavigation);
}

async function listFiles(directory: string, relativeDirectory = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        return listFiles(path.join(directory, entry.name), relativePath);
      }
      return [relativePath];
    }),
  );

  return files.flat().sort();
}

async function readPublishedText(files: readonly string[]): Promise<Map<string, string>> {
  const textFiles = files.filter((file) => /\.(?:html|json|txt|xml)$/u.test(file));
  const contents = await Promise.all(
    textFiles.map(async (file) => [file, await readFile(path.join(outputDirectory, file), 'utf8')] as const),
  );

  return new Map(contents);
}

test('publishes every localized Material selector at its normalized documentation root', async () => {
  for (const locale of localeRegistry) {
    const localeDirectory = locale.routeSlug || '.';
    const output = await readFile(path.join(outputDirectory, localeDirectory, 'index.html'), 'utf8');

    assert.match(output, new RegExp(`<html lang=${locale.tag}(?=[\\s>])`, 'u'));
    assert.match(output, /<div class=md-select>/u, `${locale.tag} must render Material's language selector.`);
    for (const candidate of localeRegistry) {
      assert.ok(
        output.includes(`href=${getDocumentationRoute(candidate)} hreflang=${candidate.tag} class=md-select__link`),
        `${locale.tag} selector must link to ${candidate.tag}.`,
      );
    }

    if (locale.tag !== 'en') {
      assert.ok(
        output.includes('src=/gpt-voice/docs/assets/generated/images/app-main.png'),
        `${locale.tag} overview must reference the shared screenshot without an invalid locale prefix.`,
      );
      assert.ok(
        !output.includes('src=assets/generated/images/app-main.png'),
        `${locale.tag} overview must not reference a nonexistent locale-local screenshot.`,
      );
    }
  }
});

test('restricts MkDocs to the public guide source and Pages docs path', async () => {
  const configuration = parseMkDocsConfiguration(await readFile(configurationPath, 'utf8')) as MkDocsConfiguration;

  assertPublicGuideConfiguration(configuration);
  assert.throws(
    () => assertPublicGuideConfiguration({ ...configuration, docs_dir: 'docs' }),
    /MkDocs must read only the public guide source/u,
  );
});

test('uses Material navigation and approved reference-derived content styling', async () => {
  const [configurationSource, stylesheet] = await Promise.all([
    readFile(configurationPath, 'utf8'),
    readFile(path.join(projectRoot, 'docs', 'user-guide', 'assets', 'stylesheets', 'extra.css'), 'utf8'),
  ]);
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;

  assertMaterialThemeContract(configuration, stylesheet);
  assert.throws(
    () => assertMaterialThemeContract(configuration, `${stylesheet}\n.md-header { border-radius: 1rem; }\n`),
    /Only the approved reference-derived content selectors/u,
  );
});

test('publishes canonical overview metadata without internal engineering artifacts', async () => {
  const files = await listFiles(outputDirectory);
  const index = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');
  const install = await readFile(path.join(outputDirectory, 'install', 'index.html'), 'utf8');
  const gettingStarted = await readFile(path.join(outputDirectory, 'getting-started', 'index.html'), 'utf8');
  const transcription = await readFile(path.join(outputDirectory, 'guides', 'transcription', 'index.html'), 'utf8');
  const providers = await readFile(path.join(outputDirectory, 'guides', 'providers', 'index.html'), 'utf8');
  const textActions = await readFile(path.join(outputDirectory, 'guides', 'text-actions', 'index.html'), 'utf8');
  const historyAndTray = await readFile(path.join(outputDirectory, 'guides', 'history-and-tray', 'index.html'), 'utf8');
  const settingsOverview = await readFile(path.join(outputDirectory, 'settings', 'index.html'), 'utf8');
  const providerSettings = await readFile(path.join(outputDirectory, 'settings', 'providers', 'index.html'), 'utf8');
  const shortcutSettings = await readFile(path.join(outputDirectory, 'settings', 'shortcuts', 'index.html'), 'utf8');
  const prettifySettings = await readFile(path.join(outputDirectory, 'settings', 'prettify', 'index.html'), 'utf8');
  const browserSettings = await readFile(path.join(outputDirectory, 'settings', 'browser', 'index.html'), 'utf8');
  const networkSettings = await readFile(path.join(outputDirectory, 'settings', 'network', 'index.html'), 'utf8');
  const privacy = await readFile(path.join(outputDirectory, 'privacy', 'index.html'), 'utf8');
  const troubleshooting = await readFile(path.join(outputDirectory, 'troubleshooting', 'index.html'), 'utf8');
  const faq = await readFile(path.join(outputDirectory, 'faq', 'index.html'), 'utf8');

  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('install/index.html'));
  assert.ok(files.includes('getting-started/index.html'));
  assert.ok(files.includes('guides/transcription/index.html'));
  assert.ok(files.includes('guides/providers/index.html'));
  assert.ok(files.includes('guides/text-actions/index.html'));
  assert.ok(files.includes('guides/history-and-tray/index.html'));
  assert.ok(files.includes('settings/index.html'));
  assert.ok(files.includes('settings/providers/index.html'));
  assert.ok(files.includes('settings/shortcuts/index.html'));
  assert.ok(files.includes('settings/prettify/index.html'));
  assert.ok(files.includes('settings/browser/index.html'));
  assert.ok(files.includes('settings/network/index.html'));
  assert.ok(files.includes('privacy/index.html'));
  assert.ok(files.includes('troubleshooting/index.html'));
  assert.ok(files.includes('faq/index.html'));
  assert.ok(files.includes('search/search_index.json'));
  assert.equal(
    files.some((file) => file.includes('data/locales.json')),
    false,
  );
  assert.equal(
    files.some((file) => file.includes('data/translation-manifest.json')),
    false,
  );
  assert.ok(index.includes(`<link href=${canonicalUrl} rel=canonical>`));
  assert.ok(index.includes('<title>GPT-Voice Documentation</title>'));
  assert.ok(index.includes('assets/generated/icons/gpt-voice.png'));
  assert.ok(index.includes('assets/generated/icons/gpt-voice-wordmark.svg'));
  assert.ok(index.includes('GPT-Voice wordmark'));
  assert.ok(index.includes('class="grid cards"'));
  assert.ok(index.includes('Overview'));
  assert.ok(index.includes('href=getting-started/ class=md-button'));
  assert.ok(install.includes(`<link href=${canonicalUrl}install/ rel=canonical>`));
  assert.ok(install.includes('href=../getting-started/'));
  assert.ok(gettingStarted.includes(`<link href=${canonicalUrl}getting-started/ rel=canonical>`));
  assert.ok(gettingStarted.includes('Copied to clipboard'));
  assert.ok(transcription.includes(`<link href=${canonicalUrl}guides/transcription/ rel=canonical>`));
  for (const detail of [
    'Pause',
    'Resume',
    'Cancel',
    'Transcribing',
    'Copied to clipboard',
    'Retry a failed transcription',
    'kept only in the running application',
    'local transcription history',
    'Could not access microphone',
  ]) {
    assert.ok(transcription.includes(detail), `Transcription guide must cover ${detail}.`);
  }
  assert.ok(providers.includes(`<link href=${canonicalUrl}guides/providers/ rel=canonical>`));
  for (const detail of [
    'ChatGPT Web',
    'OpenAI API',
    'Clear authentication',
    'whisper-1',
    'Electron safe storage',
    'billing, quotas, usage limits',
  ]) {
    assert.ok(providers.includes(detail), `Provider guide must cover ${detail}.`);
  }
  assert.ok(textActions.includes(`<link href=${canonicalUrl}guides/text-actions/ rel=canonical>`));
  for (const detail of [
    'Google Translate',
    'English, Russian, Ukrainian, or Belarusian',
    'only one selected-text action at a time',
    '16,000 characters',
    'user-operated dependencies',
    'remote endpoint receives the selected text',
    'restores the clipboard value',
  ]) {
    assert.ok(textActions.includes(detail), `Text-actions guide must cover ${detail}.`);
  }
  assert.ok(historyAndTray.includes(`<link href=${canonicalUrl}guides/history-and-tray/ rel=canonical>`));
  for (const detail of [
    'stored locally with its request time, provider name, and text',
    'loads progressively as you scroll',
    "copies that entry's stored text to the system clipboard",
    'Clear history',
    'hides it instead of quitting',
    'Show GPT-Voice',
    'Settings',
    'History',
    'About',
    'Quit',
  ]) {
    assert.ok(historyAndTray.includes(detail), `History-and-tray guide must cover ${detail}.`);
  }
  assert.ok(settingsOverview.includes(`<link href=${canonicalUrl}settings/ rel=canonical>`));
  for (const detail of [
    'Shortcuts',
    'Prettify',
    'Browser',
    'Network',
    'Unsaved changes',
    'Save changes',
    'Keep editing',
    'Discard changes',
    'temporarily suspends global shortcuts',
  ]) {
    assert.ok(settingsOverview.includes(detail), `Settings overview must cover ${detail}.`);
  }
  assert.ok(providerSettings.includes(`<link href=${canonicalUrl}settings/providers/ rel=canonical>`));
  for (const detail of [
    'ChatGPT Web',
    'Clear session',
    'Electron safe storage',
    'whisper-1',
    'automatic detection',
    '0.05 steps',
    'blank save does not replace that stored key',
    'Clear API key',
  ]) {
    assert.ok(providerSettings.includes(detail), `Provider settings must cover ${detail}.`);
  }
  assert.ok(shortcutSettings.includes(`<link href=${canonicalUrl}settings/shortcuts/ rel=canonical>`));
  for (const detail of [
    'F9',
    'F10',
    'Escape',
    'F11',
    'F12',
    'Ctrl+F8',
    'temporarily suspends all of its global shortcuts',
    'F9 with Ctrl+F9',
    'Both are enabled by default',
    'Save changes',
  ]) {
    assert.ok(shortcutSettings.includes(detail), `Shortcut settings must cover ${detail}.`);
  }
  assert.ok(prettifySettings.includes(`<link href=${canonicalUrl}settings/prettify/ rel=canonical>`));
  for (const detail of [
    'Ollama',
    'vLLM',
    'http://127.0.0.1:11434',
    'http://127.0.0.1:8000/v1',
    'Electron safe storage',
    'Clear API key',
    'Load model',
    'Free model',
    'Loaded',
    'Not loaded',
    'VRAM',
    'non-loopback endpoint must use HTTPS',
    'decimal controls use 0.05 increments',
    'Top P accepts 0.05 through 1',
    'Repeat penalty accepts 0.8 through 1.5',
    'Top K accepts whole numbers from 1 through 200',
    'Maximum output tokens accepts whole numbers from 1 through 8192',
    '2147483647',
    '4,000 characters or fewer',
    'A blank prompt',
    'selected text and your configured Prettify prompt',
    'never returned in the settings view',
  ]) {
    assert.ok(prettifySettings.includes(detail), `Prettify settings must cover ${detail}.`);
  }
  assert.ok(browserSettings.includes(`<link href=${canonicalUrl}settings/browser/ rel=canonical>`));
  for (const detail of [
    'Humanize input',
    'Careful',
    'Background browser',
    'five-digit numeric seed',
    'en-US',
    'valid BCP 47 locale',
    'valid IANA timezone',
    'Proxy GeoIP controls locale and timezone',
    'not sent to a browser context while active proxy GeoIP owns them',
  ]) {
    assert.ok(browserSettings.includes(detail), `Browser settings must cover ${detail}.`);
  }
  assert.ok(networkSettings.includes(`<link href=${canonicalUrl}settings/network/ rel=canonical>`));
  for (const detail of [
    'Proxy enabled',
    'http://',
    'https://',
    'socks5://',
    'Put credentials in the separate fields instead',
    'Electron safe storage',
    'does not support a username or password for a SOCKS5 proxy',
    'does not pass SOCKS5 credentials',
    'Proxy GeoIP controls locale and timezone',
    'does not pass its separately saved locale or timezone',
  ]) {
    assert.ok(networkSettings.includes(detail), `Network settings must cover ${detail}.`);
  }
  assert.ok(privacy.includes(`<link href=${canonicalUrl}privacy/ rel=canonical>`));
  for (const detail of [
    'Google Translate',
    'gpt-voice.sqlite3',
    '20 results',
    '60 seconds',
    'Electron safe storage',
    'not a blanket encryption claim',
    '%APPDATA%\\GPT-Voice',
    '~/.config/GPT-Voice',
  ]) {
    assert.ok(privacy.includes(detail), `Privacy guide must cover ${detail}.`);
  }
  assert.ok(troubleshooting.includes(`<link href=${canonicalUrl}troubleshooting/ rel=canonical>`));
  for (const detail of [
    'Could not access microphone',
    'Clear session',
    'whisper-1',
    'Load model',
    'SOCKS5 credentials',
    'Background browser',
    'Translation and Prettify cannot run at the same time',
    '16,000 characters',
    'SHA-256',
  ]) {
    assert.ok(troubleshooting.includes(detail), `Troubleshooting guide must cover ${detail}.`);
  }
  assert.ok(faq.includes(`<link href=${canonicalUrl}faq/ rel=canonical>`));
  for (const detail of [
    'What leaves my computer?',
    'copied to the system clipboard',
    'ChatGPT Web',
    'macOS releases are paused',
    'SOCKS5 credentials are not supported',
    'troubleshooting',
  ]) {
    assert.ok(faq.includes(detail), `FAQ must route ${detail} to authoritative guidance.`);
  }

  for (const [file, contents] of await readPublishedText(files)) {
    for (const fragment of prohibitedPathFragments) {
      assert.equal(file.includes(fragment), false, `Published file must not expose ${fragment}: ${file}`);
      assert.equal(contents.includes(fragment), false, `Published content must not expose ${fragment}: ${file}`);
    }
  }
});

test('uses local product assets and an accessible overview screenshot', async () => {
  const configuration = parseMkDocsConfiguration(await readFile(configurationPath, 'utf8')) as MkDocsConfiguration;
  const theme = configuration.theme as Record<string, unknown>;
  const files = await listFiles(outputDirectory);
  const index = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');
  const stylesheetPath = path.join(outputDirectory, 'assets/stylesheets/extra.css');

  assert.equal(theme.font, false);
  assert.equal(configuration.repo_url, undefined);
  assert.equal(theme.logo, 'assets/generated/icons/gpt-voice.png');
  assert.equal(theme.favicon, 'assets/generated/icons/gpt-voice.png');
  assert.ok(Array.isArray(configuration.extra_css));
  assert.ok(configuration.extra_css.includes('assets/stylesheets/extra.css'));
  assert.ok(files.includes('assets/stylesheets/extra.css'));
  assert.ok(index.includes('assets/generated/images/app-main.avif'));
  assert.ok(index.includes('assets/generated/images/app-main.webp'));
  assert.ok(index.includes('assets/generated/images/app-main.png'));
  assert.ok(index.includes('width=920'));
  assert.ok(index.includes('height=840'));
  assert.ok(index.includes('GPT-Voice Command Dock showing ChatGPT Web connected'));
  assert.ok(index.includes('A ready-to-record Command Dock in GPT-Voice.'));
  assert.ok(index.includes('href=/gpt-voice/ title="GPT-Voice Documentation" class="md-header__button md-logo"'));
  assert.ok(index.includes('https://github.com/swimmwatch/gpt-voice'));
  assert.ok(index.includes('https://github.com/swimmwatch/gpt-voice/releases'));

  const stylesheet = await readFile(stylesheetPath, 'utf8');
  assert.ok(stylesheet.includes('--md-default-bg-color: #080b0e'));
  assert.ok(stylesheet.includes('--md-primary-fg-color: #2b60cb'));
  assert.ok(stylesheet.includes('ubuntu-sans-latin-wght-normal.woff2'));
  assert.ok(stylesheet.includes('jetbrains-mono-latin-wght-normal.woff2'));
  assert.ok(stylesheet.includes('noto-sans-sc-wght.css'));
  assert.ok(stylesheet.includes('noto-sans-jp-wght.css'));
  assert.ok(stylesheet.includes('noto-sans-devanagari-wght.css'));
  assert.equal(stylesheet.includes('.md-header'), false);
  assert.ok(stylesheet.includes('.md-typeset .md-button'));
  assert.ok(stylesheet.includes('.md-typeset .guide-wordmark'));
  assert.ok(stylesheet.includes('.md-typeset .product-screenshot img'));
  assert.ok(stylesheet.includes('.md-typeset .grid.cards > ul > li'));
  assert.ok(stylesheet.includes('border-radius'));
  assert.equal(stylesheet.includes('@media'), false);
  assert.equal(/url\(['"]?https?:/u.test(stylesheet), false);
});
