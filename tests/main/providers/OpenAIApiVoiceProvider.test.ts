import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { StatusCodes } from 'http-status-codes';
import { OpenAIApiVoiceProvider } from '@main/providers/OpenAIApiVoiceProvider';
import { DEFAULT_OPENAI_API_SETTINGS, type OpenAIApiSettingsWithSecret } from '@main/providers/openaiApiSettingsUtils';
import { createVoiceAuditRecorder, getTerminalEvents } from './voiceAuditTestUtils';

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

  it('sends the selected compatible model and language to OpenAI', async () => {
    const audit = createVoiceAuditRecorder();
    let request: RequestInit | undefined;
    const provider = new OpenAIApiVoiceProvider({
      audit: audit.audit,
      fetch: async (_url, init) => {
        request = init;
        return {
          status: Number(StatusCodes.BAD_REQUEST),
          text: async () => JSON.stringify({ error: { message: 'synthetic test response' } }),
        };
      },
      getSettings: () =>
        createSettings({
          language: 'de',
          model: 'gpt-4o-mini-transcribe',
          prompt: 'domain vocabulary',
          temperature: 0.25,
        }),
    });

    await provider.transcribe(new Uint8Array([1, 2, 3]).buffer, 'audio/wav');

    assert.ok(request?.body instanceof FormData);
    assert.equal(request.body.get('model'), 'gpt-4o-mini-transcribe');
    assert.equal(request.body.get('language'), 'de');
    assert.equal(request.body.get('prompt'), 'domain vocabulary');
    assert.equal(request.body.get('temperature'), '0.25');
    assert.equal(request.body.get('response_format'), 'json');
    assert.equal(audit.operations.length, 1);
    assert.equal(getTerminalEvents(audit.operations[0]).length, 1);
    assert.equal(getTerminalEvents(audit.operations[0])[0]?.metadata?.causeCode, 'request-failed');
  });

  it('audits configuration absence without retaining credential values', async () => {
    const audit = createVoiceAuditRecorder();
    const provider = new OpenAIApiVoiceProvider({
      audit: audit.audit,
      getSettings: () => createSettings({ apiKey: '' }),
    });

    const result = await provider.transcribe(new Uint8Array([1, 2]).buffer, 'audio/wav');

    assert.equal(result.success, false);
    const terminal = getTerminalEvents(audit.operations[0])[0];
    assert.equal(terminal?.metadata?.causeCode, 'not-configured');
    assert.equal(terminal?.metadata?.inputByteLength, 2);
    assert.doesNotMatch(JSON.stringify(audit.operations), /secret-api-key/u);
  });

  it('audits success with safe lengths and exactly one terminal', async () => {
    const audit = createVoiceAuditRecorder();
    const clipboard: string[] = [];
    const provider = new OpenAIApiVoiceProvider({
      audit: audit.audit,
      fetch: async () => ({
        status: Number(StatusCodes.OK),
        text: async () => JSON.stringify({ text: 'synthetic transcript' }),
      }),
      getSettings: () => createSettings(),
      writeClipboardText: (text) => clipboard.push(text),
    });

    const result = await provider.transcribe(new Uint8Array([3, 4, 5]).buffer, 'audio/webm');

    assert.deepEqual(result, { success: true, text: 'synthetic transcript' });
    assert.deepEqual(clipboard, ['synthetic transcript']);
    const terminal = getTerminalEvents(audit.operations[0]);
    assert.equal(terminal.length, 1);
    assert.equal(terminal[0]?.outcome, 'success');
    assert.equal(terminal[0]?.metadata?.resultLength, 'synthetic transcript'.length);
    assert.equal(terminal[0]?.metadata?.inputByteLength, 3);
  });

  it('distinguishes rate limits, malformed contracts, and empty results', async () => {
    const cases = [
      {
        body: JSON.stringify({ error: { message: 'private provider response' } }),
        causeCode: 'rate-limited',
        status: Number(StatusCodes.TOO_MANY_REQUESTS),
      },
      {
        body: 'private malformed response',
        causeCode: 'provider-contract-changed',
        status: Number(StatusCodes.OK),
      },
      {
        body: JSON.stringify({ text: '' }),
        causeCode: 'empty-result',
        status: Number(StatusCodes.OK),
      },
      {
        body: JSON.stringify({ error: { message: 'private unexpected response' } }),
        causeCode: 'unexpected-response',
        status: Number(StatusCodes.OK),
      },
    ] as const;

    for (const testCase of cases) {
      const audit = createVoiceAuditRecorder();
      const provider = new OpenAIApiVoiceProvider({
        audit: audit.audit,
        fetch: async () => ({
          status: testCase.status,
          text: async () => testCase.body,
        }),
        getSettings: () => createSettings(),
        writeClipboardText: () => undefined,
      });

      const result = await provider.transcribe(new Uint8Array([6]).buffer, 'audio/wav');

      assert.equal(result.success, false);
      assert.equal(getTerminalEvents(audit.operations[0])[0]?.metadata?.causeCode, testCase.causeCode);
      assert.doesNotMatch(
        JSON.stringify(audit.operations),
        /private provider response|private malformed response|private unexpected response/u,
      );
    }
  });

  it('normalizes transport exceptions and keeps request privacy canaries out of audit metadata', async () => {
    const canary = 'private-key private prompt https://private.invalid /home/private stack-private';
    const audit = createVoiceAuditRecorder();
    const provider = new OpenAIApiVoiceProvider({
      audit: audit.audit,
      fetch: async () => {
        throw new TypeError(canary);
      },
      getSettings: () => createSettings({ apiKey: canary, prompt: canary }),
    });

    await provider.transcribe(new Uint8Array([7, 8]).buffer, canary);

    const terminal = getTerminalEvents(audit.operations[0])[0];
    assert.equal(terminal?.metadata?.causeCode, 'connection-failed');
    assert.equal(terminal?.metadata?.exceptionType, 'TypeError');
    assert.doesNotMatch(
      JSON.stringify(audit.operations),
      /private-key|private prompt|private\.invalid|\/home\/private/u,
    );
  });
});
