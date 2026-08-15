import {
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_LANGUAGE_CATALOG,
  LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS,
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  getLocalWhisperPromptValidationError,
  isLocalWhisperGpuBackend,
  isLocalWhisperLanguageId,
  isLocalWhisperModelFamily,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperDecodingStrategy,
  type LocalWhisperGpuBackend,
  type LocalWhisperLanguageId,
  type LocalWhisperModelFamily,
  type LocalWhisperModelVariant,
  type LocalWhisperPromptMutation,
  type LocalWhisperPublicSettings,
  type LocalWhisperRendererOption,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';
import type { TranslationKey } from '@main/i18n';

const DEFAULT_CANDIDATE_COUNT = '5';

export type LocalWhisperDraftField =
  | 'runtimeRevision'
  | 'backend'
  | 'deviceId'
  | 'modelFamily'
  | 'modelRevision'
  | 'modelVariant'
  | 'language'
  | 'initialPrompt'
  | 'temperature'
  | 'decodingStrategy'
  | 'beamSize'
  | 'bestOf'
  | 'cpuThreads'
  | 'gpuCpuThreads';

export interface LocalWhisperSettingsDraft {
  readonly executionTarget: 'gpu' | 'cpu';
  readonly backend: LocalWhisperGpuBackend | null;
  readonly deviceId: string | null;
  readonly runtimeRevision: string | null;
  readonly modelFamily: LocalWhisperModelFamily;
  readonly modelRevision: string;
  readonly modelVariant: LocalWhisperModelVariant;
  readonly language: LocalWhisperLanguageId;
  readonly initialPrompt: string;
  readonly promptMutation: LocalWhisperPromptMutation['kind'];
  readonly temperature: string;
  readonly decodingStrategy: LocalWhisperDecodingStrategy;
  readonly beamSize: string;
  readonly bestOf: string;
  readonly cpuThreads: string;
  readonly gpuCpuThreads: string;
}

export interface LocalWhisperDraftValidation {
  readonly errors: Readonly<Partial<Record<LocalWhisperDraftField, LocalWhisperValidationMessage>>>;
  readonly candidate: LocalWhisperPublicSettings | null;
  readonly promptMutation: LocalWhisperPromptMutation | null;
}

export interface LocalWhisperValidationMessage {
  readonly key: TranslationKey;
  readonly params?: Readonly<Record<string, string>>;
}

function formatTemperature(temperatureHundredths: number): string {
  return (temperatureHundredths / 100).toFixed(2);
}

function decodingCandidateCount(snapshot: LocalWhisperRendererSnapshot, field: 'beamSize' | 'bestOf'): string {
  const decoding = snapshot.settings.decoding;
  if (field === 'beamSize' && decoding.strategy === 'beamSearch') return String(decoding.beamSize);
  if (field === 'bestOf' && decoding.strategy === 'bestOfSampling') return String(decoding.bestOf);
  return DEFAULT_CANDIDATE_COUNT;
}

export function createLocalWhisperDraft(snapshot: LocalWhisperRendererSnapshot): LocalWhisperSettingsDraft {
  const execution = snapshot.settings.execution;
  return Object.freeze({
    executionTarget: execution.target,
    backend: execution.target === 'gpu' ? execution.backend : null,
    deviceId: execution.target === 'gpu' ? execution.deviceId : null,
    runtimeRevision: snapshot.settings.runtimeRevision,
    modelFamily: snapshot.settings.model.family,
    modelRevision: snapshot.settings.model.revision,
    modelVariant: snapshot.settings.model.variant,
    language: snapshot.settings.language,
    initialPrompt: '',
    promptMutation: 'unchanged',
    temperature: formatTemperature(snapshot.settings.decoding.temperatureHundredths),
    decodingStrategy: snapshot.settings.decoding.strategy,
    beamSize: decodingCandidateCount(snapshot, 'beamSize'),
    bestOf: decodingCandidateCount(snapshot, 'bestOf'),
    cpuThreads: execution.target === 'cpu' ? String(execution.cpuThreads) : LOCAL_WHISPER_AUTO_CPU_THREADS,
    gpuCpuThreads: execution.target === 'gpu' ? String(execution.gpuCpuThreads) : LOCAL_WHISPER_AUTO_CPU_THREADS,
  });
}

export function countLocalWhisperPromptCodePoints(value: string): number {
  return [...value].length;
}

export function getLocalWhisperOptions(
  snapshot: LocalWhisperRendererSnapshot,
  group: LocalWhisperRendererOption['group'],
): readonly LocalWhisperRendererOption[] {
  return snapshot.options.filter((option) => option.group === group);
}

export function getLocalWhisperOption(
  snapshot: LocalWhisperRendererSnapshot,
  group: LocalWhisperRendererOption['group'],
  id: string | null,
): LocalWhisperRendererOption | null {
  if (id === null) return null;
  return getLocalWhisperOptions(snapshot, group).find((option) => option.id === id) ?? null;
}

function addError(
  errors: Partial<Record<LocalWhisperDraftField, LocalWhisperValidationMessage>>,
  field: LocalWhisperDraftField,
  message: string,
): void {
  errors[field] ??= validationMessage(message);
}

function validationMessage(message: string): LocalWhisperValidationMessage {
  if (message.startsWith('Select runtime compatible'))
    return Object.freeze({ key: 'localWhisper.settings.validationRuntimeCompatible' });
  if (message.startsWith('Select revision compatible'))
    return Object.freeze({ key: 'localWhisper.settings.validationModelCompatible' });
  if (message.startsWith('Select GPU backend compatible'))
    return Object.freeze({ key: 'localWhisper.settings.validationBackendCompatible' });
  if (message.startsWith('Select GPU device compatible'))
    return Object.freeze({ key: 'localWhisper.settings.validationDeviceCompatible' });
  if (message.startsWith('Enter a replacement') || message.startsWith('Enter replacement')) {
    return Object.freeze({ key: 'localWhisper.settings.validationPromptEmpty' });
  }
  if (message.startsWith('Initial prompt must contain')) {
    return Object.freeze({
      key: 'localWhisper.settings.validationPromptTooLong',
      params: Object.freeze({ count: String(LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS) }),
    });
  }
  if (message.startsWith('Initial prompt contains'))
    return Object.freeze({ key: 'localWhisper.settings.validationPromptInvalid' });
  if (message.startsWith('Select runtime revision'))
    return Object.freeze({ key: 'localWhisper.settings.validationRuntimeRequired' });
  if (message.startsWith('Select model revision'))
    return Object.freeze({ key: 'localWhisper.settings.validationModelRequired' });
  if (message.startsWith('Select supported model family'))
    return Object.freeze({ key: 'localWhisper.settings.validationModelFamily' });
  if (message.startsWith('q5_0')) return Object.freeze({ key: 'localWhisper.settings.validationVariant' });
  if (message.startsWith('Select an application language'))
    return Object.freeze({ key: 'localWhisper.settings.validationLanguage' });
  if (message.startsWith('Use a value')) return Object.freeze({ key: 'localWhisper.settings.validationTemperature' });
  if (message.startsWith('Beam size')) return Object.freeze({ key: 'localWhisper.settings.validationBeam' });
  if (message.startsWith('Best of must')) return Object.freeze({ key: 'localWhisper.settings.validationBestOf' });
  if (message.startsWith('Greedy and beam search'))
    return Object.freeze({ key: 'localWhisper.settings.validationGreedyTemperature' });
  if (message.startsWith('Best-of sampling requires'))
    return Object.freeze({ key: 'localWhisper.settings.validationBestOfTemperature' });
  if (message.startsWith('CPU threads must')) {
    const count = message.match(/\d+(?=\.$)/u)?.[0] ?? '';
    return Object.freeze({ key: 'localWhisper.settings.validationCpuThreads', params: Object.freeze({ count }) });
  }
  if (message.startsWith('Select an explicit GPU backend'))
    return Object.freeze({ key: 'localWhisper.settings.validationBackendRequired' });
  if (message.startsWith('Select an application-issued GPU device'))
    return Object.freeze({ key: 'localWhisper.settings.validationDeviceRequired' });
  return Object.freeze({ key: 'localWhisper.settings.validationOption' });
}

function parseTemperature(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(?:0|1)(?:[.,]\d{1,2})?$/u.test(trimmed)) return null;
  const normalized = trimmed.replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  const hundredths = Math.round(parsed * 100);
  return hundredths >= 0 && hundredths <= 100 && hundredths % 5 === 0 ? hundredths : null;
}

