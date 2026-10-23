import type { AlphaSmokeEvidenceSealer } from './AlphaSmokeEvidenceSealer';
import type { AlphaSmokeDeadline } from './LinuxAlphaSmokeClock';
import type { PlatformAlphaSmokeAdapter } from './PlatformAlphaSmokeAdapter';
import { ALPHA_SMOKE_INTERRUPTED_STATES } from './AlphaSmokeProtocol';
import type {
  AlphaSmokeAttempt,
  AlphaSmokeCompletionEvidence,
  AlphaSmokePublicInput,
  AlphaSmokeOutcome,
  AlphaSmokeStateName,
  AlphaSmokeVerifiedStage,
} from './AlphaSmokeProtocol';

export interface AlphaSmokeStateStore {
  read(): Promise<AlphaSmokeAttempt | null>;
  sealAttemptStart(attempt: AlphaSmokeAttempt): Promise<void>;
  write(attempt: AlphaSmokeAttempt): Promise<void>;
  recordVerifiedStage(attempt: AlphaSmokeAttempt, stage: AlphaSmokeVerifiedStage): Promise<void>;
  assertVerifiedStages(attempt: AlphaSmokeAttempt): Promise<void>;
}

export interface AlphaSmokeClock {
  now(): number;
  capture?(durationMilliseconds: number): AlphaSmokeDeadline;
  remaining?(deadline: AlphaSmokeDeadline): number;
}

export const ALPHA_SMOKE_DEADLINE_MILLISECONDS = 2 * 60 * 60 * 1_000;

const UNKNOWN_COMPLETION = Object.freeze({
  packageStatus: 'unverified',
  settingsBackupStatus: 'unverified',
} as const);

/** Owns the revision-28 phase transitions and makes every post-start failure seal exactly once. */
export class AlphaSmokeSession {
  public constructor(
    private readonly dependencies: Readonly<{
      adapter: PlatformAlphaSmokeAdapter;
      clock: AlphaSmokeClock;
      sealer: AlphaSmokeEvidenceSealer;
      stateStore: AlphaSmokeStateStore;
    }>,
  ) {}

  public async prepare(
    attemptId: string,
    input: AlphaSmokePublicInput,
    operationStartedAtEpochMilliseconds = this.dependencies.clock.now(),
    monotonicDeadline: AlphaSmokeDeadline | null = this.dependencies.clock.capture?.(
      ALPHA_SMOKE_DEADLINE_MILLISECONDS,
    ) ?? null,
  ): Promise<AlphaSmokeAttempt> {
    const existing = await this.dependencies.stateStore.read();
    if (existing !== null) throw new Error('ALPHA_SMOKE_RESUME_EXISTS');
    let attempt: AlphaSmokeAttempt = Object.freeze({
      schemaVersion: 2,
      monotonicDeadline,
      completion: null,
      terminalOutcome: null,
      attemptId,
      deadlineEpochMilliseconds: operationStartedAtEpochMilliseconds + ALPHA_SMOKE_DEADLINE_MILLISECONDS,
      input,
      packageDisposition: null,
      settingsBackupStatus: 'pending',
      startedAtEpochMilliseconds: null,
      state: 'Preparing',
    });
    this.assertTime(attempt);
    const preparation = await this.dependencies.adapter.preflight(attempt);
    attempt = Object.freeze({
      ...attempt,
      packageDisposition: preparation.packageDisposition,
      settingsBackupStatus: preparation.settingsBackupStatus,
    });
    attempt = await this.transition(attempt, 'SettingsBackedUp');
    return await this.transition(attempt, 'AwaitingPackageReady');
  }

