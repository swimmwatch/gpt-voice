import {
  hasLocalWhisperControlCharacter,
  isLocalWhisperEngine,
  isLocalWhisperGpuBackend,
  isLocalWhisperModelFamily,
  isLocalWhisperTarget,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperBackend,
  type LocalWhisperDeviceDescriptor,
  type LocalWhisperEngine,
  type LocalWhisperGpuBackend,
  type LocalWhisperModelFamily,
  type LocalWhisperOpaqueDeviceId,
  type LocalWhisperPlatform,
  type LocalWhisperRevisionId,
  type LocalWhisperTarget,
} from './domain';
import { LOCAL_WHISPER_MODEL_VARIANTS, type LocalWhisperModelIdentity, type LocalWhisperModelVariant } from './catalog';
import { isLocalWhisperLanguageId, type LocalWhisperLanguageId } from './languages';

export const LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION = 1 as const;
export const LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS = 1_000;
export const LOCAL_WHISPER_MIN_TEMPERATURE_HUNDREDTHS = 0;
export const LOCAL_WHISPER_MAX_TEMPERATURE_HUNDREDTHS = 100;
export const LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS = 5;
export const LOCAL_WHISPER_MIN_CANDIDATE_COUNT = 1;
export const LOCAL_WHISPER_MAX_CANDIDATE_COUNT = 10;
export const LOCAL_WHISPER_AUTO_CPU_THREADS = 'auto' as const;

export type LocalWhisperCpuThreads = typeof LOCAL_WHISPER_AUTO_CPU_THREADS | number;

export type LocalWhisperDecodingSettings =
  | {
      readonly strategy: 'greedy';
      readonly temperatureHundredths: 0;
    }
  | {
      readonly strategy: 'beamSearch';
      readonly temperatureHundredths: 0;
      readonly beamSize: number;
    }
  | {
      readonly strategy: 'bestOfSampling';
      readonly temperatureHundredths: number;
      readonly bestOf: number;
    };

export interface LocalWhisperModelSelection {
  readonly family: LocalWhisperModelFamily;
  readonly revision: LocalWhisperRevisionId;
  readonly variant: LocalWhisperModelVariant;
}

export type LocalWhisperCppExecutionSettings =
  | {
      readonly target: 'gpu';
      readonly backend: LocalWhisperGpuBackend | null;
      readonly deviceId: LocalWhisperOpaqueDeviceId | null;
    }
  | {
      readonly target: 'cpu';
      readonly backend: 'cpu';
      readonly cpuThreads: LocalWhisperCpuThreads;
    };

interface LocalWhisperSettingsBase {
  readonly schemaVersion: typeof LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION;
  readonly runtimeRevision: LocalWhisperRevisionId | null;
  readonly model: LocalWhisperModelSelection;
  readonly language: LocalWhisperLanguageId;
  readonly initialPrompt: string;
  readonly decoding: LocalWhisperDecodingSettings;
}

export interface LocalWhisperCppSettings extends LocalWhisperSettingsBase {
  readonly engine: 'whisperCpp';
  readonly execution: LocalWhisperCppExecutionSettings;
}

export type LocalWhisperSettings = LocalWhisperCppSettings;
export type LocalWhisperPublicSettings = Omit<LocalWhisperSettings, 'initialPrompt'>;
export type LocalWhisperPromptMutation =
  { readonly kind: 'unchanged' } | { readonly kind: 'clear' } | { readonly kind: 'replace'; readonly value: string };

export interface LocalWhisperKnownRuntimeSelection {
  readonly engine: LocalWhisperEngine;
  readonly target: LocalWhisperTarget;
  readonly backend: LocalWhisperBackend;
  readonly revision: LocalWhisperRevisionId;
  readonly recommended: boolean;
}

export interface LocalWhisperKnownModelSelection {
  readonly engine: LocalWhisperEngine;
  readonly family: LocalWhisperModelFamily;
  readonly revision: LocalWhisperRevisionId;
  readonly variant: LocalWhisperModelVariant;
  readonly recommended: boolean;
}

