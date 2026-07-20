import { access, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesDirectory = path.join(rootDirectory, 'build', 'github-pages');
const siteUrl = 'https://swimmwatch.github.io/gpt-voice';
const localeSlugs = ['', 'ru', 'be', 'uk', 'es', 'pt-br', 'zh-cn', 'ja', 'de', 'fr', 'hi'];

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function run(command, args, environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDirectory,
      env: { ...process.env, ...environment },
      stdio: 'inherit',
      windowsHide: true,
    });

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`));
      }
    });
  });
}

function landingUrl(localeSlug) {
  return localeSlug ? `${siteUrl}/${localeSlug}/` : `${siteUrl}/`;
}

function sitemapEntry(url) {
  return `  <url><loc>${url}</loc></url>`;
}

function hasCanonicalHref(html, href) {
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`\\bhref\\s*=\\s*(?:"${escapedHref}"|'${escapedHref}'|${escapedHref}(?=[\\s>]))`, 'u').test(html);
}

export async function writePagesMetadata(outputDirectory = pagesDirectory) {
  const landingSitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${localeSlugs
    .map((localeSlug) => sitemapEntry(landingUrl(localeSlug)))
    .join('\n')}\n</urlset>\n`;
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${siteUrl}/landing-sitemap.xml</loc></sitemap>\n  <sitemap><loc>${siteUrl}/docs/sitemap.xml</loc></sitemap>\n</sitemapindex>\n`;
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\nSitemap: ${siteUrl}/docs/sitemap.xml\n`;

  await Promise.all([
    writeFile(path.join(outputDirectory, 'landing-sitemap.xml'), landingSitemap, 'utf8'),
    writeFile(path.join(outputDirectory, 'sitemap.xml'), sitemapIndex, 'utf8'),
    writeFile(path.join(outputDirectory, 'robots.txt'), robots, 'utf8'),
  ]);
}

async function requireFile(outputDirectory, filename) {
  try {
    await access(path.join(outputDirectory, filename));
  } catch {
    throw new Error(`Pages artifact is missing ${filename}.`);
  }
}

export async function verifyPagesArtifact(outputDirectory = pagesDirectory) {
  await Promise.all([
    requireFile(outputDirectory, 'index.html'),
    requireFile(outputDirectory, 'docs/index.html'),
    requireFile(outputDirectory, 'docs/sitemap.xml'),
    requireFile(outputDirectory, 'landing-sitemap.xml'),
    requireFile(outputDirectory, 'sitemap.xml'),
    requireFile(outputDirectory, 'robots.txt'),
    ...localeSlugs.flatMap((localeSlug) => [
      requireFile(outputDirectory, path.join(localeSlug, 'index.html')),
      requireFile(outputDirectory, path.join('docs', localeSlug, 'index.html')),
    ]),
  ]);

  const [landing, documentation, robots, sitemap] = await Promise.all([
    readFile(path.join(outputDirectory, 'index.html'), 'utf8'),
    readFile(path.join(outputDirectory, 'docs', 'index.html'), 'utf8'),
    readFile(path.join(outputDirectory, 'robots.txt'), 'utf8'),
    readFile(path.join(outputDirectory, 'sitemap.xml'), 'utf8'),
  ]);

  if (!hasCanonicalHref(landing, '/gpt-voice/docs/')) {
    throw new Error('The landing page does not link to the canonical documentation root.');
  }
  if (!hasCanonicalHref(documentation, '/gpt-voice/')) {
    throw new Error('The documentation root does not link back to the canonical landing root.');
  }
  if (!robots.includes(`${siteUrl}/docs/sitemap.xml`) || !sitemap.includes(`${siteUrl}/docs/sitemap.xml`)) {
    throw new Error('Crawl metadata does not reference the canonical MkDocs sitemap.');
  }
}

export async function buildPages() {
  await rm(pagesDirectory, { force: true, recursive: true });
  await run(npmCommand(), ['run', 'landing:build'], { PAGES_BUILD: '1' });
  await run(npmCommand(), ['run', 'docs:build']);
  await writePagesMetadata();
  await verifyPagesArtifact();
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  buildPages().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
