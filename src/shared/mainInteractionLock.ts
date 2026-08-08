import { isRecordingLifecycleBusy, type RecordingLifecycleState } from './recordingLifecycle';

export const MAIN_INTERACTION_LOCK_IPC_CHANNELS = Object.freeze({
  changed: 'main-interaction-lock-changed',
  query: 'get-main-interaction-lock',
});

export const MAIN_INTERACTION_LOCK_ACQUIRE_RESULTS = [
  'acquired',
  'locked',
  'recording-active',
  'operation-active',
] as const;

export type MainInteractionLockAcquireResult = (typeof MAIN_INTERACTION_LOCK_ACQUIRE_RESULTS)[number];

export interface MainInteractionLockDependencies {
  /** Reports work that must finish before configuration can change. */
  readonly isOperationActive?: () => boolean;
}

export interface MainInteractionLockLease {
  release(): void;
}

export interface MainInteractionLockAcquisition {
  readonly result: MainInteractionLockAcquireResult;
  readonly lease: MainInteractionLockLease | null;
}

/** Owns the process-wide exclusion of main-window actions while configuration is open. */
export class MainInteractionLock {
  private readonly leases = new Set<number>();
  private readonly listeners = new Set<(locked: boolean) => void>();
  private nextLeaseId = 1;
  private recordingLifecycleState: RecordingLifecycleState = 'idle';

  public constructor(private readonly dependencies: MainInteractionLockDependencies = {}) {}

  public get locked(): boolean {
    return this.leases.size > 0;
  }

  /** True only for in-flight work; unlike `locked`, this never disables a settings owner window. */
  public get operationActive(): boolean {
    return this.dependencies.isOperationActive?.() === true;
  }

  public acquire(): MainInteractionLockAcquisition {
    if (isRecordingLifecycleBusy(this.recordingLifecycleState)) {
      return Object.freeze({ lease: null, result: 'recording-active' });
    }
    if (this.operationActive) return Object.freeze({ lease: null, result: 'operation-active' });
    if (this.locked) return Object.freeze({ lease: null, result: 'locked' });

    const leaseId = this.nextLeaseId++;
    this.leases.add(leaseId);
    this.publish();

    let released = false;
    return Object.freeze({
      lease: Object.freeze({
        release: (): void => {
          if (released) return;
          released = true;
          if (!this.leases.delete(leaseId)) return;
          this.publish();
        },
      }),
      result: 'acquired',
    });
  }

  public setRecordingLifecycleState(state: RecordingLifecycleState): void {
    this.recordingLifecycleState = state;
  }

  public subscribe(listener: (locked: boolean) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  private publish(): void {
    const locked = this.locked;
    for (const listener of [...this.listeners]) listener(locked);
  }
}

export function isMainInteractionLockState(value: unknown): value is boolean {
  return typeof value === 'boolean';
}