export interface LocalWhisperEligibleGpuCombination {
  readonly engine: LocalWhisperEngine;
  readonly backend: LocalWhisperGpuBackend;
  readonly deviceId: LocalWhisperOpaqueDeviceId;
}

export interface LocalWhisperSettingsValidationContext {
  readonly platform: LocalWhisperPlatform;
  readonly architecture: 'x64' | 'arm64' | 'other';
  readonly logicalProcessorCount: number;
  readonly knownDevices: readonly LocalWhisperDeviceDescriptor[];
  readonly knownRuntimeSelections: readonly LocalWhisperKnownRuntimeSelection[];
  readonly knownModelSelections: readonly LocalWhisperKnownModelSelection[];
  readonly eligibleGpuCombinations: readonly LocalWhisperEligibleGpuCombination[];
}

export interface LocalWhisperSettingsValidationIssue {
  readonly path: string;
  readonly reason:
    | 'invalid-shape'
    | 'unknown-property'
    | 'unknown-value'
    | 'invalid-number'
    | 'invalid-unicode'
    | 'cross-field-invalid';
}

export type LocalWhisperSettingsValidationResult =
  | { readonly success: true; readonly settings: LocalWhisperSettings }
  | {
      readonly success: false;
      readonly code: 'INVALID_SETTINGS';
      readonly issues: readonly LocalWhisperSettingsValidationIssue[];
    };

export type LocalWhisperSelectionKey =
  | `runtime:${LocalWhisperEngine}:${LocalWhisperTarget}:${LocalWhisperBackend | 'unset'}`
  | `backend:${LocalWhisperEngine}:gpu`
  | `device:${LocalWhisperEngine}:${LocalWhisperGpuBackend}`
  | `model:${LocalWhisperEngine}`
  | `revision:${LocalWhisperEngine}:${LocalWhisperModelFamily}`
  | `variant:${LocalWhisperEngine}:${LocalWhisperModelFamily}`
  | `threads:${LocalWhisperEngine}`
  | `request:language`
  | `request:initialPrompt`
  | `request:temperatureHundredths`
  | `request:strategy`
  | `request:beamSize`
  | `request:bestOf`;

export type LocalWhisperSelectionValue = string | number;

export interface LocalWhisperDependentSelectionMemory {
  readonly values: Readonly<Partial<Record<LocalWhisperSelectionKey, LocalWhisperSelectionValue>>>;
}

interface LocalWhisperCachePublicSnapshot {
  readonly provider: 'local-whisper';
  readonly engine: LocalWhisperEngine;
  readonly runtimeRevision: LocalWhisperRevisionId | null;
  readonly protocolRevision: string;
  readonly target: LocalWhisperTarget;
  readonly backend: LocalWhisperBackend | null;
  readonly deviceClass: string;
  readonly modelFamily: LocalWhisperModelFamily;
  readonly modelRevision: LocalWhisperRevisionId;
  readonly modelVariant: LocalWhisperModelVariant;
  readonly modelSourceCheckpointRevision: LocalWhisperRevisionId;
  readonly modelArtifactRevision: LocalWhisperRevisionId;
  readonly modelNativeFormat: LocalWhisperModelIdentity['nativeFormat'];
  readonly language: LocalWhisperLanguageId;
  readonly temperatureHundredths: number;
  readonly strategy: LocalWhisperDecodingSettings['strategy'];
  readonly candidateCount: number | null;
  readonly resolvedCpuThreads: number | null;
  readonly mappingRevision: string;
}

export interface LocalWhisperCacheContextInput {
  readonly settings: LocalWhisperSettings;
  readonly modelIdentity: LocalWhisperModelIdentity;
  readonly protocolRevision: string;
  readonly mappingRevision: string;
  readonly deviceClass: string;
  readonly resolvedCpuThreads: number | null;
  readonly digestPrompt: (prompt: string) => string;
}

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
const GPU_EXECUTION_KEYS = ['target', 'backend', 'deviceId'] as const;
const CPU_EXECUTION_KEYS = ['target', 'backend', 'cpuThreads'] as const;
const UNSET_SELECTION_VALUE = '__unset__';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isMember<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.some((candidate) => candidate === value);
}

