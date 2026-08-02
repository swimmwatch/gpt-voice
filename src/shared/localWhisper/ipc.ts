import {
  LOCAL_WHISPER_ARTIFACT_SETUP_STATES,
  LOCAL_WHISPER_MODEL_FAMILIES,
  LOCAL_WHISPER_SUPPORT_TIERS,
  isLocalWhisperBackend,
  isLocalWhisperEngine,
  isLocalWhisperFailureCode,
  isLocalWhisperGpuBackend,
  isLocalWhisperModelFamily,
  isLocalWhisperRendererSafeLabel,
  isLocalWhisperRuntimeSnapshot,
  isLocalWhisperTarget,
  toLocalWhisperArtifactId,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperArtifactId,
  type LocalWhisperArtifactSetupState,
  type LocalWhisperFailureCode,
  type LocalWhisperModelFamily,
  type LocalWhisperOpaqueDeviceId,
  type LocalWhisperRevisionId,
  type LocalWhisperRuntimeSnapshot,
  type LocalWhisperSupportTier,
} from './domain';
import {
  LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE,
  LOCAL_WHISPER_MODEL_VARIANTS,
  isLocalWhisperMemoryEstimateRecord,
  type LocalWhisperFamilyMemoryGuidance,
  type LocalWhisperMemoryEstimateRecord,
} from './catalog';
import { isLocalWhisperRendererSafeFailure, type LocalWhisperRendererSafeFailure } from './failures';
import { isLocalWhisperLanguageId } from './languages';
import {
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_MAX_CANDIDATE_COUNT,
  LOCAL_WHISPER_MAX_TEMPERATURE_HUNDREDTHS,
  LOCAL_WHISPER_MIN_CANDIDATE_COUNT,
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS,
  getLocalWhisperPromptValidationError,
  type LocalWhisperPromptMutation,
  type LocalWhisperPublicSettings,
  type LocalWhisperSettingsValidationIssue,
} from './settings';

export const LOCAL_WHISPER_IPC_CHANNELS = Object.freeze({
  settingsQuery: 'local-whisper:settings:query',
  settingsSubscribe: 'local-whisper:settings:subscribe',
  settingsUnsubscribe: 'local-whisper:settings:unsubscribe',
  settingsCommand: 'local-whisper:settings:command',
  settingsChanged: 'local-whisper:settings:changed',
  mainStatusQuery: 'local-whisper:main:status-query',
  mainStatusSubscribe: 'local-whisper:main:status-subscribe',
  mainStatusUnsubscribe: 'local-whisper:main:status-unsubscribe',
  mainStatusChanged: 'local-whisper:main:status-changed',
  mainOpenSettings: 'local-whisper:main:open-settings',
} as const);

export const LOCAL_WHISPER_ARTIFACT_ACTIONS = ['download', 'resume', 'cancel', 'retry', 'remove'] as const;
export const LOCAL_WHISPER_REFERENCE_KINDS = ['viewLicenseNotice', 'openProvenanceReference'] as const;
export const LOCAL_WHISPER_ARTIFACT_KINDS = ['runtime', 'model'] as const;

export type LocalWhisperArtifactKind = (typeof LOCAL_WHISPER_ARTIFACT_KINDS)[number];
export type LocalWhisperArtifactAction = (typeof LOCAL_WHISPER_ARTIFACT_ACTIONS)[number];
export type LocalWhisperReferenceKind = (typeof LOCAL_WHISPER_REFERENCE_KINDS)[number];

export interface LocalWhisperRendererOption {
  readonly group: 'engine' | 'target' | 'backend' | 'device' | 'runtime' | 'modelFamily' | 'modelRevision';
  readonly id: string;
  readonly label: string;
  readonly available: boolean;
  readonly tier: LocalWhisperSupportTier;
  readonly reason: LocalWhisperFailureCode | null;
  readonly selected: boolean;
  readonly selectedButUnavailable: boolean;
  readonly saved: boolean;
  readonly default: boolean;
  readonly recommended: boolean;
  readonly remembered: boolean;
}

export interface LocalWhisperArtifactReference {
  readonly kind: LocalWhisperReferenceKind;
  readonly artifactKind: LocalWhisperArtifactKind;
  readonly artifactId: LocalWhisperArtifactId;
  readonly artifactRevision: LocalWhisperRevisionId;
  readonly referenceId: LocalWhisperArtifactId;
  readonly label: string;
}

