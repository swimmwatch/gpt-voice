import type {
  AlphaSmokeAttempt,
  AlphaSmokeCompletionEvidence,
  AlphaSmokePackageDisposition,
  AlphaSmokePlatform,
} from './AlphaSmokeProtocol';

export interface AlphaSmokeExerciseEvidence {
  readonly backend: 'cpu' | 'cuda' | 'offline-cuda';
  readonly outcome: 'verified';
}

export interface AlphaSmokePreparationEvidence {
  readonly packageDisposition: AlphaSmokePackageDisposition;
  readonly settingsBackupStatus: 'retained-private';
}

/** Platform ports isolate package, process, GPU, backup, and offline observations from orchestration. */
export interface PlatformAlphaSmokeAdapter {
  readonly platform: AlphaSmokePlatform;
  preflight(input: AlphaSmokeAttempt): Promise<AlphaSmokePreparationEvidence>;
  revalidateBeforeAttempt(input: AlphaSmokeAttempt): Promise<void>;
  ensurePackageReady(input: AlphaSmokeAttempt): Promise<void>;
  exerciseCpu(input: AlphaSmokeAttempt): Promise<AlphaSmokeExerciseEvidence>;
  exerciseCuda(input: AlphaSmokeAttempt): Promise<AlphaSmokeExerciseEvidence>;
  exerciseOfflineCuda(input: AlphaSmokeAttempt): Promise<AlphaSmokeExerciseEvidence>;
  finalize(input: AlphaSmokeAttempt): Promise<AlphaSmokeCompletionEvidence>;
  observeCompletion(input: AlphaSmokeAttempt): Promise<AlphaSmokeCompletionEvidence>;
}
