import type { LocalWhisperBackend } from '@shared/localWhisper';

import {
  getLocalWhisperRuntimeIdentityKey,
  type LocalWhisperAuthenticatedCatalog,
  type LocalWhisperCatalogRuntimeEntry,
} from '../catalog/LocalWhisperCatalogTypes';
import {
  createManagedRuntimeDescriptor,
  type ManagedArtifactDescriptor,
  type ManagedRuntimeLaunchLease,
} from '../filesystem/ManagedArtifactStore';
import type {
  LocalWhisperWorkerLaunchAuthority,
  LocalWhisperWorkerLaunchMode,
} from '../supervisor/WorkerProcessOwnership';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export interface LocalWhisperRuntimeLaunchLeasePort {
  leaseInstalledRuntimeForLaunch(descriptor: ManagedArtifactDescriptor): Promise<ManagedRuntimeLaunchLease>;
}

function expectedCapabilities(backend: LocalWhisperBackend): readonly string[] {
  if (backend === 'cpu') {
    return Object.freeze(['cpu-baseline', 'exact-model-authority', 'cooperative-cancellation']);
  }
  const backendCapability =
    backend === 'cuda'
      ? 'cuda-sm-120a'
      : backend === 'hip'
        ? 'hip-exact-row'
        : backend === 'vulkan'
          ? 'vulkan-1.3-amd-preview'
          : null;
  if (!backendCapability) throw new Error('Local Whisper runtime backend unavailable');
  return Object.freeze([backendCapability, 'exact-device-proof', 'exact-model-authority', 'cooperative-cancellation']);
}

/** Acquires an anchored installed runtime and binds it to one exact worker launch. */
export class LocalWhisperRuntimeLaunchAuthorityFactory {
  public constructor(private readonly store: LocalWhisperRuntimeLaunchLeasePort) {}

  public async acquire(input: {
    readonly catalog: LocalWhisperAuthenticatedCatalog;
    readonly runtime: LocalWhisperCatalogRuntimeEntry;
    readonly configurationEpoch: number;
    readonly launchMode: LocalWhisperWorkerLaunchMode;
    readonly workerInputBootstrap?: Uint8Array;
  }): Promise<LocalWhisperWorkerLaunchAuthority> {
    const { identity } = input.runtime;
    if (
      !Number.isSafeInteger(input.configurationEpoch) ||
      input.configurationEpoch < 0 ||
      identity.engine !== 'whisperCpp' ||
      identity.protocolVersion !== 1 ||
      !SHA256_PATTERN.test(identity.buildRevision)
    ) {
      throw new Error('Local Whisper runtime launch identity invalid');
    }
    const descriptor = createManagedRuntimeDescriptor(input.catalog, input.runtime);
    const launchLease = await this.store.leaseInstalledRuntimeForLaunch(descriptor);
    return Object.freeze({
      configurationEpoch: input.configurationEpoch,
      expectedHandshake: Object.freeze({
        engine: identity.engine,
        runtimeRevision: identity.packRevision,
        runtimeBuildDigest: identity.buildRevision,
        backend: identity.backend,
        capabilities: expectedCapabilities(identity.backend),
      }),
      launchMode: input.launchMode,
      runtimeIdentityKey: getLocalWhisperRuntimeIdentityKey(identity),
      runtimeLease: launchLease.runtimeLease,
      workerExecutablePath: launchLease.workerExecutablePath,
      workerFileIdentity: launchLease.workerFileIdentity,
      workerFileSha256: launchLease.workerFileSha256,
      workingDirectoryPath: launchLease.workingDirectoryPath,
      revalidate: launchLease.revalidate,
      ...(input.workerInputBootstrap ? { workerInputBootstrap: Uint8Array.from(input.workerInputBootstrap) } : {}),
    });
  }
}
