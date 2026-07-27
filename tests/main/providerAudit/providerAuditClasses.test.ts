import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as providerAuditCore from '@main/providerAudit';
import { BaseProviderAudit, type ProviderAuditSink } from '@main/providerAudit';
import * as voiceAuditModule from '@main/providers/voiceProviderAudit';
import { VoiceProviderAudit } from '@main/providers/voiceProviderAudit';
import * as prettifyAuditModule from '@main/services/prettifyProviderAudit';
import { PrettifyProviderAudit } from '@main/services/prettifyProviderAudit';
import * as translationAuditModule from '@main/translateProviders/translationProviderAudit';
import { TranslationProviderAudit } from '@main/translateProviders/translationProviderAudit';
import { RecordingTranslationProviderAudit } from '../translateProviders/translationAuditTestUtils';

function createCapture() {
  const serializedEvents: string[] = [];
  const sink: ProviderAuditSink = {
    info: (_label, serialized) => serializedEvents.push(serialized as string),
    warn: (_label, serialized) => serializedEvents.push(serialized as string),
    error: (_label, serialized) => serializedEvents.push(serialized as string),
  };
  return { serializedEvents, sink };
}

describe('provider audit class hierarchy', () => {
  it('binds every concrete family class to its exhaustive provider mapping', () => {
    const voice = new VoiceProviderAudit();
    const prettify = new PrettifyProviderAudit();
    const translation = new TranslationProviderAudit();

    assert.equal(voice instanceof BaseProviderAudit, true);
    assert.equal(prettify instanceof BaseProviderAudit, true);
    assert.equal(translation instanceof BaseProviderAudit, true);
    assert.equal(voice.family, 'voice');
    assert.equal(prettify.family, 'prettify');
    assert.equal(translation.family, 'translation');

    assert.deepEqual(
      ['chatgpt', 'openai-api', 'claude-web'].map((providerId) => voice.isKnownProviderId(providerId)),
      [true, true, true],
    );
    assert.deepEqual(
      ['ollama', 'vllm', 'claude-cli', 'codex-cli'].map((providerId) => prettify.isKnownProviderId(providerId)),
      [true, true, true, true],
    );
    assert.deepEqual(
      ['google', 'bing', 'yandex'].map((providerId) => translation.isKnownProviderId(providerId)),
      [true, true, true],
    );

    for (const audit of [voice, prettify, translation]) {
      assert.equal(audit.isKnownProviderId('private-provider-canary'), false);
      assert.equal(audit.isKnownProviderId(''), false);
      assert.equal(audit.isKnownProviderId(null), false);
    }
  });

  it('sanitizes unknown identifiers through a concrete family class', () => {
    const canary = 'https://private.invalid/account?token=provider-private-canary';
    const capture = createCapture();
    const audit = new TranslationProviderAudit({
      getSink: () => capture.sink,
      now: () => new Date('2026-07-26T12:00:00.000Z'),
      randomUUID: () => '00000000-0000-4000-8000-000000000001',
    });

    const context = audit.startOperation(canary, 'settings-readiness', 'validation');
    context.lifecycle.terminal(
      'validation',
      'failure',
      audit.createMetadata(
        {
          attemptCount: 0,
          durationMs: 0,
          phase: 'validation',
        },
        { causeCode: 'unsupportedProvider' },
      ),
    );

    const records = capture.serializedEvents.map((serialized) => JSON.parse(serialized) as Record<string, unknown>);
    assert.equal(capture.serializedEvents.join('').includes(canary), false);
    assert.equal(records.length, 3);
    assert.equal(
      records.every((record) => record.providerKnown === false),
      true,
    );
    assert.equal(
      records.every((record) => record.providerId === undefined),
      true,
    );
  });

  it('owns Translation operation defaults and recorder state per audit instance', () => {
    const first = new RecordingTranslationProviderAudit();
    const second = new RecordingTranslationProviderAudit();

    const context = first.startTranslate('google', { attemptCount: 1 });
    context.lifecycle.terminal('result', 'success', { resultLength: 12 });

    assert.equal(first.operations.length, 1);
    assert.equal(first.operations[0]?.input.operation, 'translate');
    assert.deepEqual(
      first.operations[0]?.events.map((event) => [event.event, event.phase]),
      [
        ['started', 'dispatch'],
        ['phase-entered', 'validation'],
        ['terminal', 'result'],
      ],
    );
    assert.deepEqual(second.events, []);
    assert.deepEqual(second.operations, []);
  });

  it('keeps the Prettify audit adapter inert until a lifecycle is explicitly requested', () => {
    const capture = createCapture();

    const audit = new PrettifyProviderAudit({
      getSink: () => capture.sink,
    });

    assert.equal(audit.family, 'prettify');
    assert.deepEqual(capture.serializedEvents, []);
  });

  it('does not expose obsolete function factories or family helper functions', () => {
    const coreExports = providerAuditCore as Record<string, unknown>;
    const voiceExports = voiceAuditModule as Record<string, unknown>;
    const translationExports = translationAuditModule as Record<string, unknown>;
    const prettifyExports = prettifyAuditModule as Record<string, unknown>;

    assert.equal(coreExports.createProviderAuditLifecycle, undefined);
    for (const obsoleteExport of [
      'VoiceAuditLifecycleFactory',
      'defaultVoiceProviderAuditLifecycleFactory',
      'createVoiceProviderAuditMetadata',
      'createVoiceBatchAuditContext',
      'terminalVoiceAuditException',
      'terminalVoiceBatchAudit',
    ]) {
      assert.equal(voiceExports[obsoleteExport], undefined);
    }
    for (const obsoleteExport of [
      'TranslationProviderAuditLifecycleFactory',
      'defaultTranslationProviderAuditLifecycleFactory',
      'makeTranslationProviderAuditLifecycleFailOpen',
      'createTranslationProviderAuditLifecycleSafely',
      'toProviderAuditPhase',
      'getTranslationProviderAuditErrorClass',
      'createTranslationProviderAuditMetadata',
      'getTranslationProviderAuditTerminalOutcome',
    ]) {
      assert.equal(translationExports[obsoleteExport], undefined);
    }
    assert.deepEqual(Object.keys(prettifyExports).sort(), ['PrettifyProviderAudit', 'prettifyProviderAudit']);
  });
});