export interface LocalWhisperRendererArtifact {
  readonly kind: LocalWhisperArtifactKind;
  readonly id: LocalWhisperArtifactId;
  readonly revision: LocalWhisperRevisionId;
  readonly label: string;
  readonly state: LocalWhisperArtifactSetupState;
  readonly transferSizeBytes: number;
  readonly installedSizeBytes: number;
  readonly updateAvailable: boolean;
  readonly actions: readonly LocalWhisperArtifactAction[];
  readonly references: readonly LocalWhisperArtifactReference[];
}

export interface LocalWhisperArtifactProgress {
  readonly operationId: string;
  readonly artifactId: LocalWhisperArtifactId;
  readonly action: LocalWhisperArtifactAction;
  readonly receivedBytes: number;
  readonly totalBytes: number;
  readonly queuedPosition: number | null;
  readonly failure: LocalWhisperRendererSafeFailure | null;
}

export interface LocalWhisperRendererMemoryFacts {
  readonly approximateFamilies: readonly LocalWhisperFamilyMemoryGuidance[];
  readonly selectedEstimate: LocalWhisperMemoryEstimateRecord | null;
  readonly qualifiedPeak: {
    readonly measuredPeakRamBytes: number;
    readonly measuredPeakVramBytes: number | 'notApplicable';
    readonly qualificationProfileId: LocalWhisperArtifactId;
  } | null;
  readonly exactEstimateUnavailable: boolean;
}

export interface LocalWhisperRendererSnapshot {
  readonly snapshotRevision: number;
  readonly configurationEpoch: number;
  readonly inventoryEpoch: number;
  readonly catalogRevision: LocalWhisperRevisionId | null;
  readonly settings: LocalWhisperPublicSettings;
  readonly hasInitialPrompt: boolean;
  readonly selectedDeviceId: LocalWhisperOpaqueDeviceId | null;
  readonly options: readonly LocalWhisperRendererOption[];
  readonly validationIssues: readonly LocalWhisperSettingsValidationIssue[];
  readonly memory: LocalWhisperRendererMemoryFacts;
  readonly storage: {
    readonly label: string;
    readonly installedArtifactCount: number;
    readonly installedBytes: number;
  };
  readonly artifacts: readonly LocalWhisperRendererArtifact[];
  readonly progress: readonly LocalWhisperArtifactProgress[];
  readonly runtime: LocalWhisperRuntimeSnapshot;
  readonly failure: LocalWhisperRendererSafeFailure | null;
  readonly prerequisites: readonly { readonly id: string; readonly label: string; readonly version: string | null }[];
  readonly lastValidatedAtMs: number | null;
}

export interface LocalWhisperMainStatusSnapshot {
  readonly providerId: 'local-whisper';
  readonly snapshotRevision: number;
  readonly runtime: LocalWhisperRuntimeSnapshot;
  readonly failure: LocalWhisperRendererSafeFailure | null;
  readonly selectedButUnavailable: boolean;
}

export interface LocalWhisperIpcAcknowledgement {
  readonly success: true;
}

interface LocalWhisperExpectedState {
  readonly expectedSnapshotRevision: number;
  readonly expectedConfigurationEpoch: number;
  readonly expectedInventoryEpoch: number;
}

interface LocalWhisperArtifactTarget extends LocalWhisperExpectedState {
  readonly artifactKind: LocalWhisperArtifactKind;
  readonly artifactId: LocalWhisperArtifactId;
  readonly artifactRevision: LocalWhisperRevisionId;
}

export type LocalWhisperSettingsCommand =
  | (LocalWhisperExpectedState & {
      readonly kind: 'save';
      readonly candidate: LocalWhisperPublicSettings;
      readonly promptMutation: LocalWhisperPromptMutation;
    })
  | (LocalWhisperExpectedState & { readonly kind: 'reset' })
  | (LocalWhisperExpectedState & { readonly kind: 'checkCompatibility' | 'load' | 'unload' })
  | (LocalWhisperArtifactTarget & { readonly kind: 'download' | 'resume' | 'retry' })
  | (LocalWhisperExpectedState & { readonly kind: 'cancelArtifact'; readonly operationId: string })
  | (LocalWhisperArtifactTarget & { readonly kind: 'remove'; readonly confirmed: boolean })
  | { readonly kind: 'openManagedFolder'; readonly expectedSnapshotRevision: number }
  | {
      readonly kind: 'viewArtifactReference';
      readonly referenceKind: LocalWhisperReferenceKind;
      readonly artifactKind: LocalWhisperArtifactKind;
      readonly artifactId: LocalWhisperArtifactId;
      readonly artifactRevision: LocalWhisperRevisionId;
      readonly referenceId: LocalWhisperArtifactId;
      readonly expectedCatalogRevision: LocalWhisperRevisionId;
      readonly expectedSnapshotRevision: number;
    };

