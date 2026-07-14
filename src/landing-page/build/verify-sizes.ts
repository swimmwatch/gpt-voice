import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const repositoryRoot = path.resolve(__dirname, '../../..');
const defaultBuildDirectory = path.join(repositoryRoot, 'build/github-pages');

export const landingSizeBudgets = {
  deferredPlyrGzip: 40 * 1024,
  htmlGzip: 55 * 1024,
  initialCssGzip: 35 * 1024,
  legacyInitialJavaScriptGzip: 145 * 1024,
  modernInitialJavaScriptGzip: 90 * 1024,
} as const;

export interface EncodedSize {
  brotli: number;
  gzip: number;
  raw: number;
}

export interface LandingSizeReport {
  deferredPlyr: EncodedSize;
  html: EncodedSize;
  initialCss: EncodedSize;
  legacyInitialJavaScript: EncodedSize;
  modernInitialJavaScript: EncodedSize;
  sourceMaps: readonly string[];
}

export async function measureLandingBuild(buildDirectory = defaultBuildDirectory): Promise<LandingSizeReport> {
  const indexPath = path.join(buildDirectory, 'index.html');
  const html = await readFile(indexPath);
  const source = html.toString('utf8');
  const scriptTags = getTags(source, 'script');
  const stylesheetTags = getTags(source, 'link').filter((tag) => getAttribute(tag, 'rel') === 'stylesheet');
  const modernScripts = scriptTags
    .filter((tag) => getAttribute(tag, 'type') === 'module')
    .map((tag) => getAttribute(tag, 'src'))
    .filter((value): value is string => value !== undefined);
  const legacyScripts = scriptTags
    .filter((tag) => tag.includes('nomodule'))
    .flatMap((tag) => [getAttribute(tag, 'src'), getAttribute(tag, 'data-src')])
    .filter((value): value is string => value !== undefined);
  const stylesheets = stylesheetTags
    .map((tag) => getAttribute(tag, 'href'))
    .filter((value): value is string => value !== undefined)
    .filter((asset) => !path.basename(asset).startsWith('plyr-'));
  const assetPaths = await listBuildFiles(buildDirectory);
  const deferredPlyr = assetPaths.filter((assetPath) => path.basename(assetPath).startsWith('plyr-'));

  return {
    deferredPlyr: await measurePlyrAssets(buildDirectory, deferredPlyr),
    html: measureBuffers([html]),
    initialCss: await measureAssets(buildDirectory, stylesheets),
    legacyInitialJavaScript: await measureAssets(buildDirectory, legacyScripts),
    modernInitialJavaScript: await measureAssets(buildDirectory, modernScripts),
    sourceMaps: assetPaths.filter((assetPath) => assetPath.endsWith('.map')),
  };
}

export function assertLandingSizeBudgets(report: LandingSizeReport): void {
  const failures = [
    assertBudget(
      'Modern initial JavaScript',
      report.modernInitialJavaScript.gzip,
      landingSizeBudgets.modernInitialJavaScriptGzip,
    ),
    assertBudget(
      'Legacy initial JavaScript',
      report.legacyInitialJavaScript.gzip,
      landingSizeBudgets.legacyInitialJavaScriptGzip,
    ),
    assertBudget('Initial CSS', report.initialCss.gzip, landingSizeBudgets.initialCssGzip),
    assertBudget('Deferred Plyr', report.deferredPlyr.gzip, landingSizeBudgets.deferredPlyrGzip),
    assertBudget('Minified HTML', report.html.gzip, landingSizeBudgets.htmlGzip),
    report.sourceMaps.length > 0 ? `Source maps must not be published: ${report.sourceMaps.join(', ')}` : undefined,
  ].filter((failure): failure is string => failure !== undefined);

  if (failures.length > 0) {
    throw new Error(`Landing size budget failures:\n- ${failures.join('\n- ')}`);
  }
}

export async function verifyLandingSizes(buildDirectory = defaultBuildDirectory): Promise<LandingSizeReport> {
  const report = await measureLandingBuild(buildDirectory);
  assertLandingSizeBudgets(report);

  return report;
}

export function formatLandingSizeReport(report: LandingSizeReport): string {
  return [
    'Landing size report:',
    formatMeasurement('Modern initial JavaScript', report.modernInitialJavaScript),
    formatMeasurement('Legacy initial JavaScript', report.legacyInitialJavaScript),
    formatMeasurement('Initial CSS', report.initialCss),
    formatMeasurement('Deferred Plyr', report.deferredPlyr),
    formatMeasurement('Minified HTML', report.html),
  ].join('\n');
}

function assertBudget(label: string, actual: number, limit: number): string | undefined {
  return actual > limit ? `${label}: ${formatBytes(actual)} gzip exceeds ${formatBytes(limit)}.` : undefined;
}

function formatBytes(value: number): string {
  return `${(value / 1024).toFixed(1)} KiB`;
}

function formatMeasurement(label: string, size: EncodedSize): string {
  return `- ${label}: ${formatBytes(size.raw)} raw, ${formatBytes(size.gzip)} gzip, ${formatBytes(size.brotli)} Brotli`;
}

function getTags(source: string, name: string): string[] {
  return source.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

function getAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));

  return match?.[1] ?? match?.[2] ?? match?.[3];
}

async function measureAssets(buildDirectory: string, urls: readonly string[]): Promise<EncodedSize> {
  const buffers = await Promise.all(urls.map((url) => readFile(getAssetPath(buildDirectory, url))));

  return measureBuffers(buffers);
}

async function measurePlyrAssets(buildDirectory: string, paths: readonly string[]): Promise<EncodedSize> {
  const [modernPaths, legacyPaths] = paths.reduce<[string[], string[]]>(
    ([modern, legacy], assetPath) => {
      (assetPath.includes('-legacy-') ? legacy : modern).push(assetPath);
      return [modern, legacy];
    },
    [[], []],
  );
  const [modern, legacy] = await Promise.all(
    [modernPaths, legacyPaths].map((group) =>
      Promise.all(group.map((assetPath) => readFile(path.join(buildDirectory, assetPath)))).then(measureBuffers),
    ),
  );

  return modern.gzip >= legacy.gzip ? modern : legacy;
}

function measureBuffers(buffers: readonly Buffer[]): EncodedSize {
  return buffers.reduce<EncodedSize>(
    (size, buffer) => ({
      brotli: size.brotli + brotliCompressSync(buffer).byteLength,
      gzip: size.gzip + gzipSync(buffer).byteLength,
      raw: size.raw + buffer.byteLength,
    }),
    { brotli: 0, gzip: 0, raw: 0 },
  );
}

function getAssetPath(buildDirectory: string, url: string): string {
  const assetPath = new URL(url, 'https://landing.invalid').pathname.replace(/^\/gpt-voice\//, '');
  const resolved = path.resolve(buildDirectory, assetPath);

  if (path.relative(buildDirectory, resolved).startsWith('..')) {
    throw new Error(`Landing asset URL resolves outside the build output: ${url}`);
  }

  return resolved;
}

async function listBuildFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(prefix, entry.name);
      return entry.isDirectory() ? listBuildFiles(path.join(directory, entry.name), relativePath) : [relativePath];
    }),
  );

  return paths.flat();
}

if (process.argv[1]?.endsWith(path.join('src', 'landing-page', 'build', 'verify-sizes.ts'))) {
  void measureLandingBuild()
    .then((report) => {
      process.stdout.write(`${formatLandingSizeReport(report)}\n`);
      assertLandingSizeBudgets(report);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
