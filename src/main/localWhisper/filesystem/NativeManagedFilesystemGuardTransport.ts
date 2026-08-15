import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import { ManagedFilesystemAdapterError } from './ManagedFilesystemPlatformAdapter';
import {
  createNativeRuntimeLogLaunchEnvironment,
  isNativeRuntimeProcessInstanceId,
} from '../supervisor/NativeRuntimeLogLaunchEnvironment';
import { NativeRuntimeLogStreamDecoder, type NativeRuntimeLogRelay } from '../supervisor/NativeRuntimeLogStreamDecoder';

const GUARD_PROTOCOL_VERSION = '1';
const MAX_GUARD_LINE_BYTES = 256 * 1024;
const GUARD_DISPOSE_TIMEOUT_MS = 5_000;

export interface ManagedFilesystemGuardTransport {
  request(command: string, arguments_: readonly string[]): Promise<readonly string[]>;
  dispose(): Promise<void>;
}

export interface NativeManagedFilesystemGuardTransportDependencies {
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly executablePath: string;
  readonly generateProcessInstanceId: () => string;
  readonly nativeRuntimeLogRelay?: NativeRuntimeLogRelay;
  readonly platform: 'linux' | 'win32';
  readonly spawnProcess: typeof spawn;
  readonly clearTimeout?: (handle: unknown) => void;
  readonly disposeTimeoutMs?: number;
  readonly setTimeout?: (callback: () => void, milliseconds: number) => unknown;
}

interface PendingRequest {
  readonly reject: (error: Error) => void;
  readonly resolve: (fields: readonly string[]) => void;
}

