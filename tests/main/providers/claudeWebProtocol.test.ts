import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLAUDE_WEB_CLOSE_STREAM_CONTROL,
  CLAUDE_WEB_KEEP_ALIVE_CONTROL,
  CLAUDE_WEB_SPEECH_ENDPOINT,
  CLAUDE_WEB_SPEECH_PROTOCOL_VERSION,
  ClaudeWebProtocolError,
  applyClaudeWebTranscriptEvent,
  buildClaudeWebSpeechUrl,
  createClaudeWebTranscriptState,
  parseClaudeWebSpeechEvent,
  serializeClaudeWebClientControl,
  type ClaudeWebProtocolErrorCode,
  type ClaudeWebSpeechEvent,
} from '@main/providers/claudeWebProtocol';

const SYNTHETIC_ORGANIZATION_UUID = '11111111-2222-3333-4444-555555555555';

function assertProtocolError(action: () => unknown, code: ClaudeWebProtocolErrorCode): void {
  assert.throws(action, (error: unknown) => error instanceof ClaudeWebProtocolError && error.code === code);
}

describe('Claude Web speech query', () => {
  it('builds the exact versioned private endpoint contract with canonical transient inputs', () => {
    const value = buildClaudeWebSpeechUrl({
      language: 'EN-us',
      organizationUuid: SYNTHETIC_ORGANIZATION_UUID.toUpperCase(),
    });
    const url = new URL(value);

    assert.equal(CLAUDE_WEB_SPEECH_PROTOCOL_VERSION, 1);
    assert.equal(`${url.origin}${url.pathname}`, CLAUDE_WEB_SPEECH_ENDPOINT);
    assert.deepEqual(Array.from(url.searchParams.entries()), [
      ['encoding', 'linear16'],
      ['sample_rate', '16000'],
      ['channels', '1'],
      ['endpointing_ms', '300'],
      ['utterance_end_ms', '1000'],
      ['language', 'en-US'],
      ['use_conversation_engine', 'true'],
      ['stt_provider', 'deepgram-nova3'],
      ['client_platform', 'web_claude_ai'],
      ['organization_uuid', SYNTHETIC_ORGANIZATION_UUID],
    ]);
    assert.equal(url.searchParams.has('conversation_uuid'), false);
    assert.equal(url.searchParams.has('forward_interims'), false);
  });

  it('rejects invalid language and organization values before constructing a URL', () => {
    assertProtocolError(
      () => buildClaudeWebSpeechUrl({ language: 'not_a_locale', organizationUuid: SYNTHETIC_ORGANIZATION_UUID }),
      'invalid-language',
    );
    assertProtocolError(
      () => buildClaudeWebSpeechUrl({ language: 'en-US', organizationUuid: '../not-an-organization' }),
      'invalid-organization-uuid',
    );
  });
});

describe('Claude Web client controls', () => {
  it('models and serializes only the verified KeepAlive and CloseStream controls', () => {
    assert.deepEqual(CLAUDE_WEB_KEEP_ALIVE_CONTROL, { type: 'KeepAlive' });
    assert.deepEqual(CLAUDE_WEB_CLOSE_STREAM_CONTROL, { type: 'CloseStream' });
    assert.equal(serializeClaudeWebClientControl(CLAUDE_WEB_KEEP_ALIVE_CONTROL), '{"type":"KeepAlive"}');
    assert.equal(serializeClaudeWebClientControl(CLAUDE_WEB_CLOSE_STREAM_CONTROL), '{"type":"CloseStream"}');
  });
});

describe('Claude Web server events', () => {
  it('parses every known event variant with the required data shape', () => {
    assert.deepEqual(parseClaudeWebSpeechEvent('{"type":"TranscriptText","data":"synthetic text"}'), {
      status: 'known',
      event: { type: 'TranscriptText', data: 'synthetic text' },
    });
    assert.deepEqual(parseClaudeWebSpeechEvent('{"type":"TranscriptInterim","data":"synthetic interim"}'), {
      status: 'known',
      event: { type: 'TranscriptInterim', data: 'synthetic interim' },
    });
    assert.deepEqual(parseClaudeWebSpeechEvent('{"type":"TranscriptEndpoint"}'), {
      status: 'known',
      event: { type: 'TranscriptEndpoint' },
    });
  });

  it('classifies unknown events using type and length metadata without retaining their data', () => {
    const payload = '{"type":"ProviderNotice","data":"synthetic private body"}';
    const result = parseClaudeWebSpeechEvent(payload);

    assert.deepEqual(result, {
      status: 'unknown',
      metadata: {
        eventType: 'ProviderNotice',
        payloadLength: payload.length,
        dataLength: 'synthetic private body'.length,
      },
    });
    assert.equal(JSON.stringify(result).includes('synthetic private body'), false);
  });

  it('classifies malformed JSON and known types with invalid data without retaining raw bodies', () => {
    const invalidJson = '{not-json';
    const invalidText = '{"type":"TranscriptText","data":7}';
    const endpointWithData = '{"type":"TranscriptEndpoint","data":"synthetic private body"}';

    assert.deepEqual(parseClaudeWebSpeechEvent(invalidJson), {
      status: 'malformed',
      metadata: { eventType: null, payloadLength: invalidJson.length, dataLength: null },
    });
    assert.deepEqual(parseClaudeWebSpeechEvent(invalidText), {
      status: 'malformed',
      metadata: { eventType: 'TranscriptText', payloadLength: invalidText.length, dataLength: null },
    });
    const endpointResult = parseClaudeWebSpeechEvent(endpointWithData);
    assert.deepEqual(endpointResult, {
      status: 'malformed',
      metadata: {
        eventType: 'TranscriptEndpoint',
        payloadLength: endpointWithData.length,
        dataLength: 'synthetic private body'.length,
      },
    });
    assert.equal(JSON.stringify(endpointResult).includes('synthetic private body'), false);
  });
});

describe('Claude Web cumulative transcripts', () => {
  it('replaces cumulative snapshots and commits one final value without duplication', () => {
    const events: ClaudeWebSpeechEvent[] = [
      { type: 'TranscriptInterim', data: 'synthetic' },
      { type: 'TranscriptText', data: 'synthetic final' },
      { type: 'TranscriptText', data: 'synthetic final' },
      { type: 'TranscriptEndpoint' },
      { type: 'TranscriptEndpoint' },
      { type: 'TranscriptInterim', data: 'synthetic final' },
      { type: 'TranscriptEndpoint' },
    ];
    let state = createClaudeWebTranscriptState();
    const commits: string[] = [];

    for (const event of events) {
      const update = applyClaudeWebTranscriptEvent(state, event);
      state = update.state;
      if (update.committedText !== null) commits.push(update.committedText);
    }

    assert.deepEqual(commits, ['synthetic final']);
    assert.deepEqual(state, {
      currentTranscript: 'synthetic final',
      finalTranscript: 'synthetic final',
    });
  });

  it('does not commit an endpoint before a nonempty transcript snapshot', () => {
    const update = applyClaudeWebTranscriptEvent(createClaudeWebTranscriptState(), {
      type: 'TranscriptEndpoint',
    });

    assert.equal(update.committedText, null);
    assert.deepEqual(update.state, createClaudeWebTranscriptState());
  });
});
