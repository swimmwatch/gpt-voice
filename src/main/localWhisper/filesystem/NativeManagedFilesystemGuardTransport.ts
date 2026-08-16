import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import {
  MANAGED_FILESYSTEM_PROMOTION_DIAGNOSTIC_CODES,
  ManagedFilesystemAdapterError,
  type ManagedFilesystemPromotionDiagnosticCode,
} from './ManagedFilesystemPlatformAdapter';
import {
  createNativeRuntimeLogLaunchEnvironment,
  isNativeRuntimeProcessInstanceId,
} from '../supervisor/NativeRuntimeLogLaunchEnvironment';
import { NativeRuntimeLogStreamDecoder, type NativeRuntimeLogRelay } from '../supervisor/NativeRuntimeLogStreamDecoder';

// protocol.hpp is the canonical cross-language owner; parity tests pin these mirrors.
export const GUARD_PROTOCOL_VERSION = '2';
export const MAX_GUARD_REQUEST_PAYLOAD_BYTES = 256 * 1024;
export const GUARD_PROTOCOL_FUTURE_HEADROOM_BYTES = 4 * 1024;

const MAX_GUARD_REQUEST_ID_BYTES = 20;
const MAX_GUARD_FILE_TOKEN_BYTES = 'lease-'.length + 20;
const WRITE_FILE_COMMAND = 'WRITE_FILE';
const WRITE_FILE_SEPARATOR_BYTES = 4;
const MAX_ENCODED_FILE_TOKEN_BYTES = Math.ceil((MAX_GUARD_FILE_TOKEN_BYTES * 4) / 3);
const WRITE_FILE_FIXED_PAYLOAD_BYTES =
  MAX_GUARD_REQUEST_ID_BYTES +
  GUARD_PROTOCOL_VERSION.length +
  WRITE_FILE_COMMAND.length +
  MAX_ENCODED_FILE_TOKEN_BYTES +
  WRITE_FILE_SEPARATOR_BYTES;
const MAX_ENCODED_WRITE_FILE_CHUNK_BYTES =
  MAX_GUARD_REQUEST_PAYLOAD_BYTES - GUARD_PROTOCOL_FUTURE_HEADROOM_BYTES - WRITE_FILE_FIXED_PAYLOAD_BYTES;
export const MAX_GUARD_WRITE_FILE_CHUNK_BYTES = Math.floor((MAX_ENCODED_WRITE_FILE_CHUNK_BYTES * 3) / 4);

function promotionDiagnosticCode(value: string | undefined): ManagedFilesystemPromotionDiagnosticCode | undefined {
  return MANAGED_FILESYSTEM_PROMOTION_DIAGNOSTIC_CODES.includes(value as ManagedFilesystemPromotionDiagnosticCode)
    ? (value as ManagedFilesystemPromotionDiagnosticCode)
    : undefined;
}

export type ManagedFilesystemGuardRequestField = string | Uint8Array;

export interface ManagedFilesystemGuardTransport {
  request(
    command: string,
    arguments_: readonly ManagedFilesystemGuardRequestField[],
    signal?: AbortSignal,
  ): Promise<readonly string[]>;
  dispose(): Promise<void>;
}

export interface NativeManagedFilesystemGuardTransportDependencies {
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly executablePath: string;
  readonly generateProcessInstanceId: () => string;
  readonly nativeRuntimeLogRelay?: NativeRuntimeLogRelay;
  readonly platform: 'linux' | 'win32';
  readonly spawnProcess: typeof spawn;
}

interface PendingRequest {
  readonly onAbort: (() => void) | null;
  readonly reject: (error: Error) => void;
  readonly resolve: (fields: readonly string[]) => void;
  readonly signal: AbortSignal | null;
}

interface QueuedWrite {
  readonly child: ChildProcessWithoutNullStreams;
  readonly line: string;
  readonly requestId: number;
}

function encodeField(value: ManagedFilesystemGuardRequestField): string {
  return (typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value)).toString('base64url');
}

