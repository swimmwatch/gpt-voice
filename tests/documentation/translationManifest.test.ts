import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

type TranslationManifestModule = {
  validateDocumentationTranslations: (options?: {
    configurationPath?: string;
    docsDirectory?: string;
    localeMapPath?: string;
    manifestPath?: string;
  }) => Promise<void>;
};

type Fixture = {
  configurationPath: string;
  docsDirectory: string;
  manifestPath: string;
  root: string;
};

const projectRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(projectRoot, 'scripts', 'validate-doc-translations.mjs');
const sourcePages = ['index.md', 'install.md', 'getting-started.md'];

function hash(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

function localizedPath(source: string): string {
  return source.replace(/\.md$/u, '.ru.md');
}

async function createFixture({
  buildOnlyEnglish = false,
  status = 'ready',
}: { buildOnlyEnglish?: boolean; status?: string } = {}): Promise<Fixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-doc-translations-'));
  const docsDirectory = path.join(root, 'docs');
  const dataDirectory = path.join(docsDirectory, 'data');
  const configurationPath = path.join(root, 'mkdocs.yml');
  const manifestPath = path.join(dataDirectory, 'translation-manifest.json');
  await mkdir(dataDirectory, { recursive: true });

  await Promise.all(
    sourcePages.flatMap((source) => [
      writeFile(path.join(docsDirectory, source), `# English ${source}\n`, 'utf8'),
      writeFile(path.join(docsDirectory, localizedPath(source)), `# Russian ${source}\n`, 'utf8'),
    ]),
  );
  await writeFile(
    configurationPath,
    `nav:\n  - Overview: index.md\n  - Install: install.md\n  - First use: getting-started.md\nplugins:\n  - i18n:\n      fallback_to_default: false\n${buildOnlyEnglish ? '      build_only_locale: en\n' : ''}`,
    'utf8',
  );
  await writeFile(
    path.join(dataDirectory, 'locales.json'),
    JSON.stringify({
      locales: [
        { tag: 'en', sourceSuffix: '' },
        { tag: 'ru', sourceSuffix: '.ru.md' },
      ],
    }),
    'utf8',
  );

  const pages = await Promise.all(
    sourcePages.map(async (source) => ({
      localized: localizedPath(source),
      localizedSha256: hash(await readFile(path.join(docsDirectory, localizedPath(source)), 'utf8')),
      source,
      sourceSha256: hash(await readFile(path.join(docsDirectory, source), 'utf8')),
    })),
  );
  await writeFile(
    manifestPath,
    JSON.stringify({
      locales: [
        {
          pages: status === 'ready' ? pages : [],
          status,
          tag: 'ru',
          ...(status === 'ready' ? { review: { reference: 'translation-review-ru', reviewedAt: '2026-07-15' } } : {}),
        },
      ],
      schemaVersion: 1,
      sourceLocale: 'en',
    }),
    'utf8',
  );
  return { configurationPath, docsDirectory, manifestPath, root };
}

async function withFixture(
  options: { buildOnlyEnglish?: boolean; status?: string },
  callback: (fixture: Fixture, module: TranslationManifestModule) => Promise<void>,
): Promise<void> {
  const fixture = await createFixture(options);
  const importedModule: unknown = await import(pathToFileURL(scriptPath).href);
  assert.ok(
    typeof importedModule === 'object' &&
      importedModule !== null &&
      typeof (importedModule as Partial<TranslationManifestModule>).validateDocumentationTranslations === 'function',
  );
  try {
    await callback(fixture, importedModule as TranslationManifestModule);
  } finally {
    await rm(fixture.root, { force: true, recursive: true });
  }
}

test('accepts the current English-only publication gate', async () => {
  const importedModule = (await import(pathToFileURL(scriptPath).href)) as TranslationManifestModule;
  await importedModule.validateDocumentationTranslations();
});

test('accepts a complete reviewed locale and rejects missing or stale translations', async () => {
  await withFixture({}, async (fixture, module) => {
    await module.validateDocumentationTranslations(fixture);
    await rm(path.join(fixture.docsDirectory, 'install.ru.md'));
    await assert.rejects(module.validateDocumentationTranslations(fixture), /missing source page: install\.ru\.md/u);
  });
  await withFixture({}, async (fixture, module) => {
    await writeFile(path.join(fixture.docsDirectory, 'index.md'), '# Changed English source\n', 'utf8');
    await assert.rejects(module.validateDocumentationTranslations(fixture), /stale source hash for index\.md/u);
  });
});

test('rejects wrong suffix paths and attempts to publish blocked translations', async () => {
  await withFixture({}, async (fixture, module) => {
    const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8')) as {
      locales: Array<{ pages: Array<{ localized: string }> }>;
    };
    manifest.locales[0].pages[0].localized = 'index.RU.md';
    await writeFile(fixture.manifestPath, JSON.stringify(manifest), 'utf8');
    await assert.rejects(module.validateDocumentationTranslations(fixture), /wrong localized path for index\.md/u);
  });
  await withFixture({ status: 'blocked' }, async (fixture, module) => {
    await assert.rejects(
      module.validateDocumentationTranslations(fixture),
      /ru is blocked but MkDocs would publish every locale/u,
    );
  });
});
