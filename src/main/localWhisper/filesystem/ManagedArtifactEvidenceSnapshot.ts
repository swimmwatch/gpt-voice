import type {
  LocalWhisperManagedArtifactEvidence,
  LocalWhisperManagedStorageEvidencePort,
  LocalWhisperUnmanagedEvidence,
} from '../inventory/LocalWhisperInventoryRepository';
import type { ManagedArtifactDescriptor } from './ManagedArtifactStore';

export interface ManagedArtifactEvidenceRecord {
  readonly descriptor: Pick<ManagedArtifactDescriptor, 'identityKey' | 'kind'>;
  readonly evidence: LocalWhisperManagedArtifactEvidence;
}

/** Immutable synchronous evidence view produced after anchored asynchronous inspection. */
export class ManagedArtifactEvidenceSnapshot implements LocalWhisperManagedStorageEvidencePort {
  private readonly models = new Map<string, LocalWhisperManagedArtifactEvidence>();
  private readonly runtimes = new Map<string, LocalWhisperManagedArtifactEvidence>();

  public constructor(
    records: readonly ManagedArtifactEvidenceRecord[],
    private readonly unmanagedCount: number,
  ) {
    for (const { descriptor, evidence } of records) {
      (descriptor.kind === 'model' ? this.models : this.runtimes).set(descriptor.identityKey, evidence);
    }
  }

  public getRuntimeEvidence(identityKey: string): LocalWhisperManagedArtifactEvidence {
    return this.runtimes.get(identityKey) ?? Object.freeze({ kind: 'missing' as const });
  }

  public getModelEvidence(identityKey: string): LocalWhisperManagedArtifactEvidence {
    return this.models.get(identityKey) ?? Object.freeze({ kind: 'missing' as const });
  }

  public listUnmanagedEvidence(): readonly LocalWhisperUnmanagedEvidence[] {
    return Object.freeze(
      Array.from({ length: this.unmanagedCount }, () =>
        Object.freeze({ recoveryLabel: 'Unmanaged Local Whisper storage entry' }),
      ),
    );
  }
}
