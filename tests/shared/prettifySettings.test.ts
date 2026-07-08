import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OLLAMA_PRETTIFY_BASE_URL,
  DEFAULT_PRETTIFY_REASONING,
  DEFAULT_PRETTIFY_SETTINGS,
  DEFAULT_VLLM_PRETTIFY_BASE_URL,
  isPrettifyProviderId,
  isPrettifyReasoning,
  normalizePrettifySettings,
} from '@shared/prettifySettings';

describe('prettifySettings', () => {
  it('recognizes supported reasoning values', () => {
    assert.equal(isPrettifyReasoning('instant'), true);
    assert.equal(isPrettifyReasoning('standard'), true);
    assert.equal(isPrettifyReasoning('extended'), true);
    assert.equal(isPrettifyReasoning('slow'), false);
    assert.equal(isPrettifyReasoning(null), false);
  });

  it('recognizes supported provider values', () => {
    assert.equal(isPrettifyProviderId('ollama'), true);
    assert.equal(isPrettifyProviderId('vllm'), true);
    assert.equal(isPrettifyProviderId('chatgpt'), false);
    assert.equal(isPrettifyProviderId(null), false);
  });

  it('normalizes missing or invalid settings to defaults', () => {
    assert.deepEqual(normalizePrettifySettings(), DEFAULT_PRETTIFY_SETTINGS);
    assert.deepEqual(normalizePrettifySettings({ prompt: '   ', reasoning: 'slow' }), DEFAULT_PRETTIFY_SETTINGS);
  });

  it('updates the previous built-in prompt to the current default', () => {
    assert.equal(
      normalizePrettifySettings({
        prompt:
          'Improve the selected text. Correct grammar errors, remove repetitions and unnecessary words, make the text clearer and neater, and preserve the original meaning. Do not add new facts. Do not significantly change the style unless necessary. Return only the improved text, without explanations or markdown.',
      }).prompt,
      DEFAULT_PRETTIFY_SETTINGS.prompt,
    );
  });

  it('trims custom prompt/provider settings and ignores old reasoning', () => {
    assert.deepEqual(
      normalizePrettifySettings({
        prompt: '  Improve this  ',
        reasoning: 'extended',
        providerId: 'vllm',
        temperature: 0.336,
        ollama: { baseUrl: ' http://localhost:11434/ ', model: ' llama3.2 ' },
        vllm: { baseUrl: ' http://localhost:8000/v1/ ', model: ' Qwen ', hasApiKey: true },
      }),
      {
        ...DEFAULT_PRETTIFY_SETTINGS,
        providerId: 'vllm',
        prompt: 'Improve this',
        temperature: 0.34,
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'llama3.2',
        },
        vllm: {
          baseUrl: 'http://localhost:8000/v1',
          model: 'Qwen',
          hasApiKey: true,
        },
      },
    );
  });

  it('keeps legacy reasoning helpers available without affecting normalized settings', () => {
    assert.equal(DEFAULT_PRETTIFY_REASONING, 'instant');
    assert.deepEqual(normalizePrettifySettings({ reasoning: 'extended' }), {
      ...DEFAULT_PRETTIFY_SETTINGS,
      ollama: {
        baseUrl: DEFAULT_OLLAMA_PRETTIFY_BASE_URL,
        model: '',
      },
      vllm: {
        baseUrl: DEFAULT_VLLM_PRETTIFY_BASE_URL,
        model: '',
        hasApiKey: false,
      },
    });
  });
});
