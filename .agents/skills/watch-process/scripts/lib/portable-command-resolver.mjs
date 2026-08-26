import * as path from 'node:path';
import process from 'node:process';

import { freezeArray, freezeRecord, isRecord, runtimeFail } from './runtime-core-support.mjs';
import { validateExecutable } from './runtime-preflight.mjs';

const WINDOWS_PLATFORM = 'win32';
const WINDOWS_NPM_EXECUTABLES = new Set(['npm', 'npm.cmd']);
const NPM_CLI_SEGMENTS = Object.freeze(['node_modules', 'npm', 'bin', 'npm-cli.js']);

/** Resolves package-manager commands without relying on a command shell. */
export class PortableCommandResolver {
  #nodeExecutable;
  #npmCliPath;
  #platform;

  constructor({ nodeExecutable = process.execPath, platform = process.platform } = {}) {
    if (typeof platform !== 'string') runtimeFail('invalid-portable-command-resolver');
    this.#platform = platform;
    this.#nodeExecutable = validateExecutable(nodeExecutable);
    if (platform === WINDOWS_PLATFORM) {
      if (!path.win32.isAbsolute(this.#nodeExecutable)) runtimeFail('invalid-portable-command-resolver');
      this.#npmCliPath = validateExecutable(
        path.win32.join(path.win32.dirname(this.#nodeExecutable), ...NPM_CLI_SEGMENTS),
      );
    } else {
      this.#npmCliPath = null;
    }
  }

  resolve(command) {
    if (!isRecord(command) || !Array.isArray(command.args)) runtimeFail('invalid-portable-command');
    if (this.#platform !== WINDOWS_PLATFORM || !WINDOWS_NPM_EXECUTABLES.has(String(command.executable).toLowerCase())) {
      return command;
    }
    return freezeRecord({
      ...command,
      args: freezeArray([this.#npmCliPath, ...command.args]),
      executable: this.#nodeExecutable,
    });
  }
}