function parseCandidateCount(value: string): number | null {
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 10 ? parsed : null;
}

function parseCpuThreads(
  value: string,
  logicalProcessorCount: number,
): typeof LOCAL_WHISPER_AUTO_CPU_THREADS | number | null {
  if (value === LOCAL_WHISPER_AUTO_CPU_THREADS) return value;
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= logicalProcessorCount ? parsed : null;
}

function validateOption(
  errors: Partial<Record<LocalWhisperDraftField, LocalWhisperValidationMessage>>,
  snapshot: LocalWhisperRendererSnapshot,
  group: LocalWhisperRendererOption['group'],
  id: string | null,
  field: LocalWhisperDraftField,
): LocalWhisperRendererOption | null {
  const options = getLocalWhisperOptions(snapshot, group);
  if (options.length === 0 || id === null) return null;
  const option = options.find((candidate) => candidate.id === id) ?? null;
  if (!option) {
    addError(errors, field, 'Select a value issued by the application.');
    return null;
  }
  if (!option.available) addError(errors, field, 'Select an available value.');
  return option;
}

function preferredAvailableOption(
  options: readonly LocalWhisperRendererOption[],
  currentId: string | null,
): LocalWhisperRendererOption | null {
  const available = options.filter((option) => option.available);
  return (
    available.find((option) => option.id === currentId) ??
    available.find((option) => option.remembered || option.saved) ??
    available.find((option) => option.recommended) ??
    available[0] ??
    null
  );
}