function addIssue(
  issues: LocalWhisperSettingsValidationIssue[],
  path: string,
  reason: LocalWhisperSettingsValidationIssue['reason'],
): void {
  issues.push(Object.freeze({ path, reason }));
}

function isValidCandidateCount(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= LOCAL_WHISPER_MIN_CANDIDATE_COUNT &&
    (value as number) <= LOCAL_WHISPER_MAX_CANDIDATE_COUNT
  );
}

export function getLocalWhisperPromptValidationError(prompt: unknown): string | null {
  if (typeof prompt !== 'string') return 'invalid-type';
  let codePoints = 0;
  for (let index = 0; index < prompt.length; index += 1) {
    const codeUnit = prompt.charCodeAt(index);
    if (codeUnit === 0) return 'nul';
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = prompt.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return 'invalid-scalar';
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return 'invalid-scalar';
    }
    codePoints += 1;
    if (codePoints > LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS) return 'too-long';
  }
  return null;
}

function validateDecoding(value: unknown, issues: LocalWhisperSettingsValidationIssue[]): void {
  if (!isRecord(value)) {
    addIssue(issues, 'decoding', 'invalid-shape');
    return;
  }
  const strategy = value.strategy;
  if (strategy === 'greedy') {
    if (!hasExactKeys(value, ['strategy', 'temperatureHundredths'])) {
      addIssue(issues, 'decoding', 'unknown-property');
      return;
    }
    if (value.temperatureHundredths !== 0) addIssue(issues, 'decoding.temperatureHundredths', 'cross-field-invalid');
    return;
  }
  if (strategy === 'beamSearch') {
    if (!hasExactKeys(value, ['strategy', 'temperatureHundredths', 'beamSize'])) {
      addIssue(issues, 'decoding', 'unknown-property');
      return;
    }
    if (value.temperatureHundredths !== 0) addIssue(issues, 'decoding.temperatureHundredths', 'cross-field-invalid');
    if (!isValidCandidateCount(value.beamSize)) addIssue(issues, 'decoding.beamSize', 'invalid-number');
    return;
  }
  if (strategy === 'bestOfSampling') {
    if (!hasExactKeys(value, ['strategy', 'temperatureHundredths', 'bestOf'])) {
      addIssue(issues, 'decoding', 'unknown-property');
      return;
    }
    if (
      !Number.isSafeInteger(value.temperatureHundredths) ||
      (value.temperatureHundredths as number) < LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS ||
      (value.temperatureHundredths as number) > LOCAL_WHISPER_MAX_TEMPERATURE_HUNDREDTHS ||
      (value.temperatureHundredths as number) % LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS !== 0
    ) {
      addIssue(issues, 'decoding.temperatureHundredths', 'cross-field-invalid');
    }
    if (!isValidCandidateCount(value.bestOf)) addIssue(issues, 'decoding.bestOf', 'invalid-number');
    return;
  }
  addIssue(issues, 'decoding.strategy', 'unknown-value');
}

function validateModel(
  value: unknown,
  engine: unknown,
  context: LocalWhisperSettingsValidationContext,
  issues: LocalWhisperSettingsValidationIssue[],
): void {
  if (!isRecord(value) || !hasExactKeys(value, MODEL_KEYS)) {
    addIssue(issues, 'model', isRecord(value) ? 'unknown-property' : 'invalid-shape');
    return;
  }
  if (!isLocalWhisperModelFamily(value.family)) addIssue(issues, 'model.family', 'unknown-value');
  if (toLocalWhisperRevisionId(value.revision) === null) addIssue(issues, 'model.revision', 'unknown-value');
  if (!isMember(LOCAL_WHISPER_MODEL_VARIANTS, value.variant)) addIssue(issues, 'model.variant', 'unknown-value');
  if (!isLocalWhisperEngine(engine) || !isLocalWhisperModelFamily(value.family)) return;
  if (value.variant === 'q5_0' && value.family !== 'large-v3' && value.family !== 'large-v3-turbo') {
    addIssue(issues, 'model.variant', 'cross-field-invalid');
  }
  const known = context.knownModelSelections.some(
    (selection) =>
      selection.engine === engine &&
      selection.family === value.family &&
      selection.revision === value.revision &&
      selection.variant === value.variant,
  );
  if (!known) addIssue(issues, 'model', 'unknown-value');
}

