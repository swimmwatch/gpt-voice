import { isLocalWhisperModelIdentity, type LocalWhisperModelIdentity, type LocalWhisperResidencyKey } from './catalog';
import {
  hasLocalWhisperControlCharacter,
  isLocalWhisperBackend,
  isLocalWhisperEngine,
  isLocalWhisperFailureCode,
  isLocalWhisperTarget,
  toLocalWhisperOpaqueDeviceId,
  toLocalWhisperRevisionId,
  type LocalWhisperBackend,
  type LocalWhisperEngine,
  type LocalWhisperFailureCode,
  type LocalWhisperRevisionId,
} from './domain';
import {
  getLocalWhisperPromptValidationError,
  LOCAL_WHISPER_AUTO_CPU_THREADS,
  LOCAL_WHISPER_MAX_CANDIDATE_COUNT,
  LOCAL_WHISPER_MAX_LOGICAL_PROCESSOR_COUNT,
  LOCAL_WHISPER_MAX_TEMPERATURE_HUNDREDTHS,
  LOCAL_WHISPER_MIN_CANDIDATE_COUNT,
  LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS,
} from './settings';
import { parseLocalWhisperWorkerJson } from './workerJson';

export const LOCAL_WHISPER_WORKER_PROTOCOL_VERSION = 2 as const;
export const LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES = 1024 * 1024;
export const LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES = 1024 * 1024;
export const LOCAL_WHISPER_FRAME_LENGTH_BYTES = 4;
export const LOCAL_WHISPER_FRAME_KIND_BYTES = 1;
export const LOCAL_WHISPER_FRAME_HEADER_BYTES = LOCAL_WHISPER_FRAME_LENGTH_BYTES + LOCAL_WHISPER_FRAME_KIND_BYTES;
export const LOCAL_WHISPER_CONTROL_FRAME_KIND = 0x01 as const;
export const LOCAL_WHISPER_AUDIO_FRAME_KIND = 0x02 as const;
export const LOCAL_WHISPER_MAX_REQUEST_ID_BYTES = 128;
export const LOCAL_WHISPER_MAX_CAPABILITY_COUNT = 32;
export const LOCAL_WHISPER_MAX_CAPABILITY_BYTES = 64;
export const LOCAL_WHISPER_MAX_MODEL_PATH_BYTES = 131_072;

const AUDIO_BODY_FIXED_BYTES = 1 + 1 + 4 + 2;
const AUDIO_BODY_VERSION_OFFSET = LOCAL_WHISPER_FRAME_HEADER_BYTES;
const AUDIO_BODY_FINAL_OFFSET = AUDIO_BODY_VERSION_OFFSET + 1;
const AUDIO_BODY_SEQUENCE_OFFSET = AUDIO_BODY_FINAL_OFFSET + 1;
const AUDIO_BODY_REQUEST_LENGTH_OFFSET = AUDIO_BODY_SEQUENCE_OFFSET + 4;
const AUDIO_BODY_REQUEST_OFFSET = AUDIO_BODY_REQUEST_LENGTH_OFFSET + 2;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CAPABILITY_PATTERN = /^[\w.:+-]+$/u;
const AUTHORITY_ID_PATTERN = /^[\w-]{22}$/u;
const CHALLENGE_PATTERN = /^[\w-]{43}$/u;

export type LocalWhisperFrameKind = typeof LOCAL_WHISPER_AUDIO_FRAME_KIND | typeof LOCAL_WHISPER_CONTROL_FRAME_KIND;

export type LocalWhisperWorkerDeviceBinding =
  { readonly kind: 'cpu' } | { readonly kind: 'gpuIndex'; readonly index: number };

export type LocalWhisperWorkerProbeAuthority =
  | {
      readonly authorityId: string;
      readonly deviceBinding: { readonly kind: 'cpu' };
    }
  | {
      readonly authorityId: string;
      readonly deviceBinding: { readonly kind: 'gpuIndex'; readonly index: number };
      readonly probeChallenge: string;
      readonly registryFingerprint: string;
    };

