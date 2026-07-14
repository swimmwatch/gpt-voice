import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = path.resolve(__dirname, '../../..');
const defaultOutputDirectory = path.join(repositoryRoot, 'build/github-pages');
const basePath = '/gpt-voice/';

export async function verifyBrowserSupport(outputDirectory = defaultOutputDirectory): Promise<void> {
  const document = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');
  const scripts = getTags(document, 'script');
  const modernScripts = scripts.filter((script) => getAttribute(script, 'type') === 'module');
  const legacyPolyfill = scripts.find((script) => getAttribute(script, 'id') === 'vite-legacy-polyfill');
  const legacyEntry = scripts.find((script) => getAttribute(script, 'id') === 'vite-legacy-entry');

  if (modernScripts.length === 0) {
    throw new Error('Production output is missing a module browser entry');
  }
  if (!legacyPolyfill || !legacyEntry || !legacyPolyfill.includes('nomodule') || !legacyEntry.includes('nomodule')) {
    throw new Error('Production output is missing the nomodule legacy fallback');
  }

  const modernUrls = modernScripts
    .map((script) => getAttribute(script, 'src'))
    .filter((url): url is string => url !== undefined);
  const legacyUrls = [getAttribute(legacyPolyfill, 'src'), getAttribute(legacyEntry, 'data-src')].filter(
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
  for (const tag of getTags(document, 'script')) {
    addUrl(urls, getAttribute(tag, 'src'));
    addUrl(urls, getAttribute(tag, 'data-src'));
  }
  for (const tag of getTags(document, 'link')) {
    if (getAttribute(tag, 'rel') === 'stylesheet') {
      addUrl(urls, getAttribute(tag, 'href'));
    }
  }
  for (const tagName of ['img', 'source', 'track', 'video']) {
    for (const tag of getTags(document, tagName)) {
      addUrl(urls, getAttribute(tag, 'src'));
      addUrl(urls, getAttribute(tag, 'srcset'));
      addUrl(urls, getAttribute(tag, 'poster'));
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

function getTags(document: string, name: string): string[] {
  return document.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function getAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));

  return match?.[1] ?? match?.[2] ?? match?.[3];
}

if (process.argv[1]?.endsWith(path.join('src', 'landing-page', 'build', 'verify-browser-support.ts'))) {
  void verifyBrowserSupport().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
