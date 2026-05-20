import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseTag = resolveReleaseTag();
const releaseVersion = releaseTag.replace(/^v/i, '');
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (!semverPattern.test(releaseVersion)) {
  throw new Error(`Release tag must be a valid semver tag such as v1.2.3. Received: ${releaseTag || '<empty>'}`);
}

function resolveReleaseTag() {
  const explicitTag =
    process.env.RELEASE_TAG || process.env.WORKFLOW_DISPATCH_RELEASE_TAG || process.env.INPUT_RELEASE_TAG || process.argv[2] || '';

  if (explicitTag) {
    return explicitTag;
  }

  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }

  return '';
}

async function updateJsonFile(fileName, update) {
  const filePath = path.join(rootDir, fileName);
  const json = JSON.parse(await readFile(filePath, 'utf-8'));
  update(json);
  await writeFile(filePath, `${JSON.stringify(json, null, 2)}\n`, 'utf-8');
}

async function exportGithubEnv(values) {
  if (!process.env.GITHUB_ENV) {
    return;
  }

  const lines = Object.entries(values).map(([name, value]) => `${name}=${value}`);
  await appendFile(process.env.GITHUB_ENV, `${lines.join('\n')}\n`, 'utf-8');
}

await updateJsonFile('package.json', (packageJson) => {
  packageJson.version = releaseVersion;
});

await updateJsonFile('package-lock.json', (packageLock) => {
  packageLock.version = releaseVersion;
  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = releaseVersion;
  }
});

await exportGithubEnv({
  RELEASE_TAG: releaseTag,
  RELEASE_VERSION: releaseVersion,
});

console.log(`Applied release version ${releaseVersion} from tag ${releaseTag}`);