export type LocalWhisperWorkerLoadAuthority =
  | {
      readonly authorityId: string;
      readonly deviceBinding: { readonly kind: 'cpu' };
      readonly expectedModelBytes: number;
      readonly modelPath: string;
    }
  | {
      readonly authorityId: string;
      readonly deviceBinding: { readonly kind: 'gpuIndex'; readonly index: number };
      readonly expectedModelBytes: number;
      readonly loadChallenge: string;
      readonly modelPath: string;
      readonly registryFingerprint: string;
    };

export type LocalWhisperWorkerProbeEvidence =
  | {
      readonly authorityId: string;
      readonly deviceBinding: { readonly kind: 'cpu' };
    }
  | {
      readonly activatedOrdinal: number;
      readonly actualNativeIdentity: string;
      readonly authorityId: string;
      readonly deviceBinding: { readonly kind: 'gpuIndex'; readonly index: number };
      readonly primaryExecutionNativeIdentity: string;
      readonly probeProof: string;
      readonly registryFingerprint: string;
    };

export type LocalWhisperWorkerLoadEvidence =
  | {
      readonly authorityId: string;
      readonly deviceBinding: { readonly kind: 'cpu' };
    }
  | {
      readonly activatedOrdinal: number;
      readonly actualNativeIdentity: string;
      readonly authorityId: string;
      readonly deviceBinding: { readonly kind: 'gpuIndex'; readonly index: number };
      readonly loadProof: string;
      readonly primaryExecutionNativeIdentity: string;
      readonly registryFingerprint: string;
      readonly selectedDeviceModelWeightBytes: number;
    };

export interface LocalWhisperWorkerLoadedModelEvidence {
  readonly effectiveBackend: LocalWhisperBackend;
  readonly metadataOnly: true;
  readonly model: LocalWhisperModelIdentity;
  readonly modelFileSizeBytes: number;
  readonly primaryStateOwnership: 'worker';
}

export interface LocalWhisperWorkerTranscriptionOptions {
  readonly language: string | null;
  readonly initialPrompt: string;
  readonly temperatureHundredths: number;
  readonly strategy: 'beamSearch' | 'bestOfSampling' | 'greedy';
  readonly candidateCount: number | null;
}

export interface LocalWhisperWorkerHelloAck {
  readonly type: 'helloAck';
  readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
  readonly engine: LocalWhisperEngine;
  readonly runtimeRevision: LocalWhisperRevisionId;
  readonly runtimeBuildDigest: string;
  readonly backend: LocalWhisperBackend;
  readonly capabilities: readonly string[];
  readonly maxControlFrameBytes: typeof LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES;
  readonly maxAudioChunkBytes: typeof LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES;
}

export type LocalWhisperWorkerClientMessage =
  | {
      readonly type: 'hello';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
    }
  | (LocalWhisperWorkerRequest<'probe'> & LocalWhisperWorkerProbeAuthority)
  | (LocalWhisperWorkerRequest<'load'> &
      LocalWhisperWorkerLoadAuthority & { readonly residency: LocalWhisperResidencyKey })
  | LocalWhisperWorkerRequest<'warmup'>
  | LocalWhisperWorkerRequest<'unload'>
  | (LocalWhisperWorkerRequest<'transcribe'> & {
      readonly settingsEpoch: number;
      readonly audioByteLength: number;
      readonly options: LocalWhisperWorkerTranscriptionOptions;
    })
  | (LocalWhisperWorkerRequest<'cancel'> & { readonly targetRequestId: string })
  | LocalWhisperWorkerRequest<'shutdown'>;

export type LocalWhisperWorkerServerMessage =
  | LocalWhisperWorkerHelloAck
  | (LocalWhisperWorkerRequest<'probed'> & LocalWhisperWorkerProbeEvidence)
  | (LocalWhisperWorkerRequest<'loaded'> & {
      readonly residency: LocalWhisperResidencyKey;
    } & LocalWhisperWorkerLoadEvidence &
      LocalWhisperWorkerLoadedModelEvidence)
  | LocalWhisperWorkerRequest<'warmed'>
  | LocalWhisperWorkerRequest<'unloaded'>
  | (LocalWhisperWorkerRequest<'transcript'> & { readonly text: string })
  | (LocalWhisperWorkerRequest<'cancelled'> & { readonly targetRequestId: string })
  | (LocalWhisperWorkerRequest<'cancelTooLate'> & { readonly targetRequestId: string })
  | LocalWhisperWorkerRequest<'shutdownAck'>
  | {
      readonly type: 'failure';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
      readonly requestId: string | null;
      readonly code: LocalWhisperFailureCode;
    };

