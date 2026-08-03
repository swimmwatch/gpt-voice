import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, type FileHandle } from 'node:fs/promises';
import type { Readable, Writable } from 'node:stream';

import { sha256File } from '../packaging/fileIntegrity';
import { LinuxResourceSampler, type LinuxResourceSeries } from './LinuxResourceSampler';

const OUTPUT_LIMIT_BYTES = 16 * 1024 * 1024;
const DEFAULT_TIMEOUT_MILLISECONDS = 30 * 60 * 1000;
const SAFE_FAILURE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/u;

export interface DirectEngineQualificationRequest {
  readonly executablePath: string;
  readonly executableArguments?: readonly string[];
  readonly runtimeLibraryPath?: string;
  readonly modelPath: string;
  readonly modelSizeBytes: number;
  readonly modelSha256: string;
  readonly wavPath: string;
  readonly wavSizeBytes: number;
  readonly wavSha256: string;
  readonly family: string;
  readonly variant: string;
  readonly language: 'en' | 'ru';
  readonly cpuThreads: number;
  readonly backend: 'cpu' | 'cuda';
  readonly selectedOrdinal: number | null;
}

export interface DirectEngineQualificationResult {
  readonly transcript: string;
  readonly durationNanoseconds: number;
  readonly resources: LinuxResourceSeries;
}

type DirectEngineChild = ChildProcessByStdio<Writable, Readable, Readable>;

function boundedCollector(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let byteLength = 0;
    stream.on('data', (chunk: Buffer) => {
      byteLength += chunk.byteLength;
      if (byteLength > OUTPUT_LIMIT_BYTES) {
        reject(new Error('Direct-engine output exceeded its bound'));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    stream.once('end', () => resolve(Buffer.concat(chunks)));
    stream.once('error', reject);
  });
}

function directEngineFailureCode(bytes: Buffer): string | null {
  if (bytes.byteLength === 0 || bytes[bytes.byteLength - 1] !== 0x0a) return null;
  try {
    const value = JSON.parse(bytes.toString('utf8')) as unknown;
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).sort().join('|') !== 'code|schemaVersion|status'
    ) {
      return null;
    }
    const record = value as Readonly<Record<string, unknown>>;
    return record.schemaVersion === 1 &&
      record.status === 'error' &&
      typeof record.code === 'string' &&
      SAFE_FAILURE_CODE_PATTERN.test(record.code)
      ? record.code
      : null;
  } catch {
    return null;
  }
}

async function assertExactFile(filePath: string, sizeBytes: number, sha256: string): Promise<void> {
  const metadata = await lstat(filePath);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size !== sizeBytes ||
    (await sha256File(filePath)) !== sha256
  ) {
    throw new Error('Direct-engine input identity changed');
  }
}

async function openReadOnlyNoFollow(filePath: string): Promise<FileHandle> {
  return open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
}

/** Runs the checksum-pinned direct engine with inherited read-only descriptors and owned-resource sampling. */
export class DirectEngineQualificationRunner {
  public constructor(
    private readonly resourceSampler: LinuxResourceSampler,
    private readonly timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS,
  ) {}

  public async run(request: DirectEngineQualificationRequest): Promise<DirectEngineQualificationResult> {
    if (process.platform !== 'linux') throw new Error('Direct-engine qualification requires Linux');
    if (
      (request.backend === 'cpu' && request.selectedOrdinal !== null) ||
      (request.backend === 'cuda' && request.selectedOrdinal !== 0) ||
      !Number.isSafeInteger(request.cpuThreads) ||
      request.cpuThreads <= 0
    ) {
      throw new Error('Direct-engine qualification request is invalid');
    }
    await Promise.all([
      assertExactFile(request.modelPath, request.modelSizeBytes, request.modelSha256),
      assertExactFile(request.wavPath, request.wavSizeBytes, request.wavSha256),
    ]);
    const [model, wav] = await Promise.all([
      openReadOnlyNoFollow(request.modelPath),
      openReadOnlyNoFollow(request.wavPath),
    ]);
    let child: DirectEngineChild | null = null;
    try {
      const environment: NodeJS.ProcessEnv = { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', PATH: '/usr/bin:/bin' };
      if (request.backend === 'cuda') {
        if (!request.runtimeLibraryPath) throw new Error('CUDA direct-engine library root is missing');
        environment.LD_LIBRARY_PATH = request.runtimeLibraryPath;
      }
      const started = process.hrtime.bigint();
      child = spawn(request.executablePath, [...(request.executableArguments ?? [])], {
        cwd: '/',
        env: environment,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe', model.fd, wav.fd],
      });
      const pid = child.pid;
      if (!pid) throw new Error('Direct-engine process identity unavailable');
      const sampler = this.resourceSampler.start(pid, request.backend);
      const stdout = boundedCollector(child.stdout);
      const stderr = boundedCollector(child.stderr);
      const exit = new Promise<number | null>((resolve, reject) => {
        child?.once('error', reject);
        child?.once('exit', (code, signal) => {
          if (signal !== null) reject(new Error('Direct-engine process terminated by signal'));
          else resolve(code);
        });
      });
      const timeout = setTimeout(() => child?.kill('SIGKILL'), this.timeoutMilliseconds);
      child.stdin.end(
        JSON.stringify({
          schemaVersion: 1,
          family: request.family,
          variant: request.variant,
          modelSizeBytes: request.modelSizeBytes,
          modelSha256: request.modelSha256,
          wavSizeBytes: request.wavSizeBytes,
          wavSha256: request.wavSha256,
          language: request.language,
          cpuThreads: request.cpuThreads,
          selectedOrdinal: request.selectedOrdinal,
        }),
      );
      try {
        const [exitCode, transcriptBytes, stderrBytes, resources] = await Promise.all([
          exit,
          stdout,
          stderr,
          sampler.finish(),
        ]);
        const durationNanoseconds = Number(process.hrtime.bigint() - started);
        const failureCode = directEngineFailureCode(stderrBytes);
        if (exitCode !== 0) {
          throw new Error(`Direct-engine qualification failed${failureCode ? `: ${failureCode}` : ''}`);
        }
        if (stderrBytes.byteLength !== 0) throw new Error('Direct-engine qualification failed: UNEXPECTED_STDERR');
        if (transcriptBytes.byteLength === 0) throw new Error('Direct-engine qualification failed: EMPTY_TRANSCRIPT');
        if (!Number.isSafeInteger(durationNanoseconds) || durationNanoseconds <= 0) {
          throw new Error('Direct-engine qualification failed: INVALID_DURATION');
        }
        return Object.freeze({ transcript: transcriptBytes.toString('utf8'), durationNanoseconds, resources });
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      await Promise.all([model.close(), wav.close()]);
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }
}
