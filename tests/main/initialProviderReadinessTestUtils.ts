/* eslint-disable max-classes-per-file -- The dependency fixture owns its deterministic clock. */
import type {
  InitialProviderReadinessClock,
  InitialProviderReadinessDeadlineDependencies,
} from '@main/services/initialProviderReadinessDeadline';

interface ScheduledReadinessTimer {
  readonly callback: () => void;
  readonly deadlineMs: number;
}

export class ManualInitialProviderReadinessClock implements InitialProviderReadinessClock {
  private currentTimeMs = 0;
  private nextHandle = 0;
  private readonly timers = new Map<number, ScheduledReadinessTimer>();

  public clearTimeout(handle: unknown): void {
    if (typeof handle === 'number') this.timers.delete(handle);
  }

  public now(): number {
    return this.currentTimeMs;
  }

  public setTimeout(callback: () => void, delayMs: number): unknown {
    const handle = ++this.nextHandle;
    this.timers.set(handle, {
      callback,
      deadlineMs: this.currentTimeMs + Math.max(0, delayMs),
    });
    return handle;
  }

  public advanceBy(delayMs: number): void {
    this.currentTimeMs += delayMs;
    const dueTimers = [...this.timers.entries()]
      .filter(([, timer]) => timer.deadlineMs <= this.currentTimeMs)
      .sort(([leftHandle], [rightHandle]) => leftHandle - rightHandle);
    for (const [handle, timer] of dueTimers) {
      if (!this.timers.delete(handle)) continue;
      timer.callback();
    }
  }
}

export class InitialProviderReadinessTestDependencies implements InitialProviderReadinessDeadlineDependencies {
  public readonly clock = new ManualInitialProviderReadinessClock();
  public readonly controllers: AbortController[] = [];

  public createAbortController = (): AbortController => {
    const controller = new AbortController();
    this.controllers.push(controller);
    return controller;
  };
}