function getKnownDevice(
  context: LocalWhisperSettingsValidationContext,
  value: unknown,
): LocalWhisperDeviceDescriptor | undefined {
  const id = toLocalWhisperOpaqueDeviceId(value);
  return id === null ? undefined : context.knownDevices.find((device) => device.id === id);
}

function validateGpuCompatibility(
  backend: LocalWhisperGpuBackend | null,
  device: LocalWhisperDeviceDescriptor | undefined,
  context: LocalWhisperSettingsValidationContext,
  issues: LocalWhisperSettingsValidationIssue[],
): void {
  if (backend === null || !device) return;
  if (!device.eligibleBackends.includes(backend)) {
    addIssue(issues, 'execution.backend', 'cross-field-invalid');
    return;
  }
  const validWhisperCppRoute =
    (device.vendor === 'nvidia' && backend === 'cuda') ||
    (device.vendor === 'amd' && context.platform === 'win32' && backend === 'vulkan') ||
    (device.vendor === 'amd' && context.platform === 'linux' && (backend === 'hip' || backend === 'vulkan')) ||
    (device.vendor === 'apple' && context.platform === 'darwin' && backend === 'metal');
  if (!validWhisperCppRoute) {
    addIssue(issues, 'execution.backend', 'cross-field-invalid');
  }
}

function validateRuntimeRevision(
  engine: LocalWhisperEngine,
  target: LocalWhisperTarget,
  backend: LocalWhisperBackend | null,
  revision: unknown,
  context: LocalWhisperSettingsValidationContext,
  issues: LocalWhisperSettingsValidationIssue[],
): void {
  if (revision === null) {
    if (!(target === 'gpu' && backend === null)) addIssue(issues, 'runtimeRevision', 'cross-field-invalid');
    return;
  }
  if (toLocalWhisperRevisionId(revision) === null) {
    addIssue(issues, 'runtimeRevision', 'unknown-value');
    return;
  }
  if (
    backend === null ||
    !context.knownRuntimeSelections.some(
      (selection) =>
        selection.engine === engine &&
        selection.target === target &&
        selection.backend === backend &&
        selection.revision === revision,
    )
  ) {
    addIssue(issues, 'runtimeRevision', 'unknown-value');
  }
}

function validateExecution(
  value: unknown,
  engine: unknown,
  runtimeRevision: unknown,
  context: LocalWhisperSettingsValidationContext,
  issues: LocalWhisperSettingsValidationIssue[],
): void {
  if (!isRecord(value) || !isLocalWhisperTarget(value.target) || !isLocalWhisperEngine(engine)) {
    addIssue(issues, 'execution', isRecord(value) ? 'unknown-value' : 'invalid-shape');
    return;
  }
  if (value.target === 'cpu') {
    if (!hasExactKeys(value, CPU_EXECUTION_KEYS)) addIssue(issues, 'execution', 'unknown-property');
    if (value.backend !== 'cpu') addIssue(issues, 'execution.backend', 'cross-field-invalid');
    if (
      value.cpuThreads !== LOCAL_WHISPER_AUTO_CPU_THREADS &&
      (!Number.isSafeInteger(value.cpuThreads) ||
        (value.cpuThreads as number) < 1 ||
        (value.cpuThreads as number) > context.logicalProcessorCount)
    ) {
      addIssue(issues, 'execution.cpuThreads', 'invalid-number');
    }
    validateRuntimeRevision(engine, 'cpu', 'cpu', runtimeRevision, context, issues);
    return;
  }

  if (!hasExactKeys(value, GPU_EXECUTION_KEYS)) addIssue(issues, 'execution', 'unknown-property');
  const backend = value.backend === null ? null : isLocalWhisperGpuBackend(value.backend) ? value.backend : undefined;
  if (backend === undefined) addIssue(issues, 'execution.backend', 'unknown-value');
  const device = value.deviceId === null ? undefined : getKnownDevice(context, value.deviceId);
  if (value.deviceId !== null && !device) addIssue(issues, 'execution.deviceId', 'unknown-value');
  if (value.deviceId !== null && backend === null) addIssue(issues, 'execution', 'cross-field-invalid');
  if (backend !== undefined) {
    validateGpuCompatibility(backend, device, context, issues);
    validateRuntimeRevision(engine, 'gpu', backend, runtimeRevision, context, issues);
  }
}

