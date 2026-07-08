import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIApiVoiceProvider } from '@main/providers/OpenAIApiVoiceProvider';
import { DEFAULT_OPENAI_API_SETTINGS } from '@main/providers/openaiApiSettingsUtils';
import {
  buildOpenAIResponsesPrettifyRequestBody,
  isUnsupportedOpenAIReasoningResponse,
} from '@main/providers/openaiResponsesUtils';

function response(status: number, body: unknown) {
  return {
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('openaiResponsesUtils', () => {
  it('includes reasoning for the default gpt-5.4-mini prettify model', () => {
    assert.deepEqual(
      buildOpenAIResponsesPrettifyRequestBody({
        model: 'gpt-5.4-mini',
        prompt: 'Improve text',
        input: 'bad text',
        reasoning: 'instant',
      }),
      {
        model: 'gpt-5.4-mini',
        instructions: 'Improve text',
        input: 'bad text',
        reasoning: {
          effort: 'none',
        },
      },
    );
  });

  it('omits reasoning for unknown or non-reasoning model ids', () => {
    assert.deepEqual(
      buildOpenAIResponsesPrettifyRequestBody({
        model: 'gpt-4o-mini',
        prompt: 'Improve text',
        input: 'bad text',
        reasoning: 'extended',
      }),
      {
        model: 'gpt-4o-mini',
        instructions: 'Improve text',
        input: 'bad text',
      },
    );
  });

  it('detects unsupported reasoning responses without matching unrelated 400s', () => {
    assert.equal(
      isUnsupportedOpenAIReasoningResponse(
        400,
        JSON.stringify({ error: { message: "Unsupported value: 'reasoning.effort' does not support 'none'" } }),
      ),
      true,
    );
    assert.equal(isUnsupportedOpenAIReasoningResponse(400, JSON.stringify({ error: { message: 'bad input' } })), false);
    assert.equal(
      isUnsupportedOpenAIReasoningResponse(
        500,
        JSON.stringify({ error: { message: "Unsupported value: 'reasoning.effort'" } }),
      ),
      false,
    );
  });

  it('retries OpenAI API prettify once without reasoning when reasoning is unsupported', async () => {
    const abortController = new AbortController();
    const requests: Array<Record<string, unknown>> = [];
    const signals: Array<AbortSignal | null> = [];
    const provider = new OpenAIApiVoiceProvider({
      getSettings: () => ({
        ...DEFAULT_OPENAI_API_SETTINGS,
        apiKey: 'test-key',
        prettifyModel: 'gpt-5.4-mini',
      }),
      fetch: async (_url, init) => {
        requests.push(JSON.parse(String(init.body)));
        signals.push(init.signal instanceof AbortSignal ? init.signal : null);
        if (requests.length === 1) {
          return response(400, {
            error: {
              message: "Unsupported value: 'reasoning.effort' does not support 'none'",
            },
          });
        }
        return response(200, { output_text: 'Improved text' });
      },
    });

    const result = await provider.prettifyText('bad text', {
      prompt: 'Improve text',
      reasoning: 'instant',
      signal: abortController.signal,
    });

    assert.deepEqual(result, { success: true, text: 'Improved text' });
    assert.equal(requests.length, 2);
    assert.deepEqual(signals, [abortController.signal, abortController.signal]);
    assert.deepEqual(requests[0]?.reasoning, { effort: 'none' });
    const retryRequest = requests[1];
    assert.ok(retryRequest);
    assert.equal('reasoning' in retryRequest, false);
  });

  it('does not retry OpenAI API prettify for non-reasoning API errors', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const provider = new OpenAIApiVoiceProvider({
      getSettings: () => ({
        ...DEFAULT_OPENAI_API_SETTINGS,
        apiKey: 'test-key',
        prettifyModel: 'gpt-5.4-mini',
      }),
      fetch: async (_url, init) => {
        requests.push(JSON.parse(String(init.body)));
        return response(400, { error: { message: 'Prompt is too long' } });
      },
    });

    const result = await provider.prettifyText('bad text', {
      prompt: 'Improve text',
      reasoning: 'instant',
    });

    assert.equal(result.success, false);
    assert.equal(result.error, 'Prompt is too long');
    assert.equal(requests.length, 1);
  });

  it('does not apply ChatGPT Web cooldown handling to OpenAI API prettify failures', async () => {
    const provider = new OpenAIApiVoiceProvider({
      getSettings: () => ({
        ...DEFAULT_OPENAI_API_SETTINGS,
        apiKey: 'test-key',
        prettifyModel: 'gpt-5.4-mini',
      }),
      fetch: async () => response(429, { error: { message: 'OpenAI API rate limit' } }),
    });

    const result = await provider.prettifyText('bad text', {
      prompt: 'Improve text',
      reasoning: 'instant',
    });

    assert.deepEqual(result, { success: false, error: 'OpenAI API rate limit' });
  });

  it('returns a cancelled result without calling OpenAI when the prettify signal is already aborted', async () => {
    let fetchCalled = false;
    const abortController = new AbortController();
    abortController.abort();
    const provider = new OpenAIApiVoiceProvider({
      getSettings: () => ({
        ...DEFAULT_OPENAI_API_SETTINGS,
        apiKey: 'test-key',
        prettifyModel: 'gpt-5.4-mini',
      }),
      fetch: async () => {
        fetchCalled = true;
        return response(200, { output_text: 'Improved text' });
      },
    });

    const result = await provider.prettifyText('bad text', {
      prompt: 'Improve text',
      reasoning: 'instant',
      signal: abortController.signal,
    });

    assert.deepEqual(result, { success: false, error: 'Prettify cancelled' });
    assert.equal(fetchCalled, false);
  });
});
