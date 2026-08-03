import { spawn } from 'node:child_process';

const COMMAND_OUTPUT_LIMIT_BYTES = 8 * 1024 * 1024;

export interface QualificationCommandRequest {
  readonly command: string;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly environment?: Readonly<NodeJS.ProcessEnv>;
}

export interface QualificationCommandPort {
  readonly run: (request: QualificationCommandRequest) => Promise<string>;
}

function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let byteLength = 0;
    stream.on('data', (chunk: Buffer) => {
      byteLength += chunk.byteLength;
      if (byteLength > COMMAND_OUTPUT_LIMIT_BYTES) {
        reject(new Error('Qualification build command output exceeded its bound'));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    stream.once('end', () => resolve(Buffer.concat(chunks)));
    stream.once('error', reject);
  });
}

/** Runs fixed qualification commands without a shell or inherited stdin. */
export class QualificationCommandRunner implements QualificationCommandPort {
  public async run(request: QualificationCommandRequest): Promise<string> {
    const child = spawn(request.command, [...request.arguments], {
      cwd: request.cwd,
      env: request.environment ? { ...request.environment } : process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = collect(child.stdout);
    const stderr = collect(child.stderr);
    const exit = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (signal) reject(new Error('Qualification build command terminated by signal'));
        else resolve(code);
      });
    });
    const [code, stdoutBytes, stderrBytes] = await Promise.all([exit, stdout, stderr]);
    if (code !== 0) {
      const message = stderrBytes
        .subarray(Math.max(0, stderrBytes.byteLength - 64 * 1024))
        .toString('utf8')
        .trim();
      throw new Error(message || 'Qualification build command failed');
    }
    return stdoutBytes.toString('utf8').trim();
  }
}
