import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';

import type { LocalWhisperPerformancePhaseId } from './QualificationContracts';
import { PerformanceQualificationEventWriter } from './PerformanceQualificationEventProtocol';
import type { PerformanceBackend } from './PerformanceQualification';

const NATIVE_FRAME_LIMIT = 128;
const NATIVE_BYTE_LIMIT = 64 * 1024;
const NATIVE_FRAME = /^LWQP1\t(phase|worker)\t([A-Za-z][A-Za-z0-9]{1,63})\t([1-9]\d*)$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export interface PerformanceAttemptProcessIdentity {
  readonly pid: number;
  readonly processStartIdentity: string;
  readonly executableSha256: string;
}

export class LinuxPerformanceAttemptProbeError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'LinuxPerformanceAttemptProbeError';
  }
}

function fail(): never {
  throw new LinuxPerformanceAttemptProbeError('ATTEMPT_PROBE_INVALID');
}

function positiveNanoseconds(value: bigint | number): number {
  const numeric = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(numeric) || numeric < 0) fail();
  return Math.max(1, numeric);
}

async function sha256File(filePath: string): Promise<string> {
  const handle = await open(filePath, 'r').catch(() => fail());
  try {
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let offset = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, offset).catch(() => fail());
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    return hash.digest('hex');
  } finally {
    await handle.close().catch(() => undefined);
  }
}

export async function authenticateLinuxPerformanceProcess(pid: number): Promise<PerformanceAttemptProcessIdentity> {
  if (process.platform !== 'linux' || !Number.isSafeInteger(pid) || pid <= 1) fail();
  const stat = await readFile(`/proc/${pid}/stat`, 'ascii').catch(() => fail());
  const end = stat.lastIndexOf(') ');
  const fields =
    end < 0
      ? []
      : stat
          .slice(end + 2)
          .trim()
          .split(/\s+/u);
  const processStartIdentity = fields[19];
  if (!processStartIdentity || !/^\d{1,32}$/u.test(processStartIdentity)) fail();
  const executableSha256 = await sha256File(`/proc/${pid}/exe`);
  if (!SHA256.test(executableSha256)) fail();
  const after = await readFile(`/proc/${pid}/stat`, 'ascii').catch(() => fail());
  const afterEnd = after.lastIndexOf(') ');
  const afterFields =
    afterEnd < 0
      ? []
      : after
          .slice(afterEnd + 2)
          .trim()
          .split(/\s+/u);
  if (afterFields[19] !== processStartIdentity) fail();
  return Object.freeze({ pid, processStartIdentity, executableSha256 });
}

interface PendingGuardRequest {
  readonly command: string;
  readonly started: bigint;
  readonly pipeStarted: bigint;
}

/** Owns all private probe state for one attempt; no process-global instrumentation is used. */
export class LinuxPerformanceAttemptProbe {
  private readonly writer: PerformanceQualificationEventWriter;
  private readonly phaseTotals = new Map<LocalWhisperPerformancePhaseId, number>();
  private readonly pendingGuardRequests = new Map<number, PendingGuardRequest>();
  private readonly directoryProofDurations: number[] = [];
  private nativeBytes = 0;
  private nativeFrames = 0;
  private nativePending = Buffer.alloc(0);
  private loadProofsActive = false;
  private workerPid: number | null = null;
  private workerPublished = false;
  private workerRegistration: Promise<void> | null = null;
  private guardPublished = false;
  private guardRegistration: Promise<void> | null = null;
  private terminal = false;
  private probeFailure: LinuxPerformanceAttemptProbeError | null = null;

  public constructor(
    private readonly backend: PerformanceBackend,
    publishEvent: (frame: Buffer) => void,
  ) {
    this.writer = new PerformanceQualificationEventWriter(
      new Writable({
        write(chunk: Buffer | string, _encoding, callback) {
          publishEvent(Buffer.from(chunk));
          callback();
        },
      }),
    );
  }

  public async registerMain(): Promise<void> {
    this.writer.role({ role: 'main', ...(await authenticateLinuxPerformanceProcess(process.pid)) });
  }

  public async registerGuard(pid: number): Promise<void> {
    if (this.guardPublished || this.guardRegistration || this.terminal) {
      this.recordFailure();
      return;
    }
    this.guardRegistration = (async () => {
      try {
        this.writer.role({ role: 'guard', ...(await authenticateLinuxPerformanceProcess(pid)) });
        this.guardPublished = true;
        await this.publishWorkerIfReady();
      } catch (error) {
        this.recordFailure(error);
      }
    })();
    await this.guardRegistration;
  }

  public beginLoadProofs(): void {
    if (this.loadProofsActive) fail();
    this.loadProofsActive = true;
  }

