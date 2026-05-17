import { BaseVoiceProvider, type VoiceProviderAuthType } from './BaseVoiceProvider';
import { ChatGPTVoiceProvider } from './ChatGPTVoiceProvider';
import { OpenAIApiVoiceProvider } from './OpenAIApiVoiceProvider';

export type { VoiceProviderInfo, TranscriptionResult, VoiceProviderAuthType } from './BaseVoiceProvider';
export { BaseVoiceProvider } from './BaseVoiceProvider';
export { ChatGPTVoiceProvider } from './ChatGPTVoiceProvider';
export { OpenAIApiVoiceProvider } from './OpenAIApiVoiceProvider';

const providerRegistry: Record<string, () => BaseVoiceProvider> = {
  chatgpt: () => new ChatGPTVoiceProvider(),
  'openai-api': () => new OpenAIApiVoiceProvider(),
};

export function getAvailableProviders(): { id: string; name: string; authType: VoiceProviderAuthType }[] {
  return Object.values(providerRegistry).map((factory) => {
    const p = factory();
    return { id: p.info.id, name: p.info.name, authType: p.info.authType };
  });
}

export function createProvider(id: string): BaseVoiceProvider {
  const factory = providerRegistry[id];
  if (!factory) {
    throw new Error(`Unknown voice provider: ${id}`);
  }
  return factory();
}
