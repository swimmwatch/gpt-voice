export const INITIAL_PROVIDER_READINESS_TIMEOUT_MS = 60_000;

export interface InitialProviderReadinessClock {
  clearTimeout(handle: unknown): void;
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
}

export interface InitialProviderReadinessDeadlineDependencies {
  readonly clock: InitialProviderReadinessClock;
  readonly createAbortController: () => AbortController;
}

export type InitialProviderReadinessStopCause = 'cancelled' | 'timed-out';

export type InitialProviderReadinessResult<Value> =
  | {
      readonly status: 'completed';
      readonly value: Value;
    }
  | {
      readonly cause: InitialProviderReadinessStopCause;
      readonly status: 'stopped';
    };

type InitialProviderReadinessSettlement<Value> =
  | InitialProviderReadinessResult<Value>
  | {
      readonly error: unknown;
      readonly status: 'failed';
    };

/**
 * Owns one absolute main-process readiness deadline and its cancellation
 * signal. Provider work may ignore cancellation, but settlement never does.
 */
export class InitialProviderReadinessDeadline {
  private callerAbortListener: (() => void) | null = null;
  private completed = false;
  private resolveStop: ((cause: InitialProviderReadinessStopCause) => void) | null = null;
  private stopCause: InitialProviderReadinessStopCause | null = null;
  private readonly stopPromise: Promise<InitialProviderReadinessStopCause>;
  private timer: unknown;

  public readonly controller: AbortController;
  public readonly deadlineMs: number;

  public constructor(
    private readonly dependencies: InitialProviderReadinessDeadlineDependencies,
    private readonly callerSignal?: AbortSignal,
  ) {
    this.controller = this.createController();
    this.deadlineMs = this.getNow() + INITIAL_PROVIDER_READINESS_TIMEOUT_MS;
    this.stopPromise = new Promise((resolve) => {
      this.resolveStop = resolve;
    });

    if (callerSignal) {
      this.callerAbortListener = () => this.stop('cancelled');
      try {
        callerSignal.addEventListener('abort', this.callerAbortListener, { once: true });
      } catch {
        this.callerAbortListener = null;
      }
    }
    if (callerSignal?.aborted) {
      this.stop('cancelled');
      return;
    }

    try {
      const remainingMs = Math.max(0, this.deadlineMs - this.getNow());
      this.timer = this.dependencies.clock.setTimeout(() => this.stop('timed-out'), remainingMs);
    } catch {
      this.stop('timed-out');
    }
  }

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  public cancel(): void {
    this.stop('cancelled');
  }

  public async run<Value>(
    operation: (signal: AbortSignal) => Promise<Value>,
  ): Promise<InitialProviderReadinessResult<Value>> {
    const completion: Promise<InitialProviderReadinessSettlement<Value>> = Promise.resolve()
      .then(() => operation(this.signal))
      .then(
        (value) => ({ status: 'completed' as const, value }),
        (error: unknown) => ({ error, status: 'failed' as const }),
      );

    try {
      const settlement = await Promise.race([
        completion,
        this.stopPromise.then((cause) => ({ cause, status: 'stopped' as const })),
      ]);
      if (settlement.status === 'failed') throw settlement.error;
      return settlement;
    } finally {
      this.dispose();
    }
  }

  private createController(): AbortController {
    try {
      return this.dependencies.createAbortController();
    } catch {
      return new AbortController();
    }
  }

  private getNow(): number {
    try {
      const value = this.dependencies.clock.now();
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  private stop(cause: InitialProviderReadinessStopCause): void {
    if (this.completed || this.stopCause !== null) return;
    this.stopCause = cause;
    try {
      this.controller.abort();
    } catch {
      // Settlement does not depend on adapter cancellation behavior.
    }
    this.resolveStop?.(cause);
    this.resolveStop = null;
  }

  private dispose(): void {
    this.completed = true;
    if (this.timer !== undefined) {
      try {
        this.dependencies.clock.clearTimeout(this.timer);
      } catch {
        // Timer cleanup cannot alter an already-settled operation.
      }
      this.timer = undefined;
    }
    if (this.callerSignal && this.callerAbortListener) {
      try {
        this.callerSignal.removeEventListener('abort', this.callerAbortListener);
      } catch {
        // The main process does not own the caller signal.
      }
      this.callerAbortListener = null;
    }
    this.resolveStop = null;
  }
}
