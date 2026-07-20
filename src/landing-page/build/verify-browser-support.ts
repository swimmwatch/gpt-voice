import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getHtmlAttribute, getHtmlTags } from './html.js';

const repositoryRoot = path.resolve(__dirname, '../../..');
const defaultOutputDirectory = path.join(repositoryRoot, 'build/github-pages');
const basePath = '/gpt-voice/';

export async function verifyBrowserSupport(outputDirectory = defaultOutputDirectory): Promise<void> {
  const document = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');
  const scripts = getHtmlTags(document, 'script');
  const modernScripts = scripts.filter((script) => getHtmlAttribute(script, 'type') === 'module');
  const legacyPolyfill = scripts.find((script) => getHtmlAttribute(script, 'id') === 'vite-legacy-polyfill');
  const legacyEntry = scripts.find((script) => getHtmlAttribute(script, 'id') === 'vite-legacy-entry');

  if (modernScripts.length === 0) {
    throw new Error('Production output is missing a module browser entry');
  }
  if (!legacyPolyfill || !legacyEntry || !legacyPolyfill.includes('nomodule') || !legacyEntry.includes('nomodule')) {
    throw new Error('Production output is missing the nomodule legacy fallback');
  }

  const modernUrls = modernScripts
    .map((script) => getHtmlAttribute(script, 'src'))
    .filter((url): url is string => url !== undefined);
  const legacyUrls = [getHtmlAttribute(legacyPolyfill, 'src'), getHtmlAttribute(legacyEntry, 'data-src')].filter(
    (url): url is string => url !== undefined,
  );
  if (modernUrls.length === 0 || legacyUrls.length !== 2) {
    throw new Error('Production output has incomplete modern or legacy browser entries');
  }
  if (modernUrls.some((url) => url.includes('legacy')) || legacyUrls.some((url) => !url.includes('legacy'))) {
    throw new Error('Modern and legacy browser entries are not isolated');
  }
  if (/plyr(?:-legacy)?-[\w-]+\.(?:css|js)/.test(document)) {
    throw new Error('Plyr must remain deferred and absent from initial HTML');
  }

  const runtimeUrls = getRuntimeUrls(document);
  await Promise.all(runtimeUrls.map((url) => assertLocalRuntimeAsset(outputDirectory, url)));
}

function getRuntimeUrls(document: string): string[] {
  const urls = new Set<string>();
  for (const tag of getHtmlTags(document, 'script')) {
    addUrl(urls, getHtmlAttribute(tag, 'src'));
    addUrl(urls, getHtmlAttribute(tag, 'data-src'));
  }
  for (const tag of getHtmlTags(document, 'link')) {
    if (getHtmlAttribute(tag, 'rel') === 'stylesheet') {
      addUrl(urls, getHtmlAttribute(tag, 'href'));
    }
  }
  for (const tagName of ['img', 'source', 'track', 'video']) {
    for (const tag of getHtmlTags(document, tagName)) {
      addUrl(urls, getHtmlAttribute(tag, 'src'));
      addUrl(urls, getHtmlAttribute(tag, 'srcset'));
      addUrl(urls, getHtmlAttribute(tag, 'poster'));
    }
  }

  return [...urls];
}

function addUrl(urls: Set<string>, url: string | undefined): void {
  if (url) {
    urls.add(url);
  }
}

async function assertLocalRuntimeAsset(outputDirectory: string, url: string): Promise<void> {
  if (!url.startsWith(basePath)) {
    throw new Error(`Runtime asset escapes the ${basePath} base path: ${url}`);
  }
  const relativePath = url.slice(basePath.length).split(/[?#]/, 1)[0];
  if (!relativePath) {
    throw new Error(`Runtime asset path is empty: ${url}`);
  }

  await access(path.join(outputDirectory, relativePath));
}

if (process.argv[1]?.endsWith(path.join('src', 'landing-page', 'build', 'verify-browser-support.ts'))) {
  void verifyBrowserSupport().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
