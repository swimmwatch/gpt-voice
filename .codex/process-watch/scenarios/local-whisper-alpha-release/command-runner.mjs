import { spawn } from 'node:child_process';

const MAX_OUTPUT_BYTES = 1_048_576;

export class ReleaseCommandError extends Error {
  constructor(code, { exitCode = null } = {}) {
    super(code);
    this.name = 'ReleaseCommandError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

export class ReleaseCommandRunner {
  #cwd;

  constructor({ cwd }) {
    this.#cwd = cwd;
  }

  async run(executable, args, { allowFailure = false, input, timeoutMilliseconds = 120_000 } = {}) {
    if (typeof executable !== 'string' || !Array.isArray(args) || args.some((value) => typeof value !== 'string')) {
      throw new ReleaseCommandError('release-command-invalid');
    }
    return await new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: this.#cwd,
        env: process.env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      const stdout = [];
      const stderr = [];
      let outputBytes = 0;
      let settled = false;
      const finish = (callback) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback();
      };
      const append = (target, chunk) => {
        outputBytes += chunk.byteLength;
        if (outputBytes > MAX_OUTPUT_BYTES) {
          child.kill('SIGTERM');
          finish(() => reject(new ReleaseCommandError('release-command-output-limit')));
          return;
        }
        target.push(chunk);
      };
      child.stdout.on('data', (chunk) => append(stdout, chunk));
      child.stderr.on('data', (chunk) => append(stderr, chunk));
      child.on('error', () => finish(() => reject(new ReleaseCommandError('release-command-start-failed'))));
      child.on('close', (exitCode) =>
        finish(() => {
          const result = Object.freeze({
            exitCode,
            stderr: Buffer.concat(stderr).toString('utf8').trim(),
            stdout: Buffer.concat(stdout).toString('utf8').trim(),
          });
          if (exitCode !== 0 && !allowFailure) {
            reject(new ReleaseCommandError('release-command-failed', { exitCode }));
            return;
          }
          resolve(result);
        }),
      );
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        finish(() => reject(new ReleaseCommandError('release-command-timed-out')));
      }, timeoutMilliseconds);
      timer.unref?.();
      if (input === undefined) child.stdin.end();
      else child.stdin.end(input);
    });
  }

  async json(executable, args, options) {
    const result = await this.run(executable, args, options);
    try {
      return Object.freeze({ ...result, value: JSON.parse(result.stdout) });
    } catch {
      throw new ReleaseCommandError('release-command-json-invalid');
    }
  }
}