function runtimeOptionsFor(
  snapshot: LocalWhisperRendererSnapshot,
  target: LocalWhisperSettingsDraft['executionTarget'],
  backend: 'cpu' | LocalWhisperGpuBackend,
): readonly LocalWhisperRendererOption[] {
  return getLocalWhisperOptions(snapshot, 'runtime').filter(
    (option) => option.compatibility.target === target && option.compatibility.backend === backend,
  );
}

function deviceOptionsFor(
  snapshot: LocalWhisperRendererSnapshot,
  backend: LocalWhisperGpuBackend,
): readonly LocalWhisperRendererOption[] {
  return getLocalWhisperOptions(snapshot, 'device').filter((option) =>
    option.compatibility.eligibleBackends.includes(backend),
  );
}

function modelRevisionOptionsFor(
  snapshot: LocalWhisperRendererSnapshot,
  family: LocalWhisperModelFamily,
  variant?: LocalWhisperModelVariant,
): readonly LocalWhisperRendererOption[] {
  return getLocalWhisperOptions(snapshot, 'modelRevision').filter(
    (option) =>
      option.compatibility.modelFamily === family &&
      (variant === undefined || option.compatibility.modelVariant === variant),
  );
}

function validateRuntimeCompatibility(
  draft: LocalWhisperSettingsDraft,
  option: LocalWhisperRendererOption | null,
  errors: Partial<Record<LocalWhisperDraftField, LocalWhisperValidationMessage>>,
): void {
  const expectedBackend = draft.executionTarget === 'cpu' ? 'cpu' : draft.backend;
  if (
    option &&
    (option.compatibility.target !== draft.executionTarget || option.compatibility.backend !== expectedBackend)
  ) {
    addError(errors, 'runtimeRevision', 'Select a runtime compatible with the execution target and backend.');
  }
}

function validateModelCompatibility(
  draft: LocalWhisperSettingsDraft,
  option: LocalWhisperRendererOption | null,
  errors: Partial<Record<LocalWhisperDraftField, LocalWhisperValidationMessage>>,
): void {
  if (
    option &&
    (option.compatibility.modelFamily !== draft.modelFamily || option.compatibility.modelVariant !== draft.modelVariant)
  ) {
    addError(errors, 'modelRevision', 'Select a revision compatible with the model family and variant.');
  }
}

