import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPrettifyProviderModelOptions,
  createPrettifyProviderModelStates,
  getCodexCliModelControls,
  getOllamaModelControl,
  mergePrettifyProviderModelOptions,
  normalizeCodexCliSettingsForModel,
  shouldRefreshCliModelsOnOpen,
} from '@renderer/prettifyModelControl';
import { DEFAULT_PRETTIFY_SETTINGS, type PrettifySettings } from '@shared/prettifySettings';

function createSettings(overrides: Partial<PrettifySettings> = {}): PrettifySettings {
  return {
    ...DEFAULT_PRETTIFY_SETTINGS,
    ...overrides,
    claudeCli: {
      ...DEFAULT_PRETTIFY_SETTINGS.claudeCli,
      ...overrides.claudeCli,
    },
    codexCli: {
      ...DEFAULT_PRETTIFY_SETTINGS.codexCli,
      ...overrides.codexCli,
    },
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

describe('CLI prettify model controls', () => {
  it('starts with Claude aliases and preserves configured free-text models', () => {
    const options = createPrettifyProviderModelOptions(
      createSettings({
        claudeCli: { ...DEFAULT_PRETTIFY_SETTINGS.claudeCli, model: 'claude-custom' },
        codexCli: { ...DEFAULT_PRETTIFY_SETTINGS.codexCli, model: 'gpt-custom' },
      }),
    );

    assert.deepEqual(
      options['claude-cli'].map((option) => option.id),
      ['claude-custom', 'sonnet', 'opus', 'haiku'],
    );
    assert.deepEqual(options['codex-cli'], [{ id: 'gpt-custom', name: 'gpt-custom' }]);
    assert.deepEqual(mergePrettifyProviderModelOptions([{ id: 'gpt-5', name: 'GPT-5' }], 'gpt-custom'), [
      { id: 'gpt-custom', name: 'gpt-custom' },
      { id: 'gpt-5', name: 'GPT-5' },
    ]);
  });

  it('keeps CLI availability unchecked until a model or parameter list is opened or Refresh is requested', () => {
    const states = createPrettifyProviderModelStates();

    assert.deepEqual(states['claude-cli'], {
      availability: { status: 'unavailable' },
      checkStatus: 'unchecked',
      source: 'known-aliases',
    });
    assert.deepEqual(states['codex-cli'], {
      availability: { status: 'unavailable' },
      checkStatus: 'unchecked',
      source: 'catalog',
    });
    assert.equal(states.ollama.availability.status, 'available');
    assert.equal(states.vllm.availability.status, 'available');
  });

  it('loads CLI capabilities on first list open without duplicating active or completed discovery', () => {
    const configuredCodexModel = { id: 'gpt-5.3-codex-spark', name: 'gpt-5.3-codex-spark' };
    const discoveredCodexModel = {
      ...configuredCodexModel,
      reasoningEfforts: ['low', 'medium', 'high', 'xhigh'] as const,
      verbosity: ['low', 'medium', 'high'] as const,
    };

    assert.equal(shouldRefreshCliModelsOnOpen('claude-cli', 'unchecked', false, 'sonnet'), true);
    assert.equal(shouldRefreshCliModelsOnOpen('codex-cli', 'unavailable', false, configuredCodexModel.id), true);
    assert.equal(
      shouldRefreshCliModelsOnOpen('codex-cli', 'available', false, configuredCodexModel.id, configuredCodexModel),
      true,
    );
    assert.equal(
      shouldRefreshCliModelsOnOpen('codex-cli', 'available', false, discoveredCodexModel.id, discoveredCodexModel),
      false,
    );
    assert.equal(shouldRefreshCliModelsOnOpen('codex-cli', 'checking', false, configuredCodexModel.id), false);
    assert.equal(shouldRefreshCliModelsOnOpen('codex-cli', 'unchecked', true, configuredCodexModel.id), false);
    assert.equal(shouldRefreshCliModelsOnOpen('ollama', 'unchecked', false, 'model'), false);
  });

  it('exposes only Codex defaults before discovery and verified options afterwards', () => {
    const models = [
      {
        id: 'gpt-5.6',
        name: 'GPT-5.6',
        reasoningEfforts: ['low', 'high'] as const,
        verbosity: ['low', 'medium'] as const,
      },
    ];

    assert.deepEqual(getCodexCliModelControls('gpt-5.6', models, false), {
      reasoningEfforts: ['default'],
      verbosity: ['low'],
    });
    assert.deepEqual(getCodexCliModelControls('gpt-5.6', models, true), {
      reasoningEfforts: ['default', 'low', 'high'],
      verbosity: ['low', 'medium'],
    });
    assert.deepEqual(getCodexCliModelControls('custom-model', models, true), {
      reasoningEfforts: ['default'],
      verbosity: ['low'],
    });
  });

  it('clamps unsupported Codex controls without changing supported selections', () => {
    const models = [
      {
        id: 'gpt-5.6',
        name: 'GPT-5.6',
        reasoningEfforts: ['high'] as const,
        verbosity: ['low', 'high'] as const,
      },
    ];
    const settings = {
      ...DEFAULT_PRETTIFY_SETTINGS.codexCli,
      model: 'gpt-5.6',
      reasoningEffort: 'high' as const,
      verbosity: 'high' as const,
    };

    assert.deepEqual(normalizeCodexCliSettingsForModel(settings, models, true), settings);
    assert.deepEqual(normalizeCodexCliSettingsForModel({ ...settings, model: 'custom-model' }, models, true), {
      ...settings,
      model: 'custom-model',
      reasoningEffort: 'default',
      verbosity: 'low',
    });
  });
});
