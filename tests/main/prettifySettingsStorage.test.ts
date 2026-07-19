import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergePrettifySettingsForStorage } from '@main/services/prettifySettingsStorage';
import { DEFAULT_PRETTIFY_SETTINGS } from '@shared/prettifySettings';

describe('prettify settings storage', () => {
  it('deep-merges non-secret CLI fields without replacing encrypted vLLM-key state', () => {
    const current = {
      ...DEFAULT_PRETTIFY_SETTINGS,
      claudeCli: {
        executablePath: '/opt/Claude CLI/claude',
        model: 'claude-sonnet',
        fallbackModel: 'claude-haiku',
        effort: 'medium' as const,
        timeoutSeconds: 240,
      },
      codexCli: {
        executablePath: '/opt/Codex CLI/codex',
        model: 'gpt-5.6',
        reasoningEffort: 'high' as const,
        timeoutSeconds: 180,
        verbosity: 'medium' as const,
      },
      vllm: {
        ...DEFAULT_PRETTIFY_SETTINGS.vllm,
        baseUrl: 'https://models.example.com/v1',
        hasApiKey: true,
        model: 'remote-model',
      },
    };

    const merged = mergePrettifySettingsForStorage(
      current,
      {
        claudeCli: { model: ' claude-opus ' },
        codexCli: { timeoutSeconds: 300 },
      },
      true,
    );

    assert.deepEqual(merged.claudeCli, {
      executablePath: '/opt/Claude CLI/claude',
      model: 'claude-opus',
      fallbackModel: 'claude-haiku',
      effort: 'medium',
      timeoutSeconds: 240,
    });
    assert.deepEqual(merged.codexCli, {
      executablePath: '/opt/Codex CLI/codex',
      model: 'gpt-5.6',
      reasoningEffort: 'high',
      timeoutSeconds: 300,
      verbosity: 'medium',
    });
    assert.deepEqual(merged.vllm, {
      baseUrl: 'https://models.example.com/v1',
      model: 'remote-model',
      hasApiKey: true,
    });
  });
});
