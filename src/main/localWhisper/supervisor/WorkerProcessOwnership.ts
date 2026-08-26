import type { Readable, Writable } from 'node:stream';

import type { LocalWhisperBackend, LocalWhisperEngine, LocalWhisperRevisionId } from '@shared/localWhisper';

import type { ManagedArtifactIdentitySnapshot, ManagedArtifactLease } from '../filesystem/ManagedArtifactLease';

export interface LocalWhisperExpectedHandshake {
  readonly engine: LocalWhisperEngine;
  readonly runtimeRevision: LocalWhisperRevisionId;
  readonly runtimeBuildDigest: string;
  readonly backend: LocalWhisperBackend;
  readonly capabilities: readonly string[];
}

export type LocalWhisperWorkerLaunchMode = 'fullLoad' | 'probe' | 'registry';

export interface LocalWhisperModelGuardLaunchAuthority {
  readonly modelFileIdentity: ManagedArtifactIdentitySnapshot;
  readonly modelFilePath: string;
  readonly modelFileSha256: string;
  readonly modelFileSizeBytes: number;
  readonly modelIdentityKey: string;
  readonly modelLease: ManagedArtifactLease;
  readonly modelLeaseTokenDigest: string;
  readonly operationNonce: Uint8Array;
  readonly revalidate: () => Promise<void>;
}

export interface LocalWhisperWorkerLaunchAuthority {
  readonly configurationEpoch: number;
  readonly expectedHandshake: LocalWhisperExpectedHandshake;
  readonly launchMode: LocalWhisperWorkerLaunchMode;
  readonly runtimeIdentityKey: string;
  readonly runtimeLease: ManagedArtifactLease;
  readonly workerExecutablePath: string;
  readonly workerFileIdentity: ManagedArtifactIdentitySnapshot;
  readonly workerFileSha256: string;
  readonly workingDirectoryPath: string;
  readonly revalidate: () => Promise<void>;
  readonly workerInputBootstrap?: Uint8Array;
  readonly modelGuardAuthority?: LocalWhisperModelGuardLaunchAuthority;
}

export interface LocalWhisperWorkerOwnershipRecord {
  readonly appInstanceNonce: string;
  readonly configurationEpoch: number;
  readonly executableIdentity: ManagedArtifactIdentitySnapshot;
  readonly pid: number;
  readonly processStartIdentity: string;
  readonly runtimeBuildDigest: string;
  readonly runtimeIdentityKey: string;
}

export interface LocalWhisperWorkerOwnershipRecordStore {
  read(): Promise<
    | { readonly kind: 'invalid' }
    | { readonly kind: 'missing' }
    | { readonly kind: 'valid'; readonly record: LocalWhisperWorkerOwnershipRecord }
  >;
  write(record: LocalWhisperWorkerOwnershipRecord): Promise<void>;
  remove(record: LocalWhisperWorkerOwnershipRecord): Promise<void>;
}

export interface LocalWhisperOwnedWorkerProcess {
  readonly pid: number;
  /** Exact private native-log identities generated for every process in this owned launch tree. */
  readonly nativeRuntimeProcessInstanceIds?: readonly string[];
  readonly processStartIdentity: string;
  readonly input: Writable;
  readonly output: Readable;
  readonly stderr: Readable;
  closeOwnershipControl(): void;
  requestTreeTermination(): Promise<void>;
  forceTreeTermination(): Promise<void>;
  waitForExit(timeoutMs: number): Promise<boolean>;
}

export interface LocalWhisperWorkerProcessOwner {
  launch(
    authority: LocalWhisperWorkerLaunchAuthority,
    appInstanceNonce: string,
  ): Promise<LocalWhisperOwnedWorkerProcess>;
  recoverOwnedOrphan(record: LocalWhisperWorkerOwnershipRecord): Promise<boolean>;
}