export type LocalWhisperSettingsCommandResult =
  | {
      readonly success: true;
      readonly command: LocalWhisperSettingsCommand['kind'];
      readonly snapshot: LocalWhisperRendererSnapshot;
      readonly operationId?: string;
    }
  | {
      readonly success: false;
      readonly command: LocalWhisperSettingsCommand['kind'] | 'invalid';
      readonly snapshot: LocalWhisperRendererSnapshot;
      readonly error: LocalWhisperRendererSafeFailure;
    };

export type LocalWhisperProviderSelectionResult =
  | {
      readonly success: true;
      readonly committedProviderId: string;
      readonly readinessRevision: number;
    }
  | {
      readonly success: false;
      readonly committedProviderId: string;
      readonly readinessRevision: number;
      readonly error: LocalWhisperRendererSafeFailure;
    };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isMember<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function isSafeEpoch(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isSafeByteCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isSafeOperationId(value: unknown): value is string {
  return typeof value === 'string' && /^[\w-]{16,128}$/u.test(value);
}

function isPromptMutation(value: unknown): value is LocalWhisperPromptMutation {
  if (!isPlainRecord(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'unchanged' || value.kind === 'clear') return hasExactKeys(value, ['kind']);
  return (
    value.kind === 'replace' &&
    hasExactKeys(value, ['kind', 'value']) &&
    typeof value.value === 'string' &&
    getLocalWhisperPromptValidationError(value.value) === null
  );
}

function isDecoding(value: unknown): boolean {
  if (!isPlainRecord(value) || typeof value.strategy !== 'string') return false;
  if (value.strategy === 'greedy') {
    return hasExactKeys(value, ['strategy', 'temperatureHundredths']) && value.temperatureHundredths === 0;
  }
  if (value.strategy === 'beamSearch') {
    return (
      hasExactKeys(value, ['strategy', 'temperatureHundredths', 'beamSize']) &&
      value.temperatureHundredths === 0 &&
      Number.isSafeInteger(value.beamSize) &&
      (value.beamSize as number) >= LOCAL_WHISPER_MIN_CANDIDATE_COUNT &&
      (value.beamSize as number) <= LOCAL_WHISPER_MAX_CANDIDATE_COUNT
    );
  }
  return (
    value.strategy === 'bestOfSampling' &&
    hasExactKeys(value, ['strategy', 'temperatureHundredths', 'bestOf']) &&
    Number.isSafeInteger(value.temperatureHundredths) &&
    (value.temperatureHundredths as number) > 0 &&
    (value.temperatureHundredths as number) <= LOCAL_WHISPER_MAX_TEMPERATURE_HUNDREDTHS &&
    (value.temperatureHundredths as number) % LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS === 0 &&
    Number.isSafeInteger(value.bestOf) &&
    (value.bestOf as number) >= LOCAL_WHISPER_MIN_CANDIDATE_COUNT &&
    (value.bestOf as number) <= LOCAL_WHISPER_MAX_CANDIDATE_COUNT
  );
}

export function isLocalWhisperPublicSettings(value: unknown): value is LocalWhisperPublicSettings {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, [
      'schemaVersion',
      'engine',
      'runtimeRevision',
      'model',
      'language',
      'decoding',
      'execution',
    ]) ||
    value.schemaVersion !== LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION ||
    !isLocalWhisperEngine(value.engine) ||
    (value.runtimeRevision !== null && toLocalWhisperRevisionId(value.runtimeRevision) === null) ||
    !isPlainRecord(value.model) ||
    !hasExactKeys(value.model, ['family', 'revision', 'variant']) ||
    !isLocalWhisperModelFamily(value.model.family) ||
    toLocalWhisperRevisionId(value.model.revision) === null ||
    !isMember(LOCAL_WHISPER_MODEL_VARIANTS, value.model.variant) ||
    !isLocalWhisperLanguageId(value.language) ||
    !isDecoding(value.decoding) ||
    !isPlainRecord(value.execution) ||
    !isLocalWhisperTarget(value.execution.target)
  ) {
    return false;
  }
  if (value.execution.target === 'cpu') {
    return (
      hasExactKeys(value.execution, ['target', 'backend', 'cpuThreads']) &&
      value.execution.backend === 'cpu' &&
      (value.execution.cpuThreads === LOCAL_WHISPER_AUTO_CPU_THREADS ||
        (Number.isSafeInteger(value.execution.cpuThreads) && (value.execution.cpuThreads as number) > 0))
    );
  }
  return (
    hasExactKeys(value.execution, ['target', 'backend', 'deviceId']) &&
    (value.execution.backend === null || isLocalWhisperGpuBackend(value.execution.backend)) &&
    (value.execution.deviceId === null || toLocalWhisperOpaqueDeviceId(value.execution.deviceId) !== null)
  );
}

