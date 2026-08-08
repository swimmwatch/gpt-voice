import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ARTIFACT_CONNECTION_TIMEOUT_MS,
  ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS,
  ARTIFACT_MAX_ACTIVE_TRANSFERS,
  ARTIFACT_MAX_BUFFER_BYTES,
  ARTIFACT_MAX_REDIRECTS,
  ARTIFACT_MIN_DISK_MARGIN_BYTES,
  ARTIFACT_NO_PROGRESS_TIMEOUT_MS,
  ARTIFACT_TOTAL_TRANSFER_TIMEOUT_MS,
  LocalWhisperArtifactLifecycleError,
  type ArtifactClock,
  type ArtifactHttpClientResponse,
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import { ArtifactTransferJournalRepository } from '@main/localWhisper/artifacts/ArtifactTransferJournalRepository';
import { ArtifactHttpClientError } from '@main/localWhisper/artifacts/ArtifactHttpClientError';
import { CatalogHttpTransport } from '@main/localWhisper/artifacts/CatalogHttpTransport';
import {
  MemoryArtifactJournalStore,
  RecordingArtifactHttpClient,
  STRONG_ETAG,
  createArtifactCatalogFixture,
  createArtifactServiceHarness,
} from './artifactTestUtils';

interface Timer {
  readonly callback: () => void;
  readonly deadline: number;
  cancelled: boolean;
}

class ManualClock implements ArtifactClock {
  private current = 0;
  private readonly timers: Timer[] = [];

  public now(): number {
    return this.current;
  }

  public setTimeout(callback: () => void, delayMs: number): Timer {
    const timer = { callback, deadline: this.current + delayMs, cancelled: false };
    this.timers.push(timer);
    return timer;
  }

  public clearTimeout(handle: unknown): void {
    (handle as Timer).cancelled = true;
  }

  public advance(delayMs: number): void {
    this.current += delayMs;
    for (const timer of this.timers) {
      if (!timer.cancelled && timer.deadline <= this.current) {
        timer.cancelled = true;
        timer.callback();
      }
    }
  }

  public get activeTimerCount(): number {
    return this.timers.filter((timer) => !timer.cancelled).length;
  }
}

async function* emptyBody(): AsyncIterable<Uint8Array> {
  for (const chunk of [] as Uint8Array[]) yield chunk;
}

interface TrackedResponse {
  readonly response: ArtifactHttpClientResponse;
  readonly state: {
    disposeCalls: number;
  };
}

function trackedResponse(
  status: number,
  headers: ArtifactHttpClientResponse['headers'],
  body: AsyncIterable<Uint8Array> = emptyBody(),
): TrackedResponse {
  const state = { disposeCalls: 0 };
  return {
    response: {
      status,
      body,
      headers,
      dispose: async () => {
        state.disposeCalls += 1;
      },
    },
    state,
  };
}

interface PendingBodyState {
  iteratorStarts: number;
  nextCalls: number;
  returnCalls: number;
}

function pendingBody(state: PendingBodyState): AsyncIterable<Uint8Array> {
  let releaseRead: (() => void) | null = null;
  const read = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  return {
    [Symbol.asyncIterator]: () => {
      state.iteratorStarts += 1;
      return {
        next: async (): Promise<IteratorResult<Uint8Array>> => {
          state.nextCalls += 1;
          await read;
          return { done: true, value: undefined as never };
        },
        return: async (): Promise<IteratorResult<Uint8Array>> => {
          state.returnCalls += 1;
          releaseRead?.();
          return { done: true, value: undefined as never };
        },
      };
    },
  };
}

class CountingAbortSignal {
  private readonly listeners = new Set<EventListenerOrEventListenerObject>();
  public aborted = false;

  public addEventListener(_type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener) this.listeners.add(listener);
  }

  public removeEventListener(_type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener) this.listeners.delete(listener);
  }

  public abort(): void {
    if (this.aborted) return;
    this.aborted = true;
    const event = new Event('abort');
    for (const listener of this.listeners) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
    this.listeners.clear();
  }

  public get listenerCount(): number {
    return this.listeners.size;
  }
}

class FailingPostOpenJournalStore extends MemoryArtifactJournalStore {
  public override async write(
    artifactId: Parameters<MemoryArtifactJournalStore['write']>[0],
    value: unknown,
  ): Promise<void> {
    if (this.writes >= 1) throw new Error('simulated journal persistence failure');
    await super.write(artifactId, value);
  }
}

