import type { execFile } from 'node:child_process';

import type { NvidiaSmiCommandPort } from './NvidiaSmiHostInventory';

const LOCAL_WHISPER_COMMAND_TIMEOUT_MILLISECONDS = 2_000;
const LOCAL_WHISPER_COMMAND_MAXIMUM_OUTPUT_BYTES = 4_096;

export interface PlatformCommandExecutorDependencies {
  readonly execFile: typeof execFile;
}

/** Executes one reviewed executable directly, without PowerShell, sh, or command-string interpolation. */
export abstract class PlatformCommandExecutor implements NvidiaSmiCommandPort {
  protected constructor(private readonly dependencies: PlatformCommandExecutorDependencies) {}

  protected abstract readonly windowsHide: boolean;

  public run(executablePath: string, arguments_: readonly string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      this.dependencies.execFile(
        executablePath,
        [...arguments_],
        {
          encoding: 'utf8',
          maxBuffer: LOCAL_WHISPER_COMMAND_MAXIMUM_OUTPUT_BYTES,
          timeout: LOCAL_WHISPER_COMMAND_TIMEOUT_MILLISECONDS,
          windowsHide: this.windowsHide,
        },
        (error, stdout) => {
          if (error) {
            reject(error instanceof Error ? error : new Error('Host resource command failed'));
            return;
          }
          resolve(stdout);
        },
      );
    });
  }
}
