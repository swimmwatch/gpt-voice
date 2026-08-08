import {
  FIRST_LAUNCH_STARTUP_JOB_IDS,
  FIRST_LAUNCH_STARTUP_JOB_STATES,
  FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES,
  createFirstLaunchStartupSnapshot,
  type FirstLaunchStartupJob,
  type FirstLaunchStartupJobId,
  type FirstLaunchStartupSnapshot,
} from '@shared/firstLaunchStartup';
import type { TranslationProviderConnectionState } from '@shared/translationProvider';
import { isTranslationProviderInitializationPending } from './providerStartupState';

export const STARTUP_LOADER_JOB_ORDER = [
  FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
  FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider,
  FIRST_LAUNCH_STARTUP_JOB_IDS.Translation,
  FIRST_LAUNCH_STARTUP_JOB_IDS.Prettify,
] as const;

const RENDERER_BOOTSTRAP_TOTAL_UNITS = {
  prettify: 1,
  translation: 2,
  voiceProvider: 1,
} as const;

const JOB_STATE_RANK = {
  [FIRST_LAUNCH_STARTUP_JOB_STATES.Pending]: 0,
  [FIRST_LAUNCH_STARTUP_JOB_STATES.Running]: 1,
  [FIRST_LAUNCH_STARTUP_JOB_STATES.Failed]: 2,
  [FIRST_LAUNCH_STARTUP_JOB_STATES.NotRequired]: 2,
  [FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded]: 2,
} as const;

export interface FirstLaunchStartupState {
  readonly mainSnapshot: FirstLaunchStartupSnapshot | null;
}

export interface FirstLaunchStartupRendererInputs {
  readonly prettifyPending: boolean;
  readonly translationConnection: TranslationProviderConnectionState | null;
  readonly translationSettingsPending: boolean;
  readonly voicePending: boolean;
}

export interface FirstLaunchStartupPresentation {
  readonly activeJobIds: readonly FirstLaunchStartupJobId[];
  readonly hasRetryableFailure: boolean;
  readonly isPending: boolean;
  readonly progress: number | null;
}

export type FirstLaunchStartupAction = {
  readonly snapshot: FirstLaunchStartupSnapshot;
  readonly type: 'main-snapshot-received';
};

interface MeasuredWork {
  readonly completedUnits: number;
  readonly totalUnits: number | null;
}

export function createFirstLaunchStartupState(): FirstLaunchStartupState {
  return Object.freeze({ mainSnapshot: null });
}

function isTerminalSuccess(job: FirstLaunchStartupJob | undefined): boolean {
  return (
    job?.state === FIRST_LAUNCH_STARTUP_JOB_STATES.NotRequired ||
    job?.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Succeeded
  );
}

function isMainJobActive(job: FirstLaunchStartupJob | undefined): boolean {
  return (
    job?.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Pending || job?.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Running
  );
}

function mergeJob(current: FirstLaunchStartupJob, incoming: FirstLaunchStartupJob): FirstLaunchStartupJob {
  const currentRank = JOB_STATE_RANK[current.state];
  const incomingRank = JOB_STATE_RANK[incoming.state];
  if (incomingRank > currentRank) return incoming;
  if (incomingRank < currentRank) return current;

  if (
    current.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Running &&
    incoming.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Running &&
    incoming.completedUnits > current.completedUnits
  ) {
    return incoming;
  }

  return current;
}

function createMergedSnapshot(
  current: FirstLaunchStartupSnapshot,
  incoming: FirstLaunchStartupSnapshot,
): FirstLaunchStartupSnapshot {
  const incomingById = new Map(incoming.jobs.map((job) => [job.id, job]));
  const jobs = current.jobs.map((job) => {
    const incomingJob = incomingById.get(job.id);
    return incomingJob ? mergeJob(job, incomingJob) : job;
  });

  for (const incomingJob of incoming.jobs) {
    if (!current.jobs.some((job) => job.id === incomingJob.id)) jobs.push(incomingJob);
  }

  const hasFailure = jobs.some((job) => job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Failed);
  const allSucceeded = jobs.every((job) => isTerminalSuccess(job));
  const allPending = jobs.every((job) => job.state === FIRST_LAUNCH_STARTUP_JOB_STATES.Pending);
  const state = hasFailure
    ? FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed
    : allSucceeded
      ? FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded
      : allPending
        ? FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Pending
        : FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Running;

  return createFirstLaunchStartupSnapshot({
    generation: incoming.generation,
    jobs,
    retryable: hasFailure,
    state,
  });
}

