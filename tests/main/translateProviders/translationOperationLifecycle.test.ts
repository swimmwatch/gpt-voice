import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TRANSLATION_OPERATION_TIMEOUT_MS,
  TRANSLATION_RESULT_TIMEOUT_MS,
  TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS,
  TranslationOperationLifecycle,
  type TranslationOperationLifecycleDependencies,
} from '@main/translateProviders/translationOperationLifecycle';

interface ScheduledTimer {
  readonly callback: () => void;
  readonly deadlineMs: number;
}

class ManualLifecycleDependencies implements TranslationOperationLifecycleDependencies {
  private activeMs = 0;
  private nextHandle = 0;
  private readonly resumeListeners = new Set<() => void>();
  private throwOnSetTimeout = false;
  private readonly timers = new Map<number, ScheduledTimer>();
  private wallMs = 0;

  public readonly controllers: AbortController[] = [];

  public activeNow = (): number => this.activeMs;

  public clearTimeout = (handle: unknown): void => {
    if (typeof handle === 'number') this.timers.delete(handle);
  };

  public createAbortController = (): AbortController => {
    const controller = new AbortController();
    this.controllers.push(controller);
    return controller;
  };

  public setTimeout = (callback: () => void, delayMs: number): unknown => {
    if (this.throwOnSetTimeout) throw new Error('private-timer-adapter-failure');
    const handle = ++this.nextHandle;
    this.timers.set(handle, {
      callback,
      deadlineMs: this.activeMs + Math.max(0, delayMs),
    });
    return handle;
  };

  public subscribeResume = (listener: () => void): (() => void) => {
    this.resumeListeners.add(listener);
    return () => this.resumeListeners.delete(listener);
  };

  public wallNow = (): number => this.wallMs;

  public advance(wallDeltaMs: number, activeDeltaMs: number, deliverTimers = true): void {
    this.wallMs += wallDeltaMs;
    this.activeMs += activeDeltaMs;
    if (deliverTimers) this.deliverDueTimers();
  }

  public emitResume(): void {
    for (const listener of [...this.resumeListeners]) listener();
  }

  public setTimerFailure(enabled: boolean): void {
    this.throwOnSetTimeout = enabled;
  }

  public timerCount(): number {
    return this.timers.size;
  }

  private deliverDueTimers(): void {
    const due = [...this.timers.entries()]
      .filter(([, timer]) => timer.deadlineMs <= this.activeMs)
      .sort(([left], [right]) => left - right);
    for (const [handle, timer] of due) {
      if (!this.timers.delete(handle)) continue;
      timer.callback();
    }
  }
}

function createLifecycle(
  dependencies = new ManualLifecycleDependencies(),
  callerSignal?: AbortSignal,
): { readonly dependencies: ManualLifecycleDependencies; readonly lifecycle: TranslationOperationLifecycle } {
  return {
    dependencies,
    lifecycle: new TranslationOperationLifecycle(
      dependencies,
      {
        attemptCount: 1,
        contractVersion: 'google-v1',
        generation: 3,
        providerId: 'google',
        resultLength: 0,
        sourceLength: 16,
        targetLanguage: 'en',
      },
      callerSignal,
    ),
  };
}

