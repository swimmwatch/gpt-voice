/* eslint-disable max-classes-per-file -- the family audit and its state-owning Voice harness share one core suite. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PROVIDER_AUDIT_LABEL,
  PROVIDER_AUDIT_METADATA_KEYS,
  normalizeProviderAuditExceptionType,
  type ProviderAuditFamily,
} from '@main/providerAudit/contracts';
import {
  BaseProviderAudit,
  deriveProviderAuditSeverity,
  type ProviderAuditDependencies,
  type ProviderAuditSink,
} from '@main/providerAudit/providerAudit';
import { TEST_PROVIDER_AUDIT_DEPENDENCIES } from './providerAuditTestDependencies';

const GENERATED_OPERATION_ID = '123e4567-e89b-42d3-a456-426614174000';
const STREAMING_OPERATION_ID = '4c4d8c57-0b93-4f26-a405-a1dd5e253e39';
const OCCURRED_AT = '2026-07-26T12:34:56.789Z';

interface CapturedAuditCall {
  readonly args: readonly unknown[];
  readonly severity: 'info' | 'warn' | 'error';
}

function createCapture(): {
  readonly calls: CapturedAuditCall[];
  readonly sink: ProviderAuditSink;
} {
  const calls: CapturedAuditCall[] = [];
  return {
    calls,
    sink: {
      info: (...args) => calls.push({ args, severity: 'info' }),
      warn: (...args) => calls.push({ args, severity: 'warn' }),
      error: (...args) => calls.push({ args, severity: 'error' }),
    },
  };
}

function createDependencies(sink: ProviderAuditSink | null | undefined): ProviderAuditDependencies {
  return {
    elapsedNow: () => 0,
    getSink: () => sink,
    now: () => new Date(OCCURRED_AT),
    randomUUID: () => GENERATED_OPERATION_ID,
  };
}

class TestProviderAudit<Family extends ProviderAuditFamily> extends BaseProviderAudit<Family> {
  public constructor(
    public readonly family: Family,
    dependencies: Partial<ProviderAuditDependencies> = {},
  ) {
    super({ ...TEST_PROVIDER_AUDIT_DEPENDENCIES, ...dependencies });
  }
}

class VoiceProviderAuditTestHarness {
  public readonly capture = createCapture();
  public readonly lifecycle = new TestProviderAudit('voice', createDependencies(this.capture.sink)).createLifecycle(
    'chatgpt',
    'transcribe-batch',
  );
}

function parseAuditCall(call: CapturedAuditCall): Record<string, unknown> {
  assert.deepEqual(call.args.slice(0, 1), [PROVIDER_AUDIT_LABEL]);
  assert.equal(call.args.length, 2);
  assert.equal(typeof call.args[1], 'string');
  return JSON.parse(call.args[1] as string) as Record<string, unknown>;
}

describe('provider audit lifecycle', () => {
  it('serializes canonical schema-v1 events with monotonic sequence and one terminal event', () => {
    const { capture, lifecycle } = new VoiceProviderAuditTestHarness();

    lifecycle.phaseEntered('submission');
    lifecycle.started({ hasMimeType: true, attemptCount: 0 });
    lifecycle.started();
    lifecycle.phaseEntered('submission', { inputByteLength: 4 });
    lifecycle.phaseCompleted('submission', { durationMs: 2.5 });
    lifecycle.retry('recovery', {
      attemptCount: 1,
      causeCode: 'connection-failed',
      errorClass: 'connection',
      retryScheduled: true,
    });
    lifecycle.recovery('recovery', { recoveryScheduled: true });
    lifecycle.terminal('result', 'success', { resultLength: 12 });
    lifecycle.phaseEntered('cleanup');
    lifecycle.terminal('cleanup', 'failure', { errorClass: 'cleanup' });

    assert.equal(capture.calls.length, 6);
    assert.deepEqual(
      capture.calls.map((call) => call.severity),
      ['info', 'info', 'info', 'info', 'info', 'info'],
    );
    assert.deepEqual(
      capture.calls.map((call) => parseAuditCall(call).sequence),
      [1, 2, 3, 4, 5, 6],
    );

    const firstSerialized = capture.calls[0].args[1];
    assert.equal(
      firstSerialized,
      `{"schemaVersion":1,"occurredAt":"${OCCURRED_AT}","family":"voice","providerId":"chatgpt","operation":"transcribe-batch","operationId":"${GENERATED_OPERATION_ID}","sequence":1,"event":"started","phase":"dispatch","outcome":"in-progress","attemptCount":0,"hasMimeType":true}`,
    );
    assert.equal((firstSerialized as string).includes('\n'), false);
    assert.equal((firstSerialized as string).includes('\r'), false);

    const terminal = parseAuditCall(capture.calls[capture.calls.length - 1]);
    assert.equal(terminal.event, 'terminal');
    assert.equal(terminal.outcome, 'success');
    assert.equal(terminal.phase, 'result');
    assert.equal(terminal.resultLength, 12);
  });

  it('accepts a validated opaque streaming ID and removes an unknown provider value', () => {
    const rawUnknownProvider = 'private-provider-value-must-not-appear';
    const capture = createCapture();
    const lifecycle = new TestProviderAudit('translation', createDependencies(capture.sink)).createLifecycle(
      rawUnknownProvider,
      'translate',
      STREAMING_OPERATION_ID,
    );

    lifecycle.started();
    lifecycle.terminal('validation', 'failure', {
      causeCode: 'unsupportedProvider',
      errorClass: 'validation',
      providerKnown: true,
    });

    assert.equal(capture.calls.length, 2);
    assert.deepEqual(
      capture.calls.map((call) => call.severity),
      ['info', 'warn'],
    );
    for (const call of capture.calls) {
      const serialized = call.args[1] as string;
      const record = parseAuditCall(call);
      assert.equal(serialized.includes(rawUnknownProvider), false);
      assert.equal('providerId' in record, false);
      assert.equal(record.providerKnown, false);
      assert.equal(record.operationId, STREAMING_OPERATION_ID);
    }
  });

  it('accepts every approved optional metadata field', () => {
    const { capture, lifecycle } = new VoiceProviderAuditTestHarness();
    const metadata = {
      acceptedByteCount: 0,
      activityState: 'Idle',
      artifactKind: 'runtime',
      artifactRevision: 'runtime-v1',
      attemptCount: 1,
      backend: 'cpu',
      byteCount: 2,
      capabilityState: 'Validated',
      causeCode: 'request-failed',
      chunkCount: 2,
      contractVersion: '2026-07-25',
      discarded: false,
      durationMs: 3.5,
      engineId: 'whisperCpp',
      errorClass: 'provider-rejection',
      exceptionType: 'Error',
      failureCode: 'RUNTIME_MISSING',
      frameCount: 4,
      hasFilePath: false,
      hasMessage: true,
      hasMimeType: true,
      hasStackTrace: false,
      hasUrl: false,
      httpStatus: 503,
      inputByteLength: 5,
      modelConfigured: true,
      modelFamily: 'base',
      modelNameLength: 6,
      modelSource: 'http',
      pageClosed: false,
      postSubmission: true,
      providerKnown: true,
      recoveryScheduled: false,
      residencyState: 'Unloaded',
      resultLength: 7,
      retryScheduled: true,
      runtimeRevision: 'runtime-v1',
      setupState: 'Installed',
      sourceLength: 8,
      supportTier: 'Production',
      target: 'cpu',
      targetLanguage: 'en',
      transcriptionMode: 'batch',
      usesDefaultModel: false,
      wasSanitized: true,
    } as const;

    lifecycle.started(metadata);

    assert.equal(capture.calls.length, 1);
    const record = parseAuditCall(capture.calls[0]);
    assert.deepEqual(Object.fromEntries(PROVIDER_AUDIT_METADATA_KEYS.map((key) => [key, record[key]])), metadata);
  });

  it('rejects unknown, prohibited, and incorrectly typed metadata without raw fallback', () => {
    const numericKeys = [
      'acceptedByteCount',
      'attemptCount',
      'byteCount',
      'chunkCount',
      'durationMs',
      'frameCount',
      'httpStatus',
      'inputByteLength',
      'modelNameLength',
      'resultLength',
      'sourceLength',
    ] as const;
    const booleanKeys = [
      'discarded',
      'hasFilePath',
      'hasMessage',
      'hasMimeType',
      'hasStackTrace',
      'hasUrl',
      'modelConfigured',
      'pageClosed',
      'postSubmission',
      'providerKnown',
      'recoveryScheduled',
      'retryScheduled',
      'usesDefaultModel',
      'wasSanitized',
    ] as const;
    const invalidMetadata: unknown[] = [
      { unknownKey: 'private-unknown-value' },
      { causeCode: 'unsupportedProvider' },
      { contractVersion: 'private-contract-version' },
      { errorClass: 'private-error-class' },
      { exceptionType: 'PrivateError' },
      { modelSource: 'private-model-source' },
      { activityState: 'private-state' },
      { artifactKind: 'private-kind' },
      { artifactRevision: '/private/runtime' },
      { backend: 'private-backend' },
      { capabilityState: 'private-state' },
      { engineId: 'private-engine' },
      { failureCode: 'private-failure' },
      { modelFamily: 'private-model' },
      { residencyState: 'private-state' },
      { runtimeRevision: 'C:\\private\\runtime' },
      { setupState: 'private-state' },
      { supportTier: 'private-tier' },
      { target: 'private-target' },
      { targetLanguage: 'private-target-language' },
      { transcriptionMode: 'realtime' },
      new Error('private-error-message'),
      ['private-array-value'],
      { hasUrl: { url: 'https://private.invalid' } },
      ...numericKeys.flatMap((key) => [{ [key]: -1 }, { [key]: Number.NaN }, { [key]: Number.POSITIVE_INFINITY }]),
      ...booleanKeys.map((key) => ({ [key]: 'true' })),
    ];

    for (const metadata of invalidMetadata) {
      const { capture, lifecycle } = new VoiceProviderAuditTestHarness();
      lifecycle.started(metadata as never);
      assert.equal(capture.calls.length, 0);
    }
  });

  it('derives severity centrally for progress, expected failures, and unsafe failures', () => {
    const cases = [
      [{ event: 'started', outcome: 'in-progress' }, 'info'],
      [{ event: 'retry', outcome: 'in-progress', errorClass: 'connection' }, 'info'],
      [{ event: 'recovery', outcome: 'in-progress', errorClass: 'timeout' }, 'info'],
      [
        {
          event: 'recovery',
          outcome: 'in-progress',
          causeCode: 'diagnostic-storage-failed',
          errorClass: 'internal',
        },
        'warn',
      ],
      [{ event: 'terminal', outcome: 'success' }, 'info'],
      [{ event: 'terminal', outcome: 'cancelled', errorClass: 'cancellation' }, 'info'],
      [{ event: 'terminal', outcome: 'stale' }, 'info'],
      [{ event: 'terminal', outcome: 'failure', discarded: true }, 'info'],
      [{ event: 'terminal', outcome: 'failure', errorClass: 'validation' }, 'warn'],
      [{ event: 'terminal', outcome: 'failure', errorClass: 'configuration' }, 'warn'],
      [{ event: 'terminal', outcome: 'failure', errorClass: 'authentication' }, 'warn'],
      [{ event: 'terminal', outcome: 'failure', errorClass: 'provider-rejection' }, 'warn'],
      [{ event: 'terminal', outcome: 'failure', errorClass: 'rate-limit' }, 'warn'],
      [{ event: 'terminal', outcome: 'failure', errorClass: 'connection' }, 'warn'],
      [{ event: 'terminal', outcome: 'failure', errorClass: 'timeout' }, 'warn'],
      [
        {
          event: 'terminal',
          outcome: 'failure',
          causeCode: 'diagnostic-storage-failed',
        },
        'warn',
      ],
      [{ event: 'terminal', outcome: 'failure', exceptionType: 'TypeError' }, 'error'],
      [{ event: 'terminal', outcome: 'failure', errorClass: 'contract' }, 'error'],
      [{ event: 'terminal', outcome: 'failure', errorClass: 'internal' }, 'error'],
      [{ event: 'terminal', outcome: 'failure', errorClass: 'cleanup' }, 'error'],
    ] as const;

    for (const [event, severity] of cases) {
      assert.equal(deriveProviderAuditSeverity(event), severity);
    }
  });

  it('normalizes exception types without persisting provider-controlled names', () => {
    const providerControlled = new Error('private');
    providerControlled.name = 'PrivateProviderFailure';

    assert.equal(normalizeProviderAuditExceptionType(new Error()), 'Error');
    assert.equal(normalizeProviderAuditExceptionType(new TypeError()), 'TypeError');
    assert.equal(normalizeProviderAuditExceptionType(new SyntaxError()), 'SyntaxError');
    assert.equal(normalizeProviderAuditExceptionType(new RangeError()), 'RangeError');
    assert.equal(normalizeProviderAuditExceptionType(new DOMException('private', 'AbortError')), 'AbortError');
    assert.equal(normalizeProviderAuditExceptionType(new DOMException('private', 'TimeoutError')), 'TimeoutError');
    assert.equal(normalizeProviderAuditExceptionType(providerControlled), 'unknown');
    assert.equal(normalizeProviderAuditExceptionType({ name: 'TypeError' }), 'unknown');
  });

  it('remains fail-open when dependencies, clocks, metadata, or sinks fail', () => {
    const sinkCalls: string[] = [];
    const throwingSink: ProviderAuditSink = {
      info: () => {
        sinkCalls.push('info');
        throw new Error('private-sink-failure');
      },
      warn: () => {
        sinkCalls.push('warn');
        throw new Error('private-sink-failure');
      },
      error: () => {
        sinkCalls.push('error');
        throw new Error('private-sink-failure');
      },
    };
    const lifecycle = new TestProviderAudit('prettify', createDependencies(throwingSink)).createLifecycle(
      'ollama',
      'prettify',
    );
    const syntheticProviderCall = (): { readonly success: true } => {
      lifecycle.started();
      lifecycle.terminal('result', 'success');
      lifecycle.terminal('cleanup', 'failure', { errorClass: 'cleanup' });
      return { success: true };
    };

    assert.deepEqual(syntheticProviderCall(), { success: true });
    assert.deepEqual(sinkCalls, ['info', 'info']);

    assert.doesNotThrow(() => {
      const missingSinkLifecycle = new TestProviderAudit('voice', createDependencies(undefined)).createLifecycle(
        'chatgpt',
        'initialize',
      );
      missingSinkLifecycle.started();
      missingSinkLifecycle.terminal('readiness', 'success');
    });

    assert.doesNotThrow(() => {
      const unavailableLoggerLifecycle = new TestProviderAudit('translation', {
        elapsedNow: () => 0,
        getSink: () => {
          throw new Error('private-logger-lookup');
        },
        now: () => new Date(OCCURRED_AT),
        randomUUID: () => GENERATED_OPERATION_ID,
      }).createLifecycle('google', 'translate');
      unavailableLoggerLifecycle.started();
    });

    assert.doesNotThrow(() => {
      const invalidClockLifecycle = new TestProviderAudit('voice', {
        ...createDependencies(throwingSink),
        now: () => {
          throw new Error('private-clock-failure');
        },
      }).createLifecycle('chatgpt', 'initialize');
      invalidClockLifecycle.started();
    });

    assert.doesNotThrow(() => {
      const invalidIdLifecycle = new TestProviderAudit('voice', {
        ...createDependencies(throwingSink),
        randomUUID: () => {
          throw new Error('private-id-failure');
        },
      }).createLifecycle('chatgpt', 'initialize');
      invalidIdLifecycle.started();
    });

    assert.doesNotThrow(() => {
      const { lifecycle: proxyLifecycle } = new VoiceProviderAuditTestHarness();
      const metadata = new Proxy(
        {},
        {
          ownKeys: () => {
            throw new Error('private-metadata-failure');
          },
        },
      );
      proxyLifecycle.started(metadata);
    });
  });

  it('never emits prohibited privacy canaries as logger arguments', () => {
    const marker = 'PRIVATE_CANARY_9bc67e7a';
    const prohibitedKeys = [
      'apiKey',
      'token',
      'cookie',
      'session',
      'storage',
      'accountId',
      'organizationId',
      'audio',
      'selectedText',
      'prompt',
      'transcript',
      'translation',
      'prettifiedText',
      'modelOutput',
      'body',
      'stdout',
      'stderr',
      'cacheKey',
      'digest',
      'environment',
      'argv',
      'path',
      'url',
      'baseUrl',
      'message',
      'stack',
    ] as const;
    const allCapturedArguments: unknown[] = [];

    for (const key of prohibitedKeys) {
      const { capture, lifecycle } = new VoiceProviderAuditTestHarness();
      lifecycle.started({ [key]: marker });
      allCapturedArguments.push(...capture.calls.flatMap((call) => call.args));
    }

    const unknownCapture = createCapture();
    const unknownLifecycle = new TestProviderAudit('voice', createDependencies(unknownCapture.sink)).createLifecycle(
      marker,
      'settings-readiness',
    );
    unknownLifecycle.started();
    allCapturedArguments.push(...unknownCapture.calls.flatMap((call) => call.args));

    assert.equal(JSON.stringify(allCapturedArguments).includes(marker), false);
  });
});