function hasExpectedState(record: Record<string, unknown>): boolean {
  return (
    isSafeEpoch(record.expectedSnapshotRevision) &&
    isSafeEpoch(record.expectedConfigurationEpoch) &&
    isSafeEpoch(record.expectedInventoryEpoch)
  );
}

function isArtifactTarget(record: Record<string, unknown>): boolean {
  return (
    hasExpectedState(record) &&
    isMember(LOCAL_WHISPER_ARTIFACT_KINDS, record.artifactKind) &&
    toLocalWhisperArtifactId(record.artifactId) !== null &&
    toLocalWhisperRevisionId(record.artifactRevision) !== null
  );
}

export function isLocalWhisperSettingsCommand(value: unknown): value is LocalWhisperSettingsCommand {
  if (!isPlainRecord(value) || typeof value.kind !== 'string') return false;
  const expectedKeys = ['kind', 'expectedSnapshotRevision', 'expectedConfigurationEpoch', 'expectedInventoryEpoch'];
  if (value.kind === 'save') {
    return (
      hasExactKeys(value, [...expectedKeys, 'candidate', 'promptMutation']) &&
      hasExpectedState(value) &&
      isLocalWhisperPublicSettings(value.candidate) &&
      isPromptMutation(value.promptMutation)
    );
  }
  if (
    value.kind === 'reset' ||
    value.kind === 'checkCompatibility' ||
    value.kind === 'load' ||
    value.kind === 'unload'
  ) {
    return hasExactKeys(value, expectedKeys) && hasExpectedState(value);
  }
  if (value.kind === 'download' || value.kind === 'resume' || value.kind === 'retry') {
    return (
      hasExactKeys(value, [...expectedKeys, 'artifactKind', 'artifactId', 'artifactRevision']) &&
      isArtifactTarget(value)
    );
  }
  if (value.kind === 'cancelArtifact') {
    return (
      hasExactKeys(value, [...expectedKeys, 'operationId']) &&
      hasExpectedState(value) &&
      isSafeOperationId(value.operationId)
    );
  }
  if (value.kind === 'remove') {
    return (
      hasExactKeys(value, [...expectedKeys, 'artifactKind', 'artifactId', 'artifactRevision', 'confirmed']) &&
      isArtifactTarget(value) &&
      typeof value.confirmed === 'boolean'
    );
  }
  if (value.kind === 'openManagedFolder') {
    return hasExactKeys(value, ['kind', 'expectedSnapshotRevision']) && isSafeEpoch(value.expectedSnapshotRevision);
  }
  return (
    value.kind === 'viewArtifactReference' &&
    hasExactKeys(value, [
      'kind',
      'referenceKind',
      'artifactKind',
      'artifactId',
      'artifactRevision',
      'referenceId',
      'expectedCatalogRevision',
      'expectedSnapshotRevision',
    ]) &&
    isMember(LOCAL_WHISPER_REFERENCE_KINDS, value.referenceKind) &&
    isMember(LOCAL_WHISPER_ARTIFACT_KINDS, value.artifactKind) &&
    toLocalWhisperArtifactId(value.artifactId) !== null &&
    toLocalWhisperRevisionId(value.artifactRevision) !== null &&
    toLocalWhisperArtifactId(value.referenceId) !== null &&
    toLocalWhisperRevisionId(value.expectedCatalogRevision) !== null &&
    isSafeEpoch(value.expectedSnapshotRevision)
  );
}

