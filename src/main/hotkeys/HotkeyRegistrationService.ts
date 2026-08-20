import {
  HOTKEY_TARGETS,
  HotkeyBindingAuthority,
  HotkeyDispatchStatus,
  HotkeyRegistrationFailureCode,
  HotkeyRegistrationStatus,
  HotkeyTestResult,
  getHotkeyConflict,
  getHotkeyForTarget,
  isHotkeyRegistrationFailureCode,
  isHotkeyTarget,
  normalizeHotkeyForPlatform,
  setHotkeyForTarget,
  type HotkeyRuntimeSnapshot,
  type HotkeyRuntimeSnapshotEntry,
  type HotkeySettings,
  type HotkeyTarget,
} from '@shared/hotkeys';
import type { MainInteractionLock } from '@shared/mainInteractionLock';

import { GlobalShortcutAdapter } from './GlobalShortcutAdapter';
import { HotkeyPlatformPolicy, type HotkeyPlatformPolicyResult } from './HotkeyPlatformPolicy';

export const HOTKEY_TEST_TIMEOUT_MS = 5_000;

export interface HotkeyRegistrationClock {
  clearTimeout(handle: unknown): void;
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
}

export interface HotkeyRegistrationConfigPort {
  getSnapshot(): HotkeySettings;
  persistHotkey(target: HotkeyTarget, accelerator: string | null): void;
}

export interface HotkeyRegistrationServiceDependencies {
  readonly adapter: GlobalShortcutAdapter;
  readonly callbacks: Readonly<Record<HotkeyTarget, () => void>>;
  readonly clock: HotkeyRegistrationClock;
  readonly config: HotkeyRegistrationConfigPort;
  readonly logger: {
    info(message: string, metadata?: Readonly<Record<string, string>>): void;
    warn(message: string, metadata?: Readonly<Record<string, string>>): void;
  };
  readonly platform: NodeJS.Platform;
  readonly policy: HotkeyPlatformPolicy;
}

export type HotkeyRegistrationMutationResult = Readonly<{
  readonly failureCode?: HotkeyRegistrationFailureCode;
  readonly snapshot: HotkeyRuntimeSnapshot;
  readonly success: boolean;
}>;

interface TargetState {
  authority: HotkeyBindingAuthority;
  configured: string | null;
  effective: string | null;
  failureCode: HotkeyRegistrationFailureCode | undefined;
  generation: number;
  registeredAccelerator: string | null;
  status: HotkeyRegistrationStatus;
}

interface ActiveTest {
  readonly generation: number;
  readonly target: HotkeyTarget;
  readonly resolve: (result: HotkeyTestResult) => void;
  timer: unknown;
}

function unassignedState(generation = 0): TargetState {
  return {
    authority: HotkeyBindingAuthority.None,
    configured: null,
    effective: null,
    failureCode: undefined,
    generation,
    registeredAccelerator: null,
    status: HotkeyRegistrationStatus.Unassigned,
  };
}

function failedState(
  configured: string | null,
  failureCode: HotkeyRegistrationFailureCode,
  generation: number,
): TargetState {
  return {
    authority: HotkeyBindingAuthority.None,
    configured,
    effective: null,
    failureCode,
    generation,
    registeredAccelerator: null,
    status: HotkeyRegistrationStatus.Failed,
  };
}

/** Sole owner of configured hotkeys, adapter bindings, callback generations, and bounded physical tests. */
export class HotkeyRegistrationService {
  private activeTest: ActiveTest | null = null;
  private disposed = false;
  private dispatchStatus = HotkeyDispatchStatus.Enabled;
  private readonly listeners = new Set<(snapshot: HotkeyRuntimeSnapshot) => void>();
  private mainInteractionLockUnsubscribe: (() => void) | null = null;
  private nextGeneration = 0;
  private started = false;
  private readonly states = new Map<HotkeyTarget, TargetState>();

  public constructor(private readonly dependencies: HotkeyRegistrationServiceDependencies) {
    for (const target of HOTKEY_TARGETS) this.states.set(target, unassignedState());
  }

  public get snapshot(): HotkeyRuntimeSnapshot {
    return Object.freeze({ entries: Object.freeze(HOTKEY_TARGETS.map((target) => this.toEntry(target))) });
  }

