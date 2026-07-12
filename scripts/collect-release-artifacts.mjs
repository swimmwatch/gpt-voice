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
const packageVersion = packageJson.version;

const platformMatchers = {
  linux: (fileName) =>
    fileName === `${productName}-${packageVersion}.AppImage` ||
    fileName === `${packageName}_${packageVersion}_amd64.deb` ||
    fileName === `${packageName}-${packageVersion}.x86_64.rpm`,
  win32: (fileName) => fileName.startsWith(productName) && fileName.endsWith('.exe'),
  darwin: (fileName) => fileName.startsWith(productName) && fileName.endsWith('.dmg'),
};

const matchesPlatform = platformMatchers[platform];
if (!matchesPlatform) {
  throw new Error(`Unsupported release artifact platform: ${platform}`);
}

const requiredPlatformArtifacts = {
  linux: [
    `${productName}-${packageVersion}.AppImage`,
    `${packageName}_${packageVersion}_amd64.deb`,
    `${packageName}-${packageVersion}.x86_64.rpm`,
  ],
};
const measurementReports = {
  linux: ['size-linux-x64.json', 'startup-linux-x64.json'],
  win32: ['size-win32-x64.json', 'startup-win32-x64.json'],
};

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const releaseEntries = await readdir(releaseDir, { withFileTypes: true });
const releaseFileNames = releaseEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);
const requiredArtifacts = requiredPlatformArtifacts[platform];
const artifactFiles = requiredArtifacts
  ? requiredArtifacts
  : releaseFileNames.filter((fileName) => matchesPlatform(fileName)).sort();

if (requiredArtifacts) {
  const missingArtifacts = requiredArtifacts.filter((fileName) => !releaseFileNames.includes(fileName));
  if (missingArtifacts.length > 0) {
    throw new Error(`Missing ${platform} release artifact(s) in ${releaseDir}: ${missingArtifacts.join(', ')}`);
  }
}

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

for (const fileName of measurementReports[platform] || []) {
  await copyFile(path.join(rootDir, 'release-artifacts', fileName), path.join(outputDir, fileName));
}

await writeFile(path.join(outputDir, `SHA256SUMS-${platform}.txt`), `${checksumLines.join('\n')}\n`);

console.log(`Collected ${artifactFiles.length} ${platform} artifact(s):`);
for (const fileName of artifactFiles) {
  console.log(`- ${fileName}`);
}