function isFamilyGuidance(value: unknown): value is LocalWhisperFamilyMemoryGuidance {
  if (!isPlainRecord(value) || !hasExactKeys(value, ['model', 'approximateVramGiB', 'approximateSystemRamGiB'])) {
    return false;
  }
  if (!isLocalWhisperModelFamily(value.model)) return false;
  const expected = LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE[value.model];
  return (
    Array.isArray(value.approximateVramGiB) &&
    value.approximateVramGiB.length === 2 &&
    value.approximateVramGiB[0] === expected.approximateVramGiB[0] &&
    value.approximateVramGiB[1] === expected.approximateVramGiB[1] &&
    Array.isArray(value.approximateSystemRamGiB) &&
    value.approximateSystemRamGiB.length === 2 &&
    value.approximateSystemRamGiB[0] === expected.approximateSystemRamGiB[0] &&
    value.approximateSystemRamGiB[1] === expected.approximateSystemRamGiB[1]
  );
}

function hasCompleteFamilyGuidance(value: unknown): value is readonly LocalWhisperFamilyMemoryGuidance[] {
  if (!Array.isArray(value) || value.length !== LOCAL_WHISPER_MODEL_FAMILIES.length || !value.every(isFamilyGuidance)) {
    return false;
  }
  return LOCAL_WHISPER_MODEL_FAMILIES.every((family) => value.filter((entry) => entry.model === family).length === 1);
}

function isValidationIssue(value: unknown): value is LocalWhisperSettingsValidationIssue {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, ['path', 'reason']) &&
    typeof value.path === 'string' &&
    value.path.length <= 160 &&
    isMember(
      [
        'invalid-shape',
        'unknown-property',
        'unknown-value',
        'invalid-number',
        'invalid-unicode',
        'cross-field-invalid',
      ] as const,
      value.reason,
    )
  );
}

function isRendererOption(value: unknown): value is LocalWhisperRendererOption {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, [
      'group',
      'id',
      'label',
      'available',
      'tier',
      'reason',
      'selected',
      'selectedButUnavailable',
      'saved',
      'default',
      'recommended',
      'remembered',
    ]) &&
    isMember(
      ['engine', 'target', 'backend', 'device', 'runtime', 'modelFamily', 'modelRevision'] as const,
      value.group,
    ) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    value.id.length <= 256 &&
    isLocalWhisperRendererSafeLabel(value.label) &&
    typeof value.available === 'boolean' &&
    isMember(LOCAL_WHISPER_SUPPORT_TIERS, value.tier) &&
    (value.reason === null || isLocalWhisperFailureCode(value.reason)) &&
    typeof value.selected === 'boolean' &&
    typeof value.selectedButUnavailable === 'boolean' &&
    typeof value.saved === 'boolean' &&
    typeof value.default === 'boolean' &&
    typeof value.recommended === 'boolean' &&
    typeof value.remembered === 'boolean'
  );
}

function isReference(value: unknown): value is LocalWhisperArtifactReference {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, ['kind', 'artifactKind', 'artifactId', 'artifactRevision', 'referenceId', 'label']) &&
    isMember(LOCAL_WHISPER_REFERENCE_KINDS, value.kind) &&
    isMember(LOCAL_WHISPER_ARTIFACT_KINDS, value.artifactKind) &&
    toLocalWhisperArtifactId(value.artifactId) !== null &&
    toLocalWhisperRevisionId(value.artifactRevision) !== null &&
    toLocalWhisperArtifactId(value.referenceId) !== null &&
    isLocalWhisperRendererSafeLabel(value.label)
  );
}

function isArtifact(value: unknown): value is LocalWhisperRendererArtifact {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, [
      'kind',
      'id',
      'revision',
      'label',
      'state',
      'transferSizeBytes',
      'installedSizeBytes',
      'updateAvailable',
      'actions',
      'references',
    ]) &&
    isMember(LOCAL_WHISPER_ARTIFACT_KINDS, value.kind) &&
    toLocalWhisperArtifactId(value.id) !== null &&
    toLocalWhisperRevisionId(value.revision) !== null &&
    isLocalWhisperRendererSafeLabel(value.label) &&
    isMember(LOCAL_WHISPER_ARTIFACT_SETUP_STATES, value.state) &&
    isSafeByteCount(value.transferSizeBytes) &&
    isSafeByteCount(value.installedSizeBytes) &&
    typeof value.updateAvailable === 'boolean' &&
    Array.isArray(value.actions) &&
    value.actions.every((action) => isMember(LOCAL_WHISPER_ARTIFACT_ACTIONS, action)) &&
    new Set(value.actions).size === value.actions.length &&
    Array.isArray(value.references) &&
    value.references.every(isReference)
  );
}

