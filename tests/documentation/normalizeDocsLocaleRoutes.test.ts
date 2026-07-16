import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

type LocaleRouteModule = {
  normalizeDocumentationLocaleRoutes: (options: { siteDirectory: string }) => Promise<void>;
};

const projectRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(projectRoot, 'scripts', 'normalize-docs-locale-routes.mjs');

test('normalizes only MkDocs locale path segments after the static build', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-doc-locale-routes-'));
  const importedModule: unknown = await import(pathToFileURL(scriptPath).href);
  assert.ok(
    typeof importedModule === 'object' &&
      importedModule !== null &&
      typeof (importedModule as Partial<LocaleRouteModule>).normalizeDocumentationLocaleRoutes === 'function',
  );
  const localeRoutes = importedModule as LocaleRouteModule;

  try {
    await Promise.all([
      mkdir(path.join(outputDirectory, 'pt-BR'), { recursive: true }),
      mkdir(path.join(outputDirectory, 'zh-CN'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(
        path.join(outputDirectory, 'pt-BR', 'index.html'),
        '<html lang=pt><link hreflang="pt-BR" href="https://example.test/docs/pt-BR/"><a href="../zh-CN/">next</a></html>',
      ),
      writeFile(
        path.join(outputDirectory, 'zh-CN', 'index.html'),
        '<html lang="zh"><link hreflang="zh-CN" href="https://example.test/docs/zh-CN/"></html>',
      ),
      writeFile(
        path.join(outputDirectory, 'sitemap.xml'),
        '<loc>https://example.test/docs/pt-BR/</loc><loc>https://example.test/docs/zh-CN/</loc>',
      ),
    ]);

    await localeRoutes.normalizeDocumentationLocaleRoutes({ siteDirectory: outputDirectory });

    const index = await readFile(path.join(outputDirectory, 'pt-br', 'index.html'), 'utf8');
    const chineseIndex = await readFile(path.join(outputDirectory, 'zh-cn', 'index.html'), 'utf8');
    const sitemap = await readFile(path.join(outputDirectory, 'sitemap.xml'), 'utf8');
    assert.match(index, /lang=pt-BR/u);
    assert.match(index, /hreflang="pt-BR"/u);
    assert.match(index, /docs\/pt-br\//u);
    assert.match(index, /\.\.\/zh-cn\//u);
    assert.match(chineseIndex, /lang="zh-CN"/u);
    assert.match(sitemap, /docs\/pt-br\//u);
    assert.match(sitemap, /docs\/zh-cn\//u);
    await assert.rejects(readFile(path.join(outputDirectory, 'pt-BR', 'index.html'), 'utf8'));
    await assert.rejects(readFile(path.join(outputDirectory, 'zh-CN', 'index.html'), 'utf8'));
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