export interface LocalWhisperWorkerProcessLaunchEvent {
  readonly backend: LocalWhisperBackend;
  readonly launchMode: LocalWhisperWorkerLaunchMode;
  readonly pid: number;
  readonly crashOwnedTree: () => Promise<void>;
}

export interface WorkerProcessOwnershipDependencies {
  readonly processOwner: LocalWhisperWorkerProcessOwner;
  readonly randomNonce: () => string;
  readonly recordStore: LocalWhisperWorkerOwnershipRecordStore;
  readonly onProcessLaunched?: (event: LocalWhisperWorkerProcessLaunchEvent) => void;
}

/** Owns the runtime lease, process tree, and durable proof as one lifecycle. */
export class WorkerProcessOwnership {
  private active: {
    readonly authority: LocalWhisperWorkerLaunchAuthority;
    readonly process: LocalWhisperOwnedWorkerProcess;
    readonly record: LocalWhisperWorkerOwnershipRecord;
  } | null = null;

  public constructor(private readonly dependencies: WorkerProcessOwnershipDependencies) {}

  public async recoverOwnedOrphan(): Promise<boolean> {
    if (this.active) throw new Error('Local Whisper worker is already owned');
    const stored = await this.dependencies.recordStore.read();
    if (stored.kind === 'missing') return true;
    if (stored.kind === 'invalid') return false;
    const recovered = await this.dependencies.processOwner.recoverOwnedOrphan(stored.record);
    if (!recovered) return false;
    await this.dependencies.recordStore.remove(stored.record);
    return true;
  }

  public async launch(authority: LocalWhisperWorkerLaunchAuthority): Promise<LocalWhisperOwnedWorkerProcess> {
    if (this.active) throw new Error('Local Whisper worker is already owned');
    authority.runtimeLease.assertActive();
    if (authority.runtimeLease.metadata.purpose !== 'load') {
      throw new Error('Local Whisper runtime lease has the wrong purpose');
    }
    await authority.revalidate();
    authority.runtimeLease.assertActive();
    const appInstanceNonce = this.dependencies.randomNonce();
    if (!/^[\w-]{16,128}$/u.test(appInstanceNonce)) {
      throw new Error('Invalid Local Whisper ownership nonce');
    }
    const process = await this.dependencies.processOwner.launch(authority, appInstanceNonce);
    const record = Object.freeze({
      appInstanceNonce,
      configurationEpoch: authority.configurationEpoch,
      executableIdentity: authority.workerFileIdentity,
      pid: process.pid,
      processStartIdentity: process.processStartIdentity,
      runtimeBuildDigest: authority.expectedHandshake.runtimeBuildDigest,
      runtimeIdentityKey: authority.runtimeIdentityKey,
    });
    this.active = Object.freeze({ authority, process, record });
    try {
      await this.dependencies.recordStore.write(record);
      this.dependencies.onProcessLaunched?.(
        Object.freeze({
          backend: authority.expectedHandshake.backend,
          launchMode: authority.launchMode,
          pid: process.pid,
          crashOwnedTree: () => process.forceTreeTermination(),
        }),
      );
    } catch {
      process.closeOwnershipControl();
      await process.forceTreeTermination().catch(() => undefined);
      const exited = await process.waitForExit(5_000).catch(() => false);
      if (exited) {
        await authority.runtimeLease.release().catch(() => undefined);
        this.active = null;
      }
      throw new Error('Local Whisper ownership record failed');
    }
    return process;
  }

  public get process(): LocalWhisperOwnedWorkerProcess | null {
    return this.active?.process ?? null;
  }

  public async releaseAfterConfirmedExit(): Promise<void> {
    const active = this.active;
    if (!active) return;
    await this.dependencies.recordStore.remove(active.record);
    await active.authority.runtimeLease.release();
    this.active = null;
  }

  public retainFailedOwnership(): void {
    // Deliberately retain record and lease until restart/manual recovery proves exit.
  }
}
