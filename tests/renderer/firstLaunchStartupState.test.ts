import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createFirstLaunchStartupState,
  getFirstLaunchStartupPresentation,
  reduceFirstLaunchStartupState,
  STARTUP_LOADER_JOB_ORDER,
} from '@renderer/firstLaunchStartupState';
import {
  FIRST_LAUNCH_STARTUP_FAILURE_CODES,
  FIRST_LAUNCH_STARTUP_JOB_IDS,
  FIRST_LAUNCH_STARTUP_JOB_STATES,
  FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES,
  createFirstLaunchStartupSnapshot,
  type FirstLaunchStartupJob,
  type FirstLaunchStartupSnapshot,
} from '@shared/firstLaunchStartup';
import {
  TRANSLATION_PROVIDER_CONNECTION_DETAILS,
  TRANSLATION_PROVIDER_CONNECTION_STATUSES,
  type TranslationProviderConnectionState,
} from '@shared/translationProvider';

const READY_TRANSLATION_CONNECTION: TranslationProviderConnectionState = Object.freeze({
  detail: TRANSLATION_PROVIDER_CONNECTION_DETAILS.Ready,
  providerId: 'google',
  status: TRANSLATION_PROVIDER_CONNECTION_STATUSES.Connected,
  targetLanguage: 'uk',
});

function job(
  id: FirstLaunchStartupJob['id'],
  state: FirstLaunchStartupJob['state'],
  completedUnits = state === FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded ? 1 : 0,
  totalUnits: number | null = state === FIRST_LAUNCH_STARTUP_JOB_STATES.NotRequired ? 0 : 1,
): FirstLaunchStartupJob {
  return {
    completedUnits,
    failureCode:
      state === FIRST_LAUNCH_STARTUP_JOB_STATES.Failed ? FIRST_LAUNCH_STARTUP_FAILURE_CODES.InstallationFailed : null,
    id,
    state,
    totalUnits,
  };
}

function snapshot(generation: number, jobs: readonly FirstLaunchStartupJob[]): FirstLaunchStartupSnapshot {
  const hasFailure = jobs.some((entry) => entry.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Failed);
  const allSucceeded = jobs.every(
    (entry) =>
      entry.state === FIRST_LAUNCH_STARTUP_JOB_STATES.NotRequired ||
      entry.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded,
  );
  const allPending = jobs.every((entry) => entry.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Pending);
  return createFirstLaunchStartupSnapshot({
    generation,
    jobs,
    retryable: hasFailure,
    state: hasFailure
      ? FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed
      : allSucceeded
        ? FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded
        : allPending
          ? FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Pending
          : FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running,
  });
}

function receive(state: ReturnType<typeof createFirstLaunchStartupState>, value: FirstLaunchStartupSnapshot) {
  return reduceFirstLaunchStartupState(state, { snapshot: value, type: 'main-snapshot-received' });
}

describe('first-launch startup state', () => {
  it('orders concurrent main and renderer work deterministically and reports measured aggregate work', () => {
    const state = receive(
      createFirstLaunchStartupState(),
      snapshot(4, [
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, FIRST_LAUNCH_STARTUP_JOB_STATES.Running, 2, 8),
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded),
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.Translation, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded),
      ]),
    );

    const presentation = getFirstLaunchStartupPresentation(state, {
      prettifyPending: true,
      translationConnection: READY_TRANSLATION_CONNECTION,
      translationSettingsPending: false,
      voicePending: false,
    });

    assert.deepEqual(STARTUP_LOADER_JOB_ORDER, ['cloakbrowser', 'voice-provider', 'translation', 'prettify']);
    assert.deepEqual(presentation.activeJobIds, ['cloakbrowser', 'prettify']);
    assert.equal(presentation.progress, 50);
    assert.equal(presentation.isPending, true);
  });

  it('rejects stale generations and prevents same-generation query races from reversing job progress', () => {
    const current = snapshot(2, [
      job(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded),
      job(FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded),
      job(FIRST_LAUNCH_STARTUP_JOB_IDS.Translation, FIRST_LAUNCH_STARTUP_JOB_STATES.Running),
    ]);
    const staleQuery = snapshot(2, [
      job(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, FIRST_LAUNCH_STARTUP_JOB_STATES.Pending),
      job(FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded),
      job(FIRST_LAUNCH_STARTUP_JOB_IDS.Translation, FIRST_LAUNCH_STARTUP_JOB_STATES.Pending),
    ]);
    const priorGeneration = snapshot(1, [
      job(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, FIRST_LAUNCH_STARTUP_JOB_STATES.Pending),
      job(FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider, FIRST_LAUNCH_STARTUP_JOB_STATES.Pending),
      job(FIRST_LAUNCH_STARTUP_JOB_IDS.Translation, FIRST_LAUNCH_STARTUP_JOB_STATES.Pending),
    ]);

    const accepted = receive(createFirstLaunchStartupState(), current);
    const afterSameGenerationRace = receive(accepted, staleQuery);
    const afterStaleGeneration = receive(afterSameGenerationRace, priorGeneration);

    assert.equal(afterSameGenerationRace.mainSnapshot?.jobs[0]?.state, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded);
    assert.equal(afterSameGenerationRace.mainSnapshot?.jobs[2]?.state, FIRST_LAUNCH_STARTUP_JOB_STATES.Running);
    assert.equal(afterStaleGeneration, afterSameGenerationRace);
  });

  it('uses the indeterminate loader only when a measured aggregate is unavailable', () => {
    const state = receive(
      createFirstLaunchStartupState(),
      snapshot(1, [
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded, 0, null),
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded),
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.Translation, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded),
      ]),
    );

    const presentation = getFirstLaunchStartupPresentation(state, {
      prettifyPending: false,
      translationConnection: READY_TRANSLATION_CONNECTION,
      translationSettingsPending: false,
      voicePending: false,
    });

    assert.equal(presentation.progress, null);
    assert.equal(presentation.isPending, false);
  });

  it('keeps a retryable main failure visible and exits for an intentionally unselected provider', () => {
    const failedState = receive(
      createFirstLaunchStartupState(),
      snapshot(3, [
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, FIRST_LAUNCH_STARTUP_JOB_STATES.Failed),
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider, FIRST_LAUNCH_STARTUP_JOB_STATES.Pending),
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.Translation, FIRST_LAUNCH_STARTUP_JOB_STATES.Pending),
      ]),
    );
    const failedPresentation = getFirstLaunchStartupPresentation(failedState, {
      prettifyPending: false,
      translationConnection: READY_TRANSLATION_CONNECTION,
      translationSettingsPending: false,
      voicePending: false,
    });
    const unselectedState = receive(
      createFirstLaunchStartupState(),
      snapshot(4, [
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded),
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider, FIRST_LAUNCH_STARTUP_JOB_STATES.NotRequired),
        job(FIRST_LAUNCH_STARTUP_JOB_IDS.Translation, FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded),
      ]),
    );
    const unselectedPresentation = getFirstLaunchStartupPresentation(unselectedState, {
      prettifyPending: false,
      translationConnection: READY_TRANSLATION_CONNECTION,
      translationSettingsPending: false,
      voicePending: false,
    });

    assert.equal(failedPresentation.hasRetryableFailure, true);
    assert.equal(failedPresentation.isPending, true);
    assert.equal(unselectedPresentation.hasRetryableFailure, false);
    assert.equal(unselectedPresentation.isPending, false);
  });
});
