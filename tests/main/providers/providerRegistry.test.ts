import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BatchVoiceProvider,
  ClaudeWebVoiceProvider,
  StreamingVoiceProvider,
  copyStreamingTranscriptionChunk,
  isBatchVoiceProvider,
  isStreamingVoiceProvider,
  VoiceProviderAudit,
} from '@main/providers';
import { CLAUDE_WEB_PROVIDER_ID, DEFAULT_CLAUDE_WEB_LANGUAGE } from '@shared/claudeWebSettings';
import {
  isRendererSafeVoiceProviderInfo,
  isStreamingVoiceProviderInfo,
  isVoiceTranscriptionMode,
} from '@shared/voiceProvider';
import { PROVIDER_AUDIT_PROVIDER_MAPPINGS } from '@main/providerAudit/mappings';
import type { ProviderAuditLifecycle } from '@main/providerAudit';
import { RecordingVoiceProviderAudit, getTerminalEvents } from './voiceAuditTestUtils';
import { VoiceProviderRegistryFixture } from './voiceProviderRegistryFixture';
import { TEST_PROVIDER_AUDIT_DEPENDENCIES } from '../providerAudit/providerAuditTestDependencies';

class ThrowingVoiceProviderAudit extends VoiceProviderAudit {
  public constructor() {
    super(TEST_PROVIDER_AUDIT_DEPENDENCIES);
  }

  protected override buildLifecycle(): ProviderAuditLifecycle<'voice'> {
    throw new Error('synthetic audit failure');
  }
}

