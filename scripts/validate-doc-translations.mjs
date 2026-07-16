import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMkDocsConfiguration } from './mkdocs-configuration.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assertManifest(condition, message) {
  if (!condition) {
    throw new Error(`Documentation translation manifest error: ${message}`);
  }
}

function getI18nConfiguration(configuration) {
  const plugin = configuration.plugins?.find(
    (candidate) => candidate && typeof candidate === 'object' && candidate.i18n,
  );
  assertManifest(plugin && typeof plugin.i18n === 'object', 'MkDocs must configure the i18n plugin.');
  return plugin.i18n;
}

function getNavigationSources(nav, sources = []) {
  for (const entry of nav) {
    if (typeof entry === 'string') {
      sources.push(entry);
      continue;
    }
    assertManifest(
      entry && typeof entry === 'object' && !Array.isArray(entry),
      'navigation entries must be named pages.',
    );
    for (const value of Object.values(entry)) {
      if (typeof value === 'string') {
        sources.push(value);
      } else {
        assertManifest(Array.isArray(value), 'navigation groups must contain pages.');
        getNavigationSources(value, sources);
      }
    }
  }
  return sources;
}

function localizedSourcePath(source, suffix) {
  return source.replace(/\.md$/u, suffix);
}

function getSafeSourcePath(directory, relativePath) {
  const resolvedPath = path.resolve(directory, relativePath);
  const relative = path.relative(directory, resolvedPath);
  assertManifest(
    relative && !relative.startsWith('..') && !path.isAbsolute(relative),
    `invalid source path: ${relativePath}`,
  );
  return resolvedPath;
}

async function assertSourceExists(directory, relativePath) {
  try {
    await readFile(getSafeSourcePath(directory, relativePath));
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      throw new Error(`Documentation translation manifest error: missing source page: ${relativePath}`, {
        cause: error,
      });
    }
    throw error;
  }
}

function assertApproval(approval) {
  assertManifest(approval && typeof approval === 'object', 'a project-owner approval record is required.');
  assertManifest(approval.type === 'project-owner', 'approval type must be project-owner.');
  assertManifest(/^\d{4}-\d{2}-\d{2}$/u.test(String(approval.approvedAt)), 'approval date is required.');
  assertManifest(typeof approval.scope === 'string' && approval.scope.length > 0, 'approval scope is required.');
}

async function assertApprovedLocale({ docsDirectory, expectedSources, locale, record }) {
  assertManifest(record.status === 'approved', `${locale.tag} must be approved for publication.`);
  for (const source of expectedSources) {
    const expectedLocalizedPath = localizedSourcePath(source, locale.sourceSuffix);
    await assertSourceExists(docsDirectory, expectedLocalizedPath);
  }
}

export async function validateDocumentationTranslations({
  configurationPath = path.join(repositoryRoot, 'mkdocs.yml'),
  docsDirectory = path.join(repositoryRoot, 'docs', 'user-guide'),
  localeMapPath = path.join(docsDirectory, 'data', 'locales.json'),
  manifestPath = path.join(docsDirectory, 'data', 'translation-manifest.json'),
} = {}) {
  const [configurationSource, localeMapSource, manifestSource] = await Promise.all([
    readFile(configurationPath, 'utf8'),
    readFile(localeMapPath, 'utf8'),
    readFile(manifestPath, 'utf8'),
  ]);
  const configuration = parseMkDocsConfiguration(configurationSource);
  const localeMap = JSON.parse(localeMapSource);
  const manifest = JSON.parse(manifestSource);
  const i18n = getI18nConfiguration(configuration);
  const expectedSources = getNavigationSources(configuration.nav);

  assertManifest(manifest.schemaVersion === 2 && manifest.sourceLocale === 'en', 'unsupported manifest schema.');
  assertApproval(manifest.approval);
  assertManifest(Array.isArray(localeMap.locales) && Array.isArray(manifest.locales), 'locale data must be arrays.');
  assertManifest(expectedSources.length > 0, 'navigation must include source pages.');
  assertManifest(i18n.build_only_locale === undefined, 'MkDocs must publish every approved locale.');

  const records = new Map();
  for (const record of manifest.locales) {
    assertManifest(
      record && typeof record.tag === 'string' && !records.has(record.tag),
      'locale records must be unique.',
    );
    records.set(record.tag, record);
  }

  const locales = localeMap.locales.filter((locale) => locale.tag !== 'en');
  for (const locale of locales) {
    const record = records.get(locale.tag);
    assertManifest(record, `missing ${locale.tag} locale record.`);
    await assertApprovedLocale({ docsDirectory, expectedSources, locale, record });
  }
  assertManifest(records.size === locales.length, 'manifest contains an unsupported locale.');
}

if (process.argv[1]?.endsWith(path.join('scripts', 'validate-doc-translations.mjs'))) {
  void validateDocumentationTranslations().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
