import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import { isRecord } from '../packaging/contracts';

const OUTPUT_LIMIT_BYTES = 16 * 1024 * 1024;
const SAMPLE_INTERVAL_NANOSECONDS = 100_000_000;
const MAXIMUM_GAP_NANOSECONDS = 500_000_000;
const SETTLED_SAMPLE_COUNT = 10;
const SAFE_FAILURE_PATTERN = /^LOCAL_WHISPER_RESOURCE_SAMPLING_FAILED:([a-z-]+)\n$/u;

export interface LinuxResourceSample {
  readonly elapsedNanoseconds: number;
  readonly ownedProcessCount: number;
  readonly ramBytes: number;
  readonly vramBytes: number | 'notApplicable';
}

export interface LinuxResourceSeries {
  readonly schemaVersion: 2;
  readonly sampleIntervalMilliseconds: 100;
  readonly ramAlgorithm: 'proc-smaps-rollup-pss-owned-start-identity-v1';
  readonly vramAlgorithm: 'notApplicable' | 'nvml-compute-running-processes-v3-owned-pids-v1';
  readonly cpuGpuInitialization: 'absent' | 'notApplicable';
  readonly samples: readonly LinuxResourceSample[];
}

function boundedCollector(stream: NodeJS.ReadableStream): { readonly result: Promise<Buffer> } {
  const chunks: Buffer[] = [];
  let total = 0;
  const result = new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > OUTPUT_LIMIT_BYTES) {
        reject(new Error('Resource sampler output exceeded its bound'));
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    stream.once('end', () => resolve(Buffer.concat(chunks)));
    stream.once('error', reject);
  });
  return { result };
}

function parseSample(value: unknown, backend: 'cpu' | 'cuda'): LinuxResourceSample {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 4 ||
    !Number.isSafeInteger(value.elapsedNanoseconds) ||
    (value.elapsedNanoseconds as number) < 0 ||
    !Number.isSafeInteger(value.ownedProcessCount) ||
    (value.ownedProcessCount as number) < 0 ||
    !Number.isSafeInteger(value.ramBytes) ||
    (value.ramBytes as number) < 0 ||
    (backend === 'cpu'
      ? value.vramBytes !== 'notApplicable'
      : !Number.isSafeInteger(value.vramBytes) || (value.vramBytes as number) < 0)
  ) {
    throw new Error('Resource sampler emitted an invalid sample');
  }
  return value as unknown as LinuxResourceSample;
}

function parseSeries(bytes: Buffer, backend: 'cpu' | 'cuda'): LinuxResourceSeries {
  if (bytes.byteLength === 0 || bytes[bytes.length - 1] !== 0x0a) {
    throw new Error('Resource sampler output framing is invalid');
  }
  const value = JSON.parse(bytes.toString('utf8')) as unknown;
  const expectedVram = backend === 'cpu' ? 'notApplicable' : 'nvml-compute-running-processes-v3-owned-pids-v1';
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 6 ||
    value.schemaVersion !== 2 ||
    value.sampleIntervalMilliseconds !== 100 ||
    value.ramAlgorithm !== 'proc-smaps-rollup-pss-owned-start-identity-v1' ||
    value.vramAlgorithm !== expectedVram ||
    value.cpuGpuInitialization !== (backend === 'cpu' ? 'absent' : 'notApplicable') ||
    !Array.isArray(value.samples) ||
    value.samples.length < SETTLED_SAMPLE_COUNT
  ) {
    throw new Error('Resource sampler output contract is invalid');
  }
  const samples = value.samples.map((sample) => parseSample(sample, backend));
  for (let index = 1; index < samples.length; index += 1) {
    const gap = samples[index]!.elapsedNanoseconds - samples[index - 1]!.elapsedNanoseconds;
    if (gap <= 0 || gap > MAXIMUM_GAP_NANOSECONDS) {
      throw new Error('Resource sampler cadence is invalid');
    }
  }
  const settled = samples.slice(-SETTLED_SAMPLE_COUNT);
  if (
    settled.some(
      (sample) =>
        sample.ownedProcessCount !== 0 ||
        sample.ramBytes !== 0 ||
        (sample.vramBytes !== 0 && sample.vramBytes !== 'notApplicable'),
    )
  ) {
    throw new Error('Resource sampler did not prove zero ownership settlement');
  }
  return Object.freeze({
    schemaVersion: 2,
    sampleIntervalMilliseconds: SAMPLE_INTERVAL_NANOSECONDS / 1_000_000,
    ramAlgorithm: 'proc-smaps-rollup-pss-owned-start-identity-v1',
    vramAlgorithm: expectedVram,
    cpuGpuInitialization: backend === 'cpu' ? 'absent' : 'notApplicable',
    samples: Object.freeze(samples),
  });
}

/** Owns one qualification-only Linux process/NVML sampler lifecycle. */
export class LinuxResourceSamplerSession {
  private readonly stdout: Promise<Buffer>;
  private readonly stderr: Promise<Buffer>;
  private readonly exit: Promise<number | null>;

  public constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly backend: 'cpu' | 'cuda',
  ) {
    this.stdout = boundedCollector(child.stdout).result;
    this.stderr = boundedCollector(child.stderr).result;
    this.exit = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (signal !== null) reject(new Error('Resource sampler terminated by signal'));
        else resolve(code);
      });
    });
  }

  public async finish(): Promise<LinuxResourceSeries> {
    const [code, stdout, stderr] = await Promise.all([this.exit, this.stdout, this.stderr]);
    if (code !== 0 || stderr.byteLength !== 0) {
      const match = SAFE_FAILURE_PATTERN.exec(stderr.toString('ascii'));
      throw new Error(`Linux resource sampling failed${match ? `: ${match[1]}` : ''}`);
    }
    return parseSeries(stdout, this.backend);
  }

  public terminate(): void {
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill('SIGKILL');
  }
}

/** Starts a sampler without exposing PID/device identity in its command line or evidence output. */
export class LinuxResourceSampler {
  public constructor(private readonly scriptPath: string) {}

  public start(rootPid: number, backend: 'cpu' | 'cuda'): LinuxResourceSamplerSession {
    if (!Number.isSafeInteger(rootPid) || rootPid <= 1) throw new Error('Resource sampler root PID is invalid');
    const child = spawn('/usr/bin/python3', [this.scriptPath], {
      cwd: '/',
      env: { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const session = new LinuxResourceSamplerSession(child, backend);
    child.stdin.end(JSON.stringify({ schemaVersion: 1, backend, rootPid, deviceIndex: backend === 'cpu' ? null : 0 }));
    return session;
  }
}
