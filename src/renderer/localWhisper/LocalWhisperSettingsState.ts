import {
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_LANGUAGE_CATALOG,
  LOCAL_WHISPER_MAX_PROMPT_CODE_POINTS,
  LOCAL_WHISPER_SETTINGS_SCHEMA_VERSION,
  getLocalWhisperPromptValidationError,
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
  | 'cpuThreads';

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
}

export interface LocalWhisperDraftValidation {
  readonly errors: Readonly<Partial<Record<LocalWhisperDraftField, string>>>;
  readonly candidate: LocalWhisperPublicSettings | null;
  readonly promptMutation: LocalWhisperPromptMutation | null;
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
  errors: Partial<Record<LocalWhisperDraftField, string>>,
  field: LocalWhisperDraftField,
  message: string,
): void {
  errors[field] ??= message;
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
  errors: Partial<Record<LocalWhisperDraftField, string>>,
  snapshot: LocalWhisperRendererSnapshot,
  group: LocalWhisperRendererOption['group'],
  id: string | null,
  field: LocalWhisperDraftField,
): void {
  const options = getLocalWhisperOptions(snapshot, group);
  if (options.length === 0 || id === null) return;
  if (!options.some((option) => option.id === id)) addError(errors, field, 'Select a value issued by the application.');
}

function createPromptMutation(
  draft: LocalWhisperSettingsDraft,
  errors: Partial<Record<LocalWhisperDraftField, string>>,
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
  const errors: Partial<Record<LocalWhisperDraftField, string>> = {};
  const runtimeRevision = toLocalWhisperRevisionId(draft.runtimeRevision);
  if (!runtimeRevision) addError(errors, 'runtimeRevision', 'Select a runtime revision.');
  validateOption(errors, snapshot, 'runtime', draft.runtimeRevision, 'runtimeRevision');

  const modelRevision = toLocalWhisperRevisionId(draft.modelRevision);
  if (!modelRevision) addError(errors, 'modelRevision', 'Select a model revision.');
  validateOption(errors, snapshot, 'modelRevision', draft.modelRevision, 'modelRevision');
  if (!isLocalWhisperModelFamily(draft.modelFamily))
    addError(errors, 'modelFamily', 'Select a supported model family.');
  if (draft.modelVariant === 'q5_0' && draft.modelFamily !== 'large-v3' && draft.modelFamily !== 'large-v3-turbo') {
    addError(errors, 'modelVariant', 'q5_0 is available only for catalog-qualified large-v3 models.');
  }
  validateOption(errors, snapshot, 'modelVariant', draft.modelVariant, 'modelVariant');
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
    if (!draft.backend) addError(errors, 'backend', 'Select an explicit GPU backend.');
    validateOption(errors, snapshot, 'backend', draft.backend, 'backend');
    const deviceId = toLocalWhisperOpaqueDeviceId(draft.deviceId);
    if (!deviceId) addError(errors, 'deviceId', 'Select an application-issued GPU device.');
    validateOption(errors, snapshot, 'device', draft.deviceId, 'deviceId');
    if (draft.backend && deviceId) execution = Object.freeze({ target: 'gpu', backend: draft.backend, deviceId });
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
  if (target === 'cpu') return Object.freeze({ ...draft, executionTarget: target });
  const backends = getLocalWhisperOptions(snapshot, 'backend').filter((option) => option.available);
  const devices = getLocalWhisperOptions(snapshot, 'device').filter((option) => option.available);
  return Object.freeze({
    ...draft,
    executionTarget: target,
    backend: draft.backend ?? (backends.length === 1 ? (backends[0]?.id as LocalWhisperGpuBackend) : null),
    deviceId: draft.deviceId ?? (devices.length === 1 ? (devices[0]?.id ?? null) : null),
  });
}

export function updateLocalWhisperModelFamily(
  draft: LocalWhisperSettingsDraft,
  family: LocalWhisperModelFamily,
  snapshot: LocalWhisperRendererSnapshot,
): LocalWhisperSettingsDraft {
  const revisions = getLocalWhisperOptions(snapshot, 'modelRevision');
  const remembered = revisions.find((option) => option.remembered || option.saved);
  const recommended = revisions.find((option) => option.recommended);
  return Object.freeze({
    ...draft,
    modelFamily: family,
    modelRevision: remembered?.id ?? recommended?.id ?? draft.modelRevision,
    modelVariant: 'full',
  });
}
