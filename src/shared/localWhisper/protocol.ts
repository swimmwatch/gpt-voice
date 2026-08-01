import { hasLocalWhisperControlCharacter, isLocalWhisperFailureCode, type LocalWhisperFailureCode } from './domain';
import {
  getLocalWhisperPromptValidationError,
  LOCAL_WHISPER_MAX_CANDIDATE_COUNT,
  LOCAL_WHISPER_MAX_TEMPERATURE_HUNDREDTHS,
  LOCAL_WHISPER_MIN_CANDIDATE_COUNT,
  LOCAL_WHISPER_TEMPERATURE_STEP_HUNDREDTHS,
} from './settings';

export const LOCAL_WHISPER_WORKER_PROTOCOL_VERSION = 1 as const;
export const LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES = 1024 * 1024;
export const LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES = 1024 * 1024;
export const LOCAL_WHISPER_FRAME_LENGTH_BYTES = 4;

export interface LocalWhisperWorkerTranscriptionOptions {
  readonly language: string | null;
  readonly initialPrompt: string;
  readonly temperatureHundredths: number;
  readonly strategy: 'greedy' | 'beamSearch' | 'bestOfSampling';
  readonly candidateCount: number | null;
}

export type LocalWhisperWorkerClientMessage =
  | {
      readonly type: 'hello';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
    }
  | {
      readonly type: 'load';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly residencyKey: string;
    }
  | {
      readonly type: 'unload';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
    }
  | {
      readonly type: 'transcribe';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly settingsEpoch: number;
      readonly audioByteLength: number;
      readonly options: LocalWhisperWorkerTranscriptionOptions;
    }
  | {
      readonly type: 'cancel';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
    }
  | {
      readonly type: 'shutdown';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
    };

export type LocalWhisperWorkerServerMessage =
  | {
      readonly type: 'helloAck';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
    }
  | {
      readonly type: 'loaded';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly residencyKey: string;
    }
  | {
      readonly type: 'unloaded';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
    }
  | {
      readonly type: 'transcript';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly text: string;
    }
  | {
      readonly type: 'cancelled';
      readonly protocolVersion: typeof LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
      readonly requestId: string;
    }
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

const PROTOCOL_ONLY_KEYS = ['type', 'protocolVersion'] as const;
const REQUEST_KEYS = ['type', 'protocolVersion', 'requestId'] as const;
const LOAD_KEYS = [...REQUEST_KEYS, 'residencyKey'] as const;
const TRANSCRIBE_KEYS = [...REQUEST_KEYS, 'settingsEpoch', 'audioByteLength', 'options'] as const;
const FAILURE_KEYS = [...REQUEST_KEYS, 'code'] as const;
const TRANSCRIPTION_OPTIONS_KEYS = [
  'language',
  'initialPrompt',
  'temperatureHundredths',
  'strategy',
  'candidateCount',
] as const;
const AUDIO_HEADER_FIXED_BYTES = 1 + 4 + 2;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 128 && !hasLocalWhisperControlCharacter(value)
  );
}

function isResidencyKey(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 2_048 && !hasLocalWhisperControlCharacter(value)
  );
}

function hasProtocolVersion(value: Record<string, unknown>): boolean {
  return value.protocolVersion === LOCAL_WHISPER_WORKER_PROTOCOL_VERSION;
}

function isCandidateCount(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= LOCAL_WHISPER_MIN_CANDIDATE_COUNT &&
    (value as number) <= LOCAL_WHISPER_MAX_CANDIDATE_COUNT
  );
}

