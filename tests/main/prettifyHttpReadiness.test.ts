/* eslint-disable max-classes-per-file -- deterministic clock and graph fixture own isolated readiness state. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProviderAuditSink } from '@main/providerAudit';
import type { PrettifyFetch, PrettifyFetchResponse } from '@main/services/prettifyProviderBase';
import {
  PRETTIFY_HTTP_MAX_JSON_NESTING_LEVELS,
  PRETTIFY_HTTP_MAX_MODEL_NAME_BYTES,
  PRETTIFY_HTTP_MAX_MODEL_OBJECTS,
  PRETTIFY_HTTP_MAX_MODEL_PROPERTIES,
} from '@main/services/prettifyHttpModelContracts';
import {
  PRETTIFY_HTTP_MAX_RESPONSE_BYTES,
  PRETTIFY_HTTP_READINESS_TIMEOUT_MS,
  PrettifyHttpReadiness,
  type PrettifyHttpReadinessClock,
} from '@main/services/prettifyHttpReadiness';
import { PrettifyProviderAudit } from '@main/services/prettifyProviderAudit';
import { RecordingPrettifyProviderAudit, getTerminalEvents } from './prettifyAuditTestUtils';
import { TEST_PROVIDER_AUDIT_DEPENDENCIES } from './providerAudit/providerAuditTestDependencies';
import { PrettifyRuntimeFixture } from './prettifyRuntimeTestUtils';

interface ScheduledTask {
  readonly callback: () => void;
  readonly dueAt: number;
}

class ManualPrettifyHttpReadinessClock implements PrettifyHttpReadinessClock {
  private nextId = 1;
  private nowMs = 0;
  private readonly tasks = new Map<number, ScheduledTask>();

  public clearTimeout(handle: unknown): void {
    if (typeof handle === 'number') this.tasks.delete(handle);
  }

  public now(): number {
    return this.nowMs;
  }

  public setTimeout(callback: () => void, delayMs: number): unknown {
    const id = this.nextId;
    this.nextId += 1;
    this.tasks.set(id, { callback, dueAt: this.nowMs + delayMs });
    return id;
  }

  public advanceBy(durationMs: number): void {
    const target = this.nowMs + durationMs;
    while (true) {
      const next = [...this.tasks.entries()]
        .filter(([, task]) => task.dueAt <= target)
        .sort((left, right) => left[1].dueAt - right[1].dueAt)[0];
      if (!next) break;
      const [id, task] = next;
      this.tasks.delete(id);
      this.nowMs = task.dueAt;
      task.callback();
    }
    this.nowMs = target;
  }

  public elapseBy(durationMs: number): void {
    this.nowMs += durationMs;
  }
}

class PrettifyHttpReadinessFixture {
  public abortCount = 0;
  public readonly audit: RecordingPrettifyProviderAudit;
  public readonly clock: ManualPrettifyHttpReadinessClock;
  public readonly readiness: PrettifyHttpReadiness;

  public constructor(
    fetch: PrettifyFetch,
    options: {
      readonly audit?: RecordingPrettifyProviderAudit;
      readonly clock?: ManualPrettifyHttpReadinessClock;
    } = {},
  ) {
    this.audit = options.audit ?? new RecordingPrettifyProviderAudit();
    this.clock = options.clock ?? new ManualPrettifyHttpReadinessClock();
    this.readiness = new PrettifyHttpReadiness({
      audit: this.audit,
      clock: this.clock,
      createAbortController: () => {
        const controller = new AbortController();
        controller.signal.addEventListener(
          'abort',
          () => {
            this.abortCount += 1;
          },
          { once: true },
        );
        return controller;
      },
      fetch,
    });
  }
}

function byteStream(bytes: Uint8Array, chunkSize = bytes.byteLength || 1): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
        controller.enqueue(bytes.slice(offset, Math.min(offset + chunkSize, bytes.byteLength)));
      }
      controller.close();
    },
  });
}

function streamResponse(
  status: number,
  body: unknown,
  options: { readonly chunkSize?: number; readonly rawBytes?: Uint8Array } = {},
): PrettifyFetchResponse {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const bytes = options.rawBytes ?? new TextEncoder().encode(text);
  return {
    body: byteStream(bytes, options.chunkSize),
    status,
    text: async () => text,
  };
}

function getOnlyTerminal(audit: RecordingPrettifyProviderAudit) {
  assert.equal(audit.operations.length, 1);
  const terminalEvents = getTerminalEvents(audit.operations[0]);
  assert.equal(terminalEvents.length, 1);
  return terminalEvents[0];
}

function createSizedVllmContract(byteLength: number): string {
  const prefix = '{"data":[],"padding":"';
  const suffix = '"}';
  assert.ok(byteLength >= prefix.length + suffix.length);
  return `${prefix}${'x'.repeat(byteLength - prefix.length - suffix.length)}${suffix}`;
}

function createNestedValue(containerDepth: number): unknown {
  let value: unknown = 'leaf';
  for (let index = 0; index < containerDepth; index += 1) value = { nested: value };
  return value;
}

describe('Prettify HTTP readiness deadline', () => {
  it('settles a fetch that ignores abort at one absolute deadline and aborts once', async () => {
    const fixture = new PrettifyHttpReadinessFixture(() => new Promise(() => undefined));
    const resultPromise = fixture.readiness.checkAvailability({
      baseUrl: 'http://deadline.invalid',
      providerId: 'vllm',
      signal: new AbortController().signal,
    });

    fixture.clock.advanceBy(PRETTIFY_HTTP_READINESS_TIMEOUT_MS);
    assert.deepEqual(await resultPromise, { status: 'unavailable' });
    assert.equal(fixture.clock.now(), PRETTIFY_HTTP_READINESS_TIMEOUT_MS);
    assert.equal(fixture.abortCount, 1);
    assert.equal(getOnlyTerminal(fixture.audit).metadata?.causeCode, 'timed-out');

    const settledEventCount = fixture.audit.events.length;
    fixture.clock.advanceBy(PRETTIFY_HTTP_READINESS_TIMEOUT_MS);
    assert.equal(fixture.abortCount, 1);
    assert.equal(fixture.audit.events.length, settledEventCount);
  });

  it('keeps caller cancellation distinct from native abort rejection and timeout', async () => {
    const caller = new AbortController();
    const fixture = new PrettifyHttpReadinessFixture(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('private abort detail')), { once: true });
        }),
    );
    const resultPromise = fixture.readiness.checkAvailability({
      baseUrl: 'http://caller.invalid',
      providerId: 'ollama',
      signal: caller.signal,
    });

    caller.abort();
    assert.deepEqual(await resultPromise, { status: 'unavailable' });
    assert.equal(fixture.abortCount, 1);
    const terminal = getOnlyTerminal(fixture.audit);
    assert.equal(terminal.outcome, 'cancelled');
    assert.equal(terminal.metadata?.causeCode, 'cancelled');
  });

  it('suppresses a response that completes after timeout', async () => {
    let resolveFetch: ((response: PrettifyFetchResponse) => void) | undefined;
    const fixture = new PrettifyHttpReadinessFixture(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const resultPromise = fixture.readiness.listModels({
      baseUrl: 'http://late.invalid',
      providerId: 'vllm',
    });

    fixture.clock.advanceBy(PRETTIFY_HTTP_READINESS_TIMEOUT_MS);
    const result = await resultPromise;
    const eventSnapshot = structuredClone(fixture.audit.events);
    resolveFetch?.(streamResponse(200, { data: [{ id: 'late-private-model' }] }));
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(result, { availability: { status: 'unavailable' }, models: [], source: 'http' });
    assert.deepEqual(fixture.audit.events, eventSnapshot);
    assert.equal(JSON.stringify(fixture.audit.events).includes('late-private-model'), false);
  });

  it('uses only the remaining deadline for Ollama subsidiary discovery', async () => {
    const clock = new ManualPrettifyHttpReadinessClock();
    const calls: string[] = [];
    const fixture = new PrettifyHttpReadinessFixture(
      async (url) => {
        calls.push(url);
        if (url.endsWith('/api/tags')) {
          clock.elapseBy(7_000);
          return streamResponse(200, { models: [{ model: 'bounded-model' }] });
        }
        return new Promise(() => undefined);
      },
      { clock },
    );
    const resultPromise = fixture.readiness.listModels({
      baseUrl: 'http://remaining.invalid',
      providerId: 'ollama',
    });

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    assert.equal(
      calls.some((url) => url.endsWith('/api/ps')),
      true,
    );
    clock.advanceBy(3_000);

    assert.deepEqual(await resultPromise, {
      availability: { status: 'unavailable' },
      models: [],
      source: 'http',
    });
    assert.equal(clock.now(), PRETTIFY_HTTP_READINESS_TIMEOUT_MS);
    assert.equal(fixture.abortCount, 1);
    assert.equal(getOnlyTerminal(fixture.audit).metadata?.causeCode, 'timed-out');
  });
});

describe('Prettify HTTP readiness response contracts', () => {
  it('streams readiness bodies without using unbounded whole-body helpers', async () => {
    let textCalls = 0;
    const fixture = new PrettifyHttpReadinessFixture(async () => ({
      body: byteStream(new TextEncoder().encode('{"data":[]}')),
      status: 200,
      text: async () => {
        textCalls += 1;
        throw new Error('unbounded-read-private-canary');
      },
    }));

    assert.deepEqual(
      await fixture.readiness.checkAvailability({
        baseUrl: 'http://stream-only.invalid',
        providerId: 'vllm',
        signal: new AbortController().signal,
      }),
      { status: 'available' },
    );
    assert.equal(textCalls, 0);
  });

  it('accepts the exact response-byte limit and rejects the next byte', async () => {
    const exactBody = createSizedVllmContract(PRETTIFY_HTTP_MAX_RESPONSE_BYTES);
    const exact = new PrettifyHttpReadinessFixture(async () => streamResponse(200, exactBody));
    assert.deepEqual(
      await exact.readiness.checkAvailability({
        baseUrl: 'http://bytes.invalid',
        providerId: 'vllm',
        signal: new AbortController().signal,
      }),
      { status: 'available' },
    );

    const overBody = `${exactBody} `;
    const over = new PrettifyHttpReadinessFixture(async () => streamResponse(200, overBody));
    assert.deepEqual(
      await over.readiness.checkAvailability({
        baseUrl: 'http://bytes.invalid',
        providerId: 'vllm',
        signal: new AbortController().signal,
      }),
      { status: 'unavailable' },
    );
    assert.equal(getOnlyTerminal(over.audit).metadata?.causeCode, 'unexpected-response');
  });

  it('accepts exact model, property, nesting, and multibyte-name limits', async () => {
    const exactName = 'é'.repeat(PRETTIFY_HTTP_MAX_MODEL_NAME_BYTES / 2);
    const exactProperties = Object.fromEntries(
      Array.from({ length: PRETTIFY_HTTP_MAX_MODEL_PROPERTIES - 2 }, (_, index) => [`property${index}`, index]),
    );
    const fixture = new PrettifyHttpReadinessFixture(async () =>
      streamResponse(200, {
        data: Array.from({ length: PRETTIFY_HTTP_MAX_MODEL_OBJECTS }, (_, index) =>
          index === 0
            ? {
                id: exactName,
                nesting: createNestedValue(PRETTIFY_HTTP_MAX_JSON_NESTING_LEVELS - 3),
                ...exactProperties,
              }
            : { id: `model-${index}` },
        ),
      }),
    );

    const result = await fixture.readiness.listModels({
      baseUrl: 'http://limits.invalid',
      providerId: 'vllm',
    });
    assert.equal(result.availability.status, 'available');
    assert.equal(result.models.length, PRETTIFY_HTTP_MAX_MODEL_OBJECTS);
    assert.equal(result.models[0]?.id, exactName);
    assert.equal(getOnlyTerminal(fixture.audit).outcome, 'success');
  });

  it('rejects one-over model, property, nesting, and multibyte-name limits', async () => {
    const fixtures: unknown[] = [
      {
        data: Array.from({ length: PRETTIFY_HTTP_MAX_MODEL_OBJECTS + 1 }, (_, index) => ({ id: `model-${index}` })),
      },
      {
        data: [
          {
            id: 'model',
            ...Object.fromEntries(
              Array.from({ length: PRETTIFY_HTTP_MAX_MODEL_PROPERTIES }, (_, index) => [`property${index}`, index]),
            ),
          },
        ],
      },
      {
        data: [
          {
            id: 'model',
            nesting: createNestedValue(PRETTIFY_HTTP_MAX_JSON_NESTING_LEVELS - 2),
          },
        ],
      },
      { data: [{ id: 'é'.repeat(PRETTIFY_HTTP_MAX_MODEL_NAME_BYTES / 2 + 1) }] },
    ];

    for (const contract of fixtures) {
      const fixture = new PrettifyHttpReadinessFixture(async () => streamResponse(200, contract));
      assert.deepEqual(await fixture.readiness.listModels({ baseUrl: 'http://over.invalid', providerId: 'vllm' }), {
        availability: { status: 'unavailable' },
        models: [],
        source: 'http',
      });
      assert.equal(getOnlyTerminal(fixture.audit).metadata?.causeCode, 'unexpected-response');
    }
  });

  it('enforces the aggregate model-object limit across Ollama responses', async () => {
    const fixture = new PrettifyHttpReadinessFixture(async (url) =>
      url.endsWith('/api/tags')
        ? streamResponse(200, {
            models: Array.from({ length: PRETTIFY_HTTP_MAX_MODEL_OBJECTS }, (_, index) => ({
              model: `model-${index}`,
            })),
          })
        : streamResponse(200, { models: [{ model: 'one-over-subsidiary' }] }),
    );

    assert.deepEqual(
      await fixture.readiness.listModels({ baseUrl: 'http://aggregate.invalid', providerId: 'ollama' }),
      {
        availability: { status: 'unavailable' },
        models: [],
        source: 'http',
      },
    );
    assert.equal(getOnlyTerminal(fixture.audit).metadata?.causeCode, 'unexpected-response');
  });

  it('rejects invalid UTF-8, malformed JSON, wrong roots, fields, and missing streams', async () => {
    const invalidUtf8 = new Uint8Array([0xc3, 0x28]);
    const responses: PrettifyFetchResponse[] = [
      streamResponse(200, '', { rawBytes: invalidUtf8 }),
      streamResponse(200, '{"data":'),
      streamResponse(200, { models: [] }),
      streamResponse(200, { data: [{ id: 42 }] }),
      streamResponse(200, { data: [{ id: '' }] }),
      { body: null, status: 200, text: async () => '{"data":[]}' },
      { status: 200, text: async () => '{"data":[]}' },
    ];

    for (const response of responses) {
      const fixture = new PrettifyHttpReadinessFixture(async () => response);
      assert.deepEqual(
        await fixture.readiness.checkAvailability({
          baseUrl: 'http://malformed.invalid',
          providerId: 'vllm',
          signal: new AbortController().signal,
        }),
        { status: 'unavailable' },
      );
      assert.equal(getOnlyTerminal(fixture.audit).metadata?.causeCode, 'unexpected-response');
    }
  });

  it('classifies a throwing response stream without exposing its error', async () => {
    const privateError = 'response-stream-private-stack-canary';
    const response: PrettifyFetchResponse = {
      body: new ReadableStream<Uint8Array>({
        pull() {
          throw new Error(privateError);
        },
      }),
      status: 200,
      text: async () => privateError,
    };
    const fixture = new PrettifyHttpReadinessFixture(async () => response);

    const result = await fixture.readiness.listModels({
      baseUrl: 'http://stream.invalid',
      providerId: 'vllm',
    });
    assert.deepEqual(result, { availability: { status: 'unavailable' }, models: [], source: 'http' });
    assert.equal(getOnlyTerminal(fixture.audit).metadata?.causeCode, 'request-failed');
    assert.equal(JSON.stringify({ events: fixture.audit.events, result }).includes(privateError), false);
  });

  it('keeps audit event counts independent of response chunk count', async () => {
    const body = { data: [{ id: 'chunked-model' }] };
    const oneChunk = new PrettifyHttpReadinessFixture(async () => streamResponse(200, body));
    const manyChunks = new PrettifyHttpReadinessFixture(async () => streamResponse(200, body, { chunkSize: 1 }));

    await oneChunk.readiness.listModels({ baseUrl: 'http://chunks.invalid', providerId: 'vllm' });
    await manyChunks.readiness.listModels({ baseUrl: 'http://chunks.invalid', providerId: 'vllm' });
    assert.equal(oneChunk.audit.events.length, manyChunks.audit.events.length);
    assert.equal(getTerminalEvents(oneChunk.audit.operations[0]).length, 1);
    assert.equal(getTerminalEvents(manyChunks.audit.operations[0]).length, 1);
  });

  it('returns a closed safe runtime result for malformed HTTP 200 responses', async () => {
    const privateValues = {
      apiKey: 'api-key-private-canary',
      endpoint: 'http://localhost:8123/private-endpoint-canary',
      model: 'model-private-canary',
      rawError: 'raw-error-private-canary',
    };
    const audit = new RecordingPrettifyProviderAudit();
    const result = await new PrettifyRuntimeFixture({
      audit,
      fetch: async () =>
        streamResponse(200, {
          data: [{ id: privateValues.model, malformed: { too: createNestedValue(20) } }],
          rawError: privateValues.rawError,
        }),
    }).runtime.listModels('vllm', {
      providerId: 'vllm',
      vllm: { apiKey: privateValues.apiKey, baseUrl: privateValues.endpoint },
    });

    assert.deepEqual(result, {
      availability: { status: 'unavailable' },
      error: 'Prettify provider is unavailable.',
      models: [],
      providerId: 'vllm',
      source: 'http',
      success: false,
    });
    const serialized = JSON.stringify({ audit: audit.events, result });
    for (const value of Object.values(privateValues)) assert.equal(serialized.includes(value), false);
    assert.equal(getOnlyTerminal(audit).metadata?.causeCode, 'unexpected-response');
  });

  it('keeps readiness fail-open when the audit sink throws', async () => {
    const throwingSink: ProviderAuditSink = {
      error() {
        throw new Error('audit-sink-private-canary');
      },
      info() {
        throw new Error('audit-sink-private-canary');
      },
      warn() {
        throw new Error('audit-sink-private-canary');
      },
    };
    const audit = new PrettifyProviderAudit({
      ...TEST_PROVIDER_AUDIT_DEPENDENCIES,
      getSink: () => throwingSink,
    });
    const readiness = new PrettifyHttpReadiness({
      audit,
      clock: new ManualPrettifyHttpReadinessClock(),
      createAbortController: () => new AbortController(),
      fetch: async () => streamResponse(200, { data: [{ id: 'available-model' }] }),
    });

    assert.deepEqual(
      await readiness.checkAvailability({
        baseUrl: 'http://audit.invalid',
        providerId: 'vllm',
        signal: new AbortController().signal,
      }),
      { status: 'available' },
    );
  });
});
