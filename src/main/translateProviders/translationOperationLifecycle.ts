/* eslint-disable max-classes-per-file -- the factory owns the lifecycle adapter set. */
import type { TranslationProviderId } from '@shared/translationProvider';

export const TRANSLATION_OPERATION_TIMEOUT_MS = 60_000;
export const TRANSLATION_RESULT_TIMEOUT_MS = 15_000;
export const TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS = 5_000;

export type TranslationOperationLifecyclePhase = 'operation' | 'result' | 'cleanup';
export type TranslationOperationLifecycleDeadline = TranslationOperationLifecyclePhase;
export type TranslationOperationCancellationCause = 'caller' | 'reset' | 'shutdown' | 'superseded';

export type TranslationOperationLifecycleDecision =
  | {
      readonly kind: 'cancelled';
      readonly cause: TranslationOperationCancellationCause;
    }
  | {
      readonly kind: 'timed-out';
      readonly deadline: TranslationOperationLifecycleDeadline;
    }
  | {
      readonly kind: 'completed';
    }
  | {
      readonly kind: 'cleanup-failure';
    };

export interface TranslationOperationLifecycleMetadata {
  readonly attemptCount: number;
  readonly contractVersion: string;
  readonly generation: number;
  readonly providerId: TranslationProviderId;
  readonly resultLength?: number;
  readonly sourceLength?: number;
  readonly targetLanguage: string;
}

export interface TranslationOperationLifecycleState extends TranslationOperationLifecycleMetadata {
  readonly elapsedMs: number;
  readonly phase: TranslationOperationLifecyclePhase;
}

export interface TranslationOperationLifecycleDependencies {
  readonly activeNow: () => number;
  readonly clearTimeout: (handle: unknown) => void;
  readonly createAbortController: () => AbortController;
  readonly setTimeout: (callback: () => void, delayMs: number) => unknown;
  readonly subscribeResume: (listener: () => void) => () => void;
  readonly wallNow: () => number;
}

/** Constructs independent operation lifecycles from one process-owned adapter set. */
export class TranslationOperationLifecycleFactory {
  public constructor(private readonly dependencies: TranslationOperationLifecycleDependencies) {}

  public create(
    metadata: TranslationOperationLifecycleMetadata,
    callerSignal?: AbortSignal,
  ): TranslationOperationLifecycle {
    return new TranslationOperationLifecycle(this.dependencies, metadata, callerSignal);
  }
}

type PendingDecision = Exclude<TranslationOperationLifecycleDecision, { readonly kind: 'cleanup-failure' }>;
type TerminalListener = (decision: TranslationOperationLifecycleDecision) => void;

interface ClockOrigins {
  readonly activeMs: number;
  readonly wallMs: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Owns one main-process translation deadline contract. It stores only typed
 * operation metadata and lengths; provider text and browser data remain outside
 * this lifecycle.
 */
export class TranslationOperationLifecycle {
  private callerAbortListener: (() => void) | null = null;
  private callerSignal: AbortSignal | null = null;
  private cleanupStartedAtMs: number | null = null;
  private closed = false;
  private elapsedMs = 0;
  private finalDecision: TranslationOperationLifecycleDecision | null = null;
  private readonly listeners = new Set<TerminalListener>();
  private pendingDecision: PendingDecision | null = null;
  private phase: TranslationOperationLifecyclePhase = 'operation';
  private readonly origins: ClockOrigins | null;
  private resultStartedAtMs: number | null = null;
  private resumeUnsubscribe: (() => void) | null = null;
  private timer: unknown;

  public readonly controller: AbortController;
  public readonly metadata: TranslationOperationLifecycleMetadata;

  public constructor(
    private readonly dependencies: TranslationOperationLifecycleDependencies,
    metadata: TranslationOperationLifecycleMetadata,
    callerSignal?: AbortSignal,
  ) {
    this.metadata = Object.freeze({
      attemptCount: nonNegativeInteger(metadata.attemptCount),
      contractVersion: safeString(metadata.contractVersion),
      generation: nonNegativeInteger(metadata.generation),
      providerId: metadata.providerId,
      ...(metadata.resultLength === undefined ? {} : { resultLength: nonNegativeInteger(metadata.resultLength) }),
      ...(metadata.sourceLength === undefined ? {} : { sourceLength: nonNegativeInteger(metadata.sourceLength) }),
      targetLanguage: safeString(metadata.targetLanguage),
    });
    this.controller = this.createController();
    this.origins = this.readOrigins();

    if (callerSignal) this.bindCallerAbort(callerSignal);
    if (callerSignal?.aborted) {
      this.capturePendingDecision({ cause: 'caller', kind: 'cancelled' });
      return;
    }
    if (this.origins === null) {
      this.capturePendingDecision({ deadline: 'operation', kind: 'timed-out' });
      return;
    }
    try {
      this.resumeUnsubscribe = this.dependencies.subscribeResume(() => {
        this.check();
      });
    } catch {
      this.capturePendingDecision({ deadline: 'operation', kind: 'timed-out' });
      return;
    }
    this.armWakeup();
  }

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  public get state(): TranslationOperationLifecycleState {
    this.refreshElapsed();
    return Object.freeze({
      ...this.metadata,
      elapsedMs: this.elapsedMs,
      phase: this.phase,
    });
  }