function isTranscriptionOptions(value: unknown): value is LocalWhisperWorkerTranscriptionOptions {
  if (!isRecord(value) || !hasExactKeys(value, TRANSCRIPTION_OPTIONS_KEYS)) return false;
  if (!(value.language === null || isRequestId(value.language))) return false;
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

export function isLocalWhisperWorkerClientMessage(value: unknown): value is LocalWhisperWorkerClientMessage {
  if (!isRecord(value) || !hasProtocolVersion(value)) return false;
  switch (value.type) {
    case 'hello':
      return hasExactKeys(value, PROTOCOL_ONLY_KEYS);
    case 'load':
      return hasExactKeys(value, LOAD_KEYS) && isRequestId(value.requestId) && isResidencyKey(value.residencyKey);
    case 'unload':
    case 'cancel':
    case 'shutdown':
      return hasExactKeys(value, REQUEST_KEYS) && isRequestId(value.requestId);
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
    default:
      return false;
  }
}

export function isLocalWhisperWorkerServerMessage(value: unknown): value is LocalWhisperWorkerServerMessage {
  if (!isRecord(value) || !hasProtocolVersion(value)) return false;
  switch (value.type) {
    case 'helloAck':
      return hasExactKeys(value, PROTOCOL_ONLY_KEYS);
    case 'loaded':
      return hasExactKeys(value, LOAD_KEYS) && isRequestId(value.requestId) && isResidencyKey(value.residencyKey);
    case 'unloaded':
    case 'cancelled':
      return hasExactKeys(value, REQUEST_KEYS) && isRequestId(value.requestId);
    case 'transcript':
      return (
        hasExactKeys(value, [...REQUEST_KEYS, 'text']) && isRequestId(value.requestId) && typeof value.text === 'string'
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

export function encodeLocalWhisperControlFrame(message: LocalWhisperWorkerControlMessage): Uint8Array {
  if (!isLocalWhisperWorkerControlMessage(message)) throw new Error('Invalid Local Whisper control message');
  const payload = new TextEncoder().encode(JSON.stringify(message));
  if (payload.byteLength > LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES) {
    throw new Error('Local Whisper control frame exceeds the maximum size');
  }
  const frame = new Uint8Array(LOCAL_WHISPER_FRAME_LENGTH_BYTES + payload.byteLength);
  new DataView(frame.buffer).setUint32(0, payload.byteLength, false);
  frame.set(payload, LOCAL_WHISPER_FRAME_LENGTH_BYTES);
  return frame;
}

export function decodeLocalWhisperControlFrame(frame: Uint8Array): LocalWhisperWorkerControlMessage {
  if (!(frame instanceof Uint8Array) || frame.byteLength < LOCAL_WHISPER_FRAME_LENGTH_BYTES) {
    throw new Error('Malformed Local Whisper control frame');
  }
  const payloadLength = new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(0, false);
  if (
    payloadLength > LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES ||
    payloadLength !== frame.byteLength - LOCAL_WHISPER_FRAME_LENGTH_BYTES
  ) {
    throw new Error('Malformed Local Whisper control frame length');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(frame.subarray(LOCAL_WHISPER_FRAME_LENGTH_BYTES)),
    ) as unknown;
  } catch {
    throw new Error('Malformed Local Whisper control frame payload');
  }
  if (!isLocalWhisperWorkerControlMessage(parsed)) throw new Error('Invalid Local Whisper control message');
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
    !Number.isSafeInteger(sequence) ||
    sequence < 0 ||
    sequence > 0xffffffff ||
    typeof final !== 'boolean' ||
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength > LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES
  ) {
    throw new Error('Invalid Local Whisper audio chunk');
  }
  return Object.freeze({ requestId, sequence, final, bytes: new Uint8Array(bytes) });
}

export function encodeLocalWhisperAudioFrame(chunk: LocalWhisperWorkerAudioChunk): Uint8Array {
  const safeChunk = createLocalWhisperAudioChunk(chunk.requestId, chunk.sequence, chunk.final, chunk.bytes);
  const requestIdBytes = new TextEncoder().encode(safeChunk.requestId);
  if (requestIdBytes.byteLength > 0xffff) throw new Error('Local Whisper request ID is too long');
  const payloadLength = AUDIO_HEADER_FIXED_BYTES + requestIdBytes.byteLength + safeChunk.bytes.byteLength;
  const frame = new Uint8Array(LOCAL_WHISPER_FRAME_LENGTH_BYTES + payloadLength);
  const view = new DataView(frame.buffer);
  view.setUint32(0, payloadLength, false);
  view.setUint8(4, safeChunk.final ? 1 : 0);
  view.setUint32(5, safeChunk.sequence, false);
  view.setUint16(9, requestIdBytes.byteLength, false);
  frame.set(requestIdBytes, 11);
  frame.set(safeChunk.bytes, 11 + requestIdBytes.byteLength);
  return frame;
}

export function decodeLocalWhisperAudioFrame(frame: Uint8Array): LocalWhisperWorkerAudioChunk {
  const minimumLength = LOCAL_WHISPER_FRAME_LENGTH_BYTES + AUDIO_HEADER_FIXED_BYTES;
  if (!(frame instanceof Uint8Array) || frame.byteLength < minimumLength) {
    throw new Error('Malformed Local Whisper audio frame');
  }
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const payloadLength = view.getUint32(0, false);
  const flag = view.getUint8(4);
  const sequence = view.getUint32(5, false);
  const requestIdLength = view.getUint16(9, false);
  const audioOffset = 11 + requestIdLength;
  if (
    payloadLength !== frame.byteLength - LOCAL_WHISPER_FRAME_LENGTH_BYTES ||
    (flag !== 0 && flag !== 1) ||
    audioOffset > frame.byteLength ||
    frame.byteLength - audioOffset > LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES
  ) {
    throw new Error('Malformed Local Whisper audio frame');
  }
  let requestId: string;
  try {
    requestId = new TextDecoder('utf-8', { fatal: true }).decode(frame.subarray(11, audioOffset));
  } catch {
    throw new Error('Malformed Local Whisper audio frame request ID');
  }
  return createLocalWhisperAudioChunk(requestId, sequence, flag === 1, frame.subarray(audioOffset));
}
