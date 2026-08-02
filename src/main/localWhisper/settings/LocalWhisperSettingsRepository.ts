/* eslint-disable max-classes-per-file -- the private JSON adapter, stable error, and repository share one storage boundary. */
import { randomUUID } from 'node:crypto';
import type * as fs from 'node:fs';
import * as path from 'node:path';

import {
  EMPTY_LOCAL_WHISPER_DEPENDENT_SELECTION_MEMORY,
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_BACKENDS,
  LOCAL_WHISPER_DECODING_STRATEGIES,
  LOCAL_WHISPER_ENGINES,
  LOCAL_WHISPER_GPU_BACKENDS,
  LOCAL_WHISPER_MAX_CANDIDATE_COUNT,
  LOCAL_WHISPER_MAX_TEMPERATURE_HUNDREDTHS,
  LOCAL_WHISPER_MIN_CANDIDATE_COUNT,
  LOCAL_WHISPER_MODEL_FAMILIES,
  LOCAL_WHISPER_MODEL_VARIANTS,
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  LOCAL_WHISPER_TARGETS,
  LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS,
  createNeverConfiguredLocalWhisperSettings,
  getLocalWhisperPromptValidationError,
  isLocalWhisperLanguageId,
  rememberLocalWhisperSettingsSelections,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  validateLocalWhisperSettings,
  type LocalWhisperDependentSelectionMemory,
  type LocalWhisperDeviceDescriptor,
  type LocalWhisperEngine,
  type LocalWhisperGpuBackend,
  type LocalWhisperKnownModelSelection,
  type LocalWhisperKnownRuntimeSelection,
  type LocalWhisperSettings,
  type LocalWhisperSettingsValidationContext,
  type LocalWhisperSettingsValidationIssue,
} from '@shared/localWhisper';

export const LOCAL_WHISPER_PRIVATE_FILE_MODE = 0o600;
export const LOCAL_WHISPER_PRIVATE_DIRECTORY_MODE = 0o700;
export const LOCAL_WHISPER_SETTINGS_NAMESPACE = 'local-whisper' as const;
export const LOCAL_WHISPER_SETTINGS_DOCUMENT_SCHEMA_VERSION = 1 as const;
export const LOCAL_WHISPER_SETTINGS_SUPPORTED_PRIOR_DOCUMENT_SCHEMA_VERSIONS = [0] as const;
export const LOCAL_WHISPER_SETTINGS_DIRECTORY_NAME = 'local-whisper';
export const LOCAL_WHISPER_SETTINGS_FILE_NAME = 'settings.json';

const SETTINGS_KEYS = [
  'schemaVersion',
  'engine',
  'runtimeRevision',
  'model',
  'language',
  'initialPrompt',
  'decoding',
  'execution',
] as const;
const MODEL_KEYS = ['family', 'revision', 'variant'] as const;
interface StoredKnownShape {
  readonly [key: string]: StoredKnownShape | 'validated' | null;
}
const STORED_DOCUMENT_SHAPE: StoredKnownShape = Object.freeze({
  namespace: null,
  schemaVersion: null,
  settings: Object.freeze({
    schemaVersion: null,
    engine: null,
    runtimeRevision: null,
    model: Object.freeze({ family: null, revision: null, variant: null }),
    language: null,
    initialPrompt: null,
    decoding: Object.freeze({ strategy: null, temperatureHundredths: null, beamSize: null, bestOf: null }),
    execution: Object.freeze({
      target: null,
      backend: null,
      deviceId: null,
      cpuThreads: null,
    }),
  }),
  dependentSelections: Object.freeze({ values: 'validated' }),
});
const FORBIDDEN_UNKNOWN_FIELD_TOKENS = [
  'url',
  'uri',
  'path',
  'executable',
  'hash',
  'signature',
  'argv',
  'environment',
  'pid',
  'nonce',
  'serial',
  'uuid',
  'fingerprint',
  'progress',
  'journal',
  'ready',
  'residency',
  'activity',
  'worker',
] as const;
const UNSET_SELECTION_VALUE = '__unset__';