  public get terminal(): TranslationOperationLifecycleDecision | null {
    return this.finalDecision;
  }

  /** Rechecks the authoritative clock; timers and resume callbacks are only wake-ups. */
  public check(): TranslationOperationLifecycleDecision | null {
    if (this.closed) return this.finalDecision ?? this.pendingDecision;
    this.captureExpiredDeadline();
    if (!this.closed) this.armWakeup();
    return this.finalDecision ?? this.pendingDecision;
  }

  public startResultPhase(): TranslationOperationLifecycleDecision | null {
    if (this.closed) return this.finalDecision ?? this.pendingDecision;
    this.captureExpiredDeadline();
    if (this.pendingDecision !== null || this.finalDecision !== null) return this.finalDecision ?? this.pendingDecision;
    if (this.phase === 'operation') {
      this.phase = 'result';
      this.resultStartedAtMs = this.elapsedMs;
    }
    this.armWakeup();
    return null;
  }

  /** Starts the absolute cleanup budget. It is safe to call repeatedly and after a timeout or cancellation. */
  public startCleanupPhase(): TranslationOperationLifecycleDecision | null {
    if (this.closed) return this.finalDecision ?? this.pendingDecision;
    this.captureExpiredDeadline();
    this.enterCleanupPhase();
    return this.finalDecision ?? this.pendingDecision;
  }

  /** Commits a valid provider outcome only when neither absolute deadline has expired. */
  public acceptValidOutcome(): TranslationOperationLifecycleDecision {
    if (this.finalDecision !== null) return this.finalDecision;
    this.captureExpiredDeadline();
    if (this.pendingDecision === null) this.capturePendingDecision({ kind: 'completed' });
    return this.finalDecision ?? this.pendingDecision ?? { kind: 'cleanup-failure' };
  }

  /**
   * Finalizes an already-started cleanup. An unconfirmed or expired cleanup
   * deliberately overrides an otherwise successful, cancelled, or timed-out
   * underlying outcome.
   */
  public completeCleanup(confirmed: boolean): TranslationOperationLifecycleDecision {
    if (this.finalDecision !== null) return this.finalDecision;
    if (this.cleanupStartedAtMs === null) return this.finalize({ kind: 'cleanup-failure' });
    this.captureExpiredDeadline();
    if (this.finalDecision !== null) return this.finalDecision;
    if (!confirmed) return this.finalize({ kind: 'cleanup-failure' });
    return this.finalize(this.pendingDecision ?? { kind: 'completed' });
  }

  public cancel(cause: TranslationOperationCancellationCause = 'caller'): TranslationOperationLifecycleDecision {
    if (this.finalDecision !== null) return this.finalDecision;
    this.capturePendingDecision({ cause, kind: 'cancelled' });
    return this.finalDecision ?? this.pendingDecision ?? { kind: 'cleanup-failure' };
  }