function freezeSettings(candidate: Record<string, unknown>): LocalWhisperSettings {
  const model = Object.freeze({ ...(candidate.model as LocalWhisperModelSelection) });
  const decoding = Object.freeze({ ...(candidate.decoding as LocalWhisperDecodingSettings) });
  const execution = Object.freeze({ ...(candidate.execution as LocalWhisperSettings['execution']) });
  return Object.freeze({ ...candidate, model, decoding, execution }) as unknown as LocalWhisperSettings;
}

export function validateLocalWhisperSettings(
  candidate: unknown,
  context: LocalWhisperSettingsValidationContext,
): LocalWhisperSettingsValidationResult {
  const issues: LocalWhisperSettingsValidationIssue[] = [];
  if (!isRecord(candidate)) {
    return { success: false, code: 'INVALID_SETTINGS', issues: [Object.freeze({ path: '', reason: 'invalid-shape' })] };
  }
  if (!hasExactKeys(candidate, SETTINGS_KEYS)) addIssue(issues, '', 'unknown-property');
  if (candidate.schemaVersion !== LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION)
    addIssue(issues, 'schemaVersion', 'unknown-value');
  if (!isLocalWhisperEngine(candidate.engine)) addIssue(issues, 'engine', 'unknown-value');
  validateModel(candidate.model, candidate.engine, context, issues);
  if (!isLocalWhisperLanguageId(candidate.language)) addIssue(issues, 'language', 'unknown-value');
  if (getLocalWhisperPromptValidationError(candidate.initialPrompt) !== null) {
    addIssue(issues, 'initialPrompt', 'invalid-unicode');
  }
  validateDecoding(candidate.decoding, issues);
  validateExecution(candidate.execution, candidate.engine, candidate.runtimeRevision, context, issues);
  if (issues.length > 0) return { success: false, code: 'INVALID_SETTINGS', issues: Object.freeze(issues) };
  return { success: true, settings: freezeSettings(candidate) };
}

/** Validates the prompt-free settings projection used across privileged capability and worker boundaries. */
export function isValidLocalWhisperPublicSettings(
  candidate: unknown,
  context: LocalWhisperSettingsValidationContext,
): candidate is LocalWhisperPublicSettings {
  if (!isRecord(candidate) || Object.prototype.hasOwnProperty.call(candidate, 'initialPrompt')) return false;
  return validateLocalWhisperSettings({ ...candidate, initialPrompt: '' }, context).success;
}

function recommendedModel(
  context: LocalWhisperSettingsValidationContext,
  engine: LocalWhisperEngine,
  family: LocalWhisperModelFamily,
): LocalWhisperKnownModelSelection | undefined {
  return context.knownModelSelections.find(
    (selection) => selection.engine === engine && selection.family === family && selection.recommended,
  );
}

function recommendedRuntime(
  context: LocalWhisperSettingsValidationContext,
  engine: LocalWhisperEngine,
  target: LocalWhisperTarget,
  backend: LocalWhisperBackend,
): LocalWhisperKnownRuntimeSelection | undefined {
  return context.knownRuntimeSelections.find(
    (selection) =>
      selection.engine === engine &&
      selection.target === target &&
      selection.backend === backend &&
      selection.recommended,
  );
}