function validateGpuCompatibility(
  draft: LocalWhisperSettingsDraft,
  backendOption: LocalWhisperRendererOption | null,
  deviceOption: LocalWhisperRendererOption | null,
  errors: Partial<Record<LocalWhisperDraftField, LocalWhisperValidationMessage>>,
): void {
  if (
    backendOption &&
    (backendOption.compatibility.target !== 'gpu' || backendOption.compatibility.backend !== draft.backend)
  ) {
    addError(errors, 'backend', 'Select a GPU backend compatible with the execution target.');
  }
  if (deviceOption && draft.backend && !deviceOption.compatibility.eligibleBackends.includes(draft.backend)) {
    addError(errors, 'deviceId', 'Select a GPU device compatible with the selected backend.');
  }
}

function createPromptMutation(
  draft: LocalWhisperSettingsDraft,
  errors: Partial<Record<LocalWhisperDraftField, LocalWhisperValidationMessage>>,
): LocalWhisperPromptMutation | null {
  if (draft.promptMutation === 'unchanged') return Object.freeze({ kind: 'unchanged' });
  if (draft.promptMutation === 'clear') return Object.freeze({ kind: 'clear' });
  if (draft.initialPrompt.length === 0) {
    addError(errors, 'initialPrompt', 'Enter a replacement prompt or choose Clear on Save.');
    return null;
  }
  const promptError = getLocalWhisperPromptValidationError(draft.initialPrompt);
  if (promptError !== null) {
    addError(
      errors,
      'initialPrompt',
      promptError === 'too-long'
        ? `Initial prompt must contain at most ${LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS} Unicode code points.`
        : 'Initial prompt contains an invalid Unicode scalar or NUL character.',
    );
    return null;
  }
  return Object.freeze({ kind: 'replace', value: draft.initialPrompt });
}

