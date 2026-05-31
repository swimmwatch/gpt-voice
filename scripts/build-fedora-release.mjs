import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const image = optionValue('image') || 'gpt-voice-fedora-release:local';
const mode = optionValue('mode') || 'release';
const releaseDate = optionValue('release-date') || process.env.PACKAGE_RELEASE_DATE || '';
const releaseTag = optionValue('release-tag') || process.env.RELEASE_TAG || process.env.WORKFLOW_DISPATCH_RELEASE_TAG || '';
const skipImageBuild = hasFlag('skip-image-build');
const pullBaseImage = hasFlag('pull');

if (!['release', 'smoke'].includes(mode)) {
  throw new Error(`Unsupported Fedora build mode: ${mode}`);
}

await Promise.all([
  mkdir(path.join(rootDir, '.cache', 'npm'), { recursive: true }),
  mkdir(path.join(rootDir, '.cache', 'electron'), { recursive: true }),
  mkdir(path.join(rootDir, '.cache', 'electron-builder'), { recursive: true }),
  mkdir(path.join(rootDir, '.cache', 'fedora-home'), { recursive: true }),
]);

if (!skipImageBuild) {
  const buildArgs = [
    'build',
    '--file',
    path.join(rootDir, 'build', 'fedora-release', 'Dockerfile'),
    '--tag',
    image,
  ];

  if (pullBaseImage) {
    buildArgs.push('--pull');
  }

  buildArgs.push(path.join(rootDir, 'build', 'fedora-release'));
  await run('docker', buildArgs, { env: { DOCKER_BUILDKIT: '1' } });
}

const containerArgs = [
  'run',
  '--rm',
  '--shm-size=1g',
  '--workdir',
  '/workspace',
  '--volume',
  `${rootDir}:/workspace`,
  '--env',
  'CI=true',
  '--env',
  'CLOAKBROWSER_AUTO_UPDATE=false',
  '--env',
  'HOME=/workspace/.cache/fedora-home',
  '--env',
  'NPM_CONFIG_CACHE=/workspace/.cache/npm',
  '--env',
  'ELECTRON_CACHE=/workspace/.cache/electron',
  '--env',
  'ELECTRON_BUILDER_CACHE=/workspace/.cache/electron-builder',
];

if (process.platform !== 'win32' && typeof process.getuid === 'function' && typeof process.getgid === 'function') {
  containerArgs.push('--user', `${process.getuid()}:${process.getgid()}`);
}

if (releaseDate) {
  containerArgs.push('--env', `PACKAGE_RELEASE_DATE=${releaseDate}`);
}
if (releaseTag) {
  containerArgs.push('--env', `RELEASE_TAG=${releaseTag}`);
}

containerArgs.push(image, `--mode=${mode}`);
if (releaseDate) {
  containerArgs.push(`--release-date=${releaseDate}`);
}
if (releaseTag) {
  containerArgs.push(`--release-tag=${releaseTag}`);
}

await run('docker', containerArgs);

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: 'inherit',
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`));
      }
    });
  });
}