export type LocalWhisperWorkerControlMessage = LocalWhisperWorkerClientMessage | LocalWhisperWorkerServerMessage;

export interface LocalWhisperWorkerAudioChunk {
  readonly requestId: string;
  readonly sequence: number;
  readonly final: boolean;
  readonly bytes: Uint8Array;
}

interface LocalWhisperWorkerRequest<TType extends string> {
  readonly type: TType;
  readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
  readonly requestId: string;
}

const HELLO_KEYS = ['type', 'protocolVersion'] as const;
const REQUEST_KEYS = ['type', 'protocolVersion', 'requestId'] as const;
const PROBE_CPU_KEYS = [...REQUEST_KEYS, 'authorityId', 'deviceBinding'] as const;
const PROBE_GPU_KEYS = [
  ...REQUEST_KEYS,
  'authorityId',
  'deviceBinding',
  'probeChallenge',
  'registryFingerprint',
] as const;
const LOAD_CPU_KEYS = [
  ...REQUEST_KEYS,
  'authorityId',
  'deviceBinding',
  'expectedModelBytes',
  'modelPath',
  'residency',
] as const;
const LOAD_GPU_KEYS = [
  ...REQUEST_KEYS,
  'authorityId',
  'deviceBinding',
  'expectedModelBytes',
  'loadChallenge',
  'modelPath',
  'registryFingerprint',
  'residency',
] as const;
const TRANSCRIBE_KEYS = [...REQUEST_KEYS, 'settingsEpoch', 'audioByteLength', 'options'] as const;
const CANCEL_KEYS = [...REQUEST_KEYS, 'targetRequestId'] as const;
const HELLO_ACK_KEYS = [
  'type',
  'protocolVersion',
  'engine',
  'runtimeRevision',
  'runtimeBuildDigest',
  'backend',
  'capabilities',
  'maxControlFrameBytes',
  'maxAudioChunkBytes',
] as const;
const PROBED_CPU_KEYS = [...REQUEST_KEYS, 'authorityId', 'deviceBinding'] as const;
const PROBED_GPU_KEYS = [
  ...REQUEST_KEYS,
  'activatedOrdinal',
  'actualNativeIdentity',
  'authorityId',
  'deviceBinding',
  'primaryExecutionNativeIdentity',
  'probeProof',
  'registryFingerprint',
] as const;
const LOADED_COMMON_KEYS = [
  'effectiveBackend',
  'metadataOnly',
  'model',
  'modelFileSizeBytes',
  'primaryStateOwnership',
] as const;
const LOADED_CPU_KEYS = [...REQUEST_KEYS, 'authorityId', 'deviceBinding', ...LOADED_COMMON_KEYS, 'residency'] as const;
const LOADED_GPU_KEYS = [
  ...REQUEST_KEYS,
  'activatedOrdinal',
  'actualNativeIdentity',
  'authorityId',
  'deviceBinding',
  ...LOADED_COMMON_KEYS,
  'loadProof',
  'primaryExecutionNativeIdentity',
  'registryFingerprint',
  'residency',
  'selectedDeviceModelWeightBytes',
] as const;
const TRANSCRIPT_KEYS = [...REQUEST_KEYS, 'text'] as const;
const CANCELLED_KEYS = [...REQUEST_KEYS, 'targetRequestId'] as const;
const FAILURE_KEYS = [...REQUEST_KEYS, 'code'] as const;
const TRANSCRIPTION_OPTIONS_KEYS = [
  'language',
  'initialPrompt',
  'temperatureHundredths',
  'strategy',
  'candidateCount',
] as const;
const RESIDENCY_KEYS = [
  'engine',
  'runtimePackRevision',
  'target',
  'backend',
  'deviceId',
  'model',
  'configuredGpuCpuThreads',
  'resolvedCpuThreads',
  'logicalProcessorTopologyGeneration',
  'configurationEpoch',
] as const;
const CPU_DEVICE_BINDING_KEYS = ['kind'] as const;
const GPU_INDEX_DEVICE_BINDING_KEYS = ['kind', 'index'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function hasProtocolVersion(value: Record<string, unknown>): boolean {
  return value.protocolVersion === LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isModelPath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    utf8Length(value) > LOCAL_WHISPER_MAX_MODEL_PATH_BYTES ||
    hasLocalWhisperControlCharacter(value)
  ) {
    return false;
  }
  const encoded = new TextEncoder().encode(value);
  return new TextDecoder('utf-8', { fatal: true }).decode(encoded) === value;
}

function isRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    utf8Length(value) <= LOCAL_WHISPER_MAX_REQUEST_ID_BYTES &&
    !hasLocalWhisperControlCharacter(value)
  );
}

function isAuthorityId(value: unknown): value is string {
  return typeof value === 'string' && AUTHORITY_ID_PATTERN.test(value);
}

function isChallenge(value: unknown): value is string {
  return typeof value === 'string' && CHALLENGE_PATTERN.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function isNativeIdentity(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && utf8Length(value) <= 256 && !hasLocalWhisperControlCharacter(value)
  );
}

function isCandidateCount(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= LOCAL_WHISPER_MIN_CANDIDATE_COUNT &&
    (value as number) <= LOCAL_WHISPER_MAX_CANDIDATE_COUNT
  );
}

export function isLocalWhisperWorkerDeviceBinding(value: unknown): value is LocalWhisperWorkerDeviceBinding {
  if (!isRecord(value)) return false;
  if (value.kind === 'cpu') return hasExactKeys(value, CPU_DEVICE_BINDING_KEYS);
  return (
    value.kind === 'gpuIndex' &&
    hasExactKeys(value, GPU_INDEX_DEVICE_BINDING_KEYS) &&
    Number.isSafeInteger(value.index) &&
    (value.index as number) >= 0 &&
    (value.index as number) <= 255
  );
}

function isProbeAuthority(value: Record<string, unknown>): boolean {
  if (!isAuthorityId(value.authorityId) || !isLocalWhisperWorkerDeviceBinding(value.deviceBinding)) return false;
  if (value.deviceBinding.kind === 'cpu') return hasExactKeys(value, PROBE_CPU_KEYS);
  return (
    hasExactKeys(value, PROBE_GPU_KEYS) && isChallenge(value.probeChallenge) && isSha256(value.registryFingerprint)
  );
}

function isLoadAuthority(value: Record<string, unknown>): boolean {
  if (
    !isAuthorityId(value.authorityId) ||
    !isLocalWhisperWorkerDeviceBinding(value.deviceBinding) ||
    !isModelPath(value.modelPath) ||
    !Number.isSafeInteger(value.expectedModelBytes) ||
    (value.expectedModelBytes as number) <= 0 ||
    !isResidency(value.residency) ||
    !isDeviceBindingCompatibleWithResidency(value.deviceBinding, value.residency)
  ) {
    return false;
  }
  if (value.deviceBinding.kind === 'cpu') return hasExactKeys(value, LOAD_CPU_KEYS);
  return hasExactKeys(value, LOAD_GPU_KEYS) && isChallenge(value.loadChallenge) && isSha256(value.registryFingerprint);
}

function isProbeEvidence(value: Record<string, unknown>): boolean {
  if (!isAuthorityId(value.authorityId) || !isLocalWhisperWorkerDeviceBinding(value.deviceBinding)) return false;
  if (value.deviceBinding.kind === 'cpu') return hasExactKeys(value, PROBED_CPU_KEYS);
  return (
    hasExactKeys(value, PROBED_GPU_KEYS) &&
    Number.isInteger(value.activatedOrdinal) &&
    (value.activatedOrdinal as number) >= 0 &&
    (value.activatedOrdinal as number) <= 255 &&
    isNativeIdentity(value.actualNativeIdentity) &&
    isNativeIdentity(value.primaryExecutionNativeIdentity) &&
    isSha256(value.probeProof) &&
    isSha256(value.registryFingerprint)
  );
}