  public subscribe(listener: (snapshot: HotkeyRuntimeSnapshot) => void): () => void {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener);
    this.deliver(listener, this.snapshot);
    return () => this.listeners.delete(listener);
  }

  public start(): HotkeyRuntimeSnapshot {
    if (this.disposed || this.started) return this.snapshot;
    this.started = true;
    const settings = this.dependencies.config.getSnapshot();
    for (const target of HOTKEY_TARGETS) {
      const configured = getHotkeyForTarget(settings, target);
      this.states.set(target, unassignedState());
      if (configured !== null) this.registerStartupTarget(target, configured, settings);
    }
    this.publish();
    return this.snapshot;
  }

  public set(target: unknown, accelerator: unknown): HotkeyRegistrationMutationResult {
    if (this.disposed || typeof target !== 'string' || !isHotkeyTarget(target)) {
      return this.failure(HotkeyRegistrationFailureCode.ReconciliationFailed);
    }
    if (typeof accelerator !== 'string') return this.failure(HotkeyRegistrationFailureCode.InvalidAccelerator);
    this.ensureStarted();
    const normalized = normalizeHotkeyForPlatform(accelerator, this.dependencies.platform);
    if (!normalized) return this.failure(HotkeyRegistrationFailureCode.InvalidAccelerator);
    const current = this.requireState(target);
    const configuredSettings = this.dependencies.config.getSnapshot();
    const currentNormalized =
      current.configured && normalizeHotkeyForPlatform(current.configured, this.dependencies.platform);
    if (current.status === HotkeyRegistrationStatus.Registered && currentNormalized === normalized) {
      return Object.freeze({ snapshot: this.snapshot, success: true });
    }
    const candidateSettings = setHotkeyForTarget(configuredSettings, target, accelerator);
    if (getHotkeyConflict(target, accelerator, candidateSettings, this.dependencies.platform)) {
      return this.failure(HotkeyRegistrationFailureCode.InternalConflict);
    }
    const policy = this.validatePolicy(normalized);
    if (!policy.accepted) return this.failure(policy.failureCode);

    const candidateGeneration = this.allocateGeneration();
    if (!this.registerBinding(target, normalized, candidateGeneration)) {
      this.cleanupBinding(normalized);
      return this.failure(HotkeyRegistrationFailureCode.RegistrationRejected);
    }
    try {
      this.dependencies.config.persistHotkey(target, accelerator);
    } catch {
      if (!this.cleanupBinding(normalized)) return this.reconcileFailed(target, current, normalized);
      return Object.freeze({
        failureCode: HotkeyRegistrationFailureCode.PersistenceFailed,
        snapshot: this.snapshot,
        success: false,
      });
    }

    if (current.registeredAccelerator !== null) {
      this.invalidate(target);
      if (!this.cleanupBinding(current.registeredAccelerator))
        return this.reconcileReplacement(target, current, normalized);
    }
    this.states.set(target, {
      authority: policy.bindingAuthority,
      configured: accelerator,
      effective: policy.effectiveAccelerator,
      failureCode: undefined,
      generation: candidateGeneration,
      registeredAccelerator: normalized,
      status: HotkeyRegistrationStatus.Registered,
    });
    this.publish();
    return Object.freeze({ snapshot: this.snapshot, success: true });
  }

  public clear(target: unknown): HotkeyRegistrationMutationResult {
    if (this.disposed || typeof target !== 'string' || !isHotkeyTarget(target)) {
      return this.failure(HotkeyRegistrationFailureCode.ReconciliationFailed);
    }
    this.ensureStarted();
    const current = this.requireState(target);
    if (current.configured === null) return Object.freeze({ snapshot: this.snapshot, success: true });
    try {
      this.dependencies.config.persistHotkey(target, null);
    } catch {
      return Object.freeze({
        failureCode: HotkeyRegistrationFailureCode.PersistenceFailed,
        snapshot: this.snapshot,
        success: false,
      });
    }
    this.invalidate(target);
    if (current.registeredAccelerator === null || this.cleanupBinding(current.registeredAccelerator)) {
      this.states.set(target, unassignedState(this.requireState(target).generation));
      this.publish();
      return Object.freeze({ snapshot: this.snapshot, success: true });
    }
    return this.reconcileClear(target, current);
  }

  public setDispatchSuppressed(suppressed: boolean): void {
    if (this.disposed) return;
    this.dispatchStatus = suppressed ? HotkeyDispatchStatus.Suppressed : HotkeyDispatchStatus.Enabled;
    this.publish();
  }

  /** Connects the one process-owned interaction lock before any window feedback subscribes to it. */
  public connectMainInteractionLock(lock: MainInteractionLock): void {
    if (this.disposed || this.mainInteractionLockUnsubscribe) return;
    this.setDispatchSuppressed(lock.locked);
    this.mainInteractionLockUnsubscribe = lock.subscribe((locked) => this.setDispatchSuppressed(locked));
  }

  public test(target: unknown): Promise<HotkeyTestResult> {
    if (this.disposed || typeof target !== 'string' || !isHotkeyTarget(target)) {
      return Promise.resolve(HotkeyTestResult.Unavailable);
    }
    this.ensureStarted();
    const state = this.requireState(target);
    if (state.status !== HotkeyRegistrationStatus.Registered || state.registeredAccelerator === null) {
      return Promise.resolve(HotkeyTestResult.Unavailable);
    }
    if (this.activeTest) return new Promise((resolve) => resolve(HotkeyTestResult.Unavailable));
    return new Promise((resolve) => {
      const session: ActiveTest = { generation: state.generation, resolve, target, timer: undefined };
      this.activeTest = session;
      try {
        session.timer = this.dependencies.clock.setTimeout(
          () => this.settleTest(session, HotkeyTestResult.TimedOut),
          HOTKEY_TEST_TIMEOUT_MS,
        );
      } catch {
        this.settleTest(session, HotkeyTestResult.TimedOut);
        return;
      }
    });
  }

  public cancelTest(): void {
    this.settleTest(this.activeTest, HotkeyTestResult.Unavailable);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mainInteractionLockUnsubscribe?.();
    this.mainInteractionLockUnsubscribe = null;
    for (const target of HOTKEY_TARGETS) this.invalidate(target);
    this.settleTest(this.activeTest, HotkeyTestResult.Unavailable);
    this.activeTest = null;
    try {
      this.dependencies.adapter.unregisterAll();
    } catch {
      // A shutdown adapter failure cannot restore a disposed service.
    }
    this.listeners.clear();
    this.states.clear();
  }

  private registerStartupTarget(target: HotkeyTarget, configured: string, settings: HotkeySettings): void {
    const normalized = normalizeHotkeyForPlatform(configured, this.dependencies.platform);
    if (!normalized) return this.setFailure(target, configured, HotkeyRegistrationFailureCode.InvalidAccelerator);
    if (getHotkeyConflict(target, configured, settings, this.dependencies.platform)) {
      return this.setFailure(target, configured, HotkeyRegistrationFailureCode.InternalConflict);
    }
    const policy = this.validatePolicy(normalized);
    if (!policy.accepted) return this.setFailure(target, configured, policy.failureCode);
    const generation = this.allocateGeneration();
    if (!this.registerBinding(target, normalized, generation)) {
      this.cleanupBinding(normalized);
      return this.setFailure(target, configured, HotkeyRegistrationFailureCode.RegistrationRejected);
    }
    this.states.set(target, {
      authority: policy.bindingAuthority,
      configured,
      effective: policy.effectiveAccelerator,
      failureCode: undefined,
      generation,
      registeredAccelerator: normalized,
      status: HotkeyRegistrationStatus.Registered,
    });
  }

  private registerBinding(target: HotkeyTarget, accelerator: string, generation: number): boolean {
    try {
      return (
        this.dependencies.adapter.register(accelerator, () => this.onCallback(target, generation)) &&
        this.dependencies.adapter.isRegistered(accelerator)
      );
    } catch {
      return false;
    }
  }

  private onCallback(target: HotkeyTarget, generation: number): void {
    if (this.disposed || this.requireState(target).generation !== generation) return;
    const test = this.activeTest;
    if (test?.target === target && test.generation === generation) {
      this.settleTest(test, HotkeyTestResult.Detected);
      return;
    }
    if (this.dispatchStatus === HotkeyDispatchStatus.Suppressed) return;
    try {
      this.dependencies.callbacks[target]();
    } catch {
      this.log('warn', 'Hotkey product callback failed', target);
    }
  }

  private cleanupBinding(accelerator: string): boolean {
    try {
      this.dependencies.adapter.unregister(accelerator);
      return !this.dependencies.adapter.isRegistered(accelerator);
    } catch {
      return false;
    }
  }

  private reconcileReplacement(
    target: HotkeyTarget,
    previous: TargetState,
    candidate: string,
  ): HotkeyRegistrationMutationResult {
    this.invalidate(target);
    const candidateClean = this.cleanupBinding(candidate);
    let persisted = true;
    try {
      this.dependencies.config.persistHotkey(target, previous.configured);
    } catch {
      persisted = false;
    }
    if (candidateClean && persisted && this.restorePrevious(target, previous))
      return this.failure(HotkeyRegistrationFailureCode.ReconciliationFailed);
    return this.reconcileFailed(target, previous, candidate);
  }

  private reconcileClear(target: HotkeyTarget, previous: TargetState): HotkeyRegistrationMutationResult {
    try {
      this.dependencies.config.persistHotkey(target, previous.configured);
    } catch {
      return this.reconcileFailed(target, previous, null);
    }
    if (this.restorePrevious(target, previous)) return this.failure(HotkeyRegistrationFailureCode.ReconciliationFailed);
    return this.reconcileFailed(target, previous, null);
  }

  private restorePrevious(target: HotkeyTarget, previous: TargetState): boolean {
    if (previous.configured === null || previous.registeredAccelerator === null) return false;
    this.cleanupBinding(previous.registeredAccelerator);
    const generation = this.allocateGeneration();
    if (!this.registerBinding(target, previous.registeredAccelerator, generation)) return false;
    this.states.set(target, { ...previous, generation });
    this.publish();
    return true;
  }

  private reconcileFailed(
    target: HotkeyTarget,
    previous: TargetState,
    candidate: string | null,
  ): HotkeyRegistrationMutationResult {
    if (candidate) this.cleanupBinding(candidate);
    this.invalidate(target);
    this.states.set(
      target,
      failedState(
        this.getConfiguredAccelerator(target, previous.configured),
        HotkeyRegistrationFailureCode.ReconciliationFailed,
        this.requireState(target).generation,
      ),
    );
    this.publish();
    return this.failure(HotkeyRegistrationFailureCode.ReconciliationFailed);
  }

  private setFailure(target: HotkeyTarget, configured: string | null, code: HotkeyRegistrationFailureCode): void {
    this.invalidate(target);
    this.states.set(target, failedState(configured, code, this.requireState(target).generation));
  }

  private invalidate(target: HotkeyTarget): void {
    const current = this.requireState(target);
    this.settleTestForTarget(target, current.generation);
    this.states.set(target, { ...current, generation: this.allocateGeneration() });
  }

  private allocateGeneration(): number {
    this.nextGeneration += 1;
    return this.nextGeneration;
  }

  private ensureStarted(): void {
    if (!this.started && !this.disposed) this.start();
  }

  private getConfiguredAccelerator(target: HotkeyTarget, fallback: string | null): string | null {
    try {
      return getHotkeyForTarget(this.dependencies.config.getSnapshot(), target);
    } catch {
      return fallback;
    }
  }

  private settleTestForTarget(target: HotkeyTarget, generation: number): void {
    const test = this.activeTest;
    if (test?.target === target && test.generation === generation) {
      this.settleTest(test, HotkeyTestResult.Unavailable);
    }
  }

  private validatePolicy(normalizedAccelerator: string): HotkeyPlatformPolicyResult {
    try {
      const result = this.dependencies.policy.validate(normalizedAccelerator);
      if (!result.accepted) {
        return isHotkeyRegistrationFailureCode(result.failureCode)
          ? result
          : Object.freeze({ accepted: false, failureCode: HotkeyRegistrationFailureCode.RegistrationRejected });
      }
      if (
        (result.bindingAuthority === HotkeyBindingAuthority.Application &&
          result.effectiveAccelerator === normalizedAccelerator) ||
        (result.bindingAuthority === HotkeyBindingAuthority.DesktopEnvironment && result.effectiveAccelerator === null)
      ) {
        return result;
      }
      return Object.freeze({ accepted: false, failureCode: HotkeyRegistrationFailureCode.RegistrationRejected });
    } catch {
      return Object.freeze({ accepted: false, failureCode: HotkeyRegistrationFailureCode.RegistrationRejected });
    }
  }

  private settleTest(session: ActiveTest | null, result: HotkeyTestResult): void {
    if (!session || this.activeTest !== session) return;
    this.activeTest = null;
    try {
      this.dependencies.clock.clearTimeout(session.timer);
    } catch {
      /* A settled test remains terminal. */
    }
    session.resolve(result);
  }

  private toEntry(target: HotkeyTarget): HotkeyRuntimeSnapshotEntry {
    const state = this.requireState(target);
    return Object.freeze({
      bindingAuthority: state.authority,
      configuredAccelerator: state.configured,
      dispatchStatus: this.dispatchStatus,
      effectiveAccelerator: state.effective,
      ...(state.failureCode ? { failureCode: state.failureCode } : {}),
      registrationStatus: state.status,
      target,
    });
  }

  private requireState(target: HotkeyTarget): TargetState {
    return this.states.get(target) ?? unassignedState();
  }

  private publish(): void {
    const snapshot = this.snapshot;
    for (const listener of [...this.listeners]) this.deliver(listener, snapshot);
  }

  private deliver(listener: (snapshot: HotkeyRuntimeSnapshot) => void, snapshot: HotkeyRuntimeSnapshot): void {
    try {
      listener(snapshot);
    } catch {
      this.log('warn', 'Hotkey snapshot subscriber failed');
    }
  }

  private failure(code: HotkeyRegistrationFailureCode): HotkeyRegistrationMutationResult {
    return Object.freeze({ failureCode: code, snapshot: this.snapshot, success: false });
  }

  private log(level: 'info' | 'warn', message: string, target?: HotkeyTarget): void {
    try {
      this.dependencies.logger[level](message, target ? { target } : undefined);
    } catch {
      /* Logging cannot alter ownership. */
    }
  }
}
