import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedRelativeDirectory = 'docs/user-guide/assets/generated';
const approvedCapturePath = 'captures/app-main.png';
const expectedScreenshotDimensions = { height: 840, width: 920 };

const pinnedAssets = [
  {
    destination: 'fonts/ubuntu-sans-latin-wght-normal.woff2',
    sha256: '8f34f6aeb6d02bae33e841c33848bfa689216f4323149d8471dc19c55ec8f2be',
    source: 'node_modules/@fontsource-variable/ubuntu-sans/files/ubuntu-sans-latin-wght-normal.woff2',
  },
  {
    destination: 'fonts/jetbrains-mono-latin-wght-normal.woff2',
    sha256: '18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e',
    source: 'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  },
  {
    destination: 'icons/gpt-voice.png',
    sha256: 'e4dcafc38327b7f4bc8fc2b1c5700fe29f8e5b59d4f6d7b39dbc3d6826081c81',
    source: 'assets/icon.png',
  },
  {
    destination: 'icons/gpt-voice-wordmark.svg',
    sha256: 'fd4cb757c8d82a6336a8f577802775b93064751e1f18cce68240a63304db6812',
    source: 'assets/gpt-voice-wordmark.svg',
  },
];

const pinnedFontPackages = [
  {
    destination: 'fonts/noto-sans-sc',
    sha256: 'bb1eb50afcec4272a169c3885284263676dbb52c00f278e0e22feacaeca9c381',
    sourceDirectory: 'node_modules/@fontsource-variable/noto-sans-sc/files',
    stylesheetDestination: 'fonts/noto-sans-sc-wght.css',
    stylesheetSource: 'node_modules/@fontsource-variable/noto-sans-sc/wght.css',
  },
  {
    destination: 'fonts/noto-sans-jp',
    sha256: 'e7f0f6adb8015153bc32436c306ea5bc91f1f2fd879fb4818d57051c98cc9a66',
    sourceDirectory: 'node_modules/@fontsource-variable/noto-sans-jp/files',
    stylesheetDestination: 'fonts/noto-sans-jp-wght.css',
    stylesheetSource: 'node_modules/@fontsource-variable/noto-sans-jp/wght.css',
  },
  {
    destination: 'fonts/noto-sans-devanagari',
    sha256: '49cfdc618a3cf97cd2d5be75da5049cbfb716d64d2cbd4d1a815a4c61ea4a055',
    sourceDirectory: 'node_modules/@fontsource-variable/noto-sans-devanagari/files',
    stylesheetDestination: 'fonts/noto-sans-devanagari-wght.css',
    stylesheetSource: 'node_modules/@fontsource-variable/noto-sans-devanagari/wght.css',
  },
];

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

export function getSafeAssetPath(rootDirectory, relativePath) {
  const resolvedPath = path.resolve(rootDirectory, relativePath);
  const relative = path.relative(rootDirectory, resolvedPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Documentation asset must stay inside ${rootDirectory}: ${relativePath}`);
  }
  return resolvedPath;
}

export function getApprovedDocumentationCapture(captureManifest, capturePath) {
  if (capturePath !== approvedCapturePath) {
    throw new Error(`Documentation capture is not approved for public staging: ${capturePath}`);
  }

  const capture = captureManifest.files?.find((candidate) => candidate.path === capturePath);
  if (
    !capture ||
    typeof capture.sha256 !== 'string' ||
    typeof capture.approvedUse !== 'string' ||
    /do not copy|reference-only/iu.test(capture.approvedUse)
  ) {
    throw new Error(`Documentation capture is not approved for public staging: ${capturePath}`);
  }
  if (
    capture.physicalWidth !== expectedScreenshotDimensions.width ||
    capture.physicalHeight !== expectedScreenshotDimensions.height
  ) {
    throw new Error(`Documentation capture dimensions are not approved: ${capturePath}`);
  }

  return capture;
}

async function assertPinnedSource(rootDirectory, asset) {
  const sourcePath = getSafeAssetPath(rootDirectory, asset.source);
  const details = await lstat(sourcePath);
  if (!details.isFile() || details.isSymbolicLink()) {
    throw new Error(`Documentation asset source must be a regular file: ${asset.source}`);
  }
  if (sha256(await readFile(sourcePath)) !== asset.sha256) {
    throw new Error(`Documentation asset hash mismatch: ${asset.source}`);
  }
  return sourcePath;
}

async function assertPinnedFontPackage(rootDirectory, fontPackage) {
  const sourceDirectory = getSafeAssetPath(rootDirectory, fontPackage.sourceDirectory);
  const stylesheetPath = getSafeAssetPath(rootDirectory, fontPackage.stylesheetSource);
  const [directoryDetails, stylesheetDetails, files] = await Promise.all([
    lstat(sourceDirectory),
    lstat(stylesheetPath),
    listFiles(sourceDirectory),
  ]);
  if (!directoryDetails.isDirectory() || directoryDetails.isSymbolicLink()) {
    throw new Error(`Documentation font source must be a regular directory: ${fontPackage.sourceDirectory}`);
  }
  if (!stylesheetDetails.isFile() || stylesheetDetails.isSymbolicLink()) {
    throw new Error(`Documentation font stylesheet must be a regular file: ${fontPackage.stylesheetSource}`);
  }
  if (files.length === 0 || !files.every((file) => /^[-a-z0-9]+\.woff2$/u.test(file))) {
    throw new Error(`Documentation font package contains unsupported files: ${fontPackage.sourceDirectory}`);
  }

  const hash = createHash('sha256');
  hash.update('wght.css\0');
  hash.update(await readFile(stylesheetPath));
  const fontFiles = await Promise.all(
    files.map(async (file) => {
      const sourcePath = getSafeAssetPath(sourceDirectory, file);
      const details = await lstat(sourcePath);
      if (!details.isFile() || details.isSymbolicLink()) {
        throw new Error(`Documentation font source must be a regular file: ${fontPackage.sourceDirectory}/${file}`);
      }
      return { contents: await readFile(sourcePath), file, sourcePath };
    }),
  );
  for (const fontFile of fontFiles) {
    hash.update(`files/${fontFile.file}\0`);
    hash.update(fontFile.contents);
  }
  if (hash.digest('hex') !== fontPackage.sha256) {
    throw new Error(`Documentation font package hash mismatch: ${fontPackage.sourceDirectory}`);
  }
  return { ...fontPackage, fontFiles, stylesheetPath };
}

async function collectApprovedSources(rootDirectory) {
  const manifestPath = getSafeAssetPath(
    rootDirectory,
    'docs/specs/github-pages-landing-page/assets/capture-manifest.json',
  );
  const captureRoot = getSafeAssetPath(rootDirectory, 'docs/specs/github-pages-landing-page/assets');
  const captureManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const capture = getApprovedDocumentationCapture(captureManifest, approvedCapturePath);
  const screenshotPath = getSafeAssetPath(captureRoot, capture.path);
  const screenshotDetails = await lstat(screenshotPath);

  if (!screenshotDetails.isFile() || screenshotDetails.isSymbolicLink()) {
    throw new Error(`Documentation capture source must be a regular file: ${capture.path}`);
  }
  if (sha256(await readFile(screenshotPath)) !== capture.sha256) {
    throw new Error(`Documentation asset hash mismatch: ${capture.path}`);
  }

  const metadata = await sharp(screenshotPath).metadata();
  if (
    metadata.width !== expectedScreenshotDimensions.width ||
    metadata.height !== expectedScreenshotDimensions.height
  ) {
    throw new Error(`Documentation capture dimensions are not approved: ${capture.path}`);
  }

  const [sources, fontPackages] = await Promise.all([
    Promise.all(pinnedAssets.map((asset) => assertPinnedSource(rootDirectory, asset))),
    Promise.all(pinnedFontPackages.map((fontPackage) => assertPinnedFontPackage(rootDirectory, fontPackage))),
  ]);
  return { capture, fontPackages, screenshotPath, sources };
}

async function copyAsset(sourcePath, destinationPath) {
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
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

function getFontPackageDestinations(fontPackages) {
  return fontPackages.flatMap((fontPackage) => [
    fontPackage.stylesheetDestination,
    ...fontPackage.fontFiles.map((fontFile) => path.join(fontPackage.destination, fontFile.file)),
  ]);
}

async function copyFontPackage(fontPackage, stagingDirectory) {
  await Promise.all(
    fontPackage.fontFiles.map((fontFile) =>
      copyAsset(fontFile.sourcePath, path.join(stagingDirectory, fontPackage.destination, fontFile.file)),
    ),
  );
  const stylesheet = await readFile(fontPackage.stylesheetPath, 'utf8');
  const stagedStylesheet = stylesheet.replaceAll('./files/', `./${path.basename(fontPackage.destination)}/`);
  if (stagedStylesheet === stylesheet || stagedStylesheet.includes('://') || stagedStylesheet.includes('//')) {
    throw new Error(`Documentation font stylesheet contains unsupported sources: ${fontPackage.stylesheetSource}`);
  }
  await writeFile(path.join(stagingDirectory, fontPackage.stylesheetDestination), stagedStylesheet, 'utf8');
}

async function createAssetManifest(stagingDirectory, capture, fontPackageDestinations) {
  const files = [
    ...pinnedAssets.map((asset) => asset.destination),
    ...fontPackageDestinations,
    'images/app-main.png',
    'images/app-main.webp',
    'images/app-main.avif',
  ];
  const fileHashes = await Promise.all(
    files.map(async (file) => [file, sha256(await readFile(path.join(stagingDirectory, file)))]),
  );

  return {
    files: Object.fromEntries(fileHashes),
    schemaVersion: 1,
    screenshot: {
      height: capture.physicalHeight,
      sha256: capture.sha256,
      source: capture.path,
      width: capture.physicalWidth,
    },
  };
}

async function assertStagedAssetSet(stagingDirectory, fontPackageDestinations) {
  const expectedFiles = [
    'asset-manifest.json',
    ...pinnedAssets.map((asset) => asset.destination),
    ...fontPackageDestinations,
    'images/app-main.png',
    'images/app-main.webp',
    'images/app-main.avif',
  ].sort();
  const actualFiles = await listFiles(stagingDirectory);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`Documentation staging contains unapproved assets: ${actualFiles.join(', ')}`);
  }
}

export async function syncDocumentationAssets({ destinationDirectory, rootDirectory } = {}) {
  const root = rootDirectory ?? repositoryRoot;
  const destination = destinationDirectory ?? getSafeAssetPath(root, generatedRelativeDirectory);
  const staging = `${destination}.staging`;
  const { capture, fontPackages, screenshotPath, sources } = await collectApprovedSources(root);
  const fontPackageDestinations = getFontPackageDestinations(fontPackages);

  await rm(staging, { force: true, recursive: true });
  await mkdir(staging, { recursive: true });
  try {
    await Promise.all(
      pinnedAssets.map((asset, index) => copyAsset(sources[index], path.join(staging, asset.destination))),
    );
    await Promise.all(fontPackages.map((fontPackage) => copyFontPackage(fontPackage, staging)));
    await copyAsset(screenshotPath, path.join(staging, 'images/app-main.png'));
    await Promise.all([
      sharp(screenshotPath).webp({ quality: 90 }).toFile(path.join(staging, 'images/app-main.webp')),
      sharp(screenshotPath).avif({ quality: 65 }).toFile(path.join(staging, 'images/app-main.avif')),
    ]);
    await writeFile(
      path.join(staging, 'asset-manifest.json'),
      `${JSON.stringify(await createAssetManifest(staging, capture, fontPackageDestinations), null, 2)}\n`,
      'utf8',
    );
    await assertStagedAssetSet(staging, fontPackageDestinations);
    await mkdir(path.dirname(destination), { recursive: true });
    await rm(destination, { force: true, recursive: true });
    await rename(staging, destination);
  } catch (error) {
    await rm(staging, { force: true, recursive: true });
    throw error;
  }
}

if (process.argv[1]?.endsWith(path.join('scripts', 'sync-docs-assets.mjs'))) {
  void syncDocumentationAssets().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
