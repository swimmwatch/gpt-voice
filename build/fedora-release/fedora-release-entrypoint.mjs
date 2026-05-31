#!/usr/bin/env node

import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const workspace = process.env.GPT_VOICE_WORKSPACE || '/workspace';
const mode = optionValue('mode') || 'release';
const releaseDate = optionValue('release-date') || process.env.PACKAGE_RELEASE_DATE || '';
const releaseTag = optionValue('release-tag') || process.env.RELEASE_TAG || process.env.WORKFLOW_DISPATCH_RELEASE_TAG || '';

if (!['release', 'smoke'].includes(mode)) {
  throw new Error(`Unsupported Fedora build mode: ${mode}`);
}

process.chdir(workspace);

const cacheDir = path.join(workspace, '.cache');
const homeDir = path.join(cacheDir, 'fedora-home');

process.env.CI = process.env.CI || 'true';
process.env.CLOAKBROWSER_AUTO_UPDATE = 'false';
process.env.HOME = process.env.HOME || homeDir;
process.env.NPM_CONFIG_CACHE = process.env.NPM_CONFIG_CACHE || path.join(cacheDir, 'npm');
process.env.ELECTRON_CACHE = process.env.ELECTRON_CACHE || path.join(cacheDir, 'electron');
process.env.ELECTRON_BUILDER_CACHE = process.env.ELECTRON_BUILDER_CACHE || path.join(cacheDir, 'electron-builder');
if (releaseDate) {
  process.env.PACKAGE_RELEASE_DATE = releaseDate;
}
if (releaseTag) {
  process.env.RELEASE_TAG = releaseTag;
}

await Promise.all([
  mkdir(process.env.HOME, { recursive: true }),
  mkdir(process.env.NPM_CONFIG_CACHE, { recursive: true }),
  mkdir(process.env.ELECTRON_CACHE, { recursive: true }),
  mkdir(process.env.ELECTRON_BUILDER_CACHE, { recursive: true }),
]);

await run('node', ['--version']);
await run('npm', ['--version']);
await run('npm', ['run', 'ci:install']);

if (releaseTag) {
  await run('npm', ['run', 'apply:release-version']);
} else {
  console.log('No release tag provided; using package.json version as-is');
}

await run('npm', ['run', 'prepare:cloakbrowser', '--', '--target=linux']);
await run('npm', ['run', 'smoke:cloakbrowser']);
await run('npm', ['run', 'build:prod']);

const metadataArgs = ['run', 'generate:package-metadata'];
if (releaseDate) {
  metadataArgs.push('--', `--release-date=${releaseDate}`);
}
await run('npm', metadataArgs);

if (mode === 'smoke') {
  await run('npx', ['electron-builder', '--linux', 'dir']);
  await run('npm', ['run', 'verify:packaged']);
} else {
  await run('npx', ['electron-builder', '--linux', '--publish', 'never'], {
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
  });
  await run('npm', ['run', 'verify:packaged']);
  await run('npm', ['run', 'verify:installers', '--', '--platform=linux']);
  await run('npm', ['run', 'collect:release-artifacts', '--', '--platform=linux']);
}

console.log(`Fedora ${mode} build completed`);

function optionValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspace,
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