/** Validates one renderer draft and creates the closed atomic settings command payload. */
// eslint-disable-next-line complexity -- validation mirrors the intentionally closed cross-field settings contract.
export function validateLocalWhisperDraft(
  draft: LocalWhisperSettingsDraft,
  snapshot: LocalWhisperRendererSnapshot,
): LocalWhisperDraftValidation {
  const errors: Partial<Record<LocalWhisperDraftField, LocalWhisperValidationMessage>> = {};
  const runtimeRevision = toLocalWhisperRevisionId(draft.runtimeRevision);
  if (!runtimeRevision) addError(errors, 'runtimeRevision', 'Select a runtime revision.');
  const runtimeOption = validateOption(errors, snapshot, 'runtime', draft.runtimeRevision, 'runtimeRevision');
  validateRuntimeCompatibility(draft, runtimeOption, errors);

  const modelRevision = toLocalWhisperRevisionId(draft.modelRevision);
  if (!modelRevision) addError(errors, 'modelRevision', 'Select a model revision.');
  const modelOption = validateOption(errors, snapshot, 'modelRevision', draft.modelRevision, 'modelRevision');
  if (!isLocalWhisperModelFamily(draft.modelFamily))
    addError(errors, 'modelFamily', 'Select a supported model family.');
  if (draft.modelVariant === 'q5_0' && draft.modelFamily !== 'large-v3' && draft.modelFamily !== 'large-v3-turbo') {
    addError(errors, 'modelVariant', 'q5_0 is available only for catalog-qualified large-v3 models.');
  }
  validateOption(errors, snapshot, 'modelVariant', draft.modelVariant, 'modelVariant');
  validateModelCompatibility(draft, modelOption, errors);
  if (!isLocalWhisperLanguageId(draft.language)) addError(errors, 'language', 'Select an application language ID.');
  const knownLanguage = LOCAL_WHISPER_LANGUAGE_CATALOG.some((entry) => entry.id === draft.language);
  if (!knownLanguage) addError(errors, 'language', 'Select an application language ID.');

  const temperatureHundredths = parseTemperature(draft.temperature);
  if (temperatureHundredths === null) {
    addError(errors, 'temperature', 'Use a value from 0.00 to 1.00 in increments of 0.05.');
  }
  const beamSize = parseCandidateCount(draft.beamSize);
  const bestOf = parseCandidateCount(draft.bestOf);
  if (draft.decodingStrategy === 'beamSearch' && beamSize === null) {
    addError(errors, 'beamSize', 'Beam size must be an integer from 1 to 10.');
  }
  if (draft.decodingStrategy === 'bestOfSampling' && bestOf === null) {
    addError(errors, 'bestOf', 'Best of must be an integer from 1 to 10.');
  }
  if (temperatureHundredths !== null && draft.decodingStrategy !== 'bestOfSampling' && temperatureHundredths !== 0) {
    addError(errors, 'temperature', 'Greedy and beam search require temperature 0.00.');
  }
  if (temperatureHundredths !== null && draft.decodingStrategy === 'bestOfSampling' && temperatureHundredths < 5) {
    addError(errors, 'temperature', 'Best-of sampling requires temperature from 0.05 to 1.00.');
  }

  let execution: LocalWhisperPublicSettings['execution'] | null = null;
  if (draft.executionTarget === 'cpu') {
    const cpuThreads = parseCpuThreads(draft.cpuThreads, snapshot.host.logicalProcessorCount);
    if (cpuThreads === null) {
      addError(
        errors,
        'cpuThreads',
        `CPU threads must be auto or an integer from 1 to ${snapshot.host.logicalProcessorCount}.`,
      );
    } else {
      execution = Object.freeze({ target: 'cpu', backend: 'cpu', cpuThreads });
    }
  } else {
    const gpuCpuThreads = parseCpuThreads(draft.gpuCpuThreads, snapshot.host.logicalProcessorCount);
    if (gpuCpuThreads === null) {
      addError(
        errors,
        'gpuCpuThreads',
        `GPU CPU threads must be auto or an integer from 1 to ${snapshot.host.logicalProcessorCount}.`,
      );
    }
    if (!draft.backend) addError(errors, 'backend', 'Select an explicit GPU backend.');
    const backendOption = validateOption(errors, snapshot, 'backend', draft.backend, 'backend');
    const deviceId = toLocalWhisperOpaqueDeviceId(draft.deviceId);
    if (!deviceId) addError(errors, 'deviceId', 'Select an application-issued GPU device.');
    const deviceOption = validateOption(errors, snapshot, 'device', draft.deviceId, 'deviceId');
    validateGpuCompatibility(draft, backendOption, deviceOption, errors);
    if (draft.backend && deviceId && gpuCpuThreads !== null) {
      execution = Object.freeze({ target: 'gpu', backend: draft.backend, deviceId, gpuCpuThreads });
    }
  }

  const promptMutation = createPromptMutation(draft, errors);
  if (
    Object.keys(errors).length > 0 ||
    !runtimeRevision ||
    !modelRevision ||
    temperatureHundredths === null ||
    !execution ||
    !promptMutation
  ) {
    return Object.freeze({ errors: Object.freeze(errors), candidate: null, promptMutation });
  }

  const decoding =
    draft.decodingStrategy === 'beamSearch'
      ? Object.freeze({ strategy: 'beamSearch' as const, temperatureHundredths: 0 as const, beamSize: beamSize ?? 5 })
      : draft.decodingStrategy === 'bestOfSampling'
        ? Object.freeze({
            strategy: 'bestOfSampling' as const,
            temperatureHundredths,
            bestOf: bestOf ?? 5,
          })
        : Object.freeze({ strategy: 'greedy' as const, temperatureHundredths: 0 as const });

  return Object.freeze({
    errors: Object.freeze(errors),
    promptMutation,
    candidate: Object.freeze({
      schemaVersion: LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
      engine: 'whisperCpp',
      runtimeRevision,
      model: Object.freeze({
        family: draft.modelFamily,
        revision: modelRevision,
        variant: draft.modelVariant,
      }),
      language: draft.language,
      decoding,
      execution,
    }),
  });
}

