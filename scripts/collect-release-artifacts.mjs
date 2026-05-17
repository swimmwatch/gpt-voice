import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf-8'));
const releaseDir = path.join(rootDir, 'release');
const platformArg = process.argv.find((arg) => arg.startsWith('--platform='));
const platform = platformArg?.slice('--platform='.length) || process.platform;
const outputDir = path.join(rootDir, 'release-artifacts', platform);

const productName = packageJson.build?.productName || packageJson.name;
const packageName = packageJson.name;

const platformMatchers = {
  linux: (fileName) =>
    (fileName.startsWith(`${productName}-`) && fileName.endsWith('.AppImage')) ||
    (fileName.startsWith(`${packageName}_`) && fileName.endsWith('.deb')),
  win32: (fileName) => fileName.startsWith(productName) && fileName.endsWith('.exe'),
  darwin: (fileName) => fileName.startsWith(productName) && fileName.endsWith('.dmg'),
};

const matchesPlatform = platformMatchers[platform];
if (!matchesPlatform) {
  throw new Error(`Unsupported release artifact platform: ${platform}`);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const releaseEntries = await readdir(releaseDir, { withFileTypes: true });
const artifactFiles = releaseEntries
  .filter((entry) => entry.isFile() && matchesPlatform(entry.name))
  .map((entry) => entry.name)
  .sort();

if (artifactFiles.length === 0) {
  throw new Error(`No ${platform} release artifacts found in ${releaseDir}`);
}

const checksumLines = [];
for (const fileName of artifactFiles) {
  const sourcePath = path.join(releaseDir, fileName);
  const targetPath = path.join(outputDir, fileName);
  const contents = await readFile(sourcePath);
  await copyFile(sourcePath, targetPath);
  checksumLines.push(`${sha256(contents)}  ${fileName}`);
}

await writeFile(path.join(outputDir, `SHA256SUMS-${platform}.txt`), `${checksumLines.join('\n')}\n`);

console.log(`Collected ${artifactFiles.length} ${platform} artifact(s):`);
for (const fileName of artifactFiles) {
  console.log(`- ${fileName}`);
}
