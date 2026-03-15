import { BaseVoiceProvider } from './BaseVoiceProvider';
import { ChatGPTVoiceProvider } from './ChatGPTVoiceProvider';

export type { VoiceProviderInfo, TranscriptionResult } from './BaseVoiceProvider';
export { BaseVoiceProvider } from './BaseVoiceProvider';
export { ChatGPTVoiceProvider } from './ChatGPTVoiceProvider';

const providerRegistry: Record<string, () => BaseVoiceProvider> = {
  chatgpt: () => new ChatGPTVoiceProvider(),
};

export function getAvailableProviders(): { id: string; name: string }[] {
  return Object.values(providerRegistry).map((factory) => {
    const p = factory();
    return { id: p.info.id, name: p.info.name };
  });
}

export function createProvider(id: string): BaseVoiceProvider {
  const factory = providerRegistry[id];
  if (!factory) {
    throw new Error(`Unknown voice provider: ${id}`);
  }
  return factory();
}
