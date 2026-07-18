import type { BaseVoiceProvider } from './BaseVoiceProvider';
import { BatchVoiceProvider } from './BatchVoiceProvider';
import { StreamingVoiceProvider } from './streamingVoiceProvider';

export function isBatchVoiceProvider(provider: BaseVoiceProvider): provider is BatchVoiceProvider {
  switch (provider.info.transcriptionMode) {
    case 'batch':
      return provider instanceof BatchVoiceProvider;
    case 'streaming':
      return false;
    default:
      return false;
  }
}

export function isStreamingVoiceProvider(provider: BaseVoiceProvider): provider is StreamingVoiceProvider {
  switch (provider.info.transcriptionMode) {
    case 'batch':
      return false;
    case 'streaming':
      return provider instanceof StreamingVoiceProvider;
    default:
      return false;
  }
}
