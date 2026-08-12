import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
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
import { LOCAL_WHISPER_LOAD_TIMEOUT_MS } from './LocalWhisperSupervisorConstants';
import {
  createNativeRuntimeLogLaunchEnvironment,
  isNativeRuntimeProcessInstanceId,
} from './NativeRuntimeLogLaunchEnvironment';

const LAUNCHER_ARGUMENT = '--local-whisper-launcher-v2';
const MODEL_GUARD_ARGUMENT = '--local-whisper-model-launch-v1';
const STANDARD_LAUNCHER_ACK_TIMEOUT_MS = 10_000;
const MAX_LAUNCHER_ACK_BYTES = 256;

/** Gives Linux model hashing the bounded model-load budget without relaxing ordinary launches. */
export function getLocalWhisperLauncherAcknowledgmentTimeoutMs(modelGuardLaunch: boolean): number {
  return modelGuardLaunch ? LOCAL_WHISPER_LOAD_TIMEOUT_MS : STANDARD_LAUNCHER_ACK_TIMEOUT_MS;
}

export interface NativeLauncherProcessOwnerDependencies {
  readonly environment: Readonly<NodeJS.ProcessEnv>;
  readonly getProcessStartIdentity: (pid: number) => Promise<string>;
  readonly generateProcessInstanceId?: () => string;
  readonly launcherExecutablePath: string;
  readonly launcherExecutableSha256?: string;
  readonly modelGuardExecutablePath?: string;
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

function launcherBootstrapLine(authority: LocalWhisperWorkerLaunchAuthority, nonce: string): string {
  const fields = [
    'LWLP2',
    nonce,
    authority.launchMode,
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

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function modelGuardBootstrapLine(
  authority: LocalWhisperWorkerLaunchAuthority,
  nonce: string,
  dependencies: NativeLauncherProcessOwnerDependencies,
): string {
  const model = authority.modelGuardAuthority;
  const guardPath = dependencies.modelGuardExecutablePath;
  const launcherDigest = dependencies.launcherExecutableSha256;
  const path = dependencies.platform === 'win32' ? win32 : posix;
  if (
    authority.launchMode !== 'fullLoad' ||
    !model ||
    !guardPath ||
    !launcherDigest ||
    !path.isAbsolute(guardPath) ||
    !path.isAbsolute(model.modelFilePath)
  ) {
    throw new Error('Local Whisper model guard launch authority unavailable');
  }
  const workerBootstrapBytes = authority.workerInputBootstrap?.byteLength ?? 0;
  if (workerBootstrapBytes !== 0 && workerBootstrapBytes !== 40) {
    throw new Error('Invalid Local Whisper model guard worker bootstrap');
  }
  const launcherLine = launcherBootstrapLine(authority, nonce);
  const fields = [
    'LWGL1',
    nonce,
    encode(dependencies.launcherExecutablePath),
    launcherDigest,
    encode(launcherLine.slice(0, -1)),
    encode(model.modelFilePath),
    model.modelFileSha256,
    String(model.modelFileSizeBytes),
    ...identityFields(model.modelFileIdentity),
    String(authority.configurationEpoch),
    model.modelLeaseTokenDigest,
    sha256(model.modelIdentityKey),
    Buffer.from(model.operationNonce).toString('base64url'),
    String(workerBootstrapBytes),
  ];
  const line = `${fields.join('\t')}\n`;
  if (Buffer.byteLength(line, 'utf8') > 64 * 1024) throw new Error('Local Whisper model guard bootstrap exceeded');
  return line;
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
    const processInstanceId = (this.dependencies.generateProcessInstanceId ?? randomUUID)();
    if (!isNativeRuntimeProcessInstanceId(processInstanceId)) {
      throw new Error('Invalid Local Whisper native process instance ID');
    }
    const modelGuardLaunch = authority.modelGuardAuthority !== undefined;
    const executablePath = modelGuardLaunch
      ? this.dependencies.modelGuardExecutablePath
      : this.dependencies.launcherExecutablePath;
    if (!executablePath) throw new Error('Local Whisper launch executable unavailable');
    if (modelGuardLaunch) {
      authority.modelGuardAuthority?.modelLease.assertActive();
      await authority.modelGuardAuthority?.revalidate();
      authority.modelGuardAuthority?.modelLease.assertActive();
    }
    const child = spawnProcess(executablePath, [modelGuardLaunch ? MODEL_GUARD_ARGUMENT : LAUNCHER_ARGUMENT], {
      cwd: authority.workingDirectoryPath,
      detached: false,
      env: createNativeRuntimeLogLaunchEnvironment(
        this.dependencies.platform,
        this.dependencies.environment,
        processInstanceId,
      ),
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
      await this.writeBootstrap(
        control,
        modelGuardLaunch
          ? modelGuardBootstrapLine(authority, appInstanceNonce, this.dependencies)
          : launcherBootstrapLine(authority, appInstanceNonce),
      );
      if (modelGuardLaunch && authority.workerInputBootstrap) {
        await this.writeWorkerBootstrap(input, authority.workerInputBootstrap);
      }
      const workerProcessGroupId = await this.waitForAcknowledgment(
        child,
        acknowledgment,
        getLocalWhisperLauncherAcknowledgmentTimeoutMs(modelGuardLaunch),
      );
      return new NativeOwnedWorkerProcess({
        child,
        control,
        input,
        nativeRuntimeProcessInstanceId: processInstanceId,
        output,
        platform: this.dependencies.platform,
        processStartIdentity,
        stderr,
        workerProcessGroupId,
        forceOwnerTermination: modelGuardLaunch,
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

  private writeWorkerBootstrap(stream: Writable, bytes: Uint8Array): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      stream.write(Buffer.from(bytes), (error) => {
        if (error) reject(new Error('Local Whisper model guard worker bootstrap failed'));
        else resolve();
      });
    });
  }

  private waitForAcknowledgment(child: ChildProcess, stream: Readable, timeoutMilliseconds: number): Promise<number> {
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
        const failure = /^FAILED\t([A-Z][A-Z0-9_]{0,63})$/u.exec(line);
        if (failure && newline === bytes.byteLength - 1) {
          finish(null, new Error(`Local Whisper launcher rejected: ${failure[1]}`));
          return;
        }
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
        timeoutMilliseconds,
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
