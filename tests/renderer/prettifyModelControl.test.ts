import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getOllamaModelControl } from '@renderer/prettifyModelControl';
import { DEFAULT_PRETTIFY_SETTINGS, type PrettifySettings } from '@shared/prettifySettings';

function createSettings(overrides: Partial<PrettifySettings> = {}): PrettifySettings {
  return {
    ...DEFAULT_PRETTIFY_SETTINGS,
    ...overrides,
    ollama: {
      ...DEFAULT_PRETTIFY_SETTINGS.ollama,
      ...overrides.ollama,
    },
    vllm: {
      ...DEFAULT_PRETTIFY_SETTINGS.vllm,
      ...overrides.vllm,
    },
  };
}

describe('getOllamaModelControl', () => {
  it('hides the control when vLLM is selected', () => {
    const control = getOllamaModelControl(
      createSettings({ providerId: 'vllm', vllm: { ...DEFAULT_PRETTIFY_SETTINGS.vllm, model: 'qwen' } }),
      [],
    );

    assert.equal(control, null);
  });

  it('hides the control when no Ollama model is selected', () => {
    assert.equal(getOllamaModelControl(createSettings(), []), null);
  });

  it('returns the selected loaded model and its VRAM size', () => {
    const control = getOllamaModelControl(
      createSettings({ ollama: { ...DEFAULT_PRETTIFY_SETTINGS.ollama, model: 'gemma3:1b' } }),
      [{ id: 'gemma3:1b', isLoaded: true, name: 'Gemma 3 1B', vramSizeBytes: 1_073_741_824 }],
    );

    assert.deepEqual(control, { isLoaded: true, model: 'gemma3:1b', vramSizeBytes: 1_073_741_824 });
  });

  it('keeps a selected model actionable when it is absent from the latest model list', () => {
    const control = getOllamaModelControl(
      createSettings({ ollama: { ...DEFAULT_PRETTIFY_SETTINGS.ollama, model: 'missing-model' } }),
      [],
    );

    assert.deepEqual(control, { isLoaded: false, model: 'missing-model', vramSizeBytes: undefined });
  });
});
