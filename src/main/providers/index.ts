import { BaseVoiceProvider } from './BaseVoiceProvider';
import { ChatGPTVoiceProvider } from './ChatGPTVoiceProvider';
import { ClaudeWebVoiceProvider } from './ClaudeWebVoiceProvider';
import { OpenAIApiVoiceProvider } from './OpenAIApiVoiceProvider';
import { isBatchVoiceProvider, isStreamingVoiceProvider } from './voiceProviderGuards';
import { CLAUDE_WEB_PROVIDER_ID } from '@shared/claudeWebSettings';
import { isRendererSafeVoiceProviderInfo, type RendererSafeVoiceProviderInfo } from '@shared/voiceProvider';

export type {
  TranscriptionResult,
  VoiceProviderInfo,
  VoiceProviderAuthType,
  VoiceProviderCategory,
  VoiceTranscriptionMode,
} from './BaseVoiceProvider';
export { BaseVoiceProvider } from './BaseVoiceProvider';
export { BatchVoiceProvider } from './BatchVoiceProvider';
export { ChatGPTVoiceProvider } from './ChatGPTVoiceProvider';
export { ClaudeWebVoiceProvider } from './ClaudeWebVoiceProvider';
export { OpenAIApiVoiceProvider } from './OpenAIApiVoiceProvider';
export { StreamingTranscriptionOperationError } from './StreamingTranscriptionOperationError';
export {
  copyStreamingTranscriptionChunk,
  StreamingVoiceProvider,
  StreamingTranscriptionErrorCode,
  StreamingTranscriptionLifecycle,
} from './streamingVoiceProvider';
export type {
  CancelStreamingTranscriptionInput,
  CopiedStreamingTranscriptionChunk,
  FinishStreamingTranscriptionInput,
  PushStreamingTranscriptionChunkInput,
  StartStreamingTranscriptionInput,
  StreamingTranscriptionChunkAccepted,
  StreamingTranscriptionCancellation,
  StreamingTranscriptionError,
  StreamingTranscriptionOperationId,
  StreamingTranscriptionResult,
  StreamingTranscriptionStarted,
  StreamingVoiceProviderCapability,
  StreamingVoiceProviderOperations,
} from './streamingVoiceProvider';
export { isBatchVoiceProvider, isStreamingVoiceProvider } from './voiceProviderGuards';

const providerRegistry: Record<string, () => BaseVoiceProvider> = {
  chatgpt: () => new ChatGPTVoiceProvider(),
  'openai-api': () => new OpenAIApiVoiceProvider(),
  [CLAUDE_WEB_PROVIDER_ID]: () => new ClaudeWebVoiceProvider(),
};

export function getAvailableProviders(): RendererSafeVoiceProviderInfo[] {
  return Object.values(providerRegistry).map((factory) => {
    const p = factory();
    if (!isBatchVoiceProvider(p) && !isStreamingVoiceProvider(p)) {
      throw new Error(`Voice provider class does not match its transcription mode: ${p.info.id}`);
    }
    const info: unknown = {
      id: p.info.id,
      name: p.info.name,
      authType: p.info.authType,
      category: p.info.category,
      hasSettings: p.info.hasSettings,
      transcriptionMode: p.info.transcriptionMode,
    };
    if (!isRendererSafeVoiceProviderInfo(info)) {
      throw new Error(`Invalid renderer-safe metadata for voice provider: ${p.info.id}`);
    }
    return info;
  });
}

export function createProvider(id: string): BaseVoiceProvider {
  const factory = providerRegistry[id];
  if (!factory) {
    throw new Error(`Unknown voice provider: ${id}`);
  }
  return factory();
}