describe('provider registry', () => {
  it('exposes each provider once with stable metadata', () => {
    const fixture = new VoiceProviderRegistryFixture();
    const providers = fixture.registry.getAvailableProviders();
    const repeatedProviders = fixture.registry.getAvailableProviders();

    assert.deepEqual(providers, [
      {
        id: 'chatgpt',
        name: 'ChatGPT Web',
        authType: 'browserSession',
        category: 'web',
        hasSettings: true,
        transcriptionMode: 'batch',
      },
      {
        id: 'openai-api',
        name: 'OpenAI API',
        authType: 'apiKey',
        category: 'api',
        hasSettings: true,
        transcriptionMode: 'batch',
      },
      {
        id: CLAUDE_WEB_PROVIDER_ID,
        name: 'Claude Web',
        authType: 'browserSession',
        category: 'web',
        hasSettings: true,
        transcriptionMode: 'streaming',
      },
    ]);
    assert.equal(providers.filter((provider) => provider.id === CLAUDE_WEB_PROVIDER_ID).length, 1);
    assert.deepEqual(
      providers.map((provider) => provider.id),
      Object.keys(PROVIDER_AUDIT_PROVIDER_MAPPINGS.voice),
    );
    assert.equal((fixture.audit as RecordingVoiceProviderAudit).operations.length, 0);
    assert.equal(
      providers.every((provider) => Object.isFrozen(provider)),
      true,
    );
    assert.equal(
      providers.every((provider, index) => provider === repeatedProviders[index]),
      true,
    );
  });

  it('creates providers matching readiness semantics', () => {
    const registry = new VoiceProviderRegistryFixture().registry;
    const chatgpt = registry.createProvider('chatgpt');
    const openaiApi = registry.createProvider('openai-api');
    const claudeWeb = registry.createProvider(CLAUDE_WEB_PROVIDER_ID);

    assert.equal(chatgpt.requiresBrowserSession(), true);
    assert.equal(openaiApi.requiresBrowserSession(), false);
    assert.equal(claudeWeb.requiresBrowserSession(), true);
    assert.equal(chatgpt instanceof BatchVoiceProvider, true);
    assert.equal(openaiApi instanceof BatchVoiceProvider, true);
    assert.equal(claudeWeb instanceof StreamingVoiceProvider, true);
    assert.equal(isBatchVoiceProvider(chatgpt), true);
    assert.equal(isBatchVoiceProvider(openaiApi), true);
    assert.equal(isBatchVoiceProvider(claudeWeb), false);
    assert.equal(isStreamingVoiceProvider(chatgpt), false);
    assert.equal(isStreamingVoiceProvider(openaiApi), false);
    assert.equal(isStreamingVoiceProvider(claudeWeb), true);
    assert.equal(claudeWeb.isReady(), false);
    assert.equal(claudeWeb.getAccessToken(), '');
    assert.equal(claudeWeb.getLoginUrl(), 'https://claude.ai');
    assert.equal(DEFAULT_CLAUDE_WEB_LANGUAGE, 'en-US');
  });

  it('creates fresh provider instances without sharing state', () => {
    const registry = new VoiceProviderRegistryFixture().registry;
    const first = registry.createProvider(CLAUDE_WEB_PROVIDER_ID);
    const second = registry.createProvider(CLAUDE_WEB_PROVIDER_ID);

    assert.equal(first instanceof ClaudeWebVoiceProvider, true);
    assert.equal(second instanceof ClaudeWebVoiceProvider, true);
    assert.notEqual(first, second);
  });

  it('keeps two registry graphs isolated', () => {
    const first = new VoiceProviderRegistryFixture();
    const second = new VoiceProviderRegistryFixture();

    first.registry.createProvider('chatgpt');

    assert.notEqual(first.registry, second.registry);
    assert.notEqual(first.factory, second.factory);
    assert.notEqual(first.audit, second.audit);
    assert.equal((first.audit as RecordingVoiceProviderAudit).operations.length, 1);
    assert.equal((second.audit as RecordingVoiceProviderAudit).operations.length, 0);
  });

  it('rejects unknown providers explicitly', () => {
    for (const providerId of ['missing-provider', '__proto__']) {
      const audit = new RecordingVoiceProviderAudit();
      const registry = new VoiceProviderRegistryFixture(audit).registry;
      assert.throws(() => registry.createProvider(providerId), {
        message: `Unknown voice provider: ${providerId}`,
      });
      assert.equal(audit.operations.length, 1);
      assert.equal(
        'providerKnown' in audit.operations[0].input && audit.operations[0].input.providerKnown === false,
        true,
      );
      assert.deepEqual(
        getTerminalEvents(audit.operations[0]).map((event) => event.outcome),
        ['failure'],
      );
      assert.equal(getTerminalEvents(audit.operations[0])[0]?.metadata?.causeCode, 'not-configured');
    }
  });

  it('emits one initialize lifecycle for explicit provider creation', () => {
    const audit = new RecordingVoiceProviderAudit();
    const provider = new VoiceProviderRegistryFixture(audit).registry.createProvider('openai-api');

    assert.equal(provider.info.id, 'openai-api');
    assert.equal(audit.operations.length, 1);
    assert.equal(audit.operations[0].input.operation, 'initialize');
    assert.deepEqual(
      getTerminalEvents(audit.operations[0]).map((event) => event.outcome),
      ['success'],
    );
  });

  it('omits an unknown provider privacy canary from captured audit logger arguments', () => {
    const privacyCanary = 'unknown-provider-private https://private.invalid /home/private token=private';
    const captured: unknown[][] = [];
    const sink = {
      error: (...args: unknown[]) => captured.push(args),
      info: (...args: unknown[]) => captured.push(args),
      warn: (...args: unknown[]) => captured.push(args),
    };
    const audit = new VoiceProviderAudit({
      elapsedNow: () => 0,
      getSink: () => sink,
      now: () => new Date('2026-07-26T00:00:00.000Z'),
      randomUUID: () => '11111111-2222-4333-8444-555555555555',
    });
    const registry = new VoiceProviderRegistryFixture(audit).registry;

    assert.throws(() => registry.createProvider(privacyCanary), {
      message: `Unknown voice provider: ${privacyCanary}`,
    });
    const serialized = JSON.stringify(captured);
    assert.doesNotMatch(serialized, /unknown-provider-private|private\.invalid|\/home\/private|token=/u);
    assert.equal(
      captured.some((args) => args.some((argument) => String(argument).includes('"providerKnown":false'))),
      true,
    );
  });

  it('keeps provider creation fail open when audit construction throws', () => {
    const provider = new VoiceProviderRegistryFixture(new ThrowingVoiceProviderAudit()).registry.createProvider(
      'chatgpt',
    );
    assert.equal(provider.info.id, 'chatgpt');
  });

  it('fails closed for unknown modes and non-renderer metadata', () => {
    const streamingInfo = new VoiceProviderRegistryFixture().registry
      .getAvailableProviders()
      .find((provider) => provider.id === CLAUDE_WEB_PROVIDER_ID);

    assert.ok(streamingInfo);
    assert.equal(isVoiceTranscriptionMode('batch'), true);
    assert.equal(isVoiceTranscriptionMode('streaming'), true);
    assert.equal(isVoiceTranscriptionMode('realtime'), false);
    assert.equal(isStreamingVoiceProviderInfo(streamingInfo), true);
    assert.equal(isRendererSafeVoiceProviderInfo({ ...streamingInfo, transcriptionMode: 'realtime' }), false);
    assert.equal(
      isRendererSafeVoiceProviderInfo({
        ...streamingInfo,
        accessToken: 'must-not-cross-renderer-boundary',
      }),
      false,
    );
  });

  it('copies streaming PCM chunks before provider ownership', () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const copied = copyStreamingTranscriptionChunk(source);
    assert.notEqual(copied.buffer, source.buffer);
    source[0] = 99;
    assert.deepEqual(copied, new Uint8Array([1, 2, 3, 4]));
  });
});