function encodeField(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeField(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function isSafeCommand(value: string): boolean {
  return /^[A-Z_]{1,32}$/.test(value);
}

/** Owns one narrow native guard process and a bounded request/response protocol. */
export class NativeManagedFilesystemGuardTransport implements ManagedFilesystemGuardTransport {
  private child: ChildProcessWithoutNullStreams | null = null;
  private childFailed = false;
  private disposal: Promise<void> | null = null;
  private disposed = false;
  private nativeLogDecoder: NativeRuntimeLogStreamDecoder | null = null;
  private nextRequestId = 1;
  private outputBytes = Buffer.alloc(0);
  private readonly pending = new Map<number, PendingRequest>();

  public constructor(private readonly dependencies: NativeManagedFilesystemGuardTransportDependencies) {}

  public async request(command: string, arguments_: readonly string[]): Promise<readonly string[]> {
    if (this.disposed || !isSafeCommand(command)) throw new ManagedFilesystemAdapterError('INVALID_INPUT');
    const child = this.ensureStarted();
    if (this.nextRequestId >= Number.MAX_SAFE_INTEGER) throw new ManagedFilesystemAdapterError('IO_FAILED');
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    const line = [String(requestId), GUARD_PROTOCOL_VERSION, command, ...arguments_.map(encodeField)].join('\t');
    if (Buffer.byteLength(line, 'utf8') > MAX_GUARD_LINE_BYTES) {
      throw new ManagedFilesystemAdapterError('INVALID_INPUT');
    }
    return await new Promise<readonly string[]>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      child.stdin.write(`${line}\n`, 'utf8', (error) => {
        if (!error) return;
        this.pending.delete(requestId);
        reject(new ManagedFilesystemAdapterError('IO_FAILED'));
      });
    });
  }

  public async dispose(): Promise<void> {
    this.disposed = true;
    if (this.disposal) return await this.disposal;
    const disposal = this.disposeOwnedChild();
    this.disposal = disposal;
    try {
      await disposal;
    } finally {
      if (this.disposal === disposal) this.disposal = null;
    }
  }

  private async disposeOwnedChild(): Promise<void> {
    const child = this.child;
    this.finishNativeLogDecoder();
    this.outputBytes = Buffer.alloc(0);
    this.rejectAll();
    if (!child) return;
    child.stdin.end();
    if (await this.waitForExit(child)) {
      this.confirmProcessExit(child);
      return;
    }
    child.kill('SIGKILL');
    if (!(await this.waitForExit(child))) throw new Error('Local Whisper filesystem guard cleanup failed');
    this.confirmProcessExit(child);
  }

  private ensureStarted(): ChildProcessWithoutNullStreams {
    if (this.child) {
      if (this.childFailed) throw new ManagedFilesystemAdapterError('IO_FAILED');
      return this.child;
    }
    const processInstanceId = this.dependencies.generateProcessInstanceId();
    if (!isNativeRuntimeProcessInstanceId(processInstanceId)) {
      throw new ManagedFilesystemAdapterError('IO_FAILED');
    }
    const nativeLogDecoder = this.dependencies.nativeRuntimeLogRelay
      ? new NativeRuntimeLogStreamDecoder({
          expectedProcessInstanceIds: [processInstanceId],
          onRecord: (record) => this.dependencies.nativeRuntimeLogRelay?.accept(record),
        })
      : null;
    const child = this.dependencies.spawnProcess(this.dependencies.executablePath, [], {
      env: createNativeRuntimeLogLaunchEnvironment(
        this.dependencies.platform,
        this.dependencies.environment,
        processInstanceId,
      ),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child = child;
    this.childFailed = false;
    this.nativeLogDecoder = nativeLogDecoder;
    if (nativeLogDecoder) {
      child.stderr.on('data', (chunk: Buffer) => nativeLogDecoder.append(chunk));
      child.stderr.once('end', () => nativeLogDecoder.finish());
    } else {
      child.stderr.resume();
    }
    child.stdout.on('data', (chunk: Buffer) => this.handleOutput(child, chunk));
    child.once('error', () => this.failProcess(child));
    child.once('exit', () => this.confirmProcessExit(child));
    return child;
  }

  private handleOutput(child: ChildProcessWithoutNullStreams, chunk: Buffer): void {
    if (this.child !== child) return;
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(0x0a, offset);
      const payloadEnd = newline === -1 ? chunk.length : newline;
      if (this.outputBytes.length + payloadEnd - offset > MAX_GUARD_LINE_BYTES) {
        this.failProcess(child);
        return;
      }
      if (payloadEnd > offset) {
        this.outputBytes = Buffer.concat([this.outputBytes, chunk.subarray(offset, payloadEnd)]);
      }
      if (newline === -1) return;
      this.handleLine(child, this.outputBytes.toString('utf8'));
      if (this.child !== child) return;
      this.outputBytes = Buffer.alloc(0);
      offset = newline + 1;
    }
  }

  private handleLine(child: ChildProcessWithoutNullStreams, line: string): void {
    const fields = (line.endsWith('\r') ? line.slice(0, -1) : line).split('\t');
    const requestId = Number(fields[0]);
    const pending = this.pending.get(requestId);
    if (!pending || fields[1] !== GUARD_PROTOCOL_VERSION || (fields[2] !== 'OK' && fields[2] !== 'ERR')) {
      this.failProcess(child);
      return;
    }
    this.pending.delete(requestId);
    let decoded: readonly string[];
    try {
      decoded = fields.slice(3).map(decodeField);
    } catch {
      pending.reject(new ManagedFilesystemAdapterError('IO_FAILED'));
      return;
    }
    if (fields[2] === 'OK') {
      pending.resolve(Object.freeze(decoded));
      return;
    }
    const code = decoded[0];
    pending.reject(
      new ManagedFilesystemAdapterError(
        code === 'CONFLICT' ||
          code === 'IDENTITY_CHANGED' ||
          code === 'INVALID_INPUT' ||
          code === 'NOT_FOUND' ||
          code === 'UNSAFE_ENTRY' ||
          code === 'UNSUPPORTED'
          ? code
          : 'IO_FAILED',
      ),
    );
  }

  private failProcess(child: ChildProcessWithoutNullStreams): void {
    if (this.child !== child) return;
    if (child.pid === undefined) {
      this.confirmProcessExit(child);
      return;
    }
    this.childFailed = true;
    this.finishNativeLogDecoder();
    this.outputBytes = Buffer.alloc(0);
    if (child.exitCode === null && !child.killed) child.kill();
    this.rejectAll();
  }

  private confirmProcessExit(child: ChildProcessWithoutNullStreams): void {
    if (this.child !== child) return;
    this.child = null;
    this.childFailed = false;
    this.finishNativeLogDecoder();
    this.outputBytes = Buffer.alloc(0);
    this.rejectAll();
  }

  private rejectAll(): void {
    for (const pending of this.pending.values()) pending.reject(new ManagedFilesystemAdapterError('IO_FAILED'));
    this.pending.clear();
  }

  private finishNativeLogDecoder(): void {
    const decoder = this.nativeLogDecoder;
    this.nativeLogDecoder = null;
    decoder?.finish();
  }

  private waitForExit(child: ChildProcessWithoutNullStreams): Promise<boolean> {
    if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
    const timeoutMs = this.dependencies.disposeTimeoutMs ?? GUARD_DISPOSE_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) {
      return Promise.reject(new Error('Invalid Local Whisper filesystem guard cleanup timeout'));
    }
    const schedule = this.dependencies.setTimeout ?? ((callback, milliseconds) => setTimeout(callback, milliseconds));
    const cancel =
      this.dependencies.clearTimeout ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timer: unknown = null;
      const finish = (exited: boolean): void => {
        if (settled) return;
        settled = true;
        child.removeListener('exit', onExit);
        if (timer !== null) cancel(timer);
        resolve(exited);
      };
      const onExit = (): void => finish(true);
      child.once('exit', onExit);
      timer = schedule(() => finish(false), timeoutMs);
      if (settled) cancel(timer);
    });
  }
}