export type LocalWhisperPrivateJsonReadResult =
  | { readonly status: 'ok'; readonly value: unknown }
  | { readonly status: 'missing' }
  | { readonly status: 'malformed' };

export interface LocalWhisperPrivateJsonStore {
  read(): LocalWhisperPrivateJsonReadResult;
  remove(): boolean;
  write(value: unknown): void;
}

export interface FileLocalWhisperPrivateJsonStoreDependencies {
  readonly createTemporaryPath?: (filePath: string) => string;
  readonly filePath: string;
  readonly fileSystem: Pick<
    typeof fs,
    'chmodSync' | 'existsSync' | 'mkdirSync' | 'readFileSync' | 'renameSync' | 'rmSync' | 'unlinkSync' | 'writeFileSync'
  >;
  readonly platform: NodeJS.Platform;
}

export interface LocalWhisperSettingsSnapshot {
  readonly configured: boolean;
  readonly settings: LocalWhisperSettings;
  readonly dependentSelections: LocalWhisperDependentSelectionMemory;
  readonly repairIssues: readonly LocalWhisperSettingsValidationIssue[];
}

export type LocalWhisperSettingsLoadResult =
  | { readonly status: 'default' | 'configured' | 'repairable'; readonly snapshot: LocalWhisperSettingsSnapshot }
  | { readonly status: 'invalid'; readonly code: 'INVALID_SETTINGS' }
  | { readonly status: 'unsupported'; readonly code: 'SETTINGS_VERSION_UNSUPPORTED'; readonly schemaVersion: number };

/** Stable content-free error for settings validation, compatibility, and persistence failures. */
export class LocalWhisperSettingsRepositoryError extends Error {
  public constructor(
    public readonly code: 'INVALID_SETTINGS' | 'SETTINGS_VERSION_UNSUPPORTED' | 'SETTINGS_WRITE_FAILED',
  ) {
    super(code);
    this.name = 'LocalWhisperSettingsRepositoryError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMember<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isSafeStoredString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 4_096 &&
    getLocalWhisperPromptValidationError(value) !== 'invalid-scalar'
  );
}

function looksLikeOperationalAuthority(value: string): boolean {
  const first = value.charAt(0);
  const hasWindowsDrivePrefix =
    value.length >= 3 && /[a-z]/iu.test(first) && value.charAt(1) === ':' && ['/', '\\'].includes(value.charAt(2));
  return (
    value.includes('://') ||
    value.includes('BEGIN PRIVATE KEY') ||
    first === '/' ||
    first === '\\' ||
    hasWindowsDrivePrefix
  );
}

function isForbiddenUnknownField(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/giu, '').toLowerCase();
  return FORBIDDEN_UNKNOWN_FIELD_TOKENS.some((token) => normalized.includes(token));
}

function hasSafeUnknownFields(value: unknown, knownShape?: StoredKnownShape | 'validated' | null): boolean {
  if (knownShape === 'validated') return true;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return isSafeInteger(value);
  if (typeof value === 'string') {
    return (
      isSafeStoredString(value) &&
      !value.includes('\0') &&
      (knownShape === null || !looksLikeOperationalAuthority(value))
    );
  }
  if (Array.isArray(value)) {
    return value.length <= 4_096 && value.every((entry) => hasSafeUnknownFields(entry, knownShape));
  }
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([key, nested]) => {
    const childShape = knownShape ? knownShape[key] : undefined;
    const isKnown = childShape !== undefined;
    return (isKnown || !isForbiddenUnknownField(key)) && hasSafeUnknownFields(nested, childShape);
  });
}

function projectObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

