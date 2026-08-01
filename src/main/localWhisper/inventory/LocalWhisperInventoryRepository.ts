import {
  getLocalWhisperFamilyGuidance,
  getLocalWhisperMemoryConfigurationKey,
  isLocalWhisperMemoryConfigurationIdentity,
  isLocalWhisperRendererSafeLabel,
  type LocalWhisperArtifactId,
  type LocalWhisperArtifactSetupState,
  type LocalWhisperBackend,
  type LocalWhisperEngine,
  type LocalWhisperFamilyMemoryGuidance,
  type LocalWhisperMemoryConfigurationIdentity,
  type LocalWhisperMemoryEstimateRecord,
  type LocalWhisperModelFamily,
  type LocalWhisperModelVariant,
  type LocalWhisperNativeFormat,
  type LocalWhisperPlatform,
  type LocalWhisperRevisionId,
  type LocalWhisperTarget,
} from '@shared/localWhisper';

import {
  getLocalWhisperModelIdentityKey,
  getLocalWhisperRuntimeIdentityKey,
  type LocalWhisperAuthenticatedCatalog,
  type LocalWhisperCatalogModelEntry,
  type LocalWhisperCatalogModelFileIdentity,
  type LocalWhisperCatalogRuntimeEntry,
} from '../catalog/LocalWhisperCatalogTypes';

export type LocalWhisperStagingState = 'Downloading' | 'Resumable' | 'Verifying' | 'Installing';

