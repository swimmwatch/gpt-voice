import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';

import { ManagedFilesystemAdapterError } from './ManagedFilesystemPlatformAdapter';

const GUARD_PROTOCOL_VERSION = '1';
const MAX_RESPONSE_LINE_BYTES = 256 * 1024;

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
  private readonly pending = new Map<number, PendingRequest>();
  private output: ReadlineInterface | null = null;

  public constructor(private readonly dependencies: NativeManagedFilesystemGuardTransportDependencies) {}

  public async request(command: string, arguments_: readonly string[]): Promise<readonly string[]> {
    if (this.disposed || !isSafeCommand(command)) throw new ManagedFilesystemAdapterError('INVALID_INPUT');
    const child = this.ensureStarted();
    if (this.nextRequestId >= Number.MAX_SAFE_INTEGER) throw new ManagedFilesystemAdapterError('IO_FAILED');
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    const line = [String(requestId), GUARD_PROTOCOL_VERSION, command, ...arguments_.map(encodeField)].join('\t');
    if (Buffer.byteLength(line, 'utf8') > MAX_RESPONSE_LINE_BYTES) {
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
    this.output?.close();
    this.output = null;
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
    this.output = createInterface({ input: child.stdout, crlfDelay: Number.POSITIVE_INFINITY });
    this.output.on('line', (line) => this.handleLine(line));
    child.once('error', () => this.failProcess());
    child.once('exit', () => this.failProcess());
    return child;
  }

  private handleLine(line: string): void {
    if (Buffer.byteLength(line, 'utf8') > MAX_RESPONSE_LINE_BYTES) {
      this.failProcess();
      return;
    }
    const fields = line.split('\t');
    const requestId = Number(fields[0]);
    const pending = this.pending.get(requestId);
    if (!pending || fields[1] !== GUARD_PROTOCOL_VERSION || (fields[2] !== 'OK' && fields[2] !== 'ERR')) {
      this.failProcess();
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

  private failProcess(): void {
    this.child = null;
    this.output?.close();
    this.output = null;
    this.rejectAll();
  }

  private rejectAll(): void {
    for (const pending of this.pending.values()) pending.reject(new ManagedFilesystemAdapterError('IO_FAILED'));
    this.pending.clear();
  }
}
