import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LocalWhisperSettingsLifecycle,
  type LocalWhisperSettingsLifecyclePublisher,
  type LocalWhisperSettingsLifecycleScheduler,
  type LocalWhisperSettingsLifecycleService,
} from '@renderer/localWhisper/LocalWhisperSettingsLifecycle';
import {
  createLocalWhisperRendererSafeFailure,
  type LocalWhisperRendererSnapshot,
  type LocalWhisperSettingsCommandResult,
} from '@shared/localWhisper';
import { FakeCoordinator, createSnapshotService } from '../../main/localWhisper/ipc/localWhisperIpcTestUtils';

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly reject: (error: Error) => void;
  readonly resolve: (value: Value) => void;
}

function deferred<Value>(): Deferred<Value> {
  let resolveDeferred = (_value: Value): void => undefined;
  let rejectDeferred = (_error: Error): void => undefined;
  const promise = new Promise<Value>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });
  return Object.freeze({ promise, resolve: resolveDeferred, reject: rejectDeferred });
}

function createSnapshot(overrides: Partial<LocalWhisperRendererSnapshot> = {}): LocalWhisperRendererSnapshot {
  const snapshots = createSnapshotService(new FakeCoordinator());
  const snapshot = Object.freeze({ ...snapshots.snapshot, ...overrides });
  snapshots.dispose();
  return snapshot;
}

function firstOperationId(snapshot: LocalWhisperRendererSnapshot): string {
  const [progress] = snapshot.progress;
  if (!progress) throw new Error('Expected an active artifact operation');
  return progress.operationId;
}

function successfulResult(snapshot: LocalWhisperRendererSnapshot): LocalWhisperSettingsCommandResult {
  return Object.freeze({ success: true, command: 'reset', snapshot });
}

