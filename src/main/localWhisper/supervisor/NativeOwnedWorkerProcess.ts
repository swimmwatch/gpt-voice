import type { ChildProcess } from 'node:child_process';
import process from 'node:process';
import type { Readable, Writable } from 'node:stream';

import type { LocalWhisperOwnedWorkerProcess } from './WorkerProcessOwnership';

export interface NativeOwnedWorkerProcessDependencies {
  readonly child: ChildProcess;
  readonly control: Writable;
  readonly input: Writable;
  readonly output: Readable;
  readonly platform: 'linux' | 'win32';
  readonly processStartIdentity: string;
  readonly stderr: Readable;
  readonly workerProcessGroupId: number;
}

/** Owns the launcher streams and the platform-specific forced-termination path. */
export class NativeOwnedWorkerProcess implements LocalWhisperOwnedWorkerProcess {
  public constructor(private readonly dependencies: NativeOwnedWorkerProcessDependencies) {}

  public get pid(): number {
    const pid = this.dependencies.child.pid;
    if (!pid) throw new Error('Local Whisper launcher PID unavailable');
    return pid;
  }

  public get processStartIdentity(): string {
    return this.dependencies.processStartIdentity;
  }

  public get input(): Writable {
    return this.dependencies.input;
  }

  public get output(): Readable {
    return this.dependencies.output;
  }

  public get stderr(): Readable {
    return this.dependencies.stderr;
  }

  public closeOwnershipControl(): void {
    if (!this.dependencies.control.destroyed) this.dependencies.control.destroy();
  }

  public requestTreeTermination(): Promise<void> {
    if (this.dependencies.child.exitCode === null && this.dependencies.child.signalCode === null) {
      this.closeOwnershipControl();
    }
    return Promise.resolve();
  }

  public forceTreeTermination(): Promise<void> {
    if (this.dependencies.child.exitCode !== null || this.dependencies.child.signalCode !== null) {
      return Promise.resolve();
    }
    this.closeOwnershipControl();
    if (this.dependencies.platform === 'linux') {
      try {
        process.kill(-this.dependencies.workerProcessGroupId, 'SIGKILL');
      } catch {
        // The launcher remains responsible for proving that its owned group is empty.
      }
    }
    return Promise.resolve();
  }

  public waitForExit(timeoutMs: number): Promise<boolean> {
    const { child } = this.dependencies;
    if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
    if (timeoutMs <= 0) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timer: NodeJS.Timeout | null = null;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        child.off('exit', onExit);
        resolve(value);
      };
      const onExit = (): void => finish(true);
      child.once('exit', onExit);
      timer = setTimeout(() => finish(false), timeoutMs);
      if (child.exitCode !== null || child.signalCode !== null) finish(true);
    });
  }
}