function projectSettings(value: unknown): unknown {
  const settings = projectObject(value, SETTINGS_KEYS);
  settings.model = projectObject(settings.model, MODEL_KEYS);
  const decoding = isRecord(settings.decoding) ? settings.decoding : {};
  settings.decoding = projectObject(
    decoding,
    decoding.strategy === 'beamSearch'
      ? ['strategy', 'temperatureHundredths', 'beamSize']
      : decoding.strategy === 'bestOfSampling'
        ? ['strategy', 'temperatureHundredths', 'bestOf']
        : ['strategy', 'temperatureHundredths'],
  );
  const execution = isRecord(settings.execution) ? settings.execution : {};
  const executionKeys =
    execution.target === 'cpu' ? ['target', 'backend', 'cpuThreads'] : ['target', 'backend', 'deviceId'];
  settings.execution = projectObject(execution, executionKeys);
  return settings;
}

function inferMissingDevice(
  engine: LocalWhisperEngine,
  backend: LocalWhisperGpuBackend,
  deviceId: unknown,
): LocalWhisperDeviceDescriptor | null {
  const id = toLocalWhisperOpaqueDeviceId(deviceId);
  if (!id) return null;
  const vendor = backend === 'cuda' ? 'nvidia' : backend === 'metal' ? 'apple' : 'amd';
  return Object.freeze({
    id,
    label: 'Unavailable device',
    vendor,
    available: false,
    eligibleBackends: Object.freeze([backend]),
  });
}

function createRepairableValidationContext(
  candidate: unknown,
  context: LocalWhisperSettingsValidationContext,
): LocalWhisperSettingsValidationContext {
  if (!isRecord(candidate)) return context;
  const engine = isMember(LOCAL_WHISPER_ENGINES, candidate.engine) ? candidate.engine : undefined;
  const model = isRecord(candidate.model) ? candidate.model : undefined;
  const execution = isRecord(candidate.execution) ? candidate.execution : undefined;
  const runtimeRevision = toLocalWhisperRevisionId(candidate.runtimeRevision);
  const modelRevision = toLocalWhisperRevisionId(model?.revision);
  const knownRuntimeSelections: LocalWhisperKnownRuntimeSelection[] = [...context.knownRuntimeSelections];
  const knownModelSelections: LocalWhisperKnownModelSelection[] = [...context.knownModelSelections];
  const knownDevices: LocalWhisperDeviceDescriptor[] = [...context.knownDevices];

  if (
    engine &&
    runtimeRevision &&
    execution &&
    isMember(LOCAL_WHISPER_TARGETS, execution.target) &&
    isMember(LOCAL_WHISPER_BACKENDS, execution.backend)
  ) {
    knownRuntimeSelections.push({
      engine,
      target: execution.target,
      backend: execution.backend,
      revision: runtimeRevision,
      recommended: false,
    });
  }
  if (
    engine &&
    model &&
    isMember(LOCAL_WHISPER_MODEL_FAMILIES, model.family) &&
    modelRevision &&
    isMember(LOCAL_WHISPER_MODEL_VARIANTS, model.variant)
  ) {
    knownModelSelections.push({
      engine,
      family: model.family,
      revision: modelRevision,
      variant: model.variant,
      recommended: false,
    });
  }
  if (engine && execution && isMember(LOCAL_WHISPER_GPU_BACKENDS, execution.backend)) {
    const missingDevice = inferMissingDevice(engine, execution.backend, execution.deviceId);
    if (missingDevice && !knownDevices.some(({ id }) => id === missingDevice.id)) knownDevices.push(missingDevice);
  }
  return Object.freeze({
    ...context,
    knownDevices: Object.freeze(knownDevices),
    knownRuntimeSelections: Object.freeze(knownRuntimeSelections),
    knownModelSelections: Object.freeze(knownModelSelections),
  });
}