  public async finish(): Promise<void> {
    await this.guardRegistration;
    await this.publishWorkerIfReady();
    await this.workerRegistration;
    if (
      this.probeFailure ||
      this.terminal ||
      !this.guardPublished ||
      !this.workerPublished ||
      this.directoryProofDurations.length < 5 ||
      this.nativePending.byteLength !== 0 ||
      this.pendingGuardRequests.size !== 0
    ) {
      fail();
    }
    const directory = this.directoryProofDurations;
    this.phase('directoryProofRuntimeAcquisition', directory[0]!);
    this.phase('directoryProofModelAcquisition', directory[2]!);
    this.phase('directoryProofRuntimePreSpawn', directory[1]!);
    this.phase('directoryProofModelPreSpawn', directory[3]!);
    this.phase('directoryProofModelPreLoad', directory[4]!);
    for (const phaseId of NATIVE_LOAD_PHASES) this.phase(phaseId, this.requiredTotal(phaseId));
    if (this.backend === 'cpu') this.writer.phase('gpuUploadAllocation', null, 'notApplicable');
    else this.phase('gpuUploadAllocation', this.requiredTotal('gpuUploadAllocation'));
    for (const phaseId of INSTALLATION_PHASES) this.phase(phaseId, this.requiredTotal(phaseId));
    this.terminal = true;
    this.writer.success();
  }

  public instrumentedSpawn(): typeof spawn {
    const instrument = (
      command: string,
      argumentsOrOptions?: readonly string[] | SpawnOptions,
      maybeOptions?: SpawnOptions,
    ): ChildProcess => {
      const hasArguments = Array.isArray(argumentsOrOptions);
      const arguments_ = hasArguments ? (argumentsOrOptions as readonly string[]) : [];
      const options: SpawnOptions = hasArguments
        ? (maybeOptions ?? {})
        : ((argumentsOrOptions as SpawnOptions | undefined) ?? {});
      const stdio = Array.isArray(options.stdio) ? [...options.stdio] : ['pipe', 'pipe', 'pipe'];
      while (stdio.length < 5) stdio.push('ignore');
      stdio[5] = 'pipe';
      const spawnConcrete = spawn as unknown as (
        executable: string,
        arguments_: readonly string[],
        options: SpawnOptions,
      ) => ChildProcess;
      const child = spawnConcrete(command, arguments_, {
        ...options,
        stdio: stdio as SpawnOptions['stdio'],
      });
      const native = (child.stdio as readonly unknown[])[5];
      if (!native || typeof native !== 'object' || !('on' in native) || typeof native.on !== 'function') {
        child.kill('SIGKILL');
        fail();
      }
      native.on('data', (chunk: Buffer | string) => {
        try {
          this.consumeNative(Buffer.from(chunk));
        } catch (error) {
          this.recordFailure(error);
          if (child.exitCode === null && !child.killed) child.kill('SIGKILL');
        }
      });
      native.on('error', (error: Error) => this.recordFailure(error));
      this.observeGuardProtocol(child);
      return child;
    };
    return instrument as typeof spawn;
  }

  private observeGuardProtocol(child: ChildProcess): void {
    const input = child.stdin;
    const output = child.stdout;
    if (!input || !output) return;
    const originalWrite = input.write.bind(input);
    input.write = ((chunk: string | Uint8Array, ...arguments_: readonly unknown[]): boolean => {
      const bytes = Buffer.from(chunk);
      const line = bytes.toString('utf8').trimEnd();
      const fields = line.split('\t');
      const requestId = Number(fields[0]);
      const command = fields[2];
      if (Number.isSafeInteger(requestId) && requestId > 0 && command && /^[A-Z_]{1,32}$/u.test(command)) {
        const encodeStarted = process.hrtime.bigint();
        if (command === 'WRITE_FILE') {
          const encoded = fields[fields.length - 1] ?? '';
          const roundTrip = Buffer.from(encoded, 'base64url').toString('base64url');
          if (roundTrip !== encoded) fail();
          this.add('installationEncode', process.hrtime.bigint() - encodeStarted);
        }
        const started = process.hrtime.bigint();
        this.pendingGuardRequests.set(requestId, { command, started, pipeStarted: started });
        const callbackIndex = arguments_.findIndex((value) => typeof value === 'function');
        const callback = callbackIndex < 0 ? null : (arguments_[callbackIndex] as (error?: Error | null) => void);
        if (callback) {
          const mutable = [...arguments_];
          mutable[callbackIndex] = (error?: Error | null): void => {
            this.add('installationPipeWait', process.hrtime.bigint() - started);
            callback(error);
          };
          return Reflect.apply(originalWrite, input, [chunk, ...mutable]) as boolean;
        }
      }
      return Reflect.apply(originalWrite, input, [chunk, ...arguments_]) as boolean;
    }) as typeof input.write;
    let pending = Buffer.alloc(0);
    output.on('data', (chunk: Buffer | string) => {
      pending = Buffer.concat([pending, Buffer.from(chunk)]);
      while (true) {
        const newline = pending.indexOf(0x0a);
        if (newline < 0) break;
        const line = pending.subarray(0, newline).toString('utf8');
        pending = pending.subarray(newline + 1);
        const requestId = Number(line.split('\t')[0]);
        const request = this.pendingGuardRequests.get(requestId);
        if (!request) continue;
        this.pendingGuardRequests.delete(requestId);
        const duration = process.hrtime.bigint() - request.started;
        if (this.loadProofsActive && request.command === 'LIST' && this.directoryProofDurations.length < 5) {
          this.directoryProofDurations.push(positiveNanoseconds(duration));
        }
      }
    });
  }