function isLoadedModelEvidence(value: Record<string, unknown>, residency: LocalWhisperResidencyKey): boolean {
  return (
    isLocalWhisperBackend(value.effectiveBackend) &&
    value.effectiveBackend === residency.backend &&
    isLocalWhisperModelIdentity(value.model) &&
    value.model.engine === residency.model.engine &&
    value.model.logicalModel === residency.model.logicalModel &&
    value.model.sourceCheckpointRevision === residency.model.sourceCheckpointRevision &&
    value.model.artifactRevision === residency.model.artifactRevision &&
    value.model.nativeFormat === residency.model.nativeFormat &&
    value.model.variant === residency.model.variant &&
    value.metadataOnly === true &&
    Number.isSafeInteger(value.modelFileSizeBytes) &&
    (value.modelFileSizeBytes as number) > 0 &&
    value.primaryStateOwnership === 'worker'
  );
}

function isLoadEvidence(value: Record<string, unknown>): boolean {
  if (
    !isAuthorityId(value.authorityId) ||
    !isLocalWhisperWorkerDeviceBinding(value.deviceBinding) ||
    !isResidency(value.residency) ||
    !isDeviceBindingCompatibleWithResidency(value.deviceBinding, value.residency) ||
    !isLoadedModelEvidence(value, value.residency)
  ) {
    return false;
  }
  if (value.deviceBinding.kind === 'cpu') return hasExactKeys(value, LOADED_CPU_KEYS);
  return (
    hasExactKeys(value, LOADED_GPU_KEYS) &&
    Number.isInteger(value.activatedOrdinal) &&
    (value.activatedOrdinal as number) >= 0 &&
    (value.activatedOrdinal as number) <= 255 &&
    isNativeIdentity(value.actualNativeIdentity) &&
    isNativeIdentity(value.primaryExecutionNativeIdentity) &&
    isSha256(value.loadProof) &&
    isSha256(value.registryFingerprint) &&
    Number.isSafeInteger(value.selectedDeviceModelWeightBytes) &&
    (value.selectedDeviceModelWeightBytes as number) > 0
  );
}

function isTranscriptionOptions(value: unknown): value is LocalWhisperWorkerTranscriptionOptions {
  if (!isRecord(value) || !hasExactKeys(value, TRANSCRIPTION_OPTIONS_KEYS)) return false;
  if (value.language !== null && !isRequestId(value.language)) return false;
  if (getLocalWhisperPromptValidationError(value.initialPrompt) !== null) return false;
  if (!Number.isSafeInteger(value.temperatureHundredths)) return false;
  if (value.strategy === 'greedy') {
    return value.temperatureHundredths === 0 && value.candidateCount === null;
  }
  if (value.strategy === 'beamSearch') {
    return value.temperatureHundredths === 0 && isCandidateCount(value.candidateCount);
  }
  if (value.strategy === 'bestOfSampling') {
    return (
      (value.temperatureHundredths as number) >= LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS &&
      (value.temperatureHundredths as number) <= LOCAL_WHISPER_MAX_TEMPERATURE_HUNDREDTHS &&
      (value.temperatureHundredths as number) % LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS === 0 &&
      isCandidateCount(value.candidateCount)
    );
  }
  return false;
}