function isSelectionKey(key: string): boolean {
  const parts = key.split(':');
  switch (parts[0]) {
    case 'runtime':
      return (
        parts.length === 4 &&
        isMember(LOCAL_WHISPER_ENGINES, parts[1]) &&
        isMember(LOCAL_WHISPER_TARGETS, parts[2]) &&
        (isMember(LOCAL_WHISPER_BACKENDS, parts[3]) || parts[3] === 'unset')
      );
    case 'backend':
      return parts.length === 3 && isMember(LOCAL_WHISPER_ENGINES, parts[1]) && parts[2] === 'gpu';
    case 'device':
      return (
        parts.length === 3 &&
        isMember(LOCAL_WHISPER_ENGINES, parts[1]) &&
        isMember(LOCAL_WHISPER_GPU_BACKENDS, parts[2])
      );
    case 'model':
      return parts.length === 2 && isMember(LOCAL_WHISPER_ENGINES, parts[1]);
    case 'revision':
    case 'variant':
      return (
        parts.length === 3 &&
        isMember(LOCAL_WHISPER_ENGINES, parts[1]) &&
        isMember(LOCAL_WHISPER_MODEL_FAMILIES, parts[2])
      );
    case 'threads':
      return parts.length === 2 && isMember(LOCAL_WHISPER_ENGINES, parts[1]);
    case 'request':
      return (
        parts.length === 2 &&
        ['language', 'initialPrompt', 'temperatureHundredths', 'strategy', 'beamSize', 'bestOf'].includes(parts[1])
      );
    default:
      return false;
  }
}

function isSelectionValue(key: string, value: unknown): value is string | number {
  if (value === UNSET_SELECTION_VALUE) return true;
  if (key.startsWith('runtime:') || key.startsWith('revision:')) return toLocalWhisperRevisionId(value) !== null;
  if (key.startsWith('backend:')) return isMember(LOCAL_WHISPER_GPU_BACKENDS, value);
  if (key.startsWith('device:')) return toLocalWhisperOpaqueDeviceId(value) !== null;
  if (key.startsWith('model:')) return isMember(LOCAL_WHISPER_MODEL_FAMILIES, value);
  if (key.startsWith('variant:')) return isMember(LOCAL_WHISPER_MODEL_VARIANTS, value);
  if (key.startsWith('threads:'))
    return value === LOCAL_WHISPER_AUTO_CPU_THREADS || (isSafeInteger(value) && value > 0);
  if (key === 'request:language') return isLocalWhisperLanguageId(value);
  if (key === 'request:initialPrompt') return getLocalWhisperPromptValidationError(value) === null;
  if (key === 'request:strategy') return isMember(LOCAL_WHISPER_DECODING_STRATEGIES, value);
  if (key === 'request:temperatureHundredths') {
    return (
      isSafeInteger(value) &&
      value >= 0 &&
      value <= LOCAL_WHISPER_MAX_TEMPERATURE_HUNDREDTHS &&
      value % LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS === 0
    );
  }
  return (
    isSafeInteger(value) && value >= LOCAL_WHISPER_MIN_CANDIDATE_COUNT && value <= LOCAL_WHISPER_MAX_CANDIDATE_COUNT
  );
}

function readDependentSelections(value: unknown): LocalWhisperDependentSelectionMemory | null {
  if (!isRecord(value) || !isRecord(value.values)) return null;
  const entries = Object.entries(value.values);
  if (entries.some(([key, selection]) => !isSelectionKey(key) || !isSelectionValue(key, selection))) return null;
  return Object.freeze({ values: Object.freeze({ ...value.values }) });
}

function mergePreservingUnknown(previous: unknown, next: unknown): unknown {
  if (!isRecord(previous) || !isRecord(next)) return structuredClone(next);
  const merged: Record<string, unknown> = { ...structuredClone(previous) };
  for (const [key, value] of Object.entries(next)) {
    merged[key] = mergePreservingUnknown(previous[key], value);
  }
  return merged;
}

/** Migrates only repository-owned prior schemas in memory and performs no persistence or runtime action. */
export function migrateLocalWhisperSettingsDocument(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || value.namespace !== LOCAL_WHISPER_SETTINGS_NAMESPACE) return null;
  if (value.schemaVersion === 0) {
    const { configuration, ...preserved } = value;
    return {
      ...preserved,
      schemaVersion: LOCAL_WHISPER_SETTINGS_DOCUMENT_SCHEMA_VERSION,
      settings: isRecord(configuration)
        ? { ...configuration, schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION }
        : configuration,
      dependentSelections: value.dependentSelections ?? EMPTY_LOCAL_WHISPER_DEPENDENT_SELECTION_MEMORY,
    };
  }
  return value;
}

