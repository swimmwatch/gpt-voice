import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OpenAIApiVoiceProvider } from '@main/providers/OpenAIApiVoiceProvider';
import { DEFAULT_OPENAI_API_SETTINGS, type OpenAIApiSettingsWithSecret } from '@main/providers/openaiApiSettingsUtils';

function createSettings(overrides: Partial<OpenAIApiSettingsWithSecret> = {}): OpenAIApiSettingsWithSecret {
  return {
    ...DEFAULT_OPENAI_API_SETTINGS,
    apiKey: 'secret-api-key',
    ...overrides,
  };
}

describe('OpenAIApiVoiceProvider', () => {
  it('returns all result-affecting settings without the API key', () => {
    const settings = createSettings({ language: 'uk', prompt: 'use Ukrainian spelling', temperature: 0.4 });
    const provider = new OpenAIApiVoiceProvider({ getSettings: () => settings });

    const context = provider.getTranscriptionCacheContext();

    assert.deepEqual(context, [
      'model',
      settings.model,
      'language',
      'uk',
      'prompt',
      'use Ukrainian spelling',
      'temperature',
      '0.4',
    ]);
    assert.equal(context.includes(settings.apiKey), false);
  });

  it('changes context when a transcription setting changes', () => {
    const first = new OpenAIApiVoiceProvider({
      getSettings: () => createSettings({ language: 'auto', prompt: '', temperature: 0 }),
    });
    const second = new OpenAIApiVoiceProvider({
      getSettings: () => createSettings({ language: 'en', prompt: 'identify names', temperature: 0.3 }),
    });

    assert.notDeepEqual(first.getTranscriptionCacheContext(), second.getTranscriptionCacheContext());
  });
});