export interface LocalWhisperManagedFileEvidence {
  readonly fileId: LocalWhisperArtifactId;
  readonly kind: 'executable' | 'library' | 'data' | 'config' | 'tokenizer' | 'notice';
  readonly mode: number;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export type LocalWhisperManagedArtifactEvidence =
  | { readonly kind: 'missing' }
  | {
      readonly kind: 'installed';
      readonly manifestIdentityKey: string;
      readonly manifestValid: boolean;
      readonly files: readonly LocalWhisperManagedFileEvidence[];
    }
  | {
      readonly kind: 'staging';
      readonly state: LocalWhisperStagingState;
      readonly safelyResumable: boolean;
      readonly safelyRemovable: boolean;
    };

export interface LocalWhisperUnmanagedEvidence {
  readonly recoveryLabel: string;
}

export interface LocalWhisperManagedStorageEvidencePort {
  getRuntimeEvidence(identityKey: string): LocalWhisperManagedArtifactEvidence;
  getModelEvidence(identityKey: string): LocalWhisperManagedArtifactEvidence;
  listUnmanagedEvidence(): readonly LocalWhisperUnmanagedEvidence[];
}

interface LocalWhisperInventoryItemBase {
  readonly state: LocalWhisperArtifactSetupState;
  readonly updateAvailable: boolean;
  readonly residency: 'Unloaded';
  readonly transferSizeBytes: number;
  readonly installedSizeBytes: number;
  readonly qualificationStatus: 'qualified' | 'estimateOnly' | 'planned';
  readonly licenseIds: readonly LocalWhisperArtifactId[];
  readonly noticeIds: readonly LocalWhisperArtifactId[];
  readonly stagingRecovery: LocalWhisperStagingRecovery | null;
}

export interface LocalWhisperStagingRecovery {
  readonly canResume: boolean;
  readonly canRemove: boolean;
}

export interface LocalWhisperRuntimeInventoryItem extends LocalWhisperInventoryItemBase {
  readonly kind: 'runtime';
  readonly engine: LocalWhisperEngine;
  readonly platform: LocalWhisperPlatform;
  readonly architecture: 'x64' | 'arm64';
  readonly target: LocalWhisperTarget;
  readonly backend: LocalWhisperBackend;
  readonly packRevision: LocalWhisperRevisionId;
  readonly upstreamRevision: LocalWhisperRevisionId;
  readonly buildRevision: LocalWhisperRevisionId;
  readonly provenanceId: LocalWhisperArtifactId;
  readonly prerequisites: readonly string[];
}

export interface LocalWhisperModelInventoryItem extends LocalWhisperInventoryItemBase {
  readonly kind: 'model';
  readonly engine: LocalWhisperEngine;
  readonly family: LocalWhisperModelFamily;
  readonly sourceCheckpointRevision: LocalWhisperRevisionId;
  readonly artifactRevision: LocalWhisperRevisionId;
  readonly nativeFormat: LocalWhisperNativeFormat;
  readonly variant: LocalWhisperModelVariant;
  readonly provenanceId: LocalWhisperArtifactId;
  readonly approximateGuidance: LocalWhisperFamilyMemoryGuidance;
}

export interface LocalWhisperRendererSafeQualifiedMemoryPeak {
  readonly configuration: LocalWhisperMemoryConfigurationIdentity;
  readonly measuredPeakRamBytes: number;
  readonly measuredPeakVramBytes: number | 'notApplicable';
  readonly qualificationProfileId: LocalWhisperArtifactId;
}

export interface LocalWhisperInventoryRecoveryItem {
  readonly managed: false;
  readonly deletable: false;
  readonly recoveryLabel: string;
}

export interface LocalWhisperInventorySnapshot {
  readonly revision: number;
  readonly catalogRevision: LocalWhisperRevisionId;
  readonly residency: 'Unloaded';
  readonly runtimes: readonly LocalWhisperRuntimeInventoryItem[];
  readonly models: readonly LocalWhisperModelInventoryItem[];
  readonly selectedMemoryEstimate: LocalWhisperMemoryEstimateRecord | null;
  readonly qualifiedMemoryPeak: LocalWhisperRendererSafeQualifiedMemoryPeak | null;
  readonly recoveryItems: readonly LocalWhisperInventoryRecoveryItem[];
}

export interface LocalWhisperInventoryReconstructionInput {
  readonly catalog: LocalWhisperAuthenticatedCatalog;
  readonly evidence: LocalWhisperManagedStorageEvidencePort;
  readonly selectedConfiguration?: LocalWhisperMemoryConfigurationIdentity | null;
  readonly qualifiedCapabilityFingerprint?: string | null;
}

type ExpectedFile =
  LocalWhisperCatalogModelFileIdentity | LocalWhisperCatalogRuntimeEntry['identity']['expectedFiles'][number];

function filesMatch(
  expectedFiles: readonly ExpectedFile[],
  actualFiles: readonly LocalWhisperManagedFileEvidence[],
): boolean {
  if (expectedFiles.length !== actualFiles.length) return false;
  const actualById = new Map(actualFiles.map((file) => [file.fileId, file]));
  if (actualById.size !== actualFiles.length) return false;
  return expectedFiles.every((expected) => {
    const actual = actualById.get(expected.fileId);
    return (
      actual?.kind === expected.kind &&
      actual.mode === expected.mode &&
      actual.sizeBytes === expected.sizeBytes &&
      actual.sha256 === expected.sha256
    );
  });
}

function classifyEvidence(
  evidence: LocalWhisperManagedArtifactEvidence,
  identityKey: string,
  expectedFiles: readonly ExpectedFile[],
  blocked: boolean,
): LocalWhisperArtifactSetupState {
  if (blocked) return 'Blocked';
  if (evidence.kind === 'missing') return 'Missing';
  if (evidence.kind === 'staging') {
    return evidence.state === 'Resumable' && !evidence.safelyResumable ? 'Failed' : evidence.state;
  }
  return evidence.manifestValid &&
    evidence.manifestIdentityKey === identityKey &&
    filesMatch(expectedFiles, evidence.files)
    ? 'Installed'
    : 'Corrupt';
}

function projectStagingRecovery(evidence: LocalWhisperManagedArtifactEvidence): LocalWhisperStagingRecovery | null {
  if (evidence.kind !== 'staging') return null;
  return Object.freeze({
    canResume: evidence.state === 'Resumable' && evidence.safelyResumable,
    canRemove: evidence.safelyRemovable,
  });
}

function hasRuntimeUpdate(catalog: LocalWhisperAuthenticatedCatalog, entry: LocalWhisperCatalogRuntimeEntry): boolean {
  const identity = entry.identity;
  return catalog.payload.runtimes.some(
    (candidate) =>
      candidate.recommended &&
      candidate.identity.engine === identity.engine &&
      candidate.identity.platform === identity.platform &&
      candidate.identity.architecture === identity.architecture &&
      candidate.identity.target === identity.target &&
      candidate.identity.backend === identity.backend &&
      getLocalWhisperRuntimeIdentityKey(candidate.identity) !== getLocalWhisperRuntimeIdentityKey(identity),
  );
}

function hasModelUpdate(catalog: LocalWhisperAuthenticatedCatalog, entry: LocalWhisperCatalogModelEntry): boolean {
  const identity = entry.identity;
  return catalog.payload.models.some(
    (candidate) =>
      candidate.recommended &&
      candidate.identity.engine === identity.engine &&
      candidate.identity.logicalModel === identity.logicalModel &&
      candidate.identity.variant === identity.variant &&
      getLocalWhisperModelIdentityKey(candidate.identity) !== getLocalWhisperModelIdentityKey(identity),
  );
}

function projectRuntime(
  catalog: LocalWhisperAuthenticatedCatalog,
  evidence: LocalWhisperManagedStorageEvidencePort,
  entry: LocalWhisperCatalogRuntimeEntry,
): LocalWhisperRuntimeInventoryItem {
  const identity = entry.identity;
  const identityKey = getLocalWhisperRuntimeIdentityKey(identity);
  const artifactEvidence = evidence.getRuntimeEvidence(identityKey);
  const state = classifyEvidence(
    artifactEvidence,
    identityKey,
    identity.expectedFiles,
    catalog.isRuntimeDenylisted(identityKey),
  );
  return Object.freeze({
    kind: 'runtime',
    engine: identity.engine,
    platform: identity.platform,
    architecture: identity.architecture,
    target: identity.target,
    backend: identity.backend,
    packRevision: identity.packRevision,
    upstreamRevision: identity.upstreamRevision,
    buildRevision: identity.buildRevision,
    provenanceId: identity.provenanceId,
    prerequisites: Object.freeze([...identity.prerequisites]),
    state,
    updateAvailable: state === 'Installed' && hasRuntimeUpdate(catalog, entry),
    residency: 'Unloaded',
    transferSizeBytes: identity.archiveSizeBytes,
    installedSizeBytes: identity.expectedFiles.reduce((total, file) => total + file.sizeBytes, 0),
    qualificationStatus: entry.qualificationStatus,
    licenseIds: Object.freeze([...entry.licenseIds]),
    noticeIds: Object.freeze([...identity.noticeIds]),
    stagingRecovery: projectStagingRecovery(artifactEvidence),
  });
}

function projectModel(
  catalog: LocalWhisperAuthenticatedCatalog,
  evidence: LocalWhisperManagedStorageEvidencePort,
  entry: LocalWhisperCatalogModelEntry,
): LocalWhisperModelInventoryItem {
  const identity = entry.identity;
  const identityKey = getLocalWhisperModelIdentityKey(identity);
  const guidance = getLocalWhisperFamilyGuidance(identity.logicalModel);
  if (!guidance) throw new Error('Local Whisper inventory guidance unavailable');
  const artifactEvidence = evidence.getModelEvidence(identityKey);
  const state = classifyEvidence(
    artifactEvidence,
    identityKey,
    entry.expectedFiles,
    catalog.isModelDenylisted(identityKey),
  );
  return Object.freeze({
    kind: 'model',
    engine: identity.engine,
    family: identity.logicalModel,
    sourceCheckpointRevision: identity.sourceCheckpointRevision,
    artifactRevision: identity.artifactRevision,
    nativeFormat: identity.nativeFormat,
    variant: identity.variant,
    provenanceId: entry.provenanceId,
    state,
    updateAvailable: state === 'Installed' && hasModelUpdate(catalog, entry),
    residency: 'Unloaded',
    transferSizeBytes: entry.transferSizeBytes,
    installedSizeBytes: entry.installedSizeBytes,
    qualificationStatus: entry.qualificationStatus,
    licenseIds: Object.freeze([...entry.licenseIds]),
    noticeIds: Object.freeze([...entry.noticeIds]),
    approximateGuidance: guidance,
    stagingRecovery: projectStagingRecovery(artifactEvidence),
  });
}

function matchesKnownConfiguration(
  catalog: LocalWhisperAuthenticatedCatalog,
  configuration: LocalWhisperMemoryConfigurationIdentity,
): boolean {
  return (
    catalog.payload.runtimes.some(
      ({ identity }) =>
        identity.packRevision === configuration.runtimePackRevision &&
        identity.engine === configuration.model.engine &&
        identity.target === configuration.target &&
        identity.backend === configuration.backend,
    ) &&
    catalog.payload.models.some(
      ({ identity }) =>
        getLocalWhisperModelIdentityKey(identity) === getLocalWhisperModelIdentityKey(configuration.model),
    )
  );
}

function projectMemory(
  input: LocalWhisperInventoryReconstructionInput,
): readonly [LocalWhisperMemoryEstimateRecord | null, LocalWhisperRendererSafeQualifiedMemoryPeak | null] {
  const selected = input.selectedConfiguration;
  if (
    !selected ||
    !isLocalWhisperMemoryConfigurationIdentity(selected) ||
    !matchesKnownConfiguration(input.catalog, selected)
  ) {
    return [null, null];
  }
  const selectedKey = getLocalWhisperMemoryConfigurationKey(selected);
  const estimate =
    input.catalog.payload.memoryEstimates.find(
      (candidate) => getLocalWhisperMemoryConfigurationKey(candidate) === selectedKey,
    ) ?? null;
  const qualified = input.catalog.payload.qualifiedMemoryPeaks.find(
    (candidate) =>
      getLocalWhisperMemoryConfigurationKey(candidate) === selectedKey &&
      candidate.capabilityFingerprint === input.qualifiedCapabilityFingerprint,
  );
  return [
    estimate,
    qualified
      ? Object.freeze({
          configuration: Object.freeze(structuredClone(selected)),
          measuredPeakRamBytes: qualified.measuredPeakRamBytes,
          measuredPeakVramBytes: qualified.measuredPeakVramBytes,
          qualificationProfileId: qualified.qualificationProfileId,
        })
      : null,
  ];
}

/** Rebuilds renderer-safe inventory solely from authenticated catalog entries and injected managed evidence. */
export class LocalWhisperInventoryRepository {
  private revision = 0;

  public reconstruct(input: LocalWhisperInventoryReconstructionInput): LocalWhisperInventorySnapshot {
    if (this.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Local Whisper inventory revision exhausted');
    this.revision += 1;
    const [selectedMemoryEstimate, qualifiedMemoryPeak] = projectMemory(input);
    const recoveryItems = input.evidence.listUnmanagedEvidence().map(({ recoveryLabel }) => {
      if (!isLocalWhisperRendererSafeLabel(recoveryLabel)) throw new Error('Invalid Local Whisper recovery evidence');
      return Object.freeze({ managed: false, deletable: false, recoveryLabel } as const);
    });
    return Object.freeze({
      revision: this.revision,
      catalogRevision: input.catalog.payload.catalogRevision,
      residency: 'Unloaded',
      runtimes: Object.freeze(
        input.catalog.payload.runtimes.map((entry) => projectRuntime(input.catalog, input.evidence, entry)),
      ),
      models: Object.freeze(
        input.catalog.payload.models.map((entry) => projectModel(input.catalog, input.evidence, entry)),
      ),
      selectedMemoryEstimate,
      qualifiedMemoryPeak,
      recoveryItems: Object.freeze(recoveryItems),
    });
  }
}