export function resolveLocalWhisperSettingsFile(configurationRoot: string): string {
  return path.join(configurationRoot, LOCAL_WHISPER_SETTINGS_DIRECTORY_NAME, LOCAL_WHISPER_SETTINGS_FILE_NAME);
}

/** Same-directory exclusive temporary write followed by an atomic replacement where rename supports it. */
export class FileLocalWhisperPrivateJsonStore implements LocalWhisperPrivateJsonStore {
  public constructor(private readonly dependencies: FileLocalWhisperPrivateJsonStoreDependencies) {}

  public read(): LocalWhisperPrivateJsonReadResult {
    if (!this.dependencies.fileSystem.existsSync(this.dependencies.filePath)) return { status: 'missing' };
    try {
      return {
        status: 'ok',
        value: JSON.parse(this.dependencies.fileSystem.readFileSync(this.dependencies.filePath, 'utf8')) as unknown,
      };
    } catch {
      return { status: 'malformed' };
    }
  }

  public remove(): boolean {
    try {
      if (!this.dependencies.fileSystem.existsSync(this.dependencies.filePath)) return false;
      this.dependencies.fileSystem.unlinkSync(this.dependencies.filePath);
      return true;
    } catch {
      throw new LocalWhisperSettingsRepositoryError('SETTINGS_WRITE_FAILED');
    }
  }

  public write(value: unknown): void {
    const directory = path.dirname(this.dependencies.filePath);
    const temporaryPath =
      this.dependencies.createTemporaryPath?.(this.dependencies.filePath) ??
      path.join(directory, `${path.basename(this.dependencies.filePath)}.${randomUUID()}.tmp`);
    if (path.dirname(temporaryPath) !== directory || temporaryPath === this.dependencies.filePath) {
      throw new LocalWhisperSettingsRepositoryError('SETTINGS_WRITE_FAILED');
    }
    try {
      this.dependencies.fileSystem.mkdirSync(directory, {
        recursive: true,
        mode: LOCAL_WHISPER_PRIVATE_DIRECTORY_MODE,
      });
      if (this.dependencies.platform !== 'win32') {
        this.dependencies.fileSystem.chmodSync(directory, LOCAL_WHISPER_PRIVATE_DIRECTORY_MODE);
      }
      this.dependencies.fileSystem.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: LOCAL_WHISPER_PRIVATE_FILE_MODE,
      });
      if (this.dependencies.platform !== 'win32') {
        this.dependencies.fileSystem.chmodSync(temporaryPath, LOCAL_WHISPER_PRIVATE_FILE_MODE);
      }
      this.dependencies.fileSystem.renameSync(temporaryPath, this.dependencies.filePath);
      if (this.dependencies.platform !== 'win32') {
        this.dependencies.fileSystem.chmodSync(this.dependencies.filePath, LOCAL_WHISPER_PRIVATE_FILE_MODE);
      }
    } catch {
      try {
        this.dependencies.fileSystem.rmSync(temporaryPath, { force: true });
      } catch {
        // Preserve only the stable repository error and never expose the private temporary path.
      }
      throw new LocalWhisperSettingsRepositoryError('SETTINGS_WRITE_FAILED');
    }
  }
}

/** Owns versioned Local Whisper settings without capability, network, artifact, or residency side effects. */
export class LocalWhisperSettingsRepository {
  public constructor(private readonly store: LocalWhisperPrivateJsonStore) {}

