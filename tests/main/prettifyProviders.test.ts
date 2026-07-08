import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listPrettifyModels, runPrettify } from '@main/services/prettifyProviders';
import { DEFAULT_PRETTIFY_PROMPT } from '@shared/prettifySettings';

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function response(status: number, body: unknown) {
  return {
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('prettifyProviders', () => {
  it('lists Ollama models from /api/tags', async () => {
    const calls: FetchCall[] = [];
    const models = await listPrettifyModels(
      'ollama',
      { providerId: 'ollama', ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' } },
      {
        fetch: async (url, init) => {
          calls.push({ url, init });
          return response(200, { models: [{ model: 'llama3.2' }, { name: 'mistral' }, { model: '' }] });
        },
      },
    );

    assert.deepEqual(models, [
      { id: 'llama3.2', name: 'llama3.2' },
      { id: 'mistral', name: 'mistral' },
    ]);
    assert.equal(calls[0]?.url, 'http://localhost:11434/api/tags');
  });

  it('prettifies through non-streaming Ollama /api/chat', async () => {
    const calls: FetchCall[] = [];
    const result = await runPrettify(
      'selected text',
      {
        providerId: 'ollama',
        prompt: 'Improve',
        temperature: 0.25,
        ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
      },
      undefined,
      {
        fetch: async (url, init) => {
          calls.push({ url, init });
          return response(200, { message: { content: ' improved text ' } });
        },
      },
    );

    assert.deepEqual(result, { success: true, text: 'improved text' });
    assert.equal(calls[0]?.url, 'http://localhost:11434/api/chat');
    assert.equal(calls[0]?.init?.method, 'POST');
    const body = JSON.parse(String(calls[0]?.init?.body));
    assert.equal(body.model, 'llama3.2');
    assert.equal(body.stream, false);
    assert.deepEqual(body.messages, [
      { role: 'system', content: 'Improve' },
      { role: 'user', content: 'selected text' },
    ]);
    assert.deepEqual(body.options, { temperature: 0.25 });
  });

  it('lists vLLM models from OpenAI-compatible /models with draft auth', async () => {
    const calls: FetchCall[] = [];
    const models = await listPrettifyModels(
      'vllm',
      {
        providerId: 'vllm',
        vllm: {
          baseUrl: 'http://localhost:8000/v1',
          model: 'qwen2.5',
          apiKey: 'secret',
        },
      },
      {
        fetch: async (url, init) => {
          calls.push({ url, init });
          return response(200, { data: [{ id: 'qwen2.5' }, { id: ' llama3 ' }] });
        },
      },
    );

    assert.deepEqual(models, [
      { id: 'qwen2.5', name: 'qwen2.5' },
      { id: 'llama3', name: 'llama3' },
    ]);
    assert.equal(calls[0]?.url, 'http://localhost:8000/v1/models');
    assert.equal((calls[0]?.init?.headers as Record<string, string>).Authorization, 'Bearer secret');
  });

  it('prettifies through vLLM /chat/completions and omits auth when no key is configured', async () => {
    const calls: FetchCall[] = [];
    const result = await runPrettify(
      'selected text',
      {
        providerId: 'vllm',
        prompt: DEFAULT_PRETTIFY_PROMPT,
        temperature: 0,
        vllm: {
          baseUrl: 'http://localhost:8000/v1',
          model: 'qwen2.5',
          hasApiKey: false,
        },
      },
      undefined,
      {
        fetch: async (url, init) => {
          calls.push({ url, init });
          return response(200, { choices: [{ message: { content: ' improved vllm text ' } }] });
        },
      },
    );

    assert.deepEqual(result, { success: true, text: 'improved vllm text' });
    assert.equal(calls[0]?.url, 'http://localhost:8000/v1/chat/completions');
    const headers = calls[0]?.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
    const body = JSON.parse(String(calls[0]?.init?.body));
    assert.equal(body.model, 'qwen2.5');
    assert.equal(body.temperature, 0);
    assert.equal(body.stream, false);
  });

  it('returns safe errors for non-200, invalid JSON, empty output, aborts, and network failures', async () => {
    const nonOk = await runPrettify(
      'text',
      { providerId: 'ollama', ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' } },
      undefined,
      { fetch: async () => response(500, 'server exploded with private body') },
    );
    assert.deepEqual(nonOk, { success: false, error: 'Ollama request failed (500)' });

    const invalidJson = await runPrettify(
      'text',
      { providerId: 'ollama', ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' } },
      undefined,
      { fetch: async () => response(200, '{') },
    );
    assert.deepEqual(invalidJson, { success: false, error: 'No prettified text in response' });

    const emptyOutput = await runPrettify(
      'text',
      { providerId: 'vllm', vllm: { baseUrl: 'http://localhost:8000/v1', model: 'qwen2.5' } },
      undefined,
      { fetch: async () => response(200, { choices: [{ message: { content: '   ' } }] }) },
    );
    assert.deepEqual(emptyOutput, { success: false, error: 'No prettified text in response' });

    const abortController = new AbortController();
    abortController.abort();
    const aborted = await runPrettify(
      'text',
      { providerId: 'ollama', ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' } },
      abortController.signal,
      {
        fetch: async () => {
          throw new Error('aborted');
        },
      },
    );
    assert.deepEqual(aborted, { success: false, error: 'Prettify cancelled' });

    const networkFailure = await runPrettify(
      'text',
      { providerId: 'vllm', vllm: { baseUrl: 'http://localhost:8000/v1', model: 'qwen2.5' } },
      undefined,
      {
        fetch: async () => {
          throw new TypeError('fetch failed');
        },
      },
    );
    assert.deepEqual(networkFailure, {
      success: false,
      error: 'Failed to connect to vLLM at http://localhost:8000/v1: fetch failed',
    });
  });
});
