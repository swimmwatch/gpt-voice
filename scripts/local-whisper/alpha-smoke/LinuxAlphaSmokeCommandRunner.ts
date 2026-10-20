import { spawn } from 'node:child_process';

import { LinuxAlphaSmokeCommandExitError } from './LinuxAlphaSmokeCommandExitError';

const COMMAND_TIMEOUT_MILLISECONDS = 5 * 60 * 1_000;
const MAX_COMMAND_OUTPUT_BYTES = 1024 * 1024 * 1024;
const MAX_STREAMING_COMMAND_OUTPUT_BYTES = 8 * 1024 * 1024 * 1024;
const SAFE_COMMAND_ENVIRONMENT = Object.freeze({ LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' });

export const LINUX_ALPHA_SMOKE_EXECUTABLES = Object.freeze({
  dpkgDeb: '/usr/bin/dpkg-deb',
  dpkgQuery: '/usr/bin/dpkg-query',
  nvidiaSmi: '/usr/bin/nvidia-smi',
  pgrep: '/usr/bin/pgrep',
  unshare: '/usr/bin/unshare',
});

export const LINUX_ALPHA_SMOKE_MANUAL_INSTALL_EXECUTABLE = '/usr/bin/dpkg' as const;

export interface LinuxAlphaSmokeCommandPort {
  run(executable: string, arguments_: readonly string[], environment?: Readonly<NodeJS.ProcessEnv>): Promise<string>;
  runBytes(
    executable: string,
    arguments_: readonly string[],
    environment?: Readonly<NodeJS.ProcessEnv>,
  ): Promise<Buffer>;
  runStreaming(
    executable: string,
    arguments_: readonly string[],
    onStdoutChunk: (chunk: Buffer) => void,
    environment?: Readonly<NodeJS.ProcessEnv>,
  ): Promise<void>;
}

/** Executes only explicit allowlisted Linux programs with no shell or inherited stdin. */
export class LinuxAlphaSmokeCommandRunner implements LinuxAlphaSmokeCommandPort {
  public constructor(private readonly remainingMilliseconds: () => number = () => COMMAND_TIMEOUT_MILLISECONDS) {}

  private timeout(): number {
    const remaining = this.remainingMilliseconds();
    if (!Number.isFinite(remaining) || remaining <= 0) throw new Error('ALPHA_SMOKE_DEADLINE_EXHAUSTED');
    return Math.min(COMMAND_TIMEOUT_MILLISECONDS, remaining);
  }
  public async run(
    executable: string,
    arguments_: readonly string[],
    environment?: Readonly<NodeJS.ProcessEnv>,
  ): Promise<string> {
    return (await this.runBytes(executable, arguments_, environment)).toString('utf8').trim();
  }

  public async runBytes(
    executable: string,
    arguments_: readonly string[],
    environment?: Readonly<NodeJS.ProcessEnv>,
  ): Promise<Buffer> {
    const stdout: Buffer[] = [];
    await this.execute(
      executable,
      arguments_,
      (chunk) => {
        stdout.push(Buffer.from(chunk));
      },
      MAX_COMMAND_OUTPUT_BYTES,
      environment,
    );
    return Buffer.concat(stdout);
  }

  public async runStreaming(
    executable: string,
    arguments_: readonly string[],
    onStdoutChunk: (chunk: Buffer) => void,
    environment?: Readonly<NodeJS.ProcessEnv>,
  ): Promise<void> {
    await this.execute(executable, arguments_, onStdoutChunk, MAX_STREAMING_COMMAND_OUTPUT_BYTES, environment);
  }

  private async execute(
    executable: string,
    arguments_: readonly string[],
    onStdoutChunk: (chunk: Buffer) => void,
    maximumBytes: number,
    environment?: Readonly<NodeJS.ProcessEnv>,
  ): Promise<void> {
    const timeout = this.timeout();
    if (!new Set<string>(Object.values(LINUX_ALPHA_SMOKE_EXECUTABLES)).has(executable)) {
      throw new Error('ALPHA_SMOKE_LINUX_EXECUTABLE_FORBIDDEN');
    }
    const child = spawn(executable, [...arguments_], {
      env: environment ? { ...environment } : SAFE_COMMAND_ENVIRONMENT,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise<void>((resolve, reject) => {
      let length = 0;
      let settled = false;
      const settle = (operation: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        operation();
      };
      const rejectAndStop = (error: Error): void => {
        child.kill('SIGTERM');
        settle(() => reject(error));
      };
      const accountOutput = (lengthDelta: number): boolean => {
        length += lengthDelta;
        if (length <= maximumBytes) return true;
        rejectAndStop(new Error('ALPHA_SMOKE_LINUX_COMMAND_OUTPUT_TOO_LARGE'));
        return false;
      };
      const timer = setTimeout(() => {
        rejectAndStop(new Error('ALPHA_SMOKE_LINUX_COMMAND_TIMEOUT'));
      }, timeout);
      child.stdout.on('data', (chunk: Buffer) => {
        if (settled || !accountOutput(chunk.length)) return;
        try {
          onStdoutChunk(Buffer.from(chunk));
        } catch (error) {
          rejectAndStop(error instanceof Error ? error : new Error('ALPHA_SMOKE_LINUX_COMMAND_EXECUTION_FAILED'));
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        if (!settled) accountOutput(chunk.length);
      });
      child.once('error', () => rejectAndStop(new Error('ALPHA_SMOKE_LINUX_COMMAND_EXECUTION_FAILED')));
      child.once('close', (code, signal) => {
        settle(() => {
          if (code === 0 && signal === null) resolve();
          else reject(new LinuxAlphaSmokeCommandExitError(code, signal));
        });
      });
    });
  }
}
