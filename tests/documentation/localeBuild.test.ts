import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { stringify } from 'yaml';
import { parseMkDocsConfiguration } from '../../scripts/mkdocs-configuration.mjs';

type LocaleMapEntry = {
  mkdocsLocale: string;
  routeSlug: string;
  sourceSuffix: string;
  tag: string;
};

type LocaleMap = {
  locales: LocaleMapEntry[];
};

type LocaleRouteModule = {
  normalizeDocumentationLocaleRoutes: (options: { siteDirectory: string }) => Promise<void>;
};

type MkDocsConfiguration = {
  nav: unknown;
  plugins: unknown[];
  theme: unknown;
};

const executeFile = promisify(execFile);
const projectRoot = process.cwd();
const configurationPath = path.join(projectRoot, 'mkdocs.yml');
const localeMapPath = path.join(projectRoot, 'docs', 'user-guide', 'data', 'locales.json');
const mkdocsPath = path.join(projectRoot, '.venv-docs', 'bin', 'mkdocs');
const normalizerPath = path.join(projectRoot, 'scripts', 'normalize-docs-locale-routes.mjs');
const canonicalUrl = 'https://example.test/gpt-voice/docs/';
const sourcePages = [
  'index.md',
  'install.md',
  'getting-started.md',
  'guides/transcription.md',
  'guides/providers.md',
  'guides/text-actions.md',
  'guides/history-and-tray.md',
  'settings/index.md',
  'settings/providers.md',
  'settings/shortcuts.md',
  'settings/prettify.md',
  'settings/browser.md',
  'settings/network.md',
  'privacy.md',
  'troubleshooting.md',
  'faq.md',
];

function getI18nPlugin(configuration: MkDocsConfiguration): Record<string, unknown> {
  const plugin = configuration.plugins.find(
    (candidate): candidate is { i18n: Record<string, unknown> } =>
      typeof candidate === 'object' && candidate !== null && 'i18n' in candidate,
  );
  assert.ok(plugin, 'MkDocs must configure mkdocs-static-i18n.');
  return plugin.i18n;
}

function sourcePageName(page: string, locale: LocaleMapEntry): string {
  return locale.sourceSuffix ? page.replace(/\.md$/u, locale.sourceSuffix) : page;
}

test('builds complete suffix fixtures at every static guide root without fallback', async () => {
  const [configurationSource, localeMapSource, importedModule] = await Promise.all([
    readFile(configurationPath, 'utf8'),
    readFile(localeMapPath, 'utf8'),
    import(pathToFileURL(normalizerPath).href),
  ]);
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;
  const localeMap = JSON.parse(localeMapSource) as LocaleMap;
  assert.ok(
    typeof importedModule.normalizeDocumentationLocaleRoutes === 'function',
    'Locale route normalizer must be exported.',
  );
  const localeRoutes = importedModule as LocaleRouteModule;
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-doc-locale-build-'));
  const fixtureDocs = path.join(fixtureRoot, 'docs');
  const fixtureSite = path.join(fixtureRoot, 'site');
  const fixtureConfigPath = path.join(fixtureRoot, 'mkdocs.yml');

  try {
    await mkdir(fixtureDocs, { recursive: true });
    await Promise.all(
      localeMap.locales.flatMap((locale) =>
        sourcePages.map(async (page) => {
          const fixturePage = path.join(fixtureDocs, sourcePageName(page, locale));
          await mkdir(path.dirname(fixturePage), { recursive: true });
          await writeFile(fixturePage, `# Fixture ${locale.tag}\n\nThis is the ${locale.tag} fixture.\n`);
        }),
      ),
    );

    const i18n = { ...getI18nPlugin(configuration) };
    delete i18n.build_only_locale;
    const fixtureConfig = {
      docs_dir: fixtureDocs,
      nav: configuration.nav,
      plugins: [{ i18n }],
      site_dir: fixtureSite,
      site_name: 'Locale fixture',
      site_url: canonicalUrl,
      theme: {
        custom_dir: path.join(projectRoot, 'docs', 'mkdocs-overrides'),
        language: 'en',
        name: 'material',
      },
    };
    await writeFile(fixtureConfigPath, stringify(fixtureConfig), 'utf8');
    await executeFile(mkdocsPath, ['build', '--strict', '--config-file', fixtureConfigPath], { cwd: projectRoot });
    await localeRoutes.normalizeDocumentationLocaleRoutes({ siteDirectory: fixtureSite });
    const sitemap = await readFile(path.join(fixtureSite, 'sitemap.xml'), 'utf8');

    for (const locale of localeMap.locales) {
      const localeDirectory = locale.routeSlug || '.';
      const outputPath = path.join(fixtureSite, localeDirectory, 'index.html');
      const output = await readFile(outputPath, 'utf8');
      const canonicalPath = locale.routeSlug ? `${locale.routeSlug}/` : '';

      assert.ok(output.includes(`Fixture ${locale.tag}`));
      assert.ok(output.includes(`${canonicalUrl}${canonicalPath}`));
      assert.ok(
        sitemap.includes(`${canonicalUrl}${canonicalPath}`),
        `Documentation sitemap must include the ${locale.tag} guide root.`,
      );
    }

    await assert.rejects(readFile(path.join(fixtureSite, 'pt-BR', 'index.html'), 'utf8'));
    await assert.rejects(readFile(path.join(fixtureSite, 'zh-CN', 'index.html'), 'utf8'));
  } finally {
    await rm(fixtureRoot, { force: true, recursive: true });
  }
});
