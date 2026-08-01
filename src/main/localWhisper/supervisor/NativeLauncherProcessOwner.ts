import { spawn, type ChildProcess } from 'node:child_process';
import { posix, win32 } from 'node:path';
import type { Readable, Writable } from 'node:stream';

import type { ManagedArtifactIdentitySnapshot } from '../filesystem/ManagedArtifactLease';
import type {
  LocalWhisperOwnedWorkerProcess,
  LocalWhisperWorkerLaunchAuthority,
  LocalWhisperWorkerOwnershipRecord,
  LocalWhisperWorkerProcessOwner,
} from './WorkerProcessOwnership';
import { NativeOwnedWorkerProcess } from './NativeOwnedWorkerProcess';

const LAUNCHER_ARGUMENT = '--local-whisper-launcher-v1';
const LAUNCHER_ACK_TIMEOUT_MS = 10_000;
const MAX_LAUNCHER_ACK_BYTES = 256;

export interface NativeLauncherProcessOwnerDependencies {
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly getProcessStartIdentity: (pid: number) => Promise<string>;
  readonly launcherExecutablePath: string;
  readonly platform: 'linux' | 'win32';
  readonly spawnProcess?: typeof spawn;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function identityFields(identity: ManagedArtifactIdentitySnapshot): readonly string[] {
  return Object.freeze([
    encode(identity.deviceOrVolumeId),
    encode(identity.fileId),
    String(identity.linkCount),
    String(identity.mode),
    encode(identity.parentFileId),
    String(identity.sizeBytes),
    identity.type,
  ]);
}

function bootstrapLine(authority: LocalWhisperWorkerLaunchAuthority, nonce: string): string {
  const fields = [
    'LWLP1',
    nonce,
    encode(authority.workerExecutablePath),
    encode(authority.workingDirectoryPath),
    authority.workerFileSha256,
    ...identityFields(authority.workerFileIdentity),
    ...identityFields(authority.runtimeLease.metadata.identity),
  ];
  const line = `${fields.join('\t')}\n`;
  if (Buffer.byteLength(line, 'utf8') > 64 * 1024) {
    throw new Error('Local Whisper launcher bootstrap exceeded');
  }
  return line;
}

function sanitizedEnvironment(platform: 'linux' | 'win32', source: Readonly<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
  if (platform === 'linux') return { LANG: 'C', LC_ALL: 'C' };
  const result: NodeJS.ProcessEnv = {};
  for (const key of ['SystemRoot', 'WINDIR'] as const) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) result[key] = value;
  }
  return result;
}

function requireStream<T>(value: T | null | undefined, label: string): T {
  if (!value) throw new Error(`Local Whisper launcher ${label} unavailable`);
  return value;
}

/** Shared reviewed launcher protocol; platform classes own termination semantics. */
export abstract class NativeLauncherProcessOwner implements LocalWhisperWorkerProcessOwner {
  protected constructor(private readonly dependencies: NativeLauncherProcessOwnerDependencies) {}