function decodeField(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function isSafeCommand(value: string): boolean {
  return /^[A-Z_]{1,32}$/.test(value);
}

function validateRequestFields(command: string, fields: readonly ManagedFilesystemGuardRequestField[]): void {
  if (command === WRITE_FILE_COMMAND) {
    const [fileToken, bytes] = fields;
    if (
      fields.length !== 2 ||
      typeof fileToken !== 'string' ||
      Buffer.byteLength(fileToken, 'utf8') > MAX_GUARD_FILE_TOKEN_BYTES ||
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength > MAX_GUARD_WRITE_FILE_CHUNK_BYTES
    ) {
      throw new ManagedFilesystemAdapterError('INVALID_INPUT');
    }
    return;
  }
  if (fields.some((field) => typeof field !== 'string')) {
    throw new ManagedFilesystemAdapterError('INVALID_INPUT');
  }
}

/** Owns one narrow native guard process and a bounded request/response protocol. */
export class NativeManagedFilesystemGuardTransport implements ManagedFilesystemGuardTransport {
  private child: ChildProcessWithoutNullStreams | null = null;
  private disposed = false;
  private nativeLogDecoder: NativeRuntimeLogStreamDecoder | null = null;
  private nextRequestId = 1;
  private outputBytes = Buffer.alloc(0);
  private readonly pending = new Map<number, PendingRequest>();
  private waitingForDrain = false;
  private readonly writeQueue: QueuedWrite[] = [];

  public constructor(private readonly dependencies: NativeManagedFilesystemGuardTransportDependencies) {}

  public async request(
    command: string,
    arguments_: readonly ManagedFilesystemGuardRequestField[],
    signal?: AbortSignal,
  ): Promise<readonly string[]> {
    if (this.disposed || !isSafeCommand(command)) throw new ManagedFilesystemAdapterError('INVALID_INPUT');
    if (signal?.aborted) throw new ManagedFilesystemAdapterError('IO_FAILED');
    validateRequestFields(command, arguments_);
    if (this.nextRequestId >= Number.MAX_SAFE_INTEGER) throw new ManagedFilesystemAdapterError('IO_FAILED');
    const requestId = this.nextRequestId;
    const line = [String(requestId), GUARD_PROTOCOL_VERSION, command, ...arguments_.map(encodeField)].join('\t');
    if (Buffer.byteLength(line, 'utf8') > MAX_GUARD_REQUEST_PAYLOAD_BYTES) {
      throw new ManagedFilesystemAdapterError('INVALID_INPUT');
    }
    this.nextRequestId += 1;
    const child = this.ensureStarted();
    return await new Promise<readonly string[]>((resolve, reject) => {
      const onAbort = signal
        ? (): void => {
            if (this.pending.has(requestId)) this.failProcess(child);
          }
        : null;
      this.pending.set(requestId, { onAbort, reject, resolve, signal: signal ?? null });
      if (signal && onAbort) {
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) {
          this.failProcess(child);
          return;
        }
      }
      this.writeQueue.push({ child, line: `${line}\n`, requestId });
      this.flushWrites(child);
    });
  }

  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const child = this.child;
    this.child = null;
    this.finishNativeLogDecoder();
    this.outputBytes = Buffer.alloc(0);
    this.waitingForDrain = false;
    this.writeQueue.length = 0;
    this.rejectAll();
    if (!child) return;
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      child.once('exit', () => resolve());
      child.stdin.end();
    });
  }

  private ensureStarted(): ChildProcessWithoutNullStreams {
    if (this.child) return this.child;
    const processInstanceId = this.dependencies.generateProcessInstanceId();
    if (!isNativeRuntimeProcessInstanceId(processInstanceId)) {
      throw new ManagedFilesystemAdapterError('IO_FAILED');
    }
    const nativeLogDecoder = this.dependencies.nativeRuntimeLogRelay
      ? new NativeRuntimeLogStreamDecoder({
          expectedProcessInstanceId: processInstanceId,
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
    this.nativeLogDecoder = nativeLogDecoder;
    if (nativeLogDecoder) {
      child.stderr.on('data', (chunk: Buffer) => nativeLogDecoder.append(chunk));
      child.stderr.once('end', () => nativeLogDecoder.finish());
    } else {
      child.stderr.resume();
    }
    child.stdin.on('error', () => this.failProcess(child));
    child.stdout.on('data', (chunk: Buffer) => this.handleOutput(child, chunk));
    child.once('error', () => this.failProcess(child));
    child.once('exit', () => this.failProcess(child));
    return child;
  }

  private handleOutput(child: ChildProcessWithoutNullStreams, chunk: Buffer): void {
    if (this.child !== child) return;
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(0x0a, offset);
      const payloadEnd = newline === -1 ? chunk.length : newline;
      if (this.outputBytes.length + payloadEnd - offset > MAX_GUARD_REQUEST_PAYLOAD_BYTES) {
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
    let decoded: readonly string[];
    try {
      decoded = fields.slice(3).map(decodeField);
    } catch {
      this.failProcess(child);
      return;
    }
    this.takePending(requestId);
    if (fields[2] === 'OK') {
      pending.resolve(Object.freeze(decoded));
      return;
    }
    const code = decoded[0];
    const diagnostic = code === 'IO_FAILED' ? promotionDiagnosticCode(decoded[1]) : undefined;
    if (decoded.length !== 1 && (decoded.length !== 2 || !diagnostic)) {
      this.failProcess(child);
      return;
    }
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
        diagnostic,
      ),
    );
  }

  private failProcess(child: ChildProcessWithoutNullStreams): void {
    if (this.child !== child) return;
    this.child = null;
    this.finishNativeLogDecoder();
    this.outputBytes = Buffer.alloc(0);
    this.waitingForDrain = false;
    this.writeQueue.length = 0;
    if (child.exitCode === null && !child.killed) child.kill();
    this.rejectAll();
  }

  private rejectAll(): void {
    const pendingRequests = [...this.pending.values()];
    this.pending.clear();
    for (const pending of pendingRequests) {
      this.removeAbortListener(pending);
      pending.reject(new ManagedFilesystemAdapterError('IO_FAILED'));
    }
  }

  private flushWrites(child: ChildProcessWithoutNullStreams): void {
    if (this.child !== child || this.waitingForDrain) return;
    while (this.writeQueue.length > 0) {
      const queued = this.writeQueue.shift();
      if (!queued || queued.child !== child || !this.pending.has(queued.requestId)) continue;
      let accepted: boolean;
      try {
        accepted = child.stdin.write(queued.line, 'utf8', (error) => {
          if (error) this.failProcess(child);
        });
      } catch {
        this.failProcess(child);
        return;
      }
      if (accepted) continue;
      this.waitingForDrain = true;
      child.stdin.once('drain', () => {
        if (this.child !== child || !this.waitingForDrain) return;
        this.waitingForDrain = false;
        this.flushWrites(child);
      });
      return;
    }
  }

  private takePending(requestId: number): PendingRequest | null {
    const pending = this.pending.get(requestId);
    if (!pending) return null;
    this.pending.delete(requestId);
    this.removeAbortListener(pending);
    return pending;
  }

  private removeAbortListener(pending: PendingRequest): void {
    if (pending.signal && pending.onAbort) pending.signal.removeEventListener('abort', pending.onAbort);
  }

  private finishNativeLogDecoder(): void {
    const decoder = this.nativeLogDecoder;
    this.nativeLogDecoder = null;
    decoder?.finish();
  }
}
