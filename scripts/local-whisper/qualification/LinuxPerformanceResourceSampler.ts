import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import { isRecord } from '../packaging/contracts';
import type { PerformanceBackend } from './PerformanceQualification';
import type { PerformanceResourceProof, PerformanceRoleRegistration } from './PerformanceQualificationCollector';

const OUTPUT_LIMIT_BYTES = 1024 * 1024;
const READINESS_FRAME = Buffer.from('READY\n', 'ascii');
const SAFE_FAILURE_PATTERN = /^LOCAL_WHISPER_RESOURCE_SAMPLING_FAILED:([a-z-]+)\n$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const PROCESS_START_IDENTITY = /^\d{1,32}$/u;
const RESOURCE_IDS = ['mainProcessPeakRss', 'guardProcessPeakRss', 'workerProcessPeakRss', 'gpuPeakVram'] as const;
const ROLES = ['main', 'guard', 'worker'] as const;

function boundedCollector(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  return new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk: Buffer | string) => {
      const bytes = Buffer.from(chunk);
      total += bytes.byteLength;
      if (total > OUTPUT_LIMIT_BYTES) reject(new Error('Performance resource sampler output exceeded its bound'));
      else chunks.push(bytes);
    });
    stream.once('end', () => resolve(Buffer.concat(chunks)));
    stream.once('error', reject);
  });
}

function exactReadiness(stream: NodeJS.ReadableStream): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    stream.on('data', (chunk: Buffer | string) => {
      const bytes = Buffer.from(chunk);
      total += bytes.byteLength;
      if (total > READINESS_FRAME.byteLength) reject(new Error('Performance resource readiness invalid'));
      else chunks.push(bytes);
    });
    stream.once('end', () => {
      if (Buffer.concat(chunks).equals(READINESS_FRAME)) resolve();
      else reject(new Error('Performance resource readiness invalid'));
    });
    stream.once('error', reject);
  });
}

function exactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  return (
    JSON.stringify(Object.keys(value).sort((left, right) => left.localeCompare(right, 'en'))) ===
    JSON.stringify([...expected].sort((left, right) => left.localeCompare(right, 'en')))
  );
}

function safeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function parseRole(value: unknown, index: number): PerformanceRoleRegistration {
  if (
    !isRecord(value) ||
    !exactKeys(value, ['role', 'pid', 'processStartIdentity', 'executableSha256']) ||
    value.role !== ROLES[index] ||
    !Number.isSafeInteger(value.pid) ||
    (value.pid as number) <= 1 ||
    typeof value.processStartIdentity !== 'string' ||
    !PROCESS_START_IDENTITY.test(value.processStartIdentity) ||
    typeof value.executableSha256 !== 'string' ||
    !SHA256.test(value.executableSha256)
  ) {
    throw new Error('Performance resource role proof invalid');
  }
  return Object.freeze({
    role: value.role as PerformanceRoleRegistration['role'],
    pid: value.pid as number,
    processStartIdentity: value.processStartIdentity,
    executableSha256: value.executableSha256,
  });
}

function parseProof(bytes: Buffer, backend: PerformanceBackend): PerformanceResourceProof {
  if (bytes.byteLength === 0 || bytes[bytes.byteLength - 1] !== 0x0a || bytes.subarray(0, -1).includes(0x0a)) {
    throw new Error('Performance resource output framing invalid');
  }
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'schemaVersion',
      'sampleIntervalMilliseconds',
      'ramAlgorithm',
      'vramAlgorithm',
      'resources',
      'roleRegistrations',
      'processSettlementProof',
      'settledZeroOwnershipSamples',
      'unownedProcessAttribution',
      'unownedGpuAttribution',
      'identityChanges',
      'lateRoleRegistrations',
      'liveOwnedProcessesAfterSettlement',
    ]) ||
    value.schemaVersion !== 3 ||
    value.sampleIntervalMilliseconds !== 100 ||
    value.ramAlgorithm !== 'proc-smaps-rollup-pss-registered-role-start-identity-v1' ||
    value.vramAlgorithm !==
      (backend === 'cpu' ? 'notApplicable' : 'nvml-compute-running-processes-v3-registered-pids-v1') ||
    !isRecord(value.resources) ||
    !Array.isArray(value.roleRegistrations) ||
    value.roleRegistrations.length !== ROLES.length ||
    value.processSettlementProof !== 'ownedProcessTreeSettled' ||
    value.settledZeroOwnershipSamples !== 10 ||
    value.unownedProcessAttribution !== 0 ||
    value.unownedGpuAttribution !== (backend === 'cpu' ? 'notApplicable' : 0) ||
    value.identityChanges !== 0 ||
    value.lateRoleRegistrations !== 0 ||
    value.liveOwnedProcessesAfterSettlement !== 0
  ) {
    throw new Error('Performance resource proof invalid');
  }
  const resourceValues = value.resources;
  const expectedResourceKeys = backend === 'cpu' ? RESOURCE_IDS.slice(0, 3) : RESOURCE_IDS;
  if (!exactKeys(resourceValues, RESOURCE_IDS)) throw new Error('Performance resource measurement invalid');
  const resources = expectedResourceKeys.map((id) => {
    const peakBytes = resourceValues[id];
    if (!safeInteger(peakBytes)) throw new Error('Performance resource measurement invalid');
    return Object.freeze({ id, peakBytes });
  });
  if (
    (backend === 'cpu' && resourceValues.gpuPeakVram !== 'notApplicable') ||
    (backend === 'cuda' && !safeInteger(resourceValues.gpuPeakVram))
  ) {
    throw new Error('Performance resource GPU measurement invalid');
  }
  const roles = value.roleRegistrations.map(parseRole);
  if (new Set(roles.map(({ pid }) => pid)).size !== roles.length) {
    throw new Error('Performance resource role proof invalid');
  }
  return Object.freeze({
    resources: Object.freeze(resources),
    roleRegistrations: Object.freeze(roles),
    processSettlementProof: 'ownedProcessTreeSettled',
    unownedProcessAttribution: 0,
    unownedGpuAttribution: backend === 'cpu' ? 'notApplicable' : 0,
    identityChanges: 0,
    lateRoleRegistrations: 0,
    liveOwnedProcessesAfterSettlement: 0,
  });
}

