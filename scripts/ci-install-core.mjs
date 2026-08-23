import { spawn } from 'node:child_process';
import { cp, lstat, mkdtemp, readFile, rm } from 'node:fs/promises';
import { lstatSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveCorepackCommand } from './security/corepack-command.mjs';
import {
  CURRENT_COREPACK_VERSION,
  CURRENT_PACKAGE_MANAGER,
  verifyCurrentPackageManagerManifest,
} from './security/package-manager-policy.mjs';

const DEFAULT_ATTEMPTS = 3;
const RETRY_DELAY_MILLISECONDS = 15_000;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function spawnCommand({ arguments_, command, cwd, environment, stdio }) {
  return await new Promise((resolve) => {
    const child = spawn(command, arguments_, {
      cwd,
      env: environment,
      stdio,
      windowsHide: true,
    });
    child.once('error', () => resolve(1));
    child.once('close', (code) => resolve(code ?? 1));
  });
}

function regularFile(filePath, inspectEntry, platformPath) {
  if (typeof filePath !== 'string' || !platformPath.isAbsolute(filePath)) return false;
  try {
    const identity = inspectEntry(filePath);
    return identity.isFile() && !identity.isSymbolicLink();
  } catch {
    return false;
  }
}

/** Resolves npm's JavaScript entrypoint without asking Windows to execute a command shim. */
export function resolveBootstrapNpmCommand(platform, nodeExecutable, environment, inspectEntry = lstatSync) {
  const platformPath = platform === 'win32' ? path.win32 : path.posix;
  const candidates = [
    environment.npm_execpath,
    platformPath.join(platformPath.dirname(nodeExecutable), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  const npmEntry = candidates.find((candidate) => regularFile(candidate, inspectEntry, platformPath));
  if (npmEntry) {
    return Object.freeze({ executable: nodeExecutable, argumentPrefix: Object.freeze([npmEntry]) });
  }
  if (platform === 'win32') throw new Error('CI_INSTALL_NPM_ENTRY_UNAVAILABLE');
  return Object.freeze({ executable: 'npm', argumentPrefix: Object.freeze([]) });
}

/** Installs the exact locked dependency graph with Corepack and a script-disabled bootstrap fallback. */
export class CiInstallCoordinator {
  #attempts;
  #bootstrapDirectory = null;
  #cwd;
  #delay;
  #environment;
  #nodeExecutable;
  #output;
  #platform;
  #runCommand;

  constructor({
    attempts = positiveInteger(process.env.CI_INSTALL_ATTEMPTS ?? '', DEFAULT_ATTEMPTS),
    cwd = process.cwd(),
    delay = async (milliseconds) => await new Promise((resolve) => setTimeout(resolve, milliseconds)),
    environment = process.env,
    nodeExecutable = process.execPath,
    output = process.stdout,
    platform = process.platform,
    runCommand = spawnCommand,
  } = {}) {
    this.#attempts = positiveInteger(String(attempts), DEFAULT_ATTEMPTS);
    this.#cwd = path.resolve(cwd);
    this.#delay = delay;
    this.#environment = { ...environment };
    this.#nodeExecutable = nodeExecutable;
    this.#output = output;
    this.#platform = platform;
    this.#runCommand = runCommand;
  }

  async install() {
    await this.#verifyProjectManifest();
    try {
      const corepack = await this.#resolveCorepack();
      await this.#runWithRetries(corepack, [CURRENT_PACKAGE_MANAGER, 'ci'], 'npm ci', this.#installEnvironment());
    } finally {
      if (this.#bootstrapDirectory) {
        await rm(this.#bootstrapDirectory, { force: true, recursive: true });
      }
    }
  }

  async #verifyProjectManifest() {
    let value;
    try {
      value = JSON.parse(await readFile(path.join(this.#cwd, 'package.json'), 'utf8'));
      verifyCurrentPackageManagerManifest(value);
    } catch {
      throw new Error('CI_INSTALL_PACKAGE_MANAGER_POLICY_INVALID');
    }
  }

  async #resolveCorepack() {
    let corepack;
    try {
      corepack = resolveCorepackCommand(this.#platform, this.#nodeExecutable);
    } catch {
      corepack = null;
    }
    if (
      corepack &&
      (await this.#runCommand({
        arguments_: [...corepack.argumentPrefix, CURRENT_PACKAGE_MANAGER, '--version'],
        command: corepack.executable,
        cwd: this.#cwd,
        environment: this.#installEnvironment(),
        stdio: 'ignore',
      })) === 0
    ) {
      return corepack;
    }
    return await this.#bootstrapCorepack();
  }

  async #bootstrapCorepack() {
    this.#output.write('Corepack unavailable; bootstrapping the locked script-disabled dependency graph\n');
    const npm = resolveBootstrapNpmCommand(this.#platform, this.#nodeExecutable, this.#environment);
    await this.#runWithRetries(npm, ['ci', '--ignore-scripts', '--no-audit'], 'npm bootstrap ci', {
      ...this.#installEnvironment(),
      NPM_CONFIG_AUDIT: 'false',
      NPM_CONFIG_ENGINE_STRICT: 'false',
      NPM_CONFIG_IGNORE_SCRIPTS: 'true',
    });

    const sourcePackage = path.join(this.#cwd, 'node_modules', 'corepack');
    const sourceEntry = path.join(sourcePackage, 'dist', 'corepack.js');
    let packageManifest;
    try {
      const [packageIdentity, entryIdentity, packageBytes] = await Promise.all([
        lstat(sourcePackage),
        lstat(sourceEntry),
        readFile(path.join(sourcePackage, 'package.json'), 'utf8'),
      ]);
      if (
        !packageIdentity.isDirectory() ||
        packageIdentity.isSymbolicLink() ||
        !entryIdentity.isFile() ||
        entryIdentity.isSymbolicLink()
      ) {
        throw new Error('invalid identity');
      }
      packageManifest = JSON.parse(packageBytes);
    } catch {
      throw new Error('CI_INSTALL_COREPACK_BOOTSTRAP_INVALID');
    }
    if (packageManifest?.name !== 'corepack' || packageManifest.version !== CURRENT_COREPACK_VERSION) {
      throw new Error('CI_INSTALL_COREPACK_BOOTSTRAP_INVALID');
    }

    this.#bootstrapDirectory = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-corepack-'));
    const stagedPackage = path.join(this.#bootstrapDirectory, 'corepack');
    await cp(sourcePackage, stagedPackage, { errorOnExist: true, recursive: true });
    const stagedEntry = path.join(stagedPackage, 'dist', 'corepack.js');
    const stagedIdentity = await lstat(stagedEntry).catch(() => null);
    if (!stagedIdentity?.isFile() || stagedIdentity.isSymbolicLink()) {
      throw new Error('CI_INSTALL_COREPACK_BOOTSTRAP_INVALID');
    }
    return Object.freeze({
      executable: this.#nodeExecutable,
      argumentPrefix: Object.freeze([stagedEntry]),
    });
  }

  async #runWithRetries(command, arguments_, label, environment) {
    let lastExitCode = 1;
    for (let attempt = 1; attempt <= this.#attempts; attempt += 1) {
      if (attempt > 1) {
        await this.#removePartialInstall();
        await this.#delay(RETRY_DELAY_MILLISECONDS * (attempt - 1));
      }
      this.#output.write(`Running ${label} (attempt ${attempt}/${this.#attempts})\n`);
      lastExitCode = await this.#runCommand({
        arguments_: [...command.argumentPrefix, ...arguments_],
        command: command.executable,
        cwd: this.#cwd,
        environment,
        stdio: 'inherit',
      });
      if (lastExitCode === 0) return;
    }
    throw new Error(`CI_INSTALL_FAILED_${lastExitCode}`);
  }

  async #removePartialInstall() {
    await rm(path.join(this.#cwd, 'node_modules'), {
      force: true,
      maxRetries: this.#platform === 'win32' ? 10 : 3,
      recursive: true,
      retryDelay: 1_000,
    }).catch(() => {
      this.#output.write('Could not fully remove partial node_modules before retry\n');
    });
  }

  #installEnvironment() {
    return {
      ...this.#environment,
      NPM_CONFIG_FETCH_RETRIES: this.#environment.NPM_CONFIG_FETCH_RETRIES || '5',
      NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT: this.#environment.NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT || '120000',
      NPM_CONFIG_FETCH_RETRY_MINTIMEOUT: this.#environment.NPM_CONFIG_FETCH_RETRY_MINTIMEOUT || '20000',
    };
  }
}