function isResidency(value: unknown): value is LocalWhisperResidencyKey {
  if (!isRecord(value) || !hasExactKeys(value, RESIDENCY_KEYS)) return false;
  if (
    !isLocalWhisperEngine(value.engine) ||
    toLocalWhisperRevisionId(value.runtimePackRevision) === null ||
    !isLocalWhisperTarget(value.target) ||
    !isLocalWhisperBackend(value.backend) ||
    !isLocalWhisperModelIdentity(value.model) ||
    value.model.engine !== value.engine
  ) {
    return false;
  }
  const isCpu = value.target === 'cpu';
  if (isCpu !== (value.backend === 'cpu') || isCpu !== (value.deviceId === null)) return false;
  if (value.deviceId !== null && toLocalWhisperOpaqueDeviceId(value.deviceId) === null) return false;
  if (
    !Number.isSafeInteger(value.resolvedCpuThreads) ||
    (value.resolvedCpuThreads as number) < 1 ||
    (value.resolvedCpuThreads as number) > LOCAL_WHISPER_MAX_LOGICAL_PROCESSOR_COUNT ||
    !Number.isSafeInteger(value.logicalProcessorTopologyGeneration) ||
    (value.logicalProcessorTopologyGeneration as number) < 0 ||
    !Number.isSafeInteger(value.configurationEpoch) ||
    (value.configurationEpoch as number) < 0
  ) {
    return false;
  }
  if (isCpu) return value.configuredGpuCpuThreads === null;
  if (
    value.configuredGpuCpuThreads !== LOCAL_WHISPER_AUTO_CPU_THREADS &&
    (!Number.isSafeInteger(value.configuredGpuCpuThreads) ||
      (value.configuredGpuCpuThreads as number) < 1 ||
      (value.configuredGpuCpuThreads as number) > LOCAL_WHISPER_MAX_LOGICAL_PROCESSOR_COUNT)
  ) {
    return false;
  }
  if (typeof value.configuredGpuCpuThreads === 'number' && value.configuredGpuCpuThreads !== value.resolvedCpuThreads) {
    return false;
  }
  return true;
}

function isDeviceBindingCompatibleWithResidency(
  binding: unknown,
  residency: LocalWhisperResidencyKey,
): binding is LocalWhisperWorkerDeviceBinding {
  if (!isLocalWhisperWorkerDeviceBinding(binding)) return false;
  return residency.target === 'cpu' ? binding.kind === 'cpu' : binding.kind === 'gpuIndex';
}

function isCapabilities(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > LOCAL_WHISPER_MAX_CAPABILITY_COUNT) {
    return false;
  }
  const capabilities = value.filter(
    (candidate): candidate is string =>
      typeof candidate === 'string' &&
      utf8Length(candidate) <= LOCAL_WHISPER_MAX_CAPABILITY_BYTES &&
      CAPABILITY_PATTERN.test(candidate),
  );
  return capabilities.length === value.length && new Set(capabilities).size === capabilities.length;
}

export function isLocalWhisperWorkerClientMessage(value: unknown): value is LocalWhisperWorkerClientMessage {
  if (!isRecord(value) || !hasProtocolVersion(value)) return false;
  switch (value.type) {
    case 'hello':
      return hasExactKeys(value, HELLO_KEYS);
    case 'warmup':
    case 'unload':
    case 'shutdown':
      return hasExactKeys(value, REQUEST_KEYS) && isRequestId(value.requestId);
    case 'probe':
      return isRequestId(value.requestId) && isProbeAuthority(value);
    case 'load':
      return isRequestId(value.requestId) && isLoadAuthority(value);
    case 'transcribe':
      return (
        hasExactKeys(value, TRANSCRIBE_KEYS) &&
        isRequestId(value.requestId) &&
        Number.isSafeInteger(value.settingsEpoch) &&
        (value.settingsEpoch as number) >= 0 &&
        Number.isSafeInteger(value.audioByteLength) &&
        (value.audioByteLength as number) >= 0 &&
        isTranscriptionOptions(value.options)
      );
    case 'cancel':
      return (
        hasExactKeys(value, CANCEL_KEYS) &&
        isRequestId(value.requestId) &&
        isRequestId(value.targetRequestId) &&
        value.requestId !== value.targetRequestId
      );
    default:
      return false;
  }
}

