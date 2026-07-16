import { lstat, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeAliases = [
  ['pt-BR', 'pt-br'],
  ['zh-CN', 'zh-cn'],
];
const htmlLanguageAliases = [
  ['pt', 'pt-BR'],
  ['zh', 'zh-CN'],
];
const textExtensions = new Set(['.css', '.html', '.json', '.js', '.txt', '.xml']);

async function pathExists(targetPath) {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function listFiles(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      return entry.isDirectory() ? listFiles(path.join(directory, entry.name), relativePath) : [relativePath];
    }),
  );
  return files.flat().sort();
}

function normalizePathSegments(contents) {
  const normalizedPaths = routeAliases.reduce(
    (normalized, [source, destination]) => normalized.replaceAll(`${source}/`, `${destination}/`),
    contents,
  );
  return htmlLanguageAliases.reduce(
    (normalized, [source, destination]) =>
      normalized
        .replace(new RegExp(`(<html\\b[^>]*\\blang=)${source}(?=[\\s>])`, 'gu'), `$1${destination}`)
        .replace(new RegExp(`(<html\\b[^>]*\\blang=["'])${source}(?=["'])`, 'gu'), `$1${destination}`),
    normalizedPaths,
  );
}

export async function normalizeDocumentationLocaleRoutes({ siteDirectory } = {}) {
  const site = siteDirectory ?? path.join(repositoryRoot, 'build', 'github-pages', 'docs');
  const sourceDirectories = await Promise.all(
    routeAliases.map(async ([source, destination]) => {
      const sourcePath = path.join(site, source);
      const details = await pathExists(sourcePath);
      if (!details) {
        return undefined;
      }
      if (!details.isDirectory()) {
        throw new Error(`MkDocs locale output must be a directory: ${source}`);
      }

      const destinationPath = path.join(site, destination);
      if (await pathExists(destinationPath)) {
        throw new Error(`Normalized MkDocs locale output already exists: ${destination}`);
      }
      return { destination, destinationPath, source, sourcePath };
    }),
  );
  const directories = sourceDirectories.filter(Boolean);
  if (directories.length === 0) {
    return;
  }

  const files = await listFiles(site);
  await Promise.all(
    files
      .filter((file) => textExtensions.has(path.extname(file)))
      .map(async (file) => {
        const filePath = path.join(site, file);
        const contents = await readFile(filePath, 'utf8');
        const normalized = normalizePathSegments(contents);
        if (normalized !== contents) {
          await writeFile(filePath, normalized, 'utf8');
        }
      }),
  );
  await Promise.all(directories.map(({ sourcePath, destinationPath }) => rename(sourcePath, destinationPath)));
}

if (process.argv[1]?.endsWith(path.join('scripts', 'normalize-docs-locale-routes.mjs'))) {
  void normalizeDocumentationLocaleRoutes().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