  public async exercise(evidenceRoot: string, expectedAttemptId: string): Promise<'ReadyToSeal' | 'Fail'> {
    const initial = await this.requiredAttempt(expectedAttemptId, false);
    if (initial.startedAtEpochMilliseconds !== null && ALPHA_SMOKE_INTERRUPTED_STATES.includes(initial.state))
      return await this.finalizeAndSealFailure(evidenceRoot, initial, 'interrupted_attempt');
    if (
      initial.state !== 'AwaitingPackageReady' ||
      initial.packageDisposition === null ||
      initial.settingsBackupStatus !== 'retained-private'
    ) {
      throw new Error('ALPHA_SMOKE_EXERCISE_STATE_INVALID');
    }
    await this.dependencies.adapter.revalidateBeforeAttempt(initial);
    this.assertTime(initial);
    let attempt: AlphaSmokeAttempt = Object.freeze({
      ...initial,
      startedAtEpochMilliseconds: this.dependencies.clock.now(),
    });
    await this.dependencies.stateStore.sealAttemptStart(attempt);
    try {
      await this.dependencies.stateStore.write(attempt);
      this.assertTime(attempt);
      await this.dependencies.adapter.ensurePackageReady(attempt);
      attempt = await this.transition(attempt, 'PackageReady');
      attempt = await this.transition(attempt, 'CpuExercise');
      await this.dependencies.adapter.exerciseCpu(attempt);
      await this.dependencies.stateStore.recordVerifiedStage(attempt, 'cpu');
      attempt = await this.transition(attempt, 'CudaExercise');
      await this.dependencies.adapter.exerciseCuda(attempt);
      await this.dependencies.stateStore.recordVerifiedStage(attempt, 'cuda');
      attempt = await this.transition(attempt, 'OfflineExercise');
      await this.dependencies.adapter.exerciseOfflineCuda(attempt);
      await this.dependencies.stateStore.recordVerifiedStage(attempt, 'offline-cuda');
      attempt = await this.transition(attempt, 'Finalizing');
      const completion = await this.dependencies.adapter.finalize(attempt);
      await this.dependencies.stateStore.recordVerifiedStage(attempt, 'cleanup');
      this.assertTime(attempt);
      attempt = Object.freeze({ ...attempt, completion, terminalOutcome: 'qualified' });
      await this.transition(attempt, 'ReadyToSeal');
      return 'ReadyToSeal';
    } catch {
      return await this.finalizeAndSealFailure(evidenceRoot, attempt, 'functional_failure');
    }
  }

  public async seal(evidenceRoot: string, expectedAttemptId: string): Promise<'Pass' | 'Fail'> {
    let attempt = await this.requiredAttempt(expectedAttemptId, false);
    if (attempt.state === 'SealedFail') return 'Fail';
    if (attempt.startedAtEpochMilliseconds !== null && ALPHA_SMOKE_INTERRUPTED_STATES.includes(attempt.state))
      return await this.finalizeAndSealFailure(evidenceRoot, attempt, 'interrupted_attempt');
    if (
      !['ReadyToSeal', 'Sealing', 'SealedPass'].includes(attempt.state) ||
      attempt.completion === null ||
      attempt.terminalOutcome === null
    )
      throw new Error('ALPHA_SMOKE_SEAL_STATE_INVALID');
    const expired = this.isTimeExhausted(attempt);
    if (attempt.terminalOutcome === 'qualified') {
      try {
        await this.dependencies.stateStore.assertVerifiedStages(attempt);
      } catch {
        attempt = Object.freeze({ ...attempt, terminalOutcome: 'verification_evidence_missing' });
      }
    }
    // Persist the final decision before either immutable document is written.
    if (attempt.state === 'ReadyToSeal' && expired && attempt.terminalOutcome === 'qualified') {
      attempt = Object.freeze({ ...attempt, terminalOutcome: 'deadline_exhausted' });
      await this.dependencies.stateStore.write(attempt);
    }
    if (attempt.state !== 'Sealing') attempt = await this.transitionWithoutDeadline(attempt, 'Sealing');
    if (attempt.terminalOutcome === null || attempt.completion === null)
      throw new Error('ALPHA_SMOKE_SEAL_STATE_INVALID');
    const status = attempt.terminalOutcome === 'qualified' ? 'Pass' : 'Fail';
    await this.dependencies.sealer.seal(evidenceRoot, attempt, status, attempt.terminalOutcome, attempt.completion);
    await this.transitionWithoutDeadline(attempt, status === 'Pass' ? 'SealedPass' : 'SealedFail');
    return status;
  }

