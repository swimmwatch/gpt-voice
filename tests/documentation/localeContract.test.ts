import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseMkDocsConfiguration } from '../../scripts/mkdocs-configuration.mjs';
import { localeRegistry } from '../../src/landing-page/content/locale-registry';

type LocaleMapEntry = {
  mkdocsLocale: string;
  routeSlug: string;
  sourceSuffix: string;
  tag: string;
};

type LocaleMap = {
  defaultLocale: string;
  locales: LocaleMapEntry[];
  schemaVersion: number;
};

type MkDocsLanguage = {
  build?: unknown;
  default?: unknown;
  locale?: unknown;
  name?: unknown;
  nav_translations?: unknown;
};

type I18nPlugin = {
  build_only_locale?: unknown;
  docs_structure?: unknown;
  fallback_to_default?: unknown;
  languages?: unknown;
  reconfigure_material?: unknown;
  reconfigure_search?: unknown;
};

type MkDocsConfiguration = {
  exclude_docs?: unknown;
  plugins?: unknown;
  theme?: unknown;
};

const projectRoot = process.cwd();
const configurationPath = path.join(projectRoot, 'mkdocs.yml');
const localeMapPath = path.join(projectRoot, 'docs', 'user-guide', 'data', 'locales.json');
const expectedNavigationLabels = [
  'Overview',
  'Installation',
  'Windows',
  'Linux',
  'macOS',
  'Use GPT-Voice',
  'First use',
  'Record and transcribe',
  'Providers',
  'Text actions',
  'History and tray',
  'Settings',
  'Provider settings',
  'Shortcut settings',
  'Prettify settings',
  'Browser settings',
  'Network settings',
  'Support',
  'Privacy and data',
  'Troubleshooting',
  'FAQ',
];

function getI18nPlugin(configuration: MkDocsConfiguration): I18nPlugin {
  assert.ok(Array.isArray(configuration.plugins), 'MkDocs must configure plugins.');
  const plugin = configuration.plugins.find(
    (candidate): candidate is { i18n: I18nPlugin } =>
      typeof candidate === 'object' && candidate !== null && 'i18n' in candidate,
  );
  assert.ok(plugin, 'MkDocs must configure mkdocs-static-i18n.');
  return plugin.i18n;
}

function assertLocaleContract(localeMap: LocaleMap, i18n: I18nPlugin): void {
  assert.equal(localeMap.schemaVersion, 1);
  assert.equal(localeMap.defaultLocale, 'en');
  assert.equal(i18n.docs_structure, 'suffix');
  assert.equal(i18n.fallback_to_default, false);
  assert.equal(i18n.reconfigure_material, true);
  assert.equal(i18n.reconfigure_search, true);
  assert.equal(i18n.build_only_locale, undefined);
  assert.ok(Array.isArray(i18n.languages), 'MkDocs i18n must declare every locale.');

  const configuredLanguages = i18n.languages as MkDocsLanguage[];
  assert.equal(configuredLanguages.length, localeRegistry.length);
  assert.equal(localeMap.locales.length, localeRegistry.length);

  for (const landingLocale of localeRegistry) {
    const expectedLocale = landingLocale.tag;
    const mapping = localeMap.locales.find((candidate) => candidate.tag === landingLocale.tag);
    const language = configuredLanguages.find((candidate) => candidate.locale === expectedLocale);

    assert.ok(mapping, `Locale map must include ${landingLocale.tag}.`);
    assert.equal(mapping.mkdocsLocale, expectedLocale);
    assert.equal(mapping.routeSlug, landingLocale.routeSlug);
    assert.equal(mapping.sourceSuffix, expectedLocale === 'en' ? '' : `.${expectedLocale}.md`);
    assert.ok(language, `MkDocs must configure ${expectedLocale}.`);
    assert.equal(language.name, landingLocale.nativeLabel);
    assert.equal(language.build, true);
    assert.equal(language.default === true, landingLocale.tag === 'en');
    assert.ok(
      expectedNavigationLabels.every(
        (label) => typeof (language.nav_translations as Record<string, unknown>)[label] === 'string',
      ),
      `MkDocs navigation must be translated for ${landingLocale.tag}.`,
    );
  }

  assert.equal(
    configuredLanguages.some((language) => language.locale === 'zh'),
    false,
  );
  assert.equal(
    localeMap.locales.some((locale) => locale.routeSlug === 'pt-BR' || locale.routeSlug === 'zh-CN'),
    false,
  );
}

test('aligns the MkDocs locale configuration with the landing locale registry', async () => {
  const [configurationSource, localeMapSource] = await Promise.all([
    readFile(configurationPath, 'utf8'),
    readFile(localeMapPath, 'utf8'),
  ]);
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;
  const localeMap = JSON.parse(localeMapSource) as LocaleMap;

  assertLocaleContract(localeMap, getI18nPlugin(configuration));
  assert.match(String(configuration.exclude_docs), /data\//u);
  assert.equal(
    (configuration.theme as Record<string, unknown>).custom_dir,
    'docs/mkdocs-overrides',
    'Material needs the zh-CN language adapter because it only ships a zh partial.',
  );
});

test('rejects fallback publication and route-slug drift', async () => {
  const [configurationSource, localeMapSource] = await Promise.all([
    readFile(configurationPath, 'utf8'),
    readFile(localeMapPath, 'utf8'),
  ]);
  const configuration = parseMkDocsConfiguration(configurationSource) as MkDocsConfiguration;
  const localeMap = JSON.parse(localeMapSource) as LocaleMap;
  const i18n = getI18nPlugin(configuration);

  assert.throws(() => assertLocaleContract(localeMap, { ...i18n, fallback_to_default: true }));
  assert.throws(() =>
    assertLocaleContract(
      {
        ...localeMap,
        locales: localeMap.locales.map((locale) =>
          locale.tag === 'pt-BR' ? { ...locale, routeSlug: 'pt-BR' } : locale,
        ),
      },
      i18n,
    ),
  );
});