function failedResult(snapshot: LocalWhisperRendererSnapshot): LocalWhisperSettingsCommandResult {
  return Object.freeze({
    success: false,
    command: 'reset',
    snapshot,
    error: createLocalWhisperRendererSafeFailure('OPERATION_CONFLICT'),
  });
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

interface ManualScheduler {
  readonly activeCount: number;
  readonly cancelled: number;
  readonly scheduler: LocalWhisperSettingsLifecycleScheduler;
}

function manualScheduler(): ManualScheduler {
  let cancelled = 0;
  let nextId = 1;
  const callbacks = new Map<number, () => void>();
  return Object.freeze({
    get activeCount(): number {
      return callbacks.size;
    },
    get cancelled(): number {
      return cancelled;
    },
    scheduler: Object.freeze({
      schedule: (callback: () => void, _delayMs: number): (() => void) => {
        const id = nextId;
        nextId += 1;
        callbacks.set(id, callback);
        return () => {
          if (callbacks.delete(id)) cancelled += 1;
        };
      },
    }),
  });
}

class LifecycleServiceDouble implements LocalWhisperSettingsLifecycleService {
  public cancelCalls: string[] = [];
  public disposeCalls = 0;
  public removeListenerCalls = 0;
  public startResult: Promise<LocalWhisperRendererSnapshot>;
  public cancelResult: (operationId: string) => Promise<LocalWhisperSettingsCommandResult>;
  private listener: ((snapshot: LocalWhisperRendererSnapshot) => void) | null = null;

  public constructor(snapshot: LocalWhisperRendererSnapshot) {
    this.startResult = Promise.resolve(snapshot);
    this.cancelResult = () => Promise.resolve(successfulResult(snapshot));
  }

  public cancelArtifact(operationId: string): Promise<LocalWhisperSettingsCommandResult> {
    this.cancelCalls.push(operationId);
    return this.cancelResult(operationId);
  }

  public dispose(): Promise<void> {
    this.disposeCalls += 1;
    return Promise.resolve();
  }

  public emit(snapshot: LocalWhisperRendererSnapshot): void {
    this.listener?.(snapshot);
  }

  public startSettings(): Promise<LocalWhisperRendererSnapshot> {
    return this.startResult;
  }

  public subscribeSettings(listener: (snapshot: LocalWhisperRendererSnapshot) => void): () => void {
    this.listener = listener;
    return () => {
      this.removeListenerCalls += 1;
      this.listener = null;
    };
  }
}

interface PublicationLog {
  readonly events: string[];
  readonly publisher: LocalWhisperSettingsLifecyclePublisher;
  readonly snapshots: Array<{ readonly resetDraft: boolean; readonly snapshot: LocalWhisperRendererSnapshot }>;
}

function publicationLog(): PublicationLog {
  const events: string[] = [];
  const snapshots: Array<{ readonly resetDraft: boolean; readonly snapshot: LocalWhisperRendererSnapshot }> = [];
  const publisher: LocalWhisperSettingsLifecyclePublisher = {
    publishActionError: (message) => events.push(`error:${message}`),
    publishPendingAction: (action) => events.push(`pending:${action ?? 'none'}`),
    publishSettingsLoadFailure: () => events.push('loadFailure'),
    publishSnapshot: (snapshot, resetDraft) => {
      events.push(`snapshot:${snapshot.snapshotRevision}`);
      snapshots.push(Object.freeze({ snapshot, resetDraft }));
    },
  };
  return Object.freeze({
    events,
    snapshots,
    publisher: Object.freeze(publisher),
  });
}

describe('LocalWhisperSettingsLifecycle', () => {
  it('returns ordinary command outcomes after disposal without accepting snapshots or publishing state', async () => {
    const snapshot = createSnapshot({ snapshotRevision: 10 });
    const cases: ReadonlyArray<{
      readonly expected: boolean;
      readonly name: string;
      readonly settle: (operation: Deferred<LocalWhisperSettingsCommandResult>) => void;
    }> = [
      { name: 'success', expected: true, settle: (operation) => operation.resolve(successfulResult(snapshot)) },
      { name: 'typed failure', expected: false, settle: (operation) => operation.resolve(failedResult(snapshot)) },
      {
        name: 'throw',
        expected: false,
        settle: (operation) => operation.reject(new Error('private transport detail')),
      },
    ];

    for (const testCase of cases) {
      const service = new LifecycleServiceDouble(snapshot);
      const publications = publicationLog();
      const lifecycle = new LocalWhisperSettingsLifecycle(service, publications.publisher);
      const operation = deferred<LocalWhisperSettingsCommandResult>();
      let invocationCount = 0;
      const command = lifecycle.run(
        'reset',
        () => {
          invocationCount += 1;
          return operation.promise;
        },
        true,
      );

      assert.equal(lifecycle.isCommandPending, true, testCase.name);
      assert.equal(await lifecycle.run('duplicate', () => operation.promise, false), false, testCase.name);
      assert.equal(invocationCount, 1, testCase.name);
      const publicationCountAtDisposal = publications.events.length;
      lifecycle.dispose();
      testCase.settle(operation);

      assert.equal(await command, testCase.expected, testCase.name);
      assert.equal(lifecycle.isCommandPending, false, testCase.name);
      assert.equal(lifecycle.snapshot, null, testCase.name);
      assert.equal(publications.events.length, publicationCountAtDisposal, testCase.name);
      assert.equal(service.disposeCalls, 1, testCase.name);
    }
  });

  it('does not publish or issue a second artifact cancellation after disposal', async () => {
    const activeSnapshot = createSnapshot({ snapshotRevision: 20 });
    const cases: ReadonlyArray<{
      readonly name: string;
      readonly settle: (operation: Deferred<LocalWhisperSettingsCommandResult>) => void;
    }> = [
      { name: 'success', settle: (operation) => operation.resolve(successfulResult(activeSnapshot)) },
      { name: 'typed failure', settle: (operation) => operation.resolve(failedResult(activeSnapshot)) },
      { name: 'throw', settle: (operation) => operation.reject(new Error('private transport detail')) },
    ];

    for (const testCase of cases) {
      const service = new LifecycleServiceDouble(activeSnapshot);
      const publications = publicationLog();
      const lifecycle = new LocalWhisperSettingsLifecycle(service, publications.publisher);
      lifecycle.start();
      await flushMicrotasks();
      publications.events.length = 0;

      const operation = deferred<LocalWhisperSettingsCommandResult>();
      service.cancelResult = () => operation.promise;
      const operationId = firstOperationId(activeSnapshot);
      const cancellation = lifecycle.cancelArtifactOperations([operationId]);
      assert.deepEqual(service.cancelCalls, [operationId], testCase.name);
      assert.equal(lifecycle.isCommandPending, true, testCase.name);

      lifecycle.dispose();
      const publicationCountAtDisposal = publications.events.length;
      testCase.settle(operation);

      assert.equal(await cancellation, false, testCase.name);
      assert.equal(lifecycle.isCommandPending, false, testCase.name);
      assert.deepEqual(service.cancelCalls, [operationId], testCase.name);
      assert.equal(publications.events.length, publicationCountAtDisposal, testCase.name);
    }
  });

  it('settles retained cancellation waiters once, clears their timer, and disposes listener and service once', async () => {
    const activeSnapshot = createSnapshot({ snapshotRevision: 30 });
    const scheduler = manualScheduler();
    const service = new LifecycleServiceDouble(activeSnapshot);
    const publications = publicationLog();
    const lifecycle = new LocalWhisperSettingsLifecycle(service, publications.publisher, scheduler.scheduler);
    lifecycle.start();
    await flushMicrotasks();
    publications.events.length = 0;

    const cancellation = lifecycle.cancelArtifactOperations([firstOperationId(activeSnapshot)]);
    await flushMicrotasks();
    assert.equal(scheduler.activeCount, 1);
    assert.equal(lifecycle.isCommandPending, true);

    lifecycle.dispose();
    lifecycle.dispose();

    assert.equal(await cancellation, false);
    assert.equal(lifecycle.isCommandPending, false);
    assert.equal(scheduler.activeCount, 0);
    assert.equal(scheduler.cancelled, 1);
    assert.equal(service.removeListenerCalls, 1);
    assert.equal(service.disposeCalls, 1);
    assert.deepEqual(publications.events, ['pending:cancel']);
  });

  it('allows a fresh lifecycle to accept the authoritative snapshot after a prior command settles post-disposal', async () => {
    const activeSnapshot = createSnapshot({ snapshotRevision: 40 });
    const completedSnapshot = createSnapshot({ snapshotRevision: 41, progress: Object.freeze([]) });
    const firstService = new LifecycleServiceDouble(activeSnapshot);
    const firstPublications = publicationLog();
    const firstLifecycle = new LocalWhisperSettingsLifecycle(firstService, firstPublications.publisher);
    const operation = deferred<LocalWhisperSettingsCommandResult>();
    let commandCalls = 0;
    const command = firstLifecycle.run(
      'download',
      () => {
        commandCalls += 1;
        return operation.promise;
      },
      false,
    );

    firstLifecycle.dispose();
    operation.resolve(successfulResult(completedSnapshot));
    assert.equal(await command, true);
    assert.equal(commandCalls, 1);
    assert.equal(firstPublications.snapshots.length, 0);

    const freshService = new LifecycleServiceDouble(completedSnapshot);
    const freshPublications = publicationLog();
    const freshLifecycle = new LocalWhisperSettingsLifecycle(freshService, freshPublications.publisher);
    freshLifecycle.start();
    await flushMicrotasks();

    assert.equal(freshLifecycle.snapshot?.snapshotRevision, completedSnapshot.snapshotRevision);
    assert.deepEqual(freshPublications.snapshots, [{ snapshot: completedSnapshot, resetDraft: false }]);
    freshLifecycle.dispose();
  });
});
