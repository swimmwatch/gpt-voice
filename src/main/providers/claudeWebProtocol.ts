import {
  canonicalizeClaudeWebLanguage,
  getClaudeWebLanguageInputError,
  type ClaudeWebLanguage,
} from '@shared/claudeWebSettings';

export const CLAUDE_WEB_SPEECH_PROTOCOL_VERSION = 1;
export const CLAUDE_WEB_SPEECH_ENDPOINT = 'wss://claude.ai/api/ws/speech_to_text/voice_stream';

const CLAUDE_WEB_SPEECH_QUERY_V1 = {
  encoding: 'linear16',
  sampleRate: '16000',
  channels: '1',
  endpointingMs: '300',
  utteranceEndMs: '1000',
  useConversationEngine: 'true',
  sttProvider: 'deepgram-nova3',
  clientPlatform: 'web_claude_ai',
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClaudeWebProtocolErrorCode = 'invalid-language' | 'invalid-organization-uuid';

/** Identifies invalid transient query input without retaining its value. */
export class ClaudeWebProtocolError extends Error {
  readonly code: ClaudeWebProtocolErrorCode;

  constructor(code: ClaudeWebProtocolErrorCode) {
    super(code === 'invalid-language' ? 'Claude Web language is invalid' : 'Claude Web organization UUID is invalid');
    this.name = 'ClaudeWebProtocolError';
    this.code = code;
  }
}

export interface ClaudeWebSpeechUrlInput {
  language: ClaudeWebLanguage;
  organizationUuid: string;
}

export function buildClaudeWebSpeechUrl(input: ClaudeWebSpeechUrlInput): string {
  if (getClaudeWebLanguageInputError(input.language)) {
    throw new ClaudeWebProtocolError('invalid-language');
  }
  if (typeof input.organizationUuid !== 'string' || !UUID_PATTERN.test(input.organizationUuid)) {
    throw new ClaudeWebProtocolError('invalid-organization-uuid');
  }

  const url = new URL(CLAUDE_WEB_SPEECH_ENDPOINT);
  url.searchParams.set('encoding', CLAUDE_WEB_SPEECH_QUERY_V1.encoding);
  url.searchParams.set('sample_rate', CLAUDE_WEB_SPEECH_QUERY_V1.sampleRate);
  url.searchParams.set('channels', CLAUDE_WEB_SPEECH_QUERY_V1.channels);
  url.searchParams.set('endpointing_ms', CLAUDE_WEB_SPEECH_QUERY_V1.endpointingMs);
  url.searchParams.set('utterance_end_ms', CLAUDE_WEB_SPEECH_QUERY_V1.utteranceEndMs);
  url.searchParams.set('language', canonicalizeClaudeWebLanguage(input.language));
  url.searchParams.set('use_conversation_engine', CLAUDE_WEB_SPEECH_QUERY_V1.useConversationEngine);
  url.searchParams.set('stt_provider', CLAUDE_WEB_SPEECH_QUERY_V1.sttProvider);
  url.searchParams.set('client_platform', CLAUDE_WEB_SPEECH_QUERY_V1.clientPlatform);
  url.searchParams.set('organization_uuid', input.organizationUuid.toLowerCase());
  return url.toString();
}

export type ClaudeWebClientControl = Readonly<{ type: 'KeepAlive' }> | Readonly<{ type: 'CloseStream' }>;

export const CLAUDE_WEB_KEEP_ALIVE_CONTROL: ClaudeWebClientControl = Object.freeze({ type: 'KeepAlive' });
export const CLAUDE_WEB_CLOSE_STREAM_CONTROL: ClaudeWebClientControl = Object.freeze({ type: 'CloseStream' });

export function serializeClaudeWebClientControl(control: ClaudeWebClientControl): string {
  return JSON.stringify(control);
}

export type ClaudeWebSpeechEvent =
  | { type: 'TranscriptText'; data: string }
  | { type: 'TranscriptInterim'; data: string }
  | { type: 'TranscriptEndpoint' };

export interface ClaudeWebSpeechEventMetadata {
  eventType: string | null;
  payloadLength: number | null;
  dataLength: number | null;
}

export type ClaudeWebSpeechEventParseResult =
  | { status: 'known'; event: ClaudeWebSpeechEvent }
  | { status: 'unknown' | 'malformed'; metadata: ClaudeWebSpeechEventMetadata };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getPayloadLength(value: unknown): number | null {
  if (typeof value === 'string') return value.length;
  if (value instanceof Uint8Array) return value.byteLength;
  return null;
}

function getEventMetadata(value: unknown, payloadLength: number | null): ClaudeWebSpeechEventMetadata {
  if (!isRecord(value)) {
    return { eventType: null, payloadLength, dataLength: null };
  }
  return {
    eventType: typeof value.type === 'string' ? value.type : null,
    payloadLength,
    dataLength: typeof value.data === 'string' ? value.data.length : null,
  };
}

export function parseClaudeWebSpeechEvent(input: unknown): ClaudeWebSpeechEventParseResult {
  const payloadLength = getPayloadLength(input);
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return {
        status: 'malformed',
        metadata: { eventType: null, payloadLength, dataLength: null },
      };
    }
  }

  const metadata = getEventMetadata(value, payloadLength);
  if (!isRecord(value) || typeof value.type !== 'string' || value.type.length === 0) {
    return { status: 'malformed', metadata };
  }
  if (value.type === 'TranscriptEndpoint') {
    return 'data' in value
      ? { status: 'malformed', metadata }
      : { status: 'known', event: { type: 'TranscriptEndpoint' } };
  }
  if (value.type === 'TranscriptText' || value.type === 'TranscriptInterim') {
    return typeof value.data === 'string'
      ? { status: 'known', event: { type: value.type, data: value.data } }
      : { status: 'malformed', metadata };
  }
  return { status: 'unknown', metadata };
}

export interface ClaudeWebTranscriptState {
  currentTranscript: string;
  finalTranscript: string;
}

export interface ClaudeWebTranscriptUpdate {
  state: ClaudeWebTranscriptState;
  committedText: string | null;
}

export function createClaudeWebTranscriptState(): ClaudeWebTranscriptState {
  return { currentTranscript: '', finalTranscript: '' };
}

export function applyClaudeWebTranscriptEvent(
  state: ClaudeWebTranscriptState,
  event: ClaudeWebSpeechEvent,
): ClaudeWebTranscriptUpdate {
  if (event.type === 'TranscriptText' || event.type === 'TranscriptInterim') {
    return {
      state: { ...state, currentTranscript: event.data },
      committedText: null,
    };
  }

  if (!state.currentTranscript || state.currentTranscript === state.finalTranscript) {
    return { state, committedText: null };
  }
  return {
    state: { ...state, finalTranscript: state.currentTranscript },
    committedText: state.currentTranscript,
  };
}
