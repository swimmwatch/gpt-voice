import { spawn } from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';

import { validateProcessStartToken } from './runtime-state-contracts.mjs';
import { freezeRecord, isRecord, runtimeFail } from './runtime-core-support.mjs';

/** Launches only an already verified generated module using the Node executable directly. */
export class GeneratedWatcherLauncher {
  #nodeExecutable;
  #platform;
  #spawnProcess;

  constructor({ nodeExecutable = process.execPath, platform = process.platform, spawnProcess = spawn } = {}) {
    if (
      typeof nodeExecutable !== 'string' ||
      nodeExecutable.length === 0 ||
      typeof platform !== 'string' ||
      typeof spawnProcess !== 'function'
    ) {
      runtimeFail('invalid-generated-watcher-launcher');
    }
    this.#nodeExecutable = nodeExecutable;
    this.#platform = platform;
    this.#spawnProcess = spawnProcess;
  }

  launch({ artifactPath, mode = 'start', processStartToken, workspaceRoot } = {}) {
    if (
      typeof artifactPath !== 'string' ||
      !path.isAbsolute(artifactPath) ||
      typeof workspaceRoot !== 'string' ||
      !path.isAbsolute(workspaceRoot)
    ) {
      runtimeFail('invalid-generated-watcher-launch-request');
    }
    if (!['repair-restart', 'resume', 'start'].includes(mode)) {
      runtimeFail('invalid-generated-watcher-launch-request');
    }
    const token = validateProcessStartToken(processStartToken, 'invalid-generated-watcher-launch-request');
    let child;
    try {
      child = this.#spawnProcess(this.#nodeExecutable, [artifactPath, '--process-start-token', token, '--mode', mode], {
        cwd: workspaceRoot,
        detached: this.#platform !== 'win32',
        shell: false,
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      runtimeFail('generated-watcher-launch-failed');
    }
    if (!isRecord(child) || typeof child.unref !== 'function') runtimeFail('generated-watcher-launch-failed');
    child.unref();
    return freezeRecord({ processId: Number.isSafeInteger(child.pid) ? child.pid : null, processStartToken: token });
  }
}