describe('Task 05 artifact infrastructure', () => {
  test('pins every non-user-editable operational bound', () => {
    assert.equal(ARTIFACT_CONNECTION_TIMEOUT_MS, 20_000);
    assert.equal(ARTIFACT_NO_PROGRESS_TIMEOUT_MS, 60_000);
    assert.equal(ARTIFACT_MAX_REDIRECTS, 5);
    assert.equal(ARTIFACT_TOTAL_TRANSFER_TIMEOUT_MS, 12 * 60 * 60 * 1_000);
    assert.equal(ARTIFACT_MAX_ACTIVE_TRANSFERS, 2);
    assert.equal(ARTIFACT_MAX_BUFFER_BYTES, 32 * 1024 * 1024);
    assert.equal(ARTIFACT_HELPER_CANCELLATION_TIMEOUT_MS, 5_000);
    assert.equal(ARTIFACT_MIN_DISK_MARGIN_BYTES, 512 * 1024 * 1024);
  });

  test('classifies only an exact strong-validator journal as resumable', async () => {
    const fixture = createArtifactCatalogFixture();
    const store = new MemoryArtifactJournalStore();
    const repository = new ArtifactTransferJournalRepository(store);
    let journal = await repository.create(fixture.model, 'journal-operation-00000000000001', 100);
    journal = await repository.update(journal, {
      receivedLength: 4,
      serverValidator: STRONG_ETAG,
      state: 'Downloading',
      updatedAtMs: 101,
    });
    const exact = await repository.classifyResume(fixture.model);
    assert.equal(exact.kind, 'resumable');

    store.values.set(fixture.model.artifactId, { ...journal, serverValidator: `W/${STRONG_ETAG}` });
    assert.deepEqual(await repository.classifyResume(fixture.model), {
      kind: 'invalid',
      safelyRemovable: false,
    });

    store.values.set(fixture.model.artifactId, { ...journal, expectedLength: journal.expectedLength + 1 });
    const changed = await repository.classifyResume(fixture.model);
    assert.equal(changed.kind, 'invalid');
    assert.equal(changed.safelyRemovable, true);
  });

  test('follows only bounded allowlisted HTTPS redirects', async () => {
    const fixture = createArtifactCatalogFixture();
    let calls = 0;
    const client = new RecordingArtifactHttpClient(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          status: 307,
          body: emptyBody(),
          headers: { contentLength: null, contentRange: null, etag: null, location: '/mirror/model' },
          dispose: async () => undefined,
        };
      }
      return {
        status: 200,
        body: (async function* (): AsyncIterable<Uint8Array> {
          yield new Uint8Array(fixture.model.expectedTransferSizeBytes);
        })(),
        headers: {
          contentLength: fixture.model.expectedTransferSizeBytes,
          contentRange: null,
          etag: STRONG_ETAG,
          location: null,
        },
        dispose: async () => undefined,
      };
    });
    const transport = new CatalogHttpTransport({ client, clock: new ManualClock() });
    const opened = await transport.open(fixture.model, null, new AbortController().signal);
    for await (const _chunk of opened.body) {
      // Drain the bounded response.
    }
    assert.equal(calls, 2);

    client.handler = async () => ({
      status: 302,
      body: emptyBody(),
      headers: {
        contentLength: null,
        contentRange: null,
        etag: null,
        location: 'http://local-whisper-fixtures.invalid/downgrade',
      },
      dispose: async () => undefined,
    });
    await assert.rejects(
      transport.open(fixture.model, null, new AbortController().signal),
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'UNSAFE_REDIRECT',
    );
  });

  test('transfers redirect ownership before opening again and disposes abandoned final streams once', async () => {
    const fixture = createArtifactCatalogFixture();
    const redirect = trackedResponse(307, {
      contentLength: null,
      contentRange: null,
      etag: null,
      location: '/mirror/model',
    });
    const finalBodyState: PendingBodyState = { iteratorStarts: 0, nextCalls: 0, returnCalls: 0 };
    const final = trackedResponse(
      200,
      {
        contentLength: fixture.model.expectedTransferSizeBytes,
        contentRange: null,
        etag: STRONG_ETAG,
        location: null,
      },
      pendingBody(finalBodyState),
    );
    let opens = 0;
    const client = new RecordingArtifactHttpClient(async () => {
      opens += 1;
      if (opens === 1) return redirect.response;
      assert.equal(redirect.state.disposeCalls, 1);
      return final.response;
    });
    const opened = await new CatalogHttpTransport({ client, clock: new ManualClock() }).open(
      fixture.model,
      null,
      new AbortController().signal,
    );

    assert.equal(finalBodyState.iteratorStarts, 0);
    await Promise.all([opened.dispose(), opened.dispose(), opened.dispose()]);
    assert.equal(redirect.state.disposeCalls, 1);
    assert.equal(final.state.disposeCalls, 1);
    assert.equal(finalBodyState.iteratorStarts, 0);
    assert.equal(finalBodyState.returnCalls, 0);
    assert.equal((await opened.body[Symbol.asyncIterator]().next()).done, true);
  });

  test('disposes every rejected redirect response without reading its body', async () => {
    const fixture = createArtifactCatalogFixture();
    for (const location of [null, 'http://local-whisper-fixtures.invalid/downgrade']) {
      const bodyState: PendingBodyState = { iteratorStarts: 0, nextCalls: 0, returnCalls: 0 };
      const response = trackedResponse(
        307,
        { contentLength: null, contentRange: null, etag: null, location },
        pendingBody(bodyState),
      );
      const client = new RecordingArtifactHttpClient(async () => response.response);
      await assert.rejects(
        new CatalogHttpTransport({ client, clock: new ManualClock() }).open(
          fixture.model,
          null,
          new AbortController().signal,
        ),
        (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'UNSAFE_REDIRECT',
      );
      assert.equal(response.state.disposeCalls, 1);
      assert.equal(bodyState.iteratorStarts, 0);
    }

    const redirects: TrackedResponse[] = [];
    const client = new RecordingArtifactHttpClient(async () => {
      const response = trackedResponse(307, {
        contentLength: null,
        contentRange: null,
        etag: null,
        location: '/loop',
      });
      redirects.push(response);
      return response.response;
    });
    await assert.rejects(
      new CatalogHttpTransport({ client, clock: new ManualClock() }).open(
        fixture.model,
        null,
        new AbortController().signal,
      ),
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'UNSAFE_REDIRECT',
    );
    assert.equal(redirects.length, ARTIFACT_MAX_REDIRECTS + 1);
    assert.ok(redirects.every((response) => response.state.disposeCalls === 1));
  });

  test('applies the same fail-closed URL policy to initial and redirect URLs', async () => {
    const fixture = createArtifactCatalogFixture();
    const origin = fixture.model.origin;
    const urlCases = [
      { value: fixture.model.requestUrl, initialAccepted: true, redirectAccepted: true },
      { value: `${origin}/artifacts/normalized/../model.bin`, initialAccepted: true, redirectAccepted: true },
      { value: `http://${new URL(origin).host}/artifacts/model.bin`, initialAccepted: false, redirectAccepted: false },
      {
        value: `https://user@${new URL(origin).host}/artifacts/model.bin`,
        initialAccepted: false,
        redirectAccepted: false,
      },
      { value: `${origin}/artifacts/model.bin#fragment`, initialAccepted: false, redirectAccepted: false },
      { value: `${origin}/artifacts\\model.bin`, initialAccepted: false, redirectAccepted: false },
      { value: `${origin}/artifacts/%2fmodel.bin`, initialAccepted: false, redirectAccepted: false },
      { value: `${origin}/artifacts/%5cmodel.bin`, initialAccepted: false, redirectAccepted: false },
      { value: `${origin}/artifacts/normalized/%2e%2e/model.bin`, initialAccepted: false, redirectAccepted: false },
      { value: `${origin}/artifacts/%ZZmodel.bin`, initialAccepted: false, redirectAccepted: false },
      {
        value: 'https://other.local-whisper-fixtures.invalid/artifacts/model.bin',
        initialAccepted: false,
        redirectAccepted: false,
      },
      {
        value: 'https://local-whisper-fixtures.invalid:444/artifacts/model.bin',
        initialAccepted: false,
        redirectAccepted: false,
      },
      { value: `${origin}/artifacts-not/model.bin`, initialAccepted: false, redirectAccepted: true },
      { value: `${origin}/artifacts`, initialAccepted: false, redirectAccepted: true },
    ] as const;

    for (const { initialAccepted, redirectAccepted, value } of urlCases) {
      const initialFinal = trackedResponse(200, {
        contentLength: fixture.model.expectedTransferSizeBytes,
        contentRange: null,
        etag: STRONG_ETAG,
        location: null,
      });
      const initialClient = new RecordingArtifactHttpClient(async () => initialFinal.response);
      const initialTransport = new CatalogHttpTransport({ client: initialClient, clock: new ManualClock() });
      const initial = initialTransport.open(
        { ...fixture.model, requestUrl: value },
        null,
        new AbortController().signal,
      );
      if (initialAccepted) {
        const opened = await initial;
        assert.equal(initialClient.requests[0].url, new URL(value).toString());
        await opened.dispose();
      } else {
        await assert.rejects(
          initial,
          (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'UNSAFE_REDIRECT',
        );
        assert.equal(initialClient.requests.length, 0);
      }

      const redirect = trackedResponse(307, {
        contentLength: null,
        contentRange: null,
        etag: null,
        location: value,
      });
      const redirectFinal = trackedResponse(200, {
        contentLength: fixture.model.expectedTransferSizeBytes,
        contentRange: null,
        etag: STRONG_ETAG,
        location: null,
      });
      let calls = 0;
      const redirectClient = new RecordingArtifactHttpClient(async () => {
        calls += 1;
        return calls === 1 ? redirect.response : redirectFinal.response;
      });
      const redirected = new CatalogHttpTransport({ client: redirectClient, clock: new ManualClock() }).open(
        fixture.model,
        null,
        new AbortController().signal,
      );
      if (redirectAccepted) {
        const opened = await redirected;
        assert.equal(redirectClient.requests[1].url, new URL(value, fixture.model.requestUrl).toString());
        await opened.dispose();
      } else {
        await assert.rejects(
          redirected,
          (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'UNSAFE_REDIRECT',
        );
        assert.equal(calls, 1);
      }
      assert.equal(redirect.state.disposeCalls, 1);
    }
  });

  test('settles pending reads through one terminal owner and releases caller resources', async () => {
    const fixture = createArtifactCatalogFixture();
    const clock = new ManualClock();
    const bodyState: PendingBodyState = { iteratorStarts: 0, nextCalls: 0, returnCalls: 0 };
    const response = trackedResponse(
      200,
      {
        contentLength: fixture.model.expectedTransferSizeBytes,
        contentRange: null,
        etag: STRONG_ETAG,
        location: null,
      },
      pendingBody(bodyState),
    );
    const client = new RecordingArtifactHttpClient(async () => response.response);
    const caller = new CountingAbortSignal();
    const opened = await new CatalogHttpTransport({ client, clock }).open(
      fixture.model,
      null,
      caller as unknown as AbortSignal,
    );
    assert.equal(caller.listenerCount, 1);

    const iterator = opened.body[Symbol.asyncIterator]();
    const pending = iterator.next();
    caller.abort();
    await assert.rejects(
      pending,
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'DOWNLOAD_CANCELLED',
    );
    await Promise.all([opened.dispose(), opened.dispose()]);

    assert.equal(client.requests[0].signal.aborted, true);
    assert.equal(response.state.disposeCalls, 1);
    assert.equal(bodyState.iteratorStarts, 1);
    assert.equal(bodyState.nextCalls, 1);
    assert.equal(bodyState.returnCalls, 1);
    assert.equal(caller.listenerCount, 0);
    assert.equal(clock.activeTimerCount, 0);
    assert.equal((await iterator.next()).done, true);
  });

  test('disposes an opened stream when its first post-open journal update fails', async () => {
    const bodyState: PendingBodyState = { iteratorStarts: 0, nextCalls: 0, returnCalls: 0 };
    const fixture = createArtifactCatalogFixture();
    const response = trackedResponse(
      200,
      {
        contentLength: fixture.model.expectedTransferSizeBytes,
        contentRange: null,
        etag: STRONG_ETAG,
        location: null,
      },
      pendingBody(bodyState),
    );
    const client = new RecordingArtifactHttpClient(async () => response.response);
    const harness = createArtifactServiceHarness({ client, journalStore: new FailingPostOpenJournalStore() });
    const result = await harness.service.startDownload({
      artifactId: harness.catalogFixture.model.artifactId,
      expectedInventoryRevision: harness.inventory.revision,
    }).completion;

    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.error.code, 'DOWNLOAD_FAILED');
    assert.equal(response.state.disposeCalls, 1);
    assert.equal(bodyState.iteratorStarts, 0);
    assert.equal(bodyState.nextCalls, 0);
    assert.equal(harness.store.promotions, 0);
  });

  test('rejects redirect loops and invalid range evidence', async () => {
    const fixture = createArtifactCatalogFixture();
    const redirecting = new RecordingArtifactHttpClient(async () => ({
      status: 307,
      body: emptyBody(),
      headers: { contentLength: null, contentRange: null, etag: null, location: '/loop' },
      dispose: async () => undefined,
    }));
    const transport = new CatalogHttpTransport({ client: redirecting, clock: new ManualClock() });
    await assert.rejects(
      transport.open(fixture.model, null, new AbortController().signal),
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'UNSAFE_REDIRECT',
    );
    assert.equal(redirecting.requests.length, ARTIFACT_MAX_REDIRECTS + 1);

    const invalidRange = new RecordingArtifactHttpClient(async () => ({
      status: 200,
      body: emptyBody(),
      headers: { contentLength: null, contentRange: null, etag: STRONG_ETAG, location: null },
      dispose: async () => undefined,
    }));
    await assert.rejects(
      new CatalogHttpTransport({ client: invalidRange, clock: new ManualClock() }).open(
        fixture.model,
        { offset: 1, validator: STRONG_ETAG },
        new AbortController().signal,
      ),
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'RESUME_INVALID',
    );
  });

  test('enforces connection and no-progress timeouts with fake time', async () => {
    const fixture = createArtifactCatalogFixture();
    const connectionClock = new ManualClock();
    const neverConnecting = new RecordingArtifactHttpClient(async () => await new Promise(() => undefined));
    const connection = new CatalogHttpTransport({ client: neverConnecting, clock: connectionClock }).open(
      fixture.model,
      null,
      new AbortController().signal,
    );
    connectionClock.advance(ARTIFACT_CONNECTION_TIMEOUT_MS);
    await assert.rejects(
      connection,
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'OPERATION_TIMEOUT',
    );
    assert.equal(neverConnecting.requests[0].signal.aborted, true);

    const progressClock = new ManualClock();
    const stalled = new RecordingArtifactHttpClient(async () => ({
      status: 200,
      body: {
        [Symbol.asyncIterator]: () => ({ next: async () => await new Promise(() => undefined) }),
      },
      headers: {
        contentLength: fixture.model.expectedTransferSizeBytes,
        contentRange: null,
        etag: STRONG_ETAG,
        location: null,
      },
      dispose: async () => undefined,
    }));
    const opened = await new CatalogHttpTransport({ client: stalled, clock: progressClock }).open(
      fixture.model,
      null,
      new AbortController().signal,
    );
    const next = opened.body[Symbol.asyncIterator]().next();
    progressClock.advance(ARTIFACT_NO_PROGRESS_TIMEOUT_MS);
    await assert.rejects(
      next,
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'OPERATION_TIMEOUT',
    );
    assert.equal(stalled.requests[0].signal.aborted, true);
  });

  test('enforces total-transfer and per-chunk memory bounds with fake time', async () => {
    const fixture = createArtifactCatalogFixture();
    const clock = new ManualClock();
    const body = async function* (): AsyncIterable<Uint8Array> {
      yield new Uint8Array(1);
      yield new Uint8Array(fixture.model.expectedTransferSizeBytes - 1);
    };
    const client = new RecordingArtifactHttpClient(async () => ({
      status: 200,
      body: body(),
      headers: {
        contentLength: fixture.model.expectedTransferSizeBytes,
        contentRange: null,
        etag: STRONG_ETAG,
        location: null,
      },
      dispose: async () => undefined,
    }));
    const opened = await new CatalogHttpTransport({ client, clock }).open(
      fixture.model,
      null,
      new AbortController().signal,
    );
    const iterator = opened.body[Symbol.asyncIterator]();
    assert.equal((await iterator.next()).done, false);
    clock.advance(ARTIFACT_TOTAL_TRANSFER_TIMEOUT_MS);
    await assert.rejects(
      iterator.next(),
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'OPERATION_TIMEOUT',
    );

    client.handler = async () => ({
      status: 200,
      body: (async function* (): AsyncIterable<Uint8Array> {
        yield new Uint8Array(ARTIFACT_MAX_BUFFER_BYTES + 1);
      })(),
      headers: {
        contentLength: fixture.model.expectedTransferSizeBytes,
        contentRange: null,
        etag: STRONG_ETAG,
        location: null,
      },
      dispose: async () => undefined,
    });
    const oversized = await new CatalogHttpTransport({ client, clock: new ManualClock() }).open(
      fixture.model,
      null,
      new AbortController().signal,
    );
    await assert.rejects(
      oversized.body[Symbol.asyncIterator]().next(),
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'DOWNLOAD_FAILED',
    );
  });

  test('normalizes injected offline client errors without exposing native details', async () => {
    const fixture = createArtifactCatalogFixture();
    const client = new RecordingArtifactHttpClient(async () => {
      throw new ArtifactHttpClientError('offline');
    });
    await assert.rejects(
      new CatalogHttpTransport({ client, clock: new ManualClock() }).open(
        fixture.model,
        null,
        new AbortController().signal,
      ),
      (error) =>
        error instanceof LocalWhisperArtifactLifecycleError &&
        error.code === 'DOWNLOAD_OFFLINE' &&
        error.message === 'DOWNLOAD_OFFLINE',
    );
  });
});