  public async launch(
    authority: LocalWhisperWorkerLaunchAuthority,
    appInstanceNonce: string,
  ): Promise<LocalWhisperOwnedWorkerProcess> {
    const path = this.dependencies.platform === 'win32' ? win32 : posix;
    if (
      !path.isAbsolute(this.dependencies.launcherExecutablePath) ||
      !path.isAbsolute(authority.workerExecutablePath) ||
      !path.isAbsolute(authority.workingDirectoryPath)
    ) {
      throw new Error('Local Whisper launcher paths must be absolute');
    }
    const spawnProcess = this.dependencies.spawnProcess ?? spawn;
    const child = spawnProcess(this.dependencies.launcherExecutablePath, [LAUNCHER_ARGUMENT], {
      cwd: authority.workingDirectoryPath,
      detached: false,
      env: sanitizedEnvironment(this.dependencies.platform, this.dependencies.environment),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const pid = child.pid;
    if (!pid) {
      child.kill('SIGKILL');
      throw new Error('Local Whisper launcher failed to start');
    }
    const input = requireStream(child.stdin, 'stdin');
    const output = requireStream(child.stdout, 'stdout');
    const stderr = requireStream(child.stderr, 'stderr');
    const control = requireStream(child.stdio[3] as Writable | null, 'control input');
    const acknowledgment = requireStream(child.stdio[4] as Readable | null, 'control output');
    try {
      const processStartIdentity = await this.dependencies.getProcessStartIdentity(pid);
      await this.writeBootstrap(control, bootstrapLine(authority, appInstanceNonce));
      const workerProcessGroupId = await this.waitForAcknowledgment(child, acknowledgment);
      return new NativeOwnedWorkerProcess({
        child,
        control,
        input,
        output,
        platform: this.dependencies.platform,
        processStartIdentity,
        stderr,
        workerProcessGroupId,
      });
    } catch (error) {
      control.destroy();
      child.kill('SIGKILL');
      throw error;
    } finally {
      acknowledgment.destroy();
    }
  }

  public async recoverOwnedOrphan(record: LocalWhisperWorkerOwnershipRecord): Promise<boolean> {
    try {
      const currentIdentity = await this.dependencies.getProcessStartIdentity(record.pid);
      // A live matching launcher cannot be safely adopted after its control pipe was lost.
      return currentIdentity !== record.processStartIdentity;
    } catch {
      return true;
    }
  }

  private writeBootstrap(stream: Writable, line: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      stream.write(line, 'utf8', (error) => {
        if (error) reject(new Error('Local Whisper launcher bootstrap failed'));
        else resolve();
      });
    });
  }

  private waitForAcknowledgment(child: ChildProcess, stream: Readable): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      let bytes = Buffer.alloc(0);
      let settled = false;
      let timer: NodeJS.Timeout | null = null;
      const finish = (workerProcessGroupId: number | null, error?: Error): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        stream.off('data', onData);
        stream.off('end', onStreamEnd);
        child.off('error', onChildError);
        child.off('exit', onChildExit);
        if (error || workerProcessGroupId === null) reject(error ?? new Error('Invalid launcher acknowledgment'));
        else resolve(workerProcessGroupId);
      };
      const onData = (chunk: Buffer): void => {
        bytes = Buffer.concat([bytes, chunk]);
        if (bytes.byteLength > MAX_LAUNCHER_ACK_BYTES) {
          finish(null, new Error('Local Whisper launcher acknowledgment exceeded'));
          return;
        }
        const newline = bytes.indexOf(0x0a);
        if (newline < 0) return;
        const line = bytes.subarray(0, newline).toString('utf8');
        if (!/^READY\t[1-9]\d{0,19}$/u.test(line) || newline !== bytes.byteLength - 1) {
          finish(null, new Error('Invalid Local Whisper launcher acknowledgment'));
          return;
        }
        const workerProcessGroupId = Number(line.slice('READY\t'.length));
        if (!Number.isSafeInteger(workerProcessGroupId) || workerProcessGroupId > 0xffff_ffff) {
          finish(null, new Error('Invalid Local Whisper launcher process identity'));
          return;
        }
        finish(workerProcessGroupId);
      };
      const onChildError = (): void => finish(null, new Error('Local Whisper launcher failed'));
      const onChildExit = (): void => finish(null, new Error('Local Whisper launcher exited'));
      const onStreamEnd = (): void => finish(null, new Error('Local Whisper launcher acknowledgment closed'));
      timer = setTimeout(
        () => finish(null, new Error('Local Whisper launcher acknowledgment timed out')),
        LAUNCHER_ACK_TIMEOUT_MS,
      );
      stream.on('data', onData);
      stream.once('end', onStreamEnd);
      child.once('error', onChildError);
      child.once('exit', onChildExit);
      if (child.exitCode !== null || child.signalCode !== null || stream.readableEnded) {
        finish(null, new Error('Local Whisper launcher exited'));
      }
    });
  }
}
