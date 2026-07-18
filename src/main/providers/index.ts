import { BaseVoiceProvider } from './BaseVoiceProvider';
import { ChatGPTVoiceProvider } from './ChatGPTVoiceProvider';
import { ClaudeWebVoiceProvider } from './ClaudeWebVoiceProvider';
import { OpenAIApiVoiceProvider } from './OpenAIApiVoiceProvider';
import { CLAUDE_WEB_PROVIDER_ID } from '@shared/claudeWebSettings';

export type {
  TranscriptionResult,
  VoiceProviderInfo,
  VoiceProviderAuthType,
  VoiceProviderCategory,
} from './BaseVoiceProvider';
export { BaseVoiceProvider } from './BaseVoiceProvider';
export { ChatGPTVoiceProvider } from './ChatGPTVoiceProvider';
export { ClaudeWebVoiceProvider } from './ClaudeWebVoiceProvider';
export { OpenAIApiVoiceProvider } from './OpenAIApiVoiceProvider';

const providerRegistry: Record<string, () => BaseVoiceProvider> = {
  chatgpt: () => new ChatGPTVoiceProvider(),
  'openai-api': () => new OpenAIApiVoiceProvider(),
  [CLAUDE_WEB_PROVIDER_ID]: () => new ClaudeWebVoiceProvider(),
};

export function getAvailableProviders(): Array<
  Pick<BaseVoiceProvider['info'], 'id' | 'name' | 'authType' | 'category' | 'hasSettings'>
> {
  return Object.values(providerRegistry).map((factory) => {
    const p = factory();
    return {
      id: p.info.id,
      name: p.info.name,
      authType: p.info.authType,
      category: p.info.category,
      hasSettings: p.info.hasSettings,
    };
  });
}

export function createProvider(id: string): BaseVoiceProvider {
  const factory = providerRegistry[id];
  if (!factory) {
    throw new Error(`Unknown voice provider: ${id}`);
  }
  return factory();
}
