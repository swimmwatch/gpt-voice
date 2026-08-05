import {
  FIRST_LAUNCH_STARTUP_FAILURE_CODES,
  FIRST_LAUNCH_STARTUP_JOB_STATES,
  FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES,
  createFirstLaunchStartupSnapshot,
  type FirstLaunchStartupFailureCode,
  type FirstLaunchStartupJob,
  type FirstLaunchStartupJobId,
  type FirstLaunchStartupJobRunResult,
  type FirstLaunchStartupSnapshot,
} from '@shared/firstLaunchStartup';

export interface FirstLaunchStartupJobRunner {
  readonly id: FirstLaunchStartupJobId;
  run(): Promise<FirstLaunchStartupJobRunResult>;
}

export interface FirstLaunchStartupCoordinatorDependencies {
  readonly jobRunners: readonly FirstLaunchStartupJobRunner[];
}

export type FirstLaunchStartupSnapshotListener = (snapshot: FirstLaunchStartupSnapshot) => void;

function createPendingJob(id: FirstLaunchStartupJobId): FirstLaunchStartupJob {
  return Object.freeze({
    completedUnits: 0,
    failureCode: null,
    id,
    state: FIRST_LAUNCH_STARTUP_JOB_STATES.Pending,
    totalUnits: 1,
  });
}

function normalizeFailure(result: FirstLaunchStartupJobRunResult): FirstLaunchStartupFailureCode {
  return result.failureCode ?? FIRST_LAUNCH_STARTUP_FAILURE_CODES.InitializationFailed;
}

/** Owns generation-safe startup preparation without exposing dependency errors to the renderer. */
export class FirstLaunchStartupCoordinator {
  private activeAttempt: Promise<FirstLaunchStartupSnapshot> | null = null;
  private disposed = false;
  private readonly listeners = new Set<FirstLaunchStartupSnapshotListener>();
  private snapshotValue: FirstLaunchStartupSnapshot;

  public constructor(private readonly dependencies: FirstLaunchStartupCoordinatorDependencies) {
    const runnerIds = dependencies.jobRunners.map((runner) => runner.id);
    if (runnerIds.length === 0 || new Set(runnerIds).size !== runnerIds.length) {
      throw new Error('First-launch startup jobs must be non-empty and unique');
    }
    this.snapshotValue = createFirstLaunchStartupSnapshot({
      generation: 0,
      jobs: runnerIds.map(createPendingJob),
      retryable: false,
      state: FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Pending,
    });
  }

  public getSnapshot(): FirstLaunchStartupSnapshot {
    return this.snapshotValue;
  }

  public subscribe(listener: FirstLaunchStartupSnapshotListener): () => void {
    this.assertActive();
    this.listeners.add(listener);
    listener(this.snapshotValue);
    return () => this.listeners.delete(listener);
  }

  public start(): Promise<FirstLaunchStartupSnapshot> {
    this.assertActive();
    if (this.activeAttempt) return this.activeAttempt;
    if (this.snapshotValue.state !== FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Pending) {
      return Promise.resolve(this.snapshotValue);
    }
    return this.beginAttempt(
      this.snapshotValue.generation + 1,
      this.snapshotValue.jobs.map((job) => ({ ...job })),
    );
  }

  public async retry(): Promise<FirstLaunchStartupSnapshot> {
    this.assertActive();
    if (this.activeAttempt) {
      await this.activeAttempt;
      return this.retry();
    }
    if (this.snapshotValue.state !== FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed) {
      return this.snapshotValue;
    }
    return this.beginAttempt(
      this.snapshotValue.generation + 1,
      this.snapshotValue.jobs.map((job) =>
        job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Failed ? createPendingJob(job.id) : { ...job },
      ),
    );
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
  }

  private beginAttempt(generation: number, jobs: readonly FirstLaunchStartupJob[]): Promise<FirstLaunchStartupSnapshot> {
    this.publish(
      createFirstLaunchStartupSnapshot({
        generation,
        jobs,
        retryable: false,
        state: FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running,
      }),
    );
    const attempt = this.runPendingJobs(generation);
    this.activeAttempt = attempt;
    void attempt.finally(() => {
      if (this.activeAttempt === attempt) this.activeAttempt = null;
    });
    return attempt;
  }

  private async runPendingJobs(generation: number): Promise<FirstLaunchStartupSnapshot> {
    const pendingJobIds = this.snapshotValue.jobs
      .filter((job) => job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Pending)
      .map((job) => job.id);
    await Promise.all(pendingJobIds.map((jobId) => this.runJob(generation, jobId)));
    return this.snapshotValue;
  }

  private async runJob(generation: number, jobId: FirstLaunchStartupJobId): Promise<void> {
    const runner = this.dependencies.jobRunners.find((candidate) => candidate.id === jobId);
    if (!runner) return;
    this.transitionJob(generation, jobId, {
      completedUnits: 0,
      failureCode: null,
      state: FIRST_LAUNCH_STARTUP_JOB_STATES.Running,
      totalUnits: 1,
    });
    try {
      const result = await runner.run();
      if (result.success && result.failureCode === null) {
        this.transitionJob(generation, jobId, {
          completedUnits: 1,
          failureCode: null,
          state: FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded,
          totalUnits: 1,
        });
        return;
      }
      this.transitionJob(generation, jobId, {
        completedUnits: 0,
        failureCode: normalizeFailure(result),
        state: FIRST_LAUNCH_STARTUP_JOB_STATES.Failed,
        totalUnits: 1,
      });
    } catch {
      this.transitionJob(generation, jobId, {
        completedUnits: 0,
        failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InitializationFailed,
        state: FIRST_LAUNCH_STARTUP_JOB_STATES.Failed,
        totalUnits: 1,
      });
    }
  }

  private transitionJob(
    generation: number,
    jobId: FirstLaunchStartupJobId,
    update: Omit<FirstLaunchStartupJob, 'id'>,
  ): void {
    if (this.disposed || this.snapshotValue.generation !== generation) return;
    const currentJob = this.snapshotValue.jobs.find((job) => job.id === jobId);
    if (
      !currentJob ||
      currentJob.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Failed ||
      currentJob.state === FIRST_LAUNCH_STARTUP_JOB_STATES.NotRequired ||
      currentJob.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded
    ) {
      return;
    }
    const jobs = this.snapshotValue.jobs.map((job) => (job.id === jobId ? { ...update, id: jobId } : { ...job }));
    const hasFailedJob = jobs.some((job) => job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Failed);
    const completed = jobs.every(
      (job) =>
        job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.NotRequired ||
        job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded,
    );
    this.publish(
      createFirstLaunchStartupSnapshot({
        generation,
        jobs,
        retryable: hasFailedJob,
        state: hasFailedJob
          ? FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed
          : completed
            ? FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded
            : FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running,
      }),
    );
  }

  private publish(snapshot: FirstLaunchStartupSnapshot): void {
    this.snapshotValue = snapshot;
    for (const listener of [...this.listeners]) {
      try {
        listener(snapshot);
      } catch {
        // A renderer listener cannot break startup preparation ownership.
      }
    }
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('First-launch startup coordinator is disposed');
  }
}
