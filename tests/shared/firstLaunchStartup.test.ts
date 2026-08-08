import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FIRST_LAUNCH_STARTUP_FAILURE_CODES,
  FIRST_LAUNCH_STARTUP_JOB_IDS,
  FIRST_LAUNCH_STARTUP_JOB_STATES,
  FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES,
  createFirstLaunchStartupSnapshot,
  getActiveFirstLaunchStartupJobIds,
  getFirstLaunchStartupProgress,
  isFirstLaunchStartupSnapshot,
  sanitizeFirstLaunchStartupSnapshot,
  type FirstLaunchStartupJob,
} from '@shared/firstLaunchStartup';

function createJob(overrides: Partial<FirstLaunchStartupJob> = {}): FirstLaunchStartupJob {
  return {
    completedUnits: 0,
    failureCode: null,
    id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
    state: FIRST_LAUNCH_STARTUP_JOB_STATES.Pending,
    totalUnits: 1,
    ...overrides,
  };
}

describe('first-launch startup contract', () => {
  it('creates immutable snapshots with progress derived only from completed known work units', () => {
    const pending = createFirstLaunchStartupSnapshot({
      generation: 0,
      jobs: [createJob()],
      retryable: false,
      state: FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Pending,
    });

    assert.equal(Object.isFrozen(pending), true);
    assert.equal(Object.isFrozen(pending.jobs), true);
    assert.equal(Object.isFrozen(pending.jobs[0]), true);
    assert.equal(pending.progress, 0);
    assert.equal(
      getFirstLaunchStartupProgress([
        createJob({ state: FIRST_LAUNCH_STARTUP_JOB_STATES.Running, totalUnits: null }),
        createJob({
          completedUnits: 1,
          id: FIRST_LAUNCH_STARTUP_JOB_IDS.Prettify,
          state: FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded,
        }),
      ]),
      null,
    );
  });

  it('uses stable product ordering for concurrent active jobs', () => {
    const activeJobIds = getActiveFirstLaunchStartupJobIds([
      createJob({ id: FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider }),
      createJob({ id: FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, state: FIRST_LAUNCH_STARTUP_JOB_STATES.Running }),
      createJob({
        completedUnits: 1,
        id: FIRST_LAUNCH_STARTUP_JOB_IDS.Translation,
        state: FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded,
      }),
    ]);

    assert.deepEqual(activeJobIds, [
      FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
      FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider,
    ]);
  });

  it('rejects unsafe, malformed, and inconsistent snapshots', () => {
    const valid = createFirstLaunchStartupSnapshot({
      generation: 0,
      jobs: [createJob()],
      retryable: false,
      state: FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Pending,
    });

    assert.equal(isFirstLaunchStartupSnapshot({ ...valid, error: '/private/cache/chrome' }), false);
    assert.equal(
      isFirstLaunchStartupSnapshot({
        ...valid,
        jobs: [{ ...valid.jobs[0], state: 'installing' }],
      }),
      false,
    );
    assert.equal(isFirstLaunchStartupSnapshot({ ...valid, progress: 75 }), false);
    assert.equal(
      isFirstLaunchStartupSnapshot({
        ...valid,
        jobs: [
          {
            ...valid.jobs[0],
            failureCode: FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed,
            state: FIRST_LAUNCH_STARTUP_JOB_STATES.Failed,
          },
        ],
        retryable: true,
        state: FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed,
      }),
      true,
    );
    assert.deepEqual(sanitizeFirstLaunchStartupSnapshot({ ...valid }), valid);
  });
});