export function createNeverConfiguredLocalWhisperSettings(
  context: LocalWhisperSettingsValidationContext,
): LocalWhisperSettingsValidationResult {
  const engine = 'whisperCpp' as const;
  const family = 'base' as const;
  const model = recommendedModel(context, engine, family);
  if (!model) {
    return {
      success: false,
      code: 'INVALID_SETTINGS',
      issues: [Object.freeze({ path: 'model', reason: 'unknown-value' })],
    };
  }
  const combinations = context.eligibleGpuCombinations.filter((combination) => combination.engine === engine);
  const selected = combinations.length === 1 ? combinations[0] : undefined;
  const gpuRuntime = selected ? recommendedRuntime(context, engine, 'gpu', selected.backend) : undefined;
  const useGpu = selected !== undefined && gpuRuntime !== undefined;
  const runtime = useGpu ? gpuRuntime : recommendedRuntime(context, engine, 'cpu', 'cpu');
  const candidate = {
    schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
    engine,
    runtimeRevision: runtime?.revision ?? null,
    model: { family, revision: model.revision, variant: model.variant },
    language: 'auto',
    initialPrompt: '',
    decoding: { strategy: 'greedy', temperatureHundredths: 0 },
    execution: useGpu
      ? { target: 'gpu', backend: selected.backend, deviceId: selected.deviceId }
      : { target: 'cpu', backend: 'cpu', cpuThreads: LOCAL_WHISPER_AUTO_CPU_THREADS },
  };
  return validateLocalWhisperSettings(candidate, context);
}

export function getLocalWhisperRuntimeSelectionKey(
  engine: LocalWhisperEngine,
  target: LocalWhisperTarget,
  backend: LocalWhisperBackend | null,
): LocalWhisperSelectionKey {
  return `runtime:${engine}:${target}:${backend ?? 'unset'}`;
}

export function getLocalWhisperDeviceSelectionKey(
  engine: LocalWhisperEngine,
  backend: LocalWhisperGpuBackend,
): LocalWhisperSelectionKey {
  return `device:${engine}:${backend}`;
}

export function getLocalWhisperModelRevisionSelectionKey(
  engine: LocalWhisperEngine,
  family: LocalWhisperModelFamily,
): LocalWhisperSelectionKey {
  return `revision:${engine}:${family}`;
}

export const EMPTY_LOCAL_WHISPER_DEPENDENT_SELECTION_MEMORY: LocalWhisperDependentSelectionMemory = Object.freeze({
  values: Object.freeze({}),
});

export function initializeLocalWhisperDependentSelection(
  memory: LocalWhisperDependentSelectionMemory,
  key: LocalWhisperSelectionKey,
  initialValue: LocalWhisperSelectionValue | null,
): LocalWhisperDependentSelectionMemory {
  if (Object.prototype.hasOwnProperty.call(memory.values, key)) return memory;
  return Object.freeze({
    values: Object.freeze({ ...memory.values, [key]: initialValue ?? UNSET_SELECTION_VALUE }),
  });
}

export function rememberLocalWhisperDependentSelection(
  memory: LocalWhisperDependentSelectionMemory,
  key: LocalWhisperSelectionKey,
  value: LocalWhisperSelectionValue | null,
): LocalWhisperDependentSelectionMemory {
  return Object.freeze({
    values: Object.freeze({ ...memory.values, [key]: value ?? UNSET_SELECTION_VALUE }),
  });
}

export function readLocalWhisperDependentSelection(
  memory: LocalWhisperDependentSelectionMemory,
  key: LocalWhisperSelectionKey,
): LocalWhisperSelectionValue | null | undefined {
  const value = memory.values[key];
  return value === UNSET_SELECTION_VALUE ? null : value;
}

