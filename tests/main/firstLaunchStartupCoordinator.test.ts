import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FIRST_LAUNCH_STARTUP_FAILURE_CODES,
  FIRST_LAUNCH_STARTUP_JOB_IDS,
  FIRST_LAUNCH_STARTUP_JOB_STATES,
  FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES,
  type FirstLaunchStartupJob,
  type FirstLaunchStartupJobId,
  type FirstLaunchStartupJobRunResult,
  type FirstLaunchStartupSnapshot,
} from '@shared/firstLaunchStartup';
import {
  FirstLaunchStartupCoordinator,
  type FirstLaunchStartupJobRunner,
} from '@main/firstLaunchStartupCoordinator';

interface Deferred<T> {
  readonly promise: Promise<T>;
  reject(reason: unknown): void;
  resolve(value: T): void;
}

interface CoordinatorTestHook {
  transitionJob(
    generation: number,
    jobId: FirstLaunchStartupJobId,
    update: Omit<FirstLaunchStartupJob, 'id'>,
  ): void;
}

function createDeferred<T>(): Deferred<T> {
  let rejectPromise: (reason: unknown) => void = () => undefined;
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
}

class DeferredJobRunner implements FirstLaunchStartupJobRunner {
  public readonly calls: Deferred<FirstLaunchStartupJobRunResult>[] = [];

  public constructor(public readonly id: FirstLaunchStartupJobId) {}

  public run(): Promise<FirstLaunchStartupJobRunResult> {
    const operation = createDeferred<FirstLaunchStartupJobRunResult>();
    this.calls.push(operation);
    return operation.promise;
  }
}

