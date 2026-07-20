import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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

function localizedPath(source: string): string {
  return source.replace(/\.md$/u, '.ru.md');
}

async function createFixture({
  buildOnlyEnglish = false,
  status = 'approved',
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

  await writeFile(
    manifestPath,
    JSON.stringify({
      locales: [
        {
          status,
          tag: 'ru',
        },
      ],
      approval: {
        approvedAt: '2026-07-16',
        scope: 'fixture localized guide source set',
        type: 'project-owner',
      },
      schemaVersion: 2,
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

test('accepts the current project-owner-approved publication set', async () => {
  const importedModule = (await import(pathToFileURL(scriptPath).href)) as TranslationManifestModule;
  await importedModule.validateDocumentationTranslations();
});

test('accepts complete approved locales and rejects missing translated sources', async () => {
  await withFixture({}, async (fixture, module) => {
    await module.validateDocumentationTranslations(fixture);
    await rm(path.join(fixture.docsDirectory, 'install.ru.md'));
    await assert.rejects(module.validateDocumentationTranslations(fixture), /missing source page: install\.ru\.md/u);
  });
});

test('rejects publication gates other than project-owner approval', async () => {
  await withFixture({ buildOnlyEnglish: true }, async (fixture, module) => {
    await assert.rejects(
      module.validateDocumentationTranslations(fixture),
      /MkDocs must publish every approved locale/u,
    );
  });
  await withFixture({ status: 'blocked' }, async (fixture, module) => {
    await assert.rejects(module.validateDocumentationTranslations(fixture), /ru must be approved for publication/u);
  });
});