export function rememberLocalWhisperSettingsSelections(
  memory: LocalWhisperDependentSelectionMemory,
  settings: LocalWhisperSettings,
): LocalWhisperDependentSelectionMemory {
  const execution = settings.execution;
  let next = rememberLocalWhisperDependentSelection(
    memory,
    getLocalWhisperRuntimeSelectionKey(settings.engine, execution.target, execution.backend),
    settings.runtimeRevision,
  );
  next = rememberLocalWhisperDependentSelection(next, `model:${settings.engine}`, settings.model.family);
  next = rememberLocalWhisperDependentSelection(
    next,
    `revision:${settings.engine}:${settings.model.family}`,
    settings.model.revision,
  );
  next = rememberLocalWhisperDependentSelection(
    next,
    `variant:${settings.engine}:${settings.model.family}`,
    settings.model.variant,
  );
  if (execution.target === 'gpu') {
    next = rememberLocalWhisperDependentSelection(next, `backend:${settings.engine}:gpu`, execution.backend);
    if (execution.backend !== null) {
      next = rememberLocalWhisperDependentSelection(
        next,
        `device:${settings.engine}:${execution.backend}`,
        execution.deviceId,
      );
    }
  } else {
    next = rememberLocalWhisperDependentSelection(next, `threads:${settings.engine}`, execution.cpuThreads);
  }
  next = rememberLocalWhisperDependentSelection(next, 'request:language', settings.language);
  next = rememberLocalWhisperDependentSelection(next, 'request:initialPrompt', settings.initialPrompt);
  next = rememberLocalWhisperDependentSelection(
    next,
    'request:temperatureHundredths',
    settings.decoding.temperatureHundredths,
  );
  next = rememberLocalWhisperDependentSelection(next, 'request:strategy', settings.decoding.strategy);
  if (settings.decoding.strategy === 'beamSearch') {
    next = rememberLocalWhisperDependentSelection(next, 'request:beamSize', settings.decoding.beamSize);
  }
  if (settings.decoding.strategy === 'bestOfSampling') {
    next = rememberLocalWhisperDependentSelection(next, 'request:bestOf', settings.decoding.bestOf);
  }
  return next;
}

function getCandidateCount(decoding: LocalWhisperDecodingSettings): number | null {
  if (decoding.strategy === 'beamSearch') return decoding.beamSize;
  if (decoding.strategy === 'bestOfSampling') return decoding.bestOf;
  return null;
}

/** Owns the private prompt digest while exposing only a renderer-safe comparison snapshot. */
export class LocalWhisperCacheContext {
  readonly #promptDigest: string;
  readonly #comparisonValue: string;
  readonly #publicSnapshot: LocalWhisperCachePublicSnapshot;

  public constructor(input: LocalWhisperCacheContextInput) {
    if (
      input.modelIdentity.engine !== input.settings.engine ||
      input.modelIdentity.logicalModel !== input.settings.model.family ||
      input.modelIdentity.artifactRevision !== input.settings.model.revision ||
      input.modelIdentity.variant !== input.settings.model.variant
    ) {
      throw new Error('Local Whisper cache model identity does not match settings');
    }
    const promptDigest = input.digestPrompt(input.settings.initialPrompt);
    if (
      typeof promptDigest !== 'string' ||
      promptDigest.length === 0 ||
      promptDigest.length > 512 ||
      hasLocalWhisperControlCharacter(promptDigest)
    ) {
      throw new Error('Invalid private Local Whisper prompt digest');
    }
    const execution = input.settings.execution;
    this.#publicSnapshot = Object.freeze({
      provider: 'local-whisper',
      engine: input.settings.engine,
      runtimeRevision: input.settings.runtimeRevision,
      protocolRevision: input.protocolRevision,
      target: execution.target,
      backend: execution.backend,
      deviceClass: input.deviceClass,
      modelFamily: input.settings.model.family,
      modelRevision: input.settings.model.revision,
      modelVariant: input.settings.model.variant,
      modelSourceCheckpointRevision: input.modelIdentity.sourceCheckpointRevision,
      modelArtifactRevision: input.modelIdentity.artifactRevision,
      modelNativeFormat: input.modelIdentity.nativeFormat,
      language: input.settings.language,
      temperatureHundredths: input.settings.decoding.temperatureHundredths,
      strategy: input.settings.decoding.strategy,
      candidateCount: getCandidateCount(input.settings.decoding),
      resolvedCpuThreads: execution.target === 'cpu' ? input.resolvedCpuThreads : null,
      mappingRevision: input.mappingRevision,
    });
    this.#promptDigest = promptDigest;
    this.#comparisonValue = JSON.stringify(this.#publicSnapshot);
    Object.freeze(this);
  }

  public equals(other: LocalWhisperCacheContext): boolean {
    return this.#comparisonValue === other.#comparisonValue && this.#promptDigest === other.#promptDigest;
  }

  public toPublicSnapshot(): LocalWhisperCachePublicSnapshot {
    return this.#publicSnapshot;
  }

  public toDebugString(): string {
    return this.#comparisonValue;
  }
}
