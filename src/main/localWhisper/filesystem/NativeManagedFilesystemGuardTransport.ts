import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import { ManagedFilesystemAdapterError } from './ManagedFilesystemPlatformAdapter';

const GUARD_PROTOCOL_VERSION = '1';
const MAX_GUARD_LINE_BYTES = 256 * 1024;

export interface ManagedFilesystemGuardTransport {
  request(command: string, arguments_: readonly string[]): Promise<readonly string[]>;
  dispose(): Promise<void>;
}

export interface NativeManagedFilesystemGuardTransportDependencies {
  readonly executablePath: string;
  readonly spawnProcess: typeof spawn;
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
  private disposed = false;
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
    if (this.disposed) return;
    this.disposed = true;
    const child = this.child;
    this.child = null;
    this.outputBytes = Buffer.alloc(0);
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
    const child = this.dependencies.spawnProcess(this.dependencies.executablePath, [], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child = child;
    child.stderr.resume();
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
    this.child = null;
    this.outputBytes = Buffer.alloc(0);
    if (child.exitCode === null && !child.killed) child.kill();
    this.rejectAll();
  }

  private rejectAll(): void {
    for (const pending of this.pending.values()) pending.reject(new ManagedFilesystemAdapterError('IO_FAILED'));
    this.pending.clear();
  }
}
