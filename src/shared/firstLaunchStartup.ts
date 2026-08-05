export const FIRST_LAUNCH_STARTUP_JOB_IDS = {
  CloakBrowser: 'cloakbrowser',
  Prettify: 'prettify',
  Translation: 'translation',
  VoiceProvider: 'voice-provider',
} as const;

export const FIRST_LAUNCH_STARTUP_JOB_STATES = {
  Failed: 'failed',
  NotRequired: 'not-required',
  Pending: 'pending',
  Running: 'running',
  Succeeded: 'succeeded',
} as const;

export const FIRST_LAUNCH_STARTUP_FAILURE_CODES = {
  InitializationFailed: 'initialization-failed',
  InstallationFailed: 'installation-failed',
  VerificationFailed: 'verification-failed',
} as const;

export const FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES = {
  Failed: 'failed',
  Pending: 'pending',
  Running: 'running',
  Succeeded: 'succeeded',
} as const;

export const FIRST_LAUNCH_STARTUP_IPC_CHANNELS = {
  changed: 'first-launch-startup:changed',
  retry: 'first-launch-startup:retry',
  snapshotQuery: 'first-launch-startup:snapshot-query',
} as const;

const FIRST_LAUNCH_STARTUP_SNAPSHOT_KEYS = ['generation', 'jobs', 'progress', 'retryable', 'state'] as const;
const FIRST_LAUNCH_STARTUP_JOB_KEYS = ['completedUnits', 'failureCode', 'id', 'state', 'totalUnits'] as const;
const MAX_STARTUP_WORK_UNITS = 1_000_000;

export type FirstLaunchStartupJobId = (typeof FIRST_LAUNCH_STARTUP_JOB_IDS)[keyof typeof FIRST_LAUNCH_STARTUP_JOB_IDS];
export type FirstLaunchStartupJobState =
  (typeof FIRST_LAUNCH_STARTUP_JOB_STATES)[keyof typeof FIRST_LAUNCH_STARTUP_JOB_STATES];
export type FirstLaunchStartupFailureCode =
  (typeof FIRST_LAUNCH_STARTUP_FAILURE_CODES)[keyof typeof FIRST_LAUNCH_STARTUP_FAILURE_CODES];
export type FirstLaunchStartupSnapshotState =
  (typeof FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES)[keyof typeof FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES];

export interface FirstLaunchStartupJob {
  readonly completedUnits: number;
  readonly failureCode: FirstLaunchStartupFailureCode | null;
  readonly id: FirstLaunchStartupJobId;
  readonly state: FirstLaunchStartupJobState;
  readonly totalUnits: number | null;
}

export interface FirstLaunchStartupSnapshot {
  readonly generation: number;
  readonly jobs: readonly FirstLaunchStartupJob[];
  readonly progress: number | null;
  readonly retryable: boolean;
  readonly state: FirstLaunchStartupSnapshotState;
}

