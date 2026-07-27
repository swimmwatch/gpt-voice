/* eslint-disable max-classes-per-file -- focused fail-open lifecycle subclasses share one adapter suite. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ProviderAuditLifecycle } from '@main/providerAudit';
import { VoiceProviderAudit } from '@main/providers/voiceProviderAudit';
import type { StreamingTranscriptionOperationId } from '@shared/streamingTranscription';

class ThrowingVoiceProviderAudit extends VoiceProviderAudit {
  protected override buildLifecycle(): ProviderAuditLifecycle<'voice'> {
    throw new Error('private exception https://private.invalid /home/private stack-private');
  }
}

class InjectedLifecycleVoiceProviderAudit extends VoiceProviderAudit {
  public constructor(private readonly injectedLifecycle: ProviderAuditLifecycle<'voice'>) {
    super();
  }

  protected override buildLifecycle(): ProviderAuditLifecycle<'voice'> {
    return this.injectedLifecycle;
  }
}

describe('Voice provider audit adapter', () => {
  it('maps expected and unexpected Voice causes to central severity classes', () => {
    const audit = new VoiceProviderAudit();

    assert.equal(audit.getErrorClass('not-configured'), 'configuration');
    assert.equal(audit.getErrorClass('not-authenticated'), 'authentication');
    assert.equal(audit.getErrorClass('rate-limited'), 'rate-limit');
    assert.equal(audit.getErrorClass('connection-failed'), 'connection');
    assert.equal(audit.getErrorClass('request-failed'), 'provider-rejection');
    assert.equal(audit.getErrorClass('provider-contract-changed'), 'contract');
    assert.equal(audit.getErrorClass('cleanup-failed'), 'cleanup');
    assert.equal(audit.getErrorClass('invalid-chunk'), 'provider-rejection');
    assert.equal(audit.getErrorClass('operation-conflict'), 'provider-rejection');
    assert.equal(audit.getErrorClass('provider-changed'), 'provider-rejection');
    assert.equal(audit.getErrorClass('transport-failure'), 'connection');
    assert.equal(audit.getErrorClass('unknown'), 'internal');
    assert.equal(audit.getErrorClass('connection-failed', 'TypeError'), 'internal');
    assert.equal(audit.getStreamingFailurePhase('invalid-sequence'), 'validation');
    assert.equal(audit.getStreamingFailurePhase('session-expired'), 'readiness');
    assert.equal(audit.getStreamingFailurePhase('page-shutdown'), 'context');
    assert.equal(audit.getStreamingFailurePhase('provider-changed'), 'dispatch');
    assert.equal(audit.getStreamingFailurePhase('transport-failure'), 'result');
  });

  it('owns streaming correlation, counters, duration, exception normalization, and terminal suppression', () => {
    const records: Array<Record<string, unknown>> = [];
    const levels: string[] = [];
    let elapsedMs = 100;
    const operationId = '11111111-2222-4333-8444-000000000004';
    const audit = new VoiceProviderAudit({
      elapsedNow: () => elapsedMs,
      getSink: () => ({
        error: (_label, serialized) => {
          levels.push('error');
          records.push(JSON.parse(serialized as string) as Record<string, unknown>);
        },
        info: (_label, serialized) => {
          levels.push('info');
          records.push(JSON.parse(serialized as string) as Record<string, unknown>);
        },
        warn: (_label, serialized) => {
          levels.push('warn');
          records.push(JSON.parse(serialized as string) as Record<string, unknown>);
        },
      }),
      now: () => new Date('2026-07-26T00:00:00.000Z'),
    });

    const context = audit.startStreaming('claude-web', operationId as StreamingTranscriptionOperationId);
    elapsedMs = 125;
    context.lifecycle.phaseEntered(
      'streaming',
      audit.createStreamingMetadata(context, {
        acceptedByteCount: 0,
        chunkCount: 0,
        frameCount: 0,
      }),
    );
    elapsedMs = 175;
    audit.terminalStreamingFailure(
      context,
      {
        acceptedByteCount: 8_194,
        chunkCount: 3,
        frameCount: 2,
      },
      'unexpected-failure',
      audit.getExceptionType(new TypeError('private message and stack')),
    );
    context.lifecycle.phaseEntered('cleanup');
    audit.terminalStreaming(context, { acceptedByteCount: 0, chunkCount: 0, frameCount: 0 }, 'cleanup', 'success');

    assert.deepEqual(levels, ['info', 'info', 'info', 'error']);
    assert.equal(
      records.every((record) => record.operationId === operationId && record.operation === 'transcribe-stream'),
      true,
    );
    assert.deepEqual(
      records.map((record) => record.sequence),
      [1, 2, 3, 4],
    );
    assert.deepEqual(records[records.length - 1], {
      schemaVersion: 1,
      occurredAt: '2026-07-26T00:00:00.000Z',
      family: 'voice',
      providerId: 'claude-web',
      operation: 'transcribe-stream',
      operationId,
      sequence: 4,
      event: 'terminal',
      phase: 'result',
      outcome: 'failure',
      acceptedByteCount: 8_194,
      chunkCount: 3,
      durationMs: 75,
      frameCount: 2,
      causeCode: 'unexpected-failure',
      errorClass: 'internal',
      exceptionType: 'TypeError',
      transcriptionMode: 'streaming',
    });
  });

  it('emits expected failures at warn and contract failures at error', () => {
    const levels: string[] = [];
    let operationNumber = 0;
    const audit = new VoiceProviderAudit({
      elapsedNow: () => 0,
      getSink: () => ({
        error: () => levels.push('error'),
        info: () => levels.push('info'),
        warn: () => levels.push('warn'),
      }),
      now: () => new Date('2026-07-26T00:00:00.000Z'),
      randomUUID: () => {
        operationNumber += 1;
        return `11111111-2222-4333-8444-${String(operationNumber).padStart(12, '0')}`;
      },
    });

    const expected = audit.startOperation('openai-api', 'settings-readiness', 'configuration');
    expected.lifecycle.terminal('configuration', 'failure', audit.createMetadata({ causeCode: 'not-configured' }));
    const contract = audit.startOperation('openai-api', 'transcribe-batch', 'result');
    contract.lifecycle.terminal('result', 'failure', audit.createMetadata({ causeCode: 'provider-contract-changed' }));

    assert.deepEqual(levels, ['info', 'info', 'warn', 'info', 'info', 'error']);
  });

  it('swallows lifecycle construction and invocation failures without exposing exception details', () => {
    const privacyCanary = 'private exception https://private.invalid /home/private stack-private';
    const lifecycle = new ThrowingVoiceProviderAudit().createLifecycle('chatgpt', 'transcribe-batch');

    assert.doesNotThrow(() => {
      lifecycle.started();
      lifecycle.phaseEntered('submission');
      lifecycle.terminal('result', 'success');
    });

    const audit = new InjectedLifecycleVoiceProviderAudit({
      started: () => undefined,
      phaseEntered: () => undefined,
      phaseCompleted: () => undefined,
      retry: () => undefined,
      recovery: () => undefined,
      terminal: () => {
        throw new Error(privacyCanary);
      },
    });
    const context = audit.startOperation('chatgpt', 'transcribe-batch', 'dispatch');
    assert.doesNotThrow(() => audit.terminalException(context, 'result', new TypeError(privacyCanary)));
  });

  it('enforces one terminal and suppresses all later lifecycle calls around injected seams', () => {
    const calls: string[] = [];
    const audit = new InjectedLifecycleVoiceProviderAudit({
      started: () => calls.push('started'),
      phaseEntered: () => calls.push('phase-entered'),
      phaseCompleted: () => calls.push('phase-completed'),
      retry: () => calls.push('retry'),
      recovery: () => calls.push('recovery'),
      terminal: () => calls.push('terminal'),
    });
    const lifecycle = audit.createLifecycle('chatgpt', 'transcribe-batch');

    lifecycle.started();
    lifecycle.terminal('result', 'success');
    lifecycle.phaseEntered('cleanup');
    lifecycle.retry('recovery');
    lifecycle.terminal('cleanup', 'failure');

    assert.deepEqual(calls, ['started', 'terminal']);
  });
});