describe('TranslationOperationLifecycle', () => {
  it('enforces the operation deadline at 60,000 ms, including an exact-boundary completion', () => {
    const { dependencies, lifecycle } = createLifecycle();

    dependencies.advance(TRANSLATION_OPERATION_TIMEOUT_MS - 1, TRANSLATION_OPERATION_TIMEOUT_MS - 1);
    assert.equal(lifecycle.acceptValidOutcome().kind, 'completed');
    assert.equal(lifecycle.terminal, null);

    const exactBoundary = createLifecycle();
    exactBoundary.dependencies.advance(TRANSLATION_OPERATION_TIMEOUT_MS, TRANSLATION_OPERATION_TIMEOUT_MS, false);
    assert.deepEqual(exactBoundary.lifecycle.acceptValidOutcome(), { deadline: 'operation', kind: 'timed-out' });
    assert.equal(exactBoundary.lifecycle.signal.aborted, true);
  });

  it('uses the earlier result budget at 15,000 ms and never accepts an equal-boundary result', () => {
    const { dependencies, lifecycle } = createLifecycle();

    assert.equal(lifecycle.startResultPhase(), null);
    dependencies.advance(TRANSLATION_RESULT_TIMEOUT_MS - 1, TRANSLATION_RESULT_TIMEOUT_MS - 1);
    assert.equal(lifecycle.check(), null);
    dependencies.advance(1, 1, false);

    assert.deepEqual(lifecycle.acceptValidOutcome(), { deadline: 'result', kind: 'timed-out' });
    assert.equal(lifecycle.signal.aborted, true);
  });

  it('gives cleanup an independent five-second absolute budget and lets cleanup failure override success', () => {
    const { dependencies, lifecycle } = createLifecycle();

    assert.equal(lifecycle.acceptValidOutcome().kind, 'completed');
    dependencies.advance(TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS - 1, TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS - 1);
    assert.equal(lifecycle.terminal, null);
    assert.deepEqual(lifecycle.completeCleanup(false), { kind: 'cleanup-failure' });

    const expired = createLifecycle();
    expired.lifecycle.acceptValidOutcome();
    expired.dependencies.advance(TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS, TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS);
    assert.deepEqual(expired.lifecycle.terminal, { kind: 'cleanup-failure' });
  });

  it('uses a non-decreasing maximum across rollback-prone wall and active clocks', () => {
    const { dependencies, lifecycle } = createLifecycle();

    dependencies.advance(10_000, 10_000, false);
    assert.equal(lifecycle.state.elapsedMs, 10_000);
    dependencies.advance(-9_000, -9_000, false);
    assert.equal(lifecycle.state.elapsedMs, 10_000);
    dependencies.advance(59_000, 0, false);

    assert.deepEqual(lifecycle.check(), { deadline: 'operation', kind: 'timed-out' });
  });

  it('expires after Linux-like suspend, Windows-like advancing monotonic time, and a delayed timer delivery', () => {
    const linux = createLifecycle();
    linux.dependencies.advance(TRANSLATION_OPERATION_TIMEOUT_MS, 0, false);
    linux.dependencies.emitResume();
    assert.deepEqual(linux.lifecycle.check(), { deadline: 'operation', kind: 'timed-out' });

    const windows = createLifecycle();
    windows.dependencies.advance(0, TRANSLATION_OPERATION_TIMEOUT_MS, false);
    windows.dependencies.emitResume();
    assert.deepEqual(windows.lifecycle.check(), { deadline: 'operation', kind: 'timed-out' });

    const delayed = createLifecycle();
    delayed.dependencies.advance(TRANSLATION_OPERATION_TIMEOUT_MS, TRANSLATION_OPERATION_TIMEOUT_MS, false);
    assert.deepEqual(delayed.lifecycle.check(), { deadline: 'operation', kind: 'timed-out' });
  });

  it('keeps cancellation, disposal, and terminal notification idempotent', () => {
    const caller = new AbortController();
    const { dependencies, lifecycle } = createLifecycle(new ManualLifecycleDependencies(), caller.signal);
    const decisions: unknown[] = [];
    lifecycle.subscribeTerminal((decision) => decisions.push(decision));

    caller.abort();
    caller.abort();
    assert.deepEqual(lifecycle.check(), { cause: 'caller', kind: 'cancelled' });
    assert.equal(lifecycle.signal.aborted, true);
    assert.deepEqual(lifecycle.completeCleanup(true), { cause: 'caller', kind: 'cancelled' });
    lifecycle.dispose();
    lifecycle.dispose();
    dependencies.advance(TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS, TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS);

    assert.deepEqual(decisions, [{ cause: 'caller', kind: 'cancelled' }]);
    assert.equal(dependencies.timerCount(), 0);
  });

  it('fails closed without surfacing injected adapter errors', () => {
    const dependencies = new ManualLifecycleDependencies();
    dependencies.setTimerFailure(true);
    const { lifecycle } = createLifecycle(dependencies);

    const decision = lifecycle.check();

    assert.notEqual(decision?.kind, 'completed');
    assert.equal(lifecycle.signal.aborted, true);
    assert.doesNotMatch(JSON.stringify({ decision, state: lifecycle.state }), /private-timer-adapter/u);
  });
});