export interface FirstLaunchStartupJobRunResult {
  readonly failureCode: FirstLaunchStartupFailureCode | null;
  readonly success: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isWorkUnitCount(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= MAX_STARTUP_WORK_UNITS;
}

function isFirstLaunchStartupJobId(value: unknown): value is FirstLaunchStartupJobId {
  return Object.values(FIRST_LAUNCH_STARTUP_JOB_IDS).includes(value as FirstLaunchStartupJobId);
}

function isFirstLaunchStartupJobState(value: unknown): value is FirstLaunchStartupJobState {
  return Object.values(FIRST_LAUNCH_STARTUP_JOB_STATES).includes(value as FirstLaunchStartupJobState);
}

function isFirstLaunchStartupFailureCode(value: unknown): value is FirstLaunchStartupFailureCode {
  return Object.values(FIRST_LAUNCH_STARTUP_FAILURE_CODES).includes(value as FirstLaunchStartupFailureCode);
}

function isFirstLaunchStartupSnapshotState(value: unknown): value is FirstLaunchStartupSnapshotState {
  return Object.values(FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES).includes(value as FirstLaunchStartupSnapshotState);
}

function isValidJobWork(job: FirstLaunchStartupJob): boolean {
  if (job.totalUnits === null) return job.completedUnits === 0;
  if (job.completedUnits > job.totalUnits) return false;
  switch (job.state) {
    case FIRST_LAUNCH_STARTUP_JOB_STATES.Failed:
      return job.totalUnits > 0 && job.failureCode !== null && job.completedUnits < job.totalUnits;
    case FIRST_LAUNCH_STARTUP_JOB_STATES.NotRequired:
      return job.totalUnits === 0 && job.completedUnits === 0 && job.failureCode === null;
    case FIRST_LAUNCH_STARTUP_JOB_STATES.Pending:
      return job.totalUnits > 0 && job.completedUnits === 0 && job.failureCode === null;
    case FIRST_LAUNCH_STARTUP_JOB_STATES.Running:
      return job.totalUnits > 0 && job.completedUnits < job.totalUnits && job.failureCode === null;
    case FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded:
      return job.totalUnits > 0 && job.completedUnits === job.totalUnits && job.failureCode === null;
  }
}

function isFirstLaunchStartupJob(value: unknown): value is FirstLaunchStartupJob {
  if (!isRecord(value) || !hasExactKeys(value, FIRST_LAUNCH_STARTUP_JOB_KEYS)) return false;
  const totalUnits = value.totalUnits;
  if (totalUnits !== null && !isWorkUnitCount(totalUnits)) return false;
  if (!isWorkUnitCount(value.completedUnits) || !isFirstLaunchStartupJobId(value.id)) return false;
  if (!isFirstLaunchStartupJobState(value.state)) return false;
  if (value.failureCode !== null && !isFirstLaunchStartupFailureCode(value.failureCode)) return false;
  return isValidJobWork({
    completedUnits: value.completedUnits,
    failureCode: value.failureCode,
    id: value.id,
    state: value.state,
    totalUnits,
  });
}

function hasValidSnapshotState(snapshot: Omit<FirstLaunchStartupSnapshot, 'progress'>): boolean {
  const hasFailedJob = snapshot.jobs.some((job) => job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Failed);
  const allTerminal = snapshot.jobs.every(
    (job) =>
      job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.NotRequired ||
      job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded,
  );
  switch (snapshot.state) {
    case FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed:
      return hasFailedJob && snapshot.retryable;
    case FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Pending:
      return snapshot.jobs.every((job) => job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Pending) && !snapshot.retryable;
    case FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running:
      return !hasFailedJob && !allTerminal && !snapshot.retryable;
    case FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded:
      return allTerminal && !snapshot.retryable;
  }
}

function freezeJob(job: FirstLaunchStartupJob): FirstLaunchStartupJob {
  return Object.freeze({ ...job });
}

/** Returns the only allowed aggregate: measured completed work units over their known total. */
export function getFirstLaunchStartupProgress(jobs: readonly FirstLaunchStartupJob[]): number | null {
  if (jobs.length === 0 || jobs.some((job) => job.totalUnits === null)) return null;
  const completedUnits = jobs.reduce((total, job) => total + job.completedUnits, 0);
  const totalUnits = jobs.reduce((total, job) => total + (job.totalUnits ?? 0), 0);
  if (totalUnits === 0) return null;
  return Math.round((completedUnits / totalUnits) * 100);
}

/** Orders active jobs by stable product priority instead of event arrival order. */
export function getActiveFirstLaunchStartupJobIds(
  jobs: readonly FirstLaunchStartupJob[],
): readonly FirstLaunchStartupJobId[] {
  const activeIds = new Set(
    jobs
      .filter(
        (job) =>
          job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Pending ||
          job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Running,
      )
      .map((job) => job.id),
  );
  return Object.freeze(Object.values(FIRST_LAUNCH_STARTUP_JOB_IDS).filter((jobId) => activeIds.has(jobId)));
}

export function createFirstLaunchStartupSnapshot(input: {
  readonly generation: number;
  readonly jobs: readonly FirstLaunchStartupJob[];
  readonly retryable: boolean;
  readonly state: FirstLaunchStartupSnapshotState;
}): FirstLaunchStartupSnapshot {
  const jobs = Object.freeze(input.jobs.map(freezeJob));
  const snapshot = {
    generation: input.generation,
    jobs,
    retryable: input.retryable,
    state: input.state,
  };
  if (!isNonNegativeInteger(snapshot.generation) || jobs.length === 0 || !hasValidSnapshotState(snapshot)) {
    throw new Error('Invalid first-launch startup snapshot');
  }
  const progress = getFirstLaunchStartupProgress(jobs);
  return Object.freeze({ ...snapshot, progress });
}

export function isFirstLaunchStartupSnapshot(value: unknown): value is FirstLaunchStartupSnapshot {
  if (!isRecord(value) || !hasExactKeys(value, FIRST_LAUNCH_STARTUP_SNAPSHOT_KEYS)) return false;
  if (!isNonNegativeInteger(value.generation) || !Array.isArray(value.jobs) || value.jobs.length === 0) return false;
  if (!value.jobs.every(isFirstLaunchStartupJob) || !isFirstLaunchStartupSnapshotState(value.state)) return false;
  if (typeof value.retryable !== 'boolean') return false;
  const jobIds = new Set(value.jobs.map((job) => job.id));
  if (jobIds.size !== value.jobs.length) return false;
  const snapshot = {
    generation: value.generation,
    jobs: value.jobs,
    retryable: value.retryable,
    state: value.state,
  };
  return value.progress === getFirstLaunchStartupProgress(value.jobs) && hasValidSnapshotState(snapshot);
}

export function sanitizeFirstLaunchStartupSnapshot(value: unknown): FirstLaunchStartupSnapshot | null {
  if (!isFirstLaunchStartupSnapshot(value)) return null;
  return createFirstLaunchStartupSnapshot(value);
}