  public load(context: LocalWhisperSettingsValidationContext): LocalWhisperSettingsLoadResult {
    const read = this.store.read();
    if (read.status === 'missing') {
      const defaults = createNeverConfiguredLocalWhisperSettings(context);
      if (!defaults.success) return { status: 'invalid', code: 'INVALID_SETTINGS' };
      return {
        status: 'default',
        snapshot: Object.freeze({
          configured: false,
          settings: defaults.settings,
          dependentSelections: EMPTY_LOCAL_WHISPER_DEPENDENT_SELECTION_MEMORY,
          repairIssues: Object.freeze([]),
        }),
      };
    }
    if (read.status === 'malformed' || !isRecord(read.value)) return { status: 'invalid', code: 'INVALID_SETTINGS' };
    if (
      isSafeInteger(read.value.schemaVersion) &&
      read.value.schemaVersion > LOCAL_WHISPER_SETTINGS_DOCUMENT_SCHEMA_VERSION
    ) {
      return {
        status: 'unsupported',
        code: 'SETTINGS_VERSION_UNSUPPORTED',
        schemaVersion: read.value.schemaVersion,
      };
    }
    const document = migrateLocalWhisperSettingsDocument(read.value);
    if (
      !document ||
      document.schemaVersion !== LOCAL_WHISPER_SETTINGS_DOCUMENT_SCHEMA_VERSION ||
      !hasSafeUnknownFields(document, STORED_DOCUMENT_SHAPE)
    ) {
      return { status: 'invalid', code: 'INVALID_SETTINGS' };
    }
    const projected = projectSettings(document.settings);
    const dependentSelections = readDependentSelections(document.dependentSelections);
    if (!dependentSelections) return { status: 'invalid', code: 'INVALID_SETTINGS' };

    const current = validateLocalWhisperSettings(projected, context);
    if (current.success) {
      return {
        status: 'configured',
        snapshot: Object.freeze({
          configured: true,
          settings: current.settings,
          dependentSelections,
          repairIssues: Object.freeze([]),
        }),
      };
    }
    const repairable = validateLocalWhisperSettings(projected, createRepairableValidationContext(projected, context));
    if (!repairable.success) return { status: 'invalid', code: 'INVALID_SETTINGS' };
    return {
      status: 'repairable',
      snapshot: Object.freeze({
        configured: true,
        settings: repairable.settings,
        dependentSelections,
        repairIssues: current.issues,
      }),
    };
  }

  public save(candidate: unknown, context: LocalWhisperSettingsValidationContext): LocalWhisperSettingsSnapshot {
    const validated = validateLocalWhisperSettings(candidate, context);
    if (!validated.success) throw new LocalWhisperSettingsRepositoryError('INVALID_SETTINGS');
    const read = this.store.read();
    if (
      read.status === 'ok' &&
      isRecord(read.value) &&
      isSafeInteger(read.value.schemaVersion) &&
      read.value.schemaVersion > LOCAL_WHISPER_SETTINGS_DOCUMENT_SCHEMA_VERSION
    ) {
      throw new LocalWhisperSettingsRepositoryError('SETTINGS_VERSION_UNSUPPORTED');
    }
    const previous = read.status === 'ok' ? migrateLocalWhisperSettingsDocument(read.value) : null;
    const previousSelections = readDependentSelections(previous?.dependentSelections);
    const dependentSelections = rememberLocalWhisperSettingsSelections(
      previousSelections ?? EMPTY_LOCAL_WHISPER_DEPENDENT_SELECTION_MEMORY,
      validated.settings,
    );
    const next = {
      namespace: LOCAL_WHISPER_SETTINGS_NAMESPACE,
      schemaVersion: LOCAL_WHISPER_SETTINGS_DOCUMENT_SCHEMA_VERSION,
      settings: validated.settings,
      dependentSelections,
    };
    const document =
      previous && hasSafeUnknownFields(previous, STORED_DOCUMENT_SHAPE) ? mergePreservingUnknown(previous, next) : next;
    this.store.write(document);
    return Object.freeze({
      configured: true,
      settings: validated.settings,
      dependentSelections,
      repairIssues: Object.freeze([]),
    });
  }

  public reset(): boolean {
    return this.store.remove();
  }
}
