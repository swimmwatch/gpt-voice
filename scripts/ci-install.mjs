import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';

const attempts = Number.parseInt(process.env.CI_INSTALL_ATTEMPTS || '3', 10);
// Running npm's JS entrypoint through Node avoids Windows .cmd spawn quirks on GitHub runners.
const npmExecPath = findNpmExecPath();
const npmCommand = npmExecPath ? process.execPath : 'npm';
const npmArgsPrefix = npmExecPath ? [npmExecPath] : [];
const nodeModulesPath = path.resolve('node_modules');

function findNpmExecPath() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];

  return candidates.find((candidate) => candidate && existsSync(candidate)) || '';
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runNpmCi(attempt) {
  return new Promise((resolve) => {
    console.log(`Running npm ci (attempt ${attempt}/${attempts})`);

    if (!npmExecPath && process.platform === 'win32') {
      console.error('Could not locate npm CLI entrypoint. Run this script through `npm run ci:install`.');
      resolve(1);
      return;
    }

    const child = spawn(npmCommand, [...npmArgsPrefix, 'ci'], {
      stdio: 'inherit',
      windowsHide: true,
      env: {
        ...process.env,
        NPM_CONFIG_FETCH_RETRIES: process.env.NPM_CONFIG_FETCH_RETRIES || '5',
        NPM_CONFIG_FETCH_RETRY_MINTIMEOUT: process.env.NPM_CONFIG_FETCH_RETRY_MINTIMEOUT || '20000',
        NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT: process.env.NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT || '120000',
      },
    });

    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (error) => {
      console.error(error);
      resolve(1);
    });
  });
}

async function removePartialInstall() {
  await rm(nodeModulesPath, {
    recursive: true,
    force: true,
    maxRetries: process.platform === 'win32' ? 10 : 3,
    retryDelay: 1000,
  }).catch((error) => {
    console.warn(`Could not fully remove partial node_modules before retry: ${error.message}`);
  });
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  if (attempt > 1) {
    await removePartialInstall();
    await delay(15000 * (attempt - 1));
  }

  const exitCode = await runNpmCi(attempt);
  if (exitCode === 0) {
    process.exit(0);
  }

  if (attempt === attempts) {
    process.exit(exitCode);
  }
}