/** Accepts only newer generations and monotonic same-generation job transitions. */
export function reduceFirstLaunchStartupState(
  state: FirstLaunchStartupState,
  action: FirstLaunchStartupAction,
): FirstLaunchStartupState {
  const current = state.mainSnapshot;
  const incoming = action.snapshot;
  if (current !== null && incoming.generation < current.generation) return state;

  const nextSnapshot =
    current !== null && incoming.generation === current.generation ? createMergedSnapshot(current, incoming) : incoming;
  if (nextSnapshot === current) return state;
  return Object.freeze({ mainSnapshot: nextSnapshot });
}

function getMainJob(
  snapshot: FirstLaunchStartupSnapshot,
  id: FirstLaunchStartupJobId,
): FirstLaunchStartupJob | undefined {
  return snapshot.jobs.find((job) => job.id === id);
}

function getAggregateProgress(
  snapshot: FirstLaunchStartupSnapshot | null,
  inputs: FirstLaunchStartupRendererInputs,
): number | null {
  if (snapshot === null) return null;

  const mainWork: MeasuredWork[] = snapshot.jobs.map((job) => ({
    completedUnits: job.completedUnits,
    totalUnits: job.totalUnits,
  }));
  const rendererWork: readonly MeasuredWork[] = [
    {
      completedUnits: inputs.voicePending ? 0 : RENDERER_BOOTSTRAP_TOTAL_UNITS.voiceProvider,
      totalUnits: RENDERER_BOOTSTRAP_TOTAL_UNITS.voiceProvider,
    },
    {
      completedUnits: inputs.translationSettingsPending ? 0 : 1,
      totalUnits: 1,
    },
    {
      completedUnits: isTranslationProviderInitializationPending(inputs.translationConnection) ? 0 : 1,
      totalUnits: 1,
    },
    {
      completedUnits: inputs.prettifyPending ? 0 : RENDERER_BOOTSTRAP_TOTAL_UNITS.prettify,
      totalUnits: RENDERER_BOOTSTRAP_TOTAL_UNITS.prettify,
    },
  ];
  const work = [...mainWork, ...rendererWork];
  if (work.some((unit) => unit.totalUnits === null)) return null;

  const totalUnits = work.reduce((total, unit) => total + (unit.totalUnits ?? 0), 0);
  if (totalUnits === 0) return null;
  const completedUnits = work.reduce((total, unit) => total + unit.completedUnits, 0);
  return Math.round((completedUnits / totalUnits) * 100);
}

/** Combines main startup work with renderer-owned bootstrap work for the loading interface. */
export function getFirstLaunchStartupPresentation(
  state: FirstLaunchStartupState,
  inputs: FirstLaunchStartupRendererInputs,
): FirstLaunchStartupPresentation {
  const snapshot = state.mainSnapshot;
  const translationPending =
    inputs.translationSettingsPending || isTranslationProviderInitializationPending(inputs.translationConnection);
  const mainFailed = snapshot?.state === FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Failed;
  const mainPending = snapshot === null || snapshot.state !== FIRST_LAUNCH_STARTUP_SNAPSHOT_STATES.Succeeded;
  const activeJobIds =
    snapshot === null
      ? [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser]
      : mainFailed
        ? []
        : STARTUP_LOADER_JOB_ORDER.filter((id) => {
            const job = getMainJob(snapshot, id);
            if (isMainJobActive(job)) return true;
            if (id === FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider) {
              return isTerminalSuccess(job) && inputs.voicePending;
            }
            if (id === FIRST_LAUNCH_STARTUP_JOB_IDS.Translation) {
              return isTerminalSuccess(job) && translationPending;
            }
            return id === FIRST_LAUNCH_STARTUP_JOB_IDS.Prettify && inputs.prettifyPending;
          });
  const isPending = mainPending || inputs.voicePending || inputs.prettifyPending || translationPending;

  return Object.freeze({
    activeJobIds: Object.freeze(activeJobIds),
    hasRetryableFailure: Boolean(mainFailed && snapshot?.retryable),
    isPending,
    progress: getAggregateProgress(snapshot, inputs),
  });
}