export function isLocalWhisperWorkerServerMessage(value: unknown): value is LocalWhisperWorkerServerMessage {
  if (!isRecord(value) || !hasProtocolVersion(value)) return false;
  switch (value.type) {
    case 'helloAck':
      return (
        hasExactKeys(value, HELLO_ACK_KEYS) &&
        isLocalWhisperEngine(value.engine) &&
        toLocalWhisperRevisionId(value.runtimeRevision) !== null &&
        typeof value.runtimeBuildDigest === 'string' &&
        SHA256_PATTERN.test(value.runtimeBuildDigest) &&
        isLocalWhisperBackend(value.backend) &&
        isCapabilities(value.capabilities) &&
        value.maxControlFrameBytes === LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES &&
        value.maxAudioChunkBytes === LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES
      );
    case 'warmed':
    case 'unloaded':
    case 'shutdownAck':
      return hasExactKeys(value, REQUEST_KEYS) && isRequestId(value.requestId);
    case 'probed':
      return isRequestId(value.requestId) && isProbeEvidence(value);
    case 'loaded':
      return isRequestId(value.requestId) && isLoadEvidence(value);
    case 'transcript':
      return hasExactKeys(value, TRANSCRIPT_KEYS) && isRequestId(value.requestId) && typeof value.text === 'string';
    case 'cancelled':
    case 'cancelTooLate':
      return (
        hasExactKeys(value, CANCELLED_KEYS) &&
        isRequestId(value.requestId) &&
        isRequestId(value.targetRequestId) &&
        value.requestId !== value.targetRequestId
      );
    case 'failure':
      return (
        hasExactKeys(value, FAILURE_KEYS) &&
        (value.requestId === null || isRequestId(value.requestId)) &&
        isLocalWhisperFailureCode(value.code)
      );
    default:
      return false;
  }
}

export function isLocalWhisperWorkerControlMessage(value: unknown): value is LocalWhisperWorkerControlMessage {
  return isLocalWhisperWorkerClientMessage(value) || isLocalWhisperWorkerServerMessage(value);
}

function createFrame(kind: LocalWhisperFrameKind, body: Uint8Array): Uint8Array {
  const frame = new Uint8Array(LOCAL_WHISPER_FRAME_HEADER_BYTES + body.byteLength);
  const view = new DataView(frame.buffer);
  view.setUint32(0, body.byteLength, false);
  view.setUint8(LOCAL_WHISPER_FRAME_LENGTH_BYTES, kind);
  frame.set(body, LOCAL_WHISPER_FRAME_HEADER_BYTES);
  return frame;
}

function readFrameBody(frame: Uint8Array, expectedKind: LocalWhisperFrameKind): Uint8Array {
  if (frame.byteLength < LOCAL_WHISPER_FRAME_HEADER_BYTES) {
    throw new Error('Malformed Local Whisper frame');
  }
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const bodyLength = view.getUint32(0, false);
  if (
    bodyLength !== frame.byteLength - LOCAL_WHISPER_FRAME_HEADER_BYTES ||
    view.getUint8(LOCAL_WHISPER_FRAME_LENGTH_BYTES) !== expectedKind
  ) {
    throw new Error('Malformed Local Whisper frame');
  }
  return frame.subarray(LOCAL_WHISPER_FRAME_HEADER_BYTES);
}

export function getLocalWhisperFrameKind(frame: Uint8Array): LocalWhisperFrameKind {
  if (frame.byteLength < LOCAL_WHISPER_FRAME_HEADER_BYTES) {
    throw new Error('Malformed Local Whisper frame');
  }
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  if (view.getUint32(0, false) !== frame.byteLength - LOCAL_WHISPER_FRAME_HEADER_BYTES) {
    throw new Error('Malformed Local Whisper frame');
  }
  const kind = view.getUint8(LOCAL_WHISPER_FRAME_LENGTH_BYTES);
  if (kind !== LOCAL_WHISPER_CONTROL_FRAME_KIND && kind !== LOCAL_WHISPER_AUDIO_FRAME_KIND) {
    throw new Error('Unknown Local Whisper frame kind');
  }
  return kind;
}

export function encodeLocalWhisperControlFrame(message: LocalWhisperWorkerControlMessage): Uint8Array {
  if (!isLocalWhisperWorkerControlMessage(message)) {
    throw new Error('Invalid Local Whisper control message');
  }
  const body = new TextEncoder().encode(JSON.stringify(message));
  if (body.byteLength > LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES) {
    throw new Error('Local Whisper control frame too large');
  }
  return createFrame(LOCAL_WHISPER_CONTROL_FRAME_KIND, body);
}

