import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setLocale } from '@main/i18n';
import { processCompressedPrompt, type PromptCompressionDependencies } from '@main/services/promptCompression';
import type { CompressResult } from 'headroom-ai';

function compressResult(text: string, compressed = true): CompressResult {
  return {
    messages: [{ role: 'user', content: text }],
    tokensBefore: 100,
    tokensAfter: compressed ? 40 : 100,
    tokensSaved: compressed ? 60 : 0,
    compressionRatio: compressed ? 0.4 : 1,
    transformsApplied: compressed ? ['test'] : [],
    ccrHashes: [],
    compressed,
  };
}

function createDeps(options: { compressedText?: string; compressionError?: Error } = {}) {
  const compressCalls: Array<{
    messages: Array<{ role: 'user'; content: string }>;
    options: { timeout: number; fallback: boolean; retries: number; stack: string };
  }> = [];
  const deps: PromptCompressionDependencies = {
    compressMessages: async (messages, compressOptions) => {
      compressCalls.push({ messages, options: compressOptions });
      if (options.compressionError) {
        throw options.compressionError;
      }
      return compressResult(options.compressedText ?? 'compressed prompt');
    },
  };
  return { compressCalls, deps };
}

describe('promptCompression', () => {
  afterEach(() => {
    setLocale('en');
  });

  it('returns the prompt text produced by Headroom', async () => {
    const { compressCalls, deps } = createDeps({ compressedText: 'compressed prompt' });

    const result = await processCompressedPrompt('original prompt', undefined, deps);

    assert.deepEqual(result, { success: true, text: 'compressed prompt' });
    assert.deepEqual(compressCalls, [
      {
        messages: [{ role: 'user', content: 'original prompt' }],
        options: {
          timeout: 30000,
          fallback: false,
          retries: 1,
          stack: 'gpt-voice',
        },
      },
    ]);
  });

  it('returns an error when Headroom compression fails', async () => {
    const { deps } = createDeps({ compressionError: new Error('proxy unavailable') });

    const result = await processCompressedPrompt('original prompt', undefined, deps);

    assert.deepEqual(result, { success: false, error: 'proxy unavailable' });
  });

  it('returns an error when Headroom does not produce text', async () => {
    const { deps } = createDeps({ compressedText: '   ' });

    const result = await processCompressedPrompt('original prompt', undefined, deps);

    assert.deepEqual(result, { success: false, error: 'No compressed prompt in response' });
  });

  it('does not call Headroom when compression is already cancelled', async () => {
    const { compressCalls, deps } = createDeps();
    const controller = new AbortController();
    controller.abort();

    const result = await processCompressedPrompt('original prompt', controller.signal, deps);

    assert.deepEqual(result, { success: false, error: 'Prompt compression cancelled' });
    assert.deepEqual(compressCalls, []);
  });
});