function isProgress(value: unknown): value is LocalWhisperArtifactProgress {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, [
      'operationId',
      'artifactId',
      'action',
      'receivedBytes',
      'totalBytes',
      'queuedPosition',
      'failure',
    ]) &&
    isSafeOperationId(value.operationId) &&
    toLocalWhisperArtifactId(value.artifactId) !== null &&
    isMember(LOCAL_WHISPER_ARTIFACT_ACTIONS, value.action) &&
    isSafeByteCount(value.receivedBytes) &&
    isSafeByteCount(value.totalBytes) &&
    value.receivedBytes <= value.totalBytes &&
    (value.queuedPosition === null ||
      (Number.isSafeInteger(value.queuedPosition) && (value.queuedPosition as number) > 0)) &&
    (value.failure === null || isLocalWhisperRendererSafeFailure(value.failure))
  );
}

function isMemory(value: unknown): value is LocalWhisperRendererMemoryFacts {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, ['approximateFamilies', 'selectedEstimate', 'qualifiedPeak', 'exactEstimateUnavailable']) ||
    !hasCompleteFamilyGuidance(value.approximateFamilies) ||
    (value.selectedEstimate !== null && !isLocalWhisperMemoryEstimateRecord(value.selectedEstimate)) ||
    typeof value.exactEstimateUnavailable !== 'boolean'
  ) {
    return false;
  }
  if (value.qualifiedPeak === null) return true;
  return (
    isPlainRecord(value.qualifiedPeak) &&
    hasExactKeys(value.qualifiedPeak, ['measuredPeakRamBytes', 'measuredPeakVramBytes', 'qualificationProfileId']) &&
    isSafeByteCount(value.qualifiedPeak.measuredPeakRamBytes) &&
    (value.qualifiedPeak.measuredPeakVramBytes === 'notApplicable' ||
      isSafeByteCount(value.qualifiedPeak.measuredPeakVramBytes)) &&
    toLocalWhisperArtifactId(value.qualifiedPeak.qualificationProfileId) !== null
  );
}

export function isLocalWhisperRendererSnapshot(value: unknown): value is LocalWhisperRendererSnapshot {
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, [
      'snapshotRevision',
      'configurationEpoch',
      'inventoryEpoch',
      'catalogRevision',
      'settings',
      'hasInitialPrompt',
      'selectedDeviceId',
      'options',
      'validationIssues',
      'memory',
      'storage',
      'artifacts',
      'progress',
      'runtime',
      'failure',
      'prerequisites',
      'lastValidatedAtMs',
    ]) ||
    !isSafeEpoch(value.snapshotRevision) ||
    !isSafeEpoch(value.configurationEpoch) ||
    !isSafeEpoch(value.inventoryEpoch) ||
    (value.catalogRevision !== null && toLocalWhisperRevisionId(value.catalogRevision) === null) ||
    !isLocalWhisperPublicSettings(value.settings) ||
    typeof value.hasInitialPrompt !== 'boolean' ||
    (value.selectedDeviceId !== null && toLocalWhisperOpaqueDeviceId(value.selectedDeviceId) === null) ||
    !Array.isArray(value.options) ||
    !value.options.every(isRendererOption) ||
    !Array.isArray(value.validationIssues) ||
    !value.validationIssues.every(isValidationIssue) ||
    !isMemory(value.memory) ||
    !Array.isArray(value.artifacts) ||
    !value.artifacts.every(isArtifact) ||
    !Array.isArray(value.progress) ||
    !value.progress.every(isProgress) ||
    !isLocalWhisperRuntimeSnapshot(value.runtime) ||
    (value.failure !== null && !isLocalWhisperRendererSafeFailure(value.failure))
  ) {
    return false;
  }
  if (
    !isPlainRecord(value.storage) ||
    !hasExactKeys(value.storage, ['label', 'installedArtifactCount', 'installedBytes']) ||
    !isLocalWhisperRendererSafeLabel(value.storage.label) ||
    !isSafeByteCount(value.storage.installedArtifactCount) ||
    !isSafeByteCount(value.storage.installedBytes)
  ) {
    return false;
  }
  if (
    !Array.isArray(value.prerequisites) ||
    !value.prerequisites.every(
      (item) =>
        isPlainRecord(item) &&
        hasExactKeys(item, ['id', 'label', 'version']) &&
        typeof item.id === 'string' &&
        item.id.length > 0 &&
        item.id.length <= 256 &&
        isLocalWhisperRendererSafeLabel(item.label) &&
        (item.version === null || isLocalWhisperRendererSafeLabel(item.version)),
    )
  ) {
    return false;
  }
  return value.lastValidatedAtMs === null || isSafeEpoch(value.lastValidatedAtMs);
}