export function updateLocalWhisperTarget(
  draft: LocalWhisperSettingsDraft,
  target: LocalWhisperSettingsDraft['executionTarget'],
  snapshot: LocalWhisperRendererSnapshot,
): LocalWhisperSettingsDraft {
  if (target === 'cpu') {
    const runtime = preferredAvailableOption(runtimeOptionsFor(snapshot, 'cpu', 'cpu'), draft.runtimeRevision);
    return Object.freeze({ ...draft, executionTarget: target, runtimeRevision: runtime?.id ?? null });
  }
  const backendOption = preferredAvailableOption(
    getLocalWhisperOptions(snapshot, 'backend').filter(
      (option) => option.compatibility.target === 'gpu' && isLocalWhisperGpuBackend(option.id),
    ),
    draft.backend,
  );
  const backend = backendOption && isLocalWhisperGpuBackend(backendOption.id) ? backendOption.id : null;
  const runtime = backend
    ? preferredAvailableOption(runtimeOptionsFor(snapshot, 'gpu', backend), draft.runtimeRevision)
    : null;
  const device = backend ? preferredAvailableOption(deviceOptionsFor(snapshot, backend), draft.deviceId) : null;
  return Object.freeze({
    ...draft,
    executionTarget: target,
    backend,
    deviceId: device?.id ?? null,
    runtimeRevision: runtime?.id ?? null,
  });
}

export function updateLocalWhisperRuntimeRevision(
  draft: LocalWhisperSettingsDraft,
  runtimeRevision: string,
  snapshot: LocalWhisperRendererSnapshot,
): LocalWhisperSettingsDraft {
  const runtime = getLocalWhisperOption(snapshot, 'runtime', runtimeRevision);
  if (!runtime?.available) return Object.freeze({ ...draft, runtimeRevision });
  const { target, backend } = runtime.compatibility;
  if (target === 'cpu' && backend === 'cpu') {
    return Object.freeze({ ...draft, executionTarget: 'cpu', runtimeRevision });
  }
  if (target !== 'gpu' || !isLocalWhisperGpuBackend(backend)) {
    return Object.freeze({ ...draft, runtimeRevision });
  }
  const device = preferredAvailableOption(deviceOptionsFor(snapshot, backend), draft.deviceId);
  return Object.freeze({
    ...draft,
    executionTarget: 'gpu',
    backend,
    deviceId: device?.id ?? null,
    runtimeRevision,
  });
}

export function updateLocalWhisperBackend(
  draft: LocalWhisperSettingsDraft,
  backend: LocalWhisperGpuBackend,
  snapshot: LocalWhisperRendererSnapshot,
): LocalWhisperSettingsDraft {
  const runtime = preferredAvailableOption(runtimeOptionsFor(snapshot, 'gpu', backend), draft.runtimeRevision);
  const device = preferredAvailableOption(deviceOptionsFor(snapshot, backend), draft.deviceId);
  return Object.freeze({
    ...draft,
    executionTarget: 'gpu',
    backend,
    deviceId: device?.id ?? null,
    runtimeRevision: runtime?.id ?? null,
  });
}

export function updateLocalWhisperModelFamily(
  draft: LocalWhisperSettingsDraft,
  family: LocalWhisperModelFamily,
  snapshot: LocalWhisperRendererSnapshot,
): LocalWhisperSettingsDraft {
  const revision = preferredAvailableOption(modelRevisionOptionsFor(snapshot, family), draft.modelRevision);
  return Object.freeze({
    ...draft,
    modelFamily: family,
    modelRevision: revision?.id ?? draft.modelRevision,
    modelVariant: revision?.compatibility.modelVariant ?? 'full',
  });
}

export function updateLocalWhisperModelRevision(
  draft: LocalWhisperSettingsDraft,
  modelRevision: string,
  snapshot: LocalWhisperRendererSnapshot,
): LocalWhisperSettingsDraft {
  const revision = getLocalWhisperOption(snapshot, 'modelRevision', modelRevision);
  return Object.freeze({
    ...draft,
    modelRevision,
    modelFamily: revision?.compatibility.modelFamily ?? draft.modelFamily,
    modelVariant: revision?.compatibility.modelVariant ?? draft.modelVariant,
  });
}

export function updateLocalWhisperModelVariant(
  draft: LocalWhisperSettingsDraft,
  modelVariant: LocalWhisperModelVariant,
  snapshot: LocalWhisperRendererSnapshot,
): LocalWhisperSettingsDraft {
  const revision = preferredAvailableOption(
    modelRevisionOptionsFor(snapshot, draft.modelFamily, modelVariant),
    draft.modelRevision,
  );
  return Object.freeze({
    ...draft,
    modelRevision: revision?.id ?? draft.modelRevision,
    modelVariant,
  });
}
