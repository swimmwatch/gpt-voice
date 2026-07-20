export const VOICE_PROVIDER_AUTH_TYPES = ['browserSession', 'apiKey'] as const;
export const VOICE_PROVIDER_CATEGORIES = ['web', 'api', 'local'] as const;
export const VOICE_TRANSCRIPTION_MODES = ['batch', 'streaming'] as const;

export type VoiceProviderAuthType = (typeof VOICE_PROVIDER_AUTH_TYPES)[number];
export type VoiceProviderCategory = (typeof VOICE_PROVIDER_CATEGORIES)[number];
export type VoiceTranscriptionMode = (typeof VOICE_TRANSCRIPTION_MODES)[number];

interface VoiceProviderInfoBase {
  id: string;
  name: string;
  authType: VoiceProviderAuthType;
  category: VoiceProviderCategory;
  hasSettings: boolean;
}

export interface BatchVoiceProviderInfo extends VoiceProviderInfoBase {
  transcriptionMode: 'batch';
}

export interface StreamingVoiceProviderInfo extends VoiceProviderInfoBase {
  transcriptionMode: 'streaming';
}

/** Exact non-secret provider metadata allowed to cross the main/renderer boundary. */
export type RendererSafeVoiceProviderInfo = BatchVoiceProviderInfo | StreamingVoiceProviderInfo;

const RENDERER_SAFE_PROVIDER_INFO_KEYS = new Set<keyof RendererSafeVoiceProviderInfo>([
  'id',
  'name',
  'authType',
  'category',
  'hasSettings',
  'transcriptionMode',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVoiceProviderAuthType(value: unknown): value is VoiceProviderAuthType {
  return typeof value === 'string' && VOICE_PROVIDER_AUTH_TYPES.some((authType) => authType === value);
}

function isVoiceProviderCategory(value: unknown): value is VoiceProviderCategory {
  return typeof value === 'string' && VOICE_PROVIDER_CATEGORIES.some((category) => category === value);
}

export function isVoiceTranscriptionMode(value: unknown): value is VoiceTranscriptionMode {
  return typeof value === 'string' && VOICE_TRANSCRIPTION_MODES.some((mode) => mode === value);
}

export function isRendererSafeVoiceProviderInfo(value: unknown): value is RendererSafeVoiceProviderInfo {
  if (!isRecord(value)) return false;
  if (
    Object.keys(value).some((key) => !RENDERER_SAFE_PROVIDER_INFO_KEYS.has(key as keyof RendererSafeVoiceProviderInfo))
  ) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    isVoiceProviderAuthType(value.authType) &&
    isVoiceProviderCategory(value.category) &&
    typeof value.hasSettings === 'boolean' &&
    isVoiceTranscriptionMode(value.transcriptionMode)
  );
}

export function isStreamingVoiceProviderInfo(value: unknown): value is StreamingVoiceProviderInfo {
  return isRendererSafeVoiceProviderInfo(value) && value.transcriptionMode === 'streaming';
}