  private async requiredAttempt(expectedAttemptId: string, requireTime: boolean): Promise<AlphaSmokeAttempt> {
    const attempt = await this.dependencies.stateStore.read();
    if (!attempt || attempt.attemptId !== expectedAttemptId) throw new Error('ALPHA_SMOKE_RESUME_INVALID');
    if (requireTime) this.assertTime(attempt);
    return attempt;
  }

  private async finalizeAndSealFailure(
    evidenceRoot: string,
    attempt: AlphaSmokeAttempt,
    outcome: 'functional_failure' | 'interrupted_attempt',
  ): Promise<'Fail'> {
    let finalizingAttempt = attempt;
    let completion: AlphaSmokeCompletionEvidence;
    try {
      finalizingAttempt = await this.transitionWithoutDeadline(attempt, 'Finalizing');
      completion = await this.dependencies.adapter.finalize(finalizingAttempt);
    } catch {
      return await this.sealObservedFailure(evidenceRoot, finalizingAttempt, `${outcome}_and_finalization_failure`);
    }
    finalizingAttempt = Object.freeze({ ...finalizingAttempt, completion, terminalOutcome: outcome });
    finalizingAttempt = await this.transitionWithoutDeadline(finalizingAttempt, 'Sealing');
    await this.dependencies.sealer.seal(evidenceRoot, finalizingAttempt, 'Fail', outcome, completion);
    await this.transitionWithoutDeadline(finalizingAttempt, 'SealedFail');
    return 'Fail';
  }

  private async sealObservedFailure(
    evidenceRoot: string,
    attempt: AlphaSmokeAttempt,
    outcome: AlphaSmokeOutcome,
  ): Promise<'Fail'> {
    let completion: AlphaSmokeCompletionEvidence = UNKNOWN_COMPLETION;
    try {
      completion = await this.dependencies.adapter.observeCompletion(attempt);
    } catch {
      // Normalized unknown state is safer than leaking host diagnostics into repository evidence.
    }
    const sealingAttempt = await this.transitionWithoutDeadline(
      Object.freeze({ ...attempt, completion, terminalOutcome: outcome }),
      'Sealing',
    );
    await this.dependencies.sealer.seal(evidenceRoot, sealingAttempt, 'Fail', outcome, completion);
    await this.transitionWithoutDeadline(sealingAttempt, 'SealedFail');
    return 'Fail';
  }

  private async transition(attempt: AlphaSmokeAttempt, state: AlphaSmokeStateName): Promise<AlphaSmokeAttempt> {
    this.assertTime(attempt);
    return await this.transitionWithoutDeadline(attempt, state);
  }

  private async transitionWithoutDeadline(
    attempt: AlphaSmokeAttempt,
    state: AlphaSmokeStateName,
  ): Promise<AlphaSmokeAttempt> {
    const next = Object.freeze({ ...attempt, state });
    await this.dependencies.stateStore.write(next);
    return next;
  }

  private isTimeExhausted(attempt: AlphaSmokeAttempt): boolean {
    if (this.dependencies.clock.remaining) {
      if (attempt.monotonicDeadline === null) return true;
      try {
        return this.dependencies.clock.remaining(attempt.monotonicDeadline) <= 0;
      } catch {
        return true;
      }
    }
    return this.dependencies.clock.now() > attempt.deadlineEpochMilliseconds;
  }

  private assertTime(attempt: AlphaSmokeAttempt): void {
    if (this.isTimeExhausted(attempt)) throw new Error('ALPHA_SMOKE_DEADLINE_EXHAUSTED');
  }
}