/** Owns one role-aware sampler process and live inherited event forwarding. */
export class LinuxPerformanceResourceSamplerSession {
  public readonly ready: Promise<void>;
  private readonly stdout: Promise<Buffer>;
  private readonly stderr: Promise<Buffer>;
  private readonly exit: Promise<number | null>;
  private readonly onEvents: (chunk: Buffer | string) => void;
  private readonly onEventEnd: () => void;
  private readonly onEventError: () => void;

  public constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    private readonly backend: PerformanceBackend,
    private readonly eventStream: NodeJS.ReadableStream,
    readiness: NodeJS.ReadableStream,
  ) {
    this.ready = exactReadiness(readiness);
    this.stdout = boundedCollector(child.stdout);
    this.stderr = boundedCollector(child.stderr);
    this.exit = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (signal !== null) reject(new Error('Performance resource sampler terminated by signal'));
        else resolve(code);
      });
    });
    this.onEvents = (chunk): void => {
      if (!child.stdin.write(chunk)) {
        this.eventStream.pause();
        child.stdin.once('drain', () => this.eventStream.resume());
      }
    };
    this.onEventEnd = (): void => {
      child.stdin.end();
    };
    this.onEventError = (): void => {
      child.stdin.destroy(new Error('Performance event stream failed'));
    };
    eventStream.on('data', this.onEvents);
    eventStream.once('end', this.onEventEnd);
    eventStream.once('error', this.onEventError);
  }

  public async finish(): Promise<PerformanceResourceProof> {
    const [, code, stdout, stderr] = await Promise.all([this.ready, this.exit, this.stdout, this.stderr]);
    this.detach();
    if (code !== 0 || stderr.byteLength !== 0) {
      const match = SAFE_FAILURE_PATTERN.exec(stderr.toString('ascii'));
      throw new Error(`Linux performance resource sampling failed${match ? `: ${match[1]}` : ''}`);
    }
    return parseProof(stdout, this.backend);
  }

  public terminate(): void {
    this.detach();
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill('SIGKILL');
  }

  private detach(): void {
    this.eventStream.removeListener('data', this.onEvents);
    this.eventStream.removeListener('end', this.onEventEnd);
    this.eventStream.removeListener('error', this.onEventError);
  }
}

/** Starts the dedicated role-aware sampler without putting private identities on argv. */
export class LinuxPerformanceResourceSampler {
  public constructor(private readonly scriptPath: string) {}

  public start(
    input: Readonly<{
      readonly rootPid: number;
      readonly backend: PerformanceBackend;
      readonly expectedMainExecutableSha256: string;
      readonly eventStream: NodeJS.ReadableStream;
    }>,
  ): LinuxPerformanceResourceSamplerSession {
    if (
      !Number.isSafeInteger(input.rootPid) ||
      input.rootPid <= 1 ||
      !SHA256.test(input.expectedMainExecutableSha256)
    ) {
      throw new Error('Performance resource sampler input invalid');
    }
    const child = spawn('/usr/bin/python3', [this.scriptPath], {
      cwd: '/',
      env: { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const readiness = child.stdio[3] as NodeJS.ReadableStream | null;
    if (!readiness) {
      child.kill('SIGKILL');
      throw new Error('Performance resource sampler readiness unavailable');
    }
    child.stdin.write(
      `${JSON.stringify({
        schemaVersion: 3,
        backend: input.backend,
        rootPid: input.rootPid,
        deviceIndex: input.backend === 'cpu' ? null : 0,
        expectedMainExecutableSha256: input.expectedMainExecutableSha256,
      })}\n`,
    );
    return new LinuxPerformanceResourceSamplerSession(child, input.backend, input.eventStream, readiness);
  }
}