  /** Registers one terminal observer; each observer can receive at most one notification. */
  public subscribeTerminal(listener: TerminalListener): () => void {
    if (this.finalDecision !== null) {
      try {
        listener(this.finalDecision);
      } catch {
        // Observers are informational and must not alter lifecycle settlement.
      }
      return () => undefined;
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Removes all owned timers and listeners. Late timer or resume callbacks only observe a closed lifecycle. */
  public dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.clearWakeup();
    if (this.resumeUnsubscribe) {
      try {
        this.resumeUnsubscribe();
      } catch {
        // Listener cleanup cannot resurrect an operation.
      }
      this.resumeUnsubscribe = null;
    }
    if (this.callerAbortListener) {
      if (this.callerSignal) {
        try {
          this.callerSignal.removeEventListener('abort', this.callerAbortListener);
        } catch {
          // The lifecycle does not own the caller signal.
        }
      }
      this.callerAbortListener = null;
      this.callerSignal = null;
    }
  }

  private bindCallerAbort(signal: AbortSignal): void {
    this.callerSignal = signal;
    this.callerAbortListener = () => this.cancel('caller');
    try {
      signal.addEventListener('abort', this.callerAbortListener, { once: true });
    } catch {
      this.callerAbortListener = null;
      this.callerSignal = null;
      this.capturePendingDecision({ deadline: 'operation', kind: 'timed-out' });
    }
  }

  private createController(): AbortController {
    try {
      const controller = this.dependencies.createAbortController();
      if (controller && typeof controller.abort === 'function' && controller.signal) return controller;
    } catch {
      // Fall through to the platform AbortController without exposing adapter details.
    }
    return new AbortController();
  }

  private readOrigins(): ClockOrigins | null {
    try {
      const activeMs = this.dependencies.activeNow();
      const wallMs = this.dependencies.wallNow();
      return isFiniteNumber(activeMs) && isFiniteNumber(wallMs) ? { activeMs, wallMs } : null;
    } catch {
      return null;
    }
  }

  private refreshElapsed(): boolean {
    if (this.origins === null) return false;
    try {
      const activeNow = this.dependencies.activeNow();
      const wallNow = this.dependencies.wallNow();
      if (!isFiniteNumber(activeNow) || !isFiniteNumber(wallNow)) return false;
      const activeElapsed = Math.max(0, activeNow - this.origins.activeMs);
      const wallElapsed = Math.max(0, wallNow - this.origins.wallMs);
      this.elapsedMs = Math.max(this.elapsedMs, activeElapsed, wallElapsed);
      return true;
    } catch {
      return false;
    }
  }

  private captureExpiredDeadline(): void {
    if (this.closed || this.finalDecision !== null) return;
    if (!this.refreshElapsed()) {
      if (this.phase === 'cleanup') this.finalize({ kind: 'cleanup-failure' });
      else this.capturePendingDecision({ deadline: this.phase, kind: 'timed-out' });
      return;
    }
    if (this.phase === 'cleanup') {
      if (
        this.cleanupStartedAtMs !== null &&
        this.elapsedMs >= this.cleanupStartedAtMs + TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS
      ) {
        this.finalize({ kind: 'cleanup-failure' });
      }
      return;
    }

    const resultDeadlineMs =
      this.resultStartedAtMs === null
        ? null
        : Math.min(TRANSLATION_OPERATION_TIMEOUT_MS, this.resultStartedAtMs + TRANSLATION_RESULT_TIMEOUT_MS);
    if (resultDeadlineMs !== null && this.elapsedMs >= resultDeadlineMs) {
      this.capturePendingDecision({ deadline: 'result', kind: 'timed-out' });
      return;
    }
    if (this.elapsedMs >= TRANSLATION_OPERATION_TIMEOUT_MS) {
      this.capturePendingDecision({ deadline: 'operation', kind: 'timed-out' });
    }
  }

  private capturePendingDecision(decision: PendingDecision): void {
    if (this.closed || this.finalDecision !== null || this.pendingDecision !== null) return;
    this.pendingDecision = decision;
    if (decision.kind === 'cancelled' || decision.kind === 'timed-out') {
      try {
        this.controller.abort();
      } catch {
        // Cancellation is advisory; the owned terminal decision remains authoritative.
      }
    }
    this.enterCleanupPhase();
  }

  private enterCleanupPhase(): void {
    if (this.closed || this.finalDecision !== null || this.cleanupStartedAtMs !== null) return;
    if (!this.refreshElapsed()) {
      this.finalize({ kind: 'cleanup-failure' });
      return;
    }
    this.phase = 'cleanup';
    this.cleanupStartedAtMs = this.elapsedMs;
    this.armWakeup();
  }

  private nextDeadlineMs(): number | null {
    if (this.phase === 'cleanup') {
      return this.cleanupStartedAtMs === null
        ? null
        : this.cleanupStartedAtMs + TRANSLATION_TERMINAL_CLEANUP_TIMEOUT_MS;
    }
    if (this.resultStartedAtMs !== null) {
      return Math.min(TRANSLATION_OPERATION_TIMEOUT_MS, this.resultStartedAtMs + TRANSLATION_RESULT_TIMEOUT_MS);
    }
    return TRANSLATION_OPERATION_TIMEOUT_MS;
  }

  private armWakeup(): void {
    this.clearWakeup();
    if (this.closed || this.finalDecision !== null) return;
    if (!this.refreshElapsed()) {
      this.captureExpiredDeadline();
      return;
    }
    const deadlineMs = this.nextDeadlineMs();
    if (deadlineMs === null) return;
    if (this.elapsedMs >= deadlineMs) {
      this.captureExpiredDeadline();
      return;
    }
    try {
      this.timer = this.dependencies.setTimeout(() => this.check(), Math.max(0, deadlineMs - this.elapsedMs));
    } catch {
      if (this.phase === 'cleanup') this.finalize({ kind: 'cleanup-failure' });
      else this.capturePendingDecision({ deadline: this.phase, kind: 'timed-out' });
    }
  }

  private clearWakeup(): void {
    if (this.timer === undefined) return;
    const timer = this.timer;
    this.timer = undefined;
    try {
      this.dependencies.clearTimeout(timer);
    } catch {
      // Timer cleanup cannot alter a completed terminal decision.
    }
  }

  private finalize(decision: TranslationOperationLifecycleDecision): TranslationOperationLifecycleDecision {
    if (this.finalDecision !== null) return this.finalDecision;
    this.finalDecision = Object.freeze(decision);
    const listeners = [...this.listeners];
    this.listeners.clear();
    this.dispose();
    for (const listener of listeners) {
      try {
        listener(this.finalDecision);
      } catch {
        // Terminal observers cannot alter the committed decision.
      }
    }
    return this.finalDecision;
  }
}
