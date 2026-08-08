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
} from '@main/localWhisper/artifacts/ArtifactLifecycleTypes';
import { ArtifactTransferJournalRepository } from '@main/localWhisper/artifacts/ArtifactTransferJournalRepository';
import { ArtifactHttpClientError } from '@main/localWhisper/artifacts/ArtifactHttpClientError';
import { CatalogHttpTransport } from '@main/localWhisper/artifacts/CatalogHttpTransport';
import {
  MemoryArtifactJournalStore,
  RecordingArtifactHttpClient,
  STRONG_ETAG,
  createArtifactCatalogFixture,
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
}

async function* emptyBody(): AsyncIterable<Uint8Array> {
  for (const chunk of [] as Uint8Array[]) yield chunk;
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
    });
    await assert.rejects(
      transport.open(fixture.model, null, new AbortController().signal),
      (error) => error instanceof LocalWhisperArtifactLifecycleError && error.code === 'UNSAFE_REDIRECT',
    );
  });

  test('rejects redirect loops and invalid range evidence', async () => {
    const fixture = createArtifactCatalogFixture();
    const redirecting = new RecordingArtifactHttpClient(async () => ({
      status: 307,
      body: emptyBody(),
      headers: { contentLength: null, contentRange: null, etag: null, location: '/loop' },
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