export function decodeLocalWhisperControlFrame(frame: Uint8Array): LocalWhisperWorkerControlMessage {
  const body = readFrameBody(frame, LOCAL_WHISPER_CONTROL_FRAME_KIND);
  if (body.byteLength > LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES) {
    throw new Error('Local Whisper control frame too large');
  }
  let parsed: unknown;
  try {
    parsed = parseLocalWhisperWorkerJson(body);
  } catch {
    throw new Error('Malformed Local Whisper control frame payload');
  }
  if (!isLocalWhisperWorkerControlMessage(parsed)) {
    throw new Error('Invalid Local Whisper control message');
  }
  return parsed;
}

export function createLocalWhisperAudioChunk(
  requestId: string,
  sequence: number,
  final: boolean,
  bytes: Uint8Array,
): LocalWhisperWorkerAudioChunk {
  if (
    !isRequestId(requestId) ||
    !Number.isInteger(sequence) ||
    sequence < 0 ||
    sequence > 0xffffffff ||
    typeof final !== 'boolean' ||
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength > LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES ||
    (bytes.byteLength === 0 && !final)
  ) {
    throw new Error('Invalid Local Whisper audio chunk');
  }
  return Object.freeze({ requestId, sequence, final, bytes: new Uint8Array(bytes) });
}

export function encodeLocalWhisperAudioFrame(chunk: LocalWhisperWorkerAudioChunk): Uint8Array {
  const safeChunk = createLocalWhisperAudioChunk(chunk.requestId, chunk.sequence, chunk.final, chunk.bytes);
  const requestId = new TextEncoder().encode(safeChunk.requestId);
  const body = new Uint8Array(AUDIO_BODY_FIXED_BYTES + requestId.byteLength + safeChunk.bytes.byteLength);
  const view = new DataView(body.buffer);
  view.setUint8(0, LOCAL_WHISPER_WORKER_PROTOCOL_VERSION);
  view.setUint8(1, safeChunk.final ? 1 : 0);
  view.setUint32(2, safeChunk.sequence, false);
  view.setUint16(6, requestId.byteLength, false);
  body.set(requestId, AUDIO_BODY_FIXED_BYTES);
  body.set(safeChunk.bytes, AUDIO_BODY_FIXED_BYTES + requestId.byteLength);
  return createFrame(LOCAL_WHISPER_AUDIO_FRAME_KIND, body);
}

export function decodeLocalWhisperAudioFrame(frame: Uint8Array): LocalWhisperWorkerAudioChunk {
  const body = readFrameBody(frame, LOCAL_WHISPER_AUDIO_FRAME_KIND);
  if (body.byteLength < AUDIO_BODY_FIXED_BYTES) throw new Error('Malformed Local Whisper audio frame');
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const version = view.getUint8(AUDIO_BODY_VERSION_OFFSET);
  const flag = view.getUint8(AUDIO_BODY_FINAL_OFFSET);
  const sequence = view.getUint32(AUDIO_BODY_SEQUENCE_OFFSET, false);
  const requestIdLength = view.getUint16(AUDIO_BODY_REQUEST_LENGTH_OFFSET, false);
  const audioOffset = AUDIO_BODY_REQUEST_OFFSET + requestIdLength;
  if (
    version !== LOCAL_WHISPER_WORKER_PROTOCOL_VERSION ||
    (flag !== 0 && flag !== 1) ||
    requestIdLength === 0 ||
    requestIdLength > LOCAL_WHISPER_MAX_REQUEST_ID_BYTES ||
    audioOffset > frame.byteLength ||
    frame.byteLength - audioOffset > LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES ||
    (frame.byteLength === audioOffset && flag !== 1)
  ) {
    throw new Error('Malformed Local Whisper audio frame');
  }
  let requestId: string;
  try {
    requestId = new TextDecoder('utf-8', { fatal: true }).decode(
      frame.subarray(AUDIO_BODY_REQUEST_OFFSET, audioOffset),
    );
  } catch {
    throw new Error('Malformed Local Whisper audio frame request ID');
  }
  return createLocalWhisperAudioChunk(requestId, sequence, flag === 1, frame.subarray(audioOffset));
}
