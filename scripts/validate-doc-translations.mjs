import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMkDocsConfiguration } from './mkdocs-configuration.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

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

async function readHash(directory, relativePath) {
  try {
    return sha256(await readFile(getSafeSourcePath(directory, relativePath)));
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      throw new Error(`Documentation translation manifest error: missing source page: ${relativePath}`, {
        cause: error,
      });
    }
    throw error;
  }
}

function assertReview(review, tag) {
  assertManifest(review && typeof review === 'object', `${tag} must include a non-personal review record.`);
  assertManifest(
    typeof review.reference === 'string' && review.reference.length > 0,
    `${tag} review reference is required.`,
  );
  assertManifest(/^\d{4}-\d{2}-\d{2}$/u.test(String(review.reviewedAt)), `${tag} review date is required.`);
}

async function assertReadyLocale({ docsDirectory, expectedSources, locale, record }) {
  assertReview(record.review, locale.tag);
  assertManifest(Array.isArray(record.pages), `${locale.tag} must declare translated pages.`);
  assertManifest(record.pages.length === expectedSources.length, `${locale.tag} must translate every navigation page.`);

  const pagesBySource = new Map();
  for (const page of record.pages) {
    assertManifest(page && typeof page === 'object', `${locale.tag} has an invalid page record.`);
    assertManifest(
      typeof page.source === 'string' && !pagesBySource.has(page.source),
      `${locale.tag} has duplicate pages.`,
    );
    pagesBySource.set(page.source, page);
  }

  for (const source of expectedSources) {
    const page = pagesBySource.get(source);
    const expectedLocalizedPath = localizedSourcePath(source, locale.sourceSuffix);
    assertManifest(page, `${locale.tag} is missing ${source}.`);
    assertManifest(
      page.localized === expectedLocalizedPath,
      `${locale.tag} has the wrong localized path for ${source}.`,
    );
    assertManifest(
      page.sourceSha256 === (await readHash(docsDirectory, source)),
      `${locale.tag} has a stale source hash for ${source}.`,
    );
    assertManifest(
      page.localizedSha256 === (await readHash(docsDirectory, page.localized)),
      `${locale.tag} has a stale localized hash for ${source}.`,
    );
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

  assertManifest(manifest.schemaVersion === 1 && manifest.sourceLocale === 'en', 'unsupported manifest schema.');
  assertManifest(Array.isArray(localeMap.locales) && Array.isArray(manifest.locales), 'locale data must be arrays.');
  assertManifest(expectedSources.length > 0, 'navigation must include source pages.');

  const records = new Map();
  for (const record of manifest.locales) {
    assertManifest(
      record && typeof record.tag === 'string' && !records.has(record.tag),
      'locale records must be unique.',
    );
    records.set(record.tag, record);
  }

  const locales = localeMap.locales.filter((locale) => locale.tag !== 'en');
  const publishAllLocales = i18n.build_only_locale !== 'en';
  for (const locale of locales) {
    const record = records.get(locale.tag);
    assertManifest(record, `missing ${locale.tag} locale record.`);
    assertManifest(record.status === 'blocked' || record.status === 'ready', `${locale.tag} has an invalid status.`);
    if (record.status === 'blocked') {
      assertManifest(
        Array.isArray(record.pages) && record.pages.length === 0,
        `${locale.tag} blocked records cannot publish pages.`,
      );
      assertManifest(!publishAllLocales, `${locale.tag} is blocked but MkDocs would publish every locale.`);
      continue;
    }
    await assertReadyLocale({ docsDirectory, expectedSources, locale, record });
  }
  assertManifest(records.size === locales.length, 'manifest contains an unsupported locale.');
}

if (process.argv[1]?.endsWith(path.join('scripts', 'validate-doc-translations.mjs'))) {
  void validateDocumentationTranslations().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