describe('FirstLaunchStartupCoordinator', () => {
  it('publishes immutable initial, running, and succeeded snapshots exactly once per completed job', async () => {
    const runner = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser);
    const coordinator = new FirstLaunchStartupCoordinator({ jobRunners: [runner] });
    const snapshots: FirstLaunchStartupSnapshot[] = [];
    coordinator.subscribe((snapshot) => snapshots.push(snapshot));

    const firstStart = coordinator.start();
    const duplicateStart = coordinator.start();
    assert.equal(firstStart, duplicateStart);
    assert.equal(runner.calls.length, 1);
    assert.equal(coordinator.getSnapshot().state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running);
    assert.equal(coordinator.getSnapshot().progress, 0);

    runner.calls[0].resolve({ failureCode: null, success: true });
    const completed = await firstStart;

    assert.equal(completed.state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded);
    assert.equal(completed.progress, 100);
    assert.equal(Object.isFrozen(completed), true);
    assert.deepEqual(
      snapshots.map((snapshot) => snapshot.state),
      [
        FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Pending,
        FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running,
        FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running,
        FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded,
      ],
    );
    await coordinator.start();
    assert.equal(runner.calls.length, 1);
  });

  it('retains successful jobs across retry and reruns only failed jobs', async () => {
    const successfulRunner = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser);
    const retryableRunner = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.Prettify);
    const coordinator = new FirstLaunchStartupCoordinator({ jobRunners: [successfulRunner, retryableRunner] });

    const initialAttempt = coordinator.start();
    successfulRunner.calls[0].resolve({ failureCode: null, success: true });
    retryableRunner.calls[0].resolve({
      failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed,
      success: false,
    });
    const failed = await initialAttempt;
    assert.equal(failed.state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed);
    assert.equal(failed.progress, 50);

    const retryAttempt = coordinator.retry();
    assert.equal(successfulRunner.calls.length, 1);
    assert.equal(retryableRunner.calls.length, 2);
    retryableRunner.calls[1].resolve({ failureCode: null, success: true });
    const completed = await retryAttempt;

    assert.equal(completed.generation, 2);
    assert.equal(completed.state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded);
    assert.equal(completed.progress, 100);
  });

  it('ignores duplicate, stale, and disposed terminal events', async () => {
    const runner = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser);
    const coordinator = new FirstLaunchStartupCoordinator({ jobRunners: [runner] });
    const testHook = coordinator as unknown as CoordinatorTestHook;

    const initialAttempt = coordinator.start();
    runner.calls[0].resolve({
      failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed,
      success: false,
    });
    await initialAttempt;
    const retryAttempt = coordinator.retry();
    const retrySnapshot = coordinator.getSnapshot();

    testHook.transitionJob(1, FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, {
      completedUnits: 1,
      failureCode: null,
      state: FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded,
      totalUnits: 1,
    });
    assert.equal(coordinator.getSnapshot(), retrySnapshot);

    testHook.transitionJob(2, FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, {
      completedUnits: 0,
      failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed,
      state: FIRST_LAUNCH_STARTUP_JOB_STATES.Failed,
      totalUnits: 1,
    });
    const terminalSnapshot = coordinator.getSnapshot();
    testHook.transitionJob(2, FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, {
      completedUnits: 1,
      failureCode: null,
      state: FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded,
      totalUnits: 1,
    });
    assert.equal(coordinator.getSnapshot(), terminalSnapshot);

    coordinator.dispose();
    runner.calls[1].resolve({ failureCode: null, success: true });
    await retryAttempt;
    assert.equal(coordinator.getSnapshot(), terminalSnapshot);
  });

  it('maps runner errors to safe status codes without exposing their messages', async () => {
    const runner: FirstLaunchStartupJobRunner = {
      id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
      run: async () => {
        throw new Error('/private/cache/chrome');
      },
    };
    const coordinator = new FirstLaunchStartupCoordinator({ jobRunners: [runner] });

    const failed = await coordinator.start();

    assert.deepEqual(failed.jobs, [
      {
        completedUnits: 0,
        failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InitializationFailed,
        id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
        state: FIRST_LAUNCH_STARTUP_JOB_STATES.Failed,
        totalUnits: 1,
      },
    ]);
    assert.equal(JSON.stringify(failed).includes('/private/cache/chrome'), false);
  });

  it('gates dependent jobs on CloakBrowser and starts independent jobs together after preparation', async () => {
    const cloakBrowser = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser);
    const voiceProvider = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider);
    const translation = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.Translation);
    const coordinator = new FirstLaunchStartupCoordinator({
      jobRunners: [
        cloakBrowser,
        {
          dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser],
          id: voiceProvider.id,
          run: voiceProvider.run.bind(voiceProvider),
        },
        {
          dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser],
          id: translation.id,
          run: translation.run.bind(translation),
        },
      ],
    });

    const attempt = coordinator.start();
    assert.equal(cloakBrowser.calls.length, 1);
    assert.equal(voiceProvider.calls.length, 0);
    assert.equal(translation.calls.length, 0);

    cloakBrowser.calls[0]?.resolve({ failureCode: null, success: true });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(voiceProvider.calls.length, 1);
    assert.equal(translation.calls.length, 1);

    voiceProvider.calls[0]?.resolve({ failureCode: null, success: true });
    translation.calls[0]?.resolve({ failureCode: null, success: true });
    const completed = await attempt;

    assert.equal(completed.state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded);
  });

  it('marks an unselected Voice Provider as not required before dependency scheduling', async () => {
    const cloakBrowser = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser);
    const voiceProvider = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider);
    const coordinator = new FirstLaunchStartupCoordinator({
      jobRunners: [
        cloakBrowser,
        {
          dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser],
          id: voiceProvider.id,
          isRequired: () => false,
          run: voiceProvider.run.bind(voiceProvider),
        },
      ],
    });

    const attempt = coordinator.start();
    assert.deepEqual(coordinator.getSnapshot().jobs.find((job) => job.id === voiceProvider.id), {
      completedUnits: 0,
      failureCode: null,
      id: FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider,
      state: FIRST_LAUNCH_STARTUP_JOB_STATES.NotRequired,
      totalUnits: 0,
    });
    assert.equal(voiceProvider.calls.length, 0);

    cloakBrowser.calls[0]?.resolve({ failureCode: null, success: true });
    await attempt;
    assert.equal(voiceProvider.calls.length, 0);
  });

  it('leaves dependents pending after a prerequisite failure and runs them after a retry', async () => {
    const cloakBrowser = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser);
    const translation = new DeferredJobRunner(FIRST_LAUNCH_STARTUP_JOB_IDS.Translation);
    const coordinator = new FirstLaunchStartupCoordinator({
      jobRunners: [
        cloakBrowser,
        {
          dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser],
          id: translation.id,
          run: translation.run.bind(translation),
        },
      ],
    });

    const initialAttempt = coordinator.start();
    cloakBrowser.calls[0]?.resolve({
      failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed,
      success: false,
    });
    const failed = await initialAttempt;
    assert.equal(failed.state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed);
    assert.equal(translation.calls.length, 0);
    assert.equal(
      failed.jobs.find((job) => job.id === FIRST_LAUNCH_STARTUP_JOB_IDS.Translation)?.state,
      FIRST_LAUNCH_STARTUP_JOB_STATES.Pending,
    );

    const retryAttempt = coordinator.retry();
    assert.equal(cloakBrowser.calls.length, 2);
    cloakBrowser.calls[1]?.resolve({ failureCode: null, success: true });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(translation.calls.length, 1);
    translation.calls[0]?.resolve({ failureCode: null, success: true });

    const completed = await retryAttempt;
    assert.equal(completed.state, FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded);
  });

  it('rejects unknown and cyclic startup job dependencies', () => {
    assert.throws(
      () =>
        new FirstLaunchStartupCoordinator({
          jobRunners: [
            {
              dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.Translation],
              id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
              run: async () => ({ failureCode: null, success: true }),
            },
          ],
        }),
      /dependencies are invalid/u,
    );
    assert.throws(
      () =>
        new FirstLaunchStartupCoordinator({
          jobRunners: [
            {
              dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.Translation],
              id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
              run: async () => ({ failureCode: null, success: true }),
            },
            {
              dependsOn: [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser],
              id: FIRST_LAUNCH_STARTUP_JOB_IDS.Translation,
              run: async () => ({ failureCode: null, success: true }),
            },
          ],
        }),
      /dependencies contain a cycle/u,
    );
  });
});
