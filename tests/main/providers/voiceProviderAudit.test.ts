/* eslint-disable max-classes-per-file -- focused fail-open lifecycle subclasses share one adapter suite. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ProviderAuditLifecycle } from '@main/providerAudit';
import { VoiceProviderAudit } from '@main/providers/voiceProviderAudit';

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
    assert.equal(audit.getErrorClass('unknown'), 'internal');
    assert.equal(audit.getErrorClass('connection-failed', 'TypeError'), 'internal');
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
    expected.lifecycle.terminal(
      'configuration',
      'failure',
      audit.createMetadata({ causeCode: 'not-configured' }),
    );
    const contract = audit.startOperation('openai-api', 'transcribe-batch', 'result');
    contract.lifecycle.terminal(
      'result',
      'failure',
      audit.createMetadata({ causeCode: 'provider-contract-changed' }),
    );

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