  private consumeNative(chunk: Buffer): void {
    if (this.terminal || this.probeFailure) fail();
    this.nativeBytes += chunk.byteLength;
    if (this.nativeBytes > NATIVE_BYTE_LIMIT) fail();
    this.nativePending = Buffer.concat([this.nativePending, chunk]);
    while (true) {
      const newline = this.nativePending.indexOf(0x0a);
      if (newline < 0) break;
      if (newline === 0 || newline > 1024 || this.nativePending.subarray(0, newline).includes(0x0d)) fail();
      const line = this.nativePending.subarray(0, newline).toString('ascii');
      this.nativePending = this.nativePending.subarray(newline + 1);
      this.nativeFrames += 1;
      if (this.nativeFrames > NATIVE_FRAME_LIMIT) fail();
      const match = NATIVE_FRAME.exec(line);
      if (!match) fail();
      const value = Number(match[3]);
      if (!Number.isSafeInteger(value) || value < 1) fail();
      if (match[1] === 'worker') {
        if (match[2] !== 'pid' || this.workerPid !== null) fail();
        this.workerPid = value;
        void this.publishWorkerIfReady();
      } else if (NATIVE_PHASE_SET.has(match[2] as LocalWhisperPerformancePhaseId)) {
        this.add(match[2] as LocalWhisperPerformancePhaseId, value);
      } else {
        fail();
      }
    }
    if (this.nativePending.byteLength > 1024) fail();
  }

  private async publishWorkerIfReady(): Promise<void> {
    const workerPid = this.workerPid;
    if (!this.guardPublished || this.workerPublished || workerPid === null || this.probeFailure) return;
    if (!this.workerRegistration) {
      this.workerRegistration = (async () => {
        try {
          this.writer.role({ role: 'worker', ...(await authenticateLinuxPerformanceProcess(workerPid)) });
          this.workerPublished = true;
        } catch (error) {
          this.recordFailure(error);
        }
      })();
    }
    await this.workerRegistration;
  }

  private recordFailure(_error?: unknown): void {
    this.probeFailure ??= new LinuxPerformanceAttemptProbeError('ATTEMPT_PROBE_INVALID');
  }

  private add(phaseId: LocalWhisperPerformancePhaseId, value: bigint | number): void {
    const duration = positiveNanoseconds(value);
    const current = this.phaseTotals.get(phaseId) ?? 0;
    if (!Number.isSafeInteger(current + duration)) fail();
    this.phaseTotals.set(phaseId, current + duration);
  }

  private requiredTotal(phaseId: LocalWhisperPerformancePhaseId): number {
    const value = this.phaseTotals.get(phaseId);
    if (!value) fail();
    return value;
  }

  private phase(phaseId: LocalWhisperPerformancePhaseId, durationNanoseconds: number): void {
    this.writer.phase(phaseId, positiveNanoseconds(durationNanoseconds));
  }
}

const NATIVE_LOAD_PHASES = Object.freeze([
  'nativeModelGuardDigest',
  'nativeAuthorityDigest',
  'workerPreflightDigest',
  'workerLoaderDigest',
  'guardedProcessCreation',
  'authorityTransfer',
  'modelPreflight',
  'whisperLoad',
  'inferenceWarmup',
] as const satisfies readonly LocalWhisperPerformancePhaseId[]);
const INSTALLATION_PHASES = Object.freeze([
  'installationEncode',
  'installationPipeWait',
  'installationDecode',
  'installationWrite',
] as const satisfies readonly LocalWhisperPerformancePhaseId[]);
const NATIVE_PHASE_SET: ReadonlySet<LocalWhisperPerformancePhaseId> = new Set([
  ...NATIVE_LOAD_PHASES,
  'gpuUploadAllocation',
  'installationDecode',
  'installationWrite',
]);