export function isLocalWhisperMainStatusSnapshot(value: unknown): value is LocalWhisperMainStatusSnapshot {
  return (
    isPlainRecord(value) &&
    hasExactKeys(value, ['providerId', 'snapshotRevision', 'runtime', 'failure', 'selectedButUnavailable']) &&
    value.providerId === 'local-whisper' &&
    isSafeEpoch(value.snapshotRevision) &&
    isLocalWhisperRuntimeSnapshot(value.runtime) &&
    (value.failure === null || isLocalWhisperRendererSafeFailure(value.failure)) &&
    typeof value.selectedButUnavailable === 'boolean'
  );
}

export function isLocalWhisperProviderSelectionResult(value: unknown): value is LocalWhisperProviderSelectionResult {
  if (!isPlainRecord(value) || typeof value.success !== 'boolean') return false;
  const base =
    typeof value.committedProviderId === 'string' &&
    value.committedProviderId.length > 0 &&
    value.committedProviderId.length <= 128 &&
    isSafeEpoch(value.readinessRevision);
  if (!base) return false;
  return value.success
    ? hasExactKeys(value, ['success', 'committedProviderId', 'readinessRevision'])
    : hasExactKeys(value, ['success', 'committedProviderId', 'readinessRevision', 'error']) &&
        isLocalWhisperRendererSafeFailure(value.error);
}

export function isLocalWhisperIpcAcknowledgement(value: unknown): value is LocalWhisperIpcAcknowledgement {
  return isPlainRecord(value) && hasExactKeys(value, ['success']) && value.success === true;
}

export function isLocalWhisperSettingsCommandResult(value: unknown): value is LocalWhisperSettingsCommandResult {
  if (!isPlainRecord(value) || typeof value.success !== 'boolean' || !isLocalWhisperRendererSnapshot(value.snapshot)) {
    return false;
  }
  const commandKinds = [
    'save',
    'reset',
    'checkCompatibility',
    'load',
    'unload',
    'download',
    'resume',
    'retry',
    'cancelArtifact',
    'remove',
    'openManagedFolder',
    'viewArtifactReference',
  ] as const;
  if (value.success) {
    if (!isMember(commandKinds, value.command)) return false;
    const keys =
      value.operationId === undefined
        ? ['success', 'command', 'snapshot']
        : ['success', 'command', 'snapshot', 'operationId'];
    return hasExactKeys(value, keys) && (value.operationId === undefined || isSafeOperationId(value.operationId));
  }
  return (
    hasExactKeys(value, ['success', 'command', 'snapshot', 'error']) &&
    (value.command === 'invalid' || isMember(commandKinds, value.command)) &&
    isLocalWhisperRendererSafeFailure(value.error)
  );
}

export function isLocalWhisperArtifactKind(value: unknown): value is LocalWhisperArtifactKind {
  return isMember(LOCAL_WHISPER_ARTIFACT_KINDS, value);
}

export function isLocalWhisperReferenceKind(value: unknown): value is LocalWhisperReferenceKind {
  return isMember(LOCAL_WHISPER_REFERENCE_KINDS, value);
}

export function isLocalWhisperBackendSelection(value: unknown): boolean {
  return value === null || isLocalWhisperBackend(value);
}

export function isLocalWhisperModelFamilySelection(value: unknown): value is LocalWhisperModelFamily {
  return isLocalWhisperModelFamily(value);
}
