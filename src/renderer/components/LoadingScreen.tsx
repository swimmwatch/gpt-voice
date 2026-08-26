import {
  CheckCircle2,
  Clock3,
  Languages,
  Mic2,
  MinusCircle,
  Sparkles,
  TriangleAlert,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import type { JSX } from 'react';
import { FIRST_LAUNCH_STARTUP_JOB_IDS } from '@shared/firstLaunchStartup';
import { Button } from '@renderer/components/ui/button';
import { Spinner } from '@renderer/components/ui/spinner';
import { useI18n } from '@renderer/hooks/useI18n';
import { cn } from '@renderer/lib/cn';
import type { FirstLaunchStartupStage, FirstLaunchStartupStageState } from '@renderer/firstLaunchStartupState';

const VISIBLE_STARTUP_STAGE_IDS = [
  FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider,
  FIRST_LAUNCH_STARTUP_JOB_IDS.Translation,
  FIRST_LAUNCH_STARTUP_JOB_IDS.Prettify,
] as const;

type VisibleStartupStageId = (typeof VISIBLE_STARTUP_STAGE_IDS)[number];
type VisibleStartupStage = FirstLaunchStartupStage & { readonly id: VisibleStartupStageId };

const STARTUP_JOB_LABEL_KEYS: Record<VisibleStartupStageId, string> = {
  [FIRST_LAUNCH_STARTUP_JOB_IDS.Prettify]: 'startup.job.prettify',
  [FIRST_LAUNCH_STARTUP_JOB_IDS.Translation]: 'startup.job.translation',
  [FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider]: 'startup.job.voiceProvider',
};

const STARTUP_JOB_ICONS: Record<VisibleStartupStageId, LucideIcon> = {
  [FIRST_LAUNCH_STARTUP_JOB_IDS.Prettify]: WandSparkles,
  [FIRST_LAUNCH_STARTUP_JOB_IDS.Translation]: Languages,
  [FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider]: Mic2,
};

function isVisibleStartupStage(stage: FirstLaunchStartupStage): stage is VisibleStartupStage {
  return VISIBLE_STARTUP_STAGE_IDS.includes(stage.id as VisibleStartupStageId);
}

interface InitializingLoadingScreenProps {
  readonly mode?: 'initializing';
}

interface StartupLoadingScreenProps {
  readonly hasRetryableFailure?: boolean;
  readonly isComplete?: boolean;
  readonly isRetryPending?: boolean;
  readonly mode: 'startup';
  readonly onRetry?: () => void;
  readonly progress?: number | null;
  readonly retryFailed?: boolean;
  readonly stages: readonly FirstLaunchStartupStage[];
}

type LoadingScreenProps = InitializingLoadingScreenProps | StartupLoadingScreenProps;

function getStageCardClassName(state: FirstLaunchStartupStageState): string {
  switch (state) {
    case 'active':
      return 'border-primary/40 bg-primary/10 shadow-lg shadow-primary/10';
    case 'completed':
      return 'border-border/70 bg-background/60';
    case 'failed':
      return 'border-destructive/40 bg-destructive/10';
    case 'skipped':
      return 'border-border/50 bg-surface-muted/60 opacity-60';
    case 'waiting':
      return 'border-border/60 bg-background/40';
  }
}

function getStageProgressClassName(state: FirstLaunchStartupStageState): string {
  if (state === 'failed') return 'bg-destructive';
  if (state === 'completed') return 'bg-emerald-500';
  if (state === 'skipped' || state === 'waiting') return 'bg-muted-foreground/35';
  return 'bg-primary';
}

function StageStateIcon({ label, state }: { readonly label: string; readonly state: FirstLaunchStartupStageState }) {
  switch (state) {
    case 'active':
      return <Spinner active announce={false} className="text-primary" label={label} size="sm" />;
    case 'completed':
      return <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-500" />;
    case 'failed':
      return <TriangleAlert aria-hidden="true" className="size-4 text-destructive" />;
    case 'skipped':
      return <MinusCircle aria-hidden="true" className="size-4 text-muted-foreground" />;
    case 'waiting':
      return <Clock3 aria-hidden="true" className="size-4 text-muted-foreground" />;
  }
}

function StartupStageCard({ stage }: { readonly stage: VisibleStartupStage }): JSX.Element {
  const { t } = useI18n();
  const label = t(STARTUP_JOB_LABEL_KEYS[stage.id]);
  const JobIcon = STARTUP_JOB_ICONS[stage.id];
  const progress = stage.progress === null ? null : Math.max(0, Math.min(100, stage.progress));

  return (
    <li
      className={cn(
        'relative min-w-0 overflow-hidden rounded-lg border p-2 transition-colors duration-200',
        getStageCardClassName(stage.state),
      )}
      data-stage-id={stage.id}
      data-state={stage.state}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground/5 text-foreground">
          <JobIcon aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{label}</span>
        <StageStateIcon label={label} state={stage.state} />
      </div>
      <div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/10">
        {progress !== null && (
          <span
            className={cn(
              'block h-full rounded-full transition-[width] duration-300',
              getStageProgressClassName(stage.state),
            )}
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
      {progress !== null && (
        <span className="mt-1 block text-right text-[10px] tabular-nums text-muted-foreground">
          {t('startup.progressValue', { progress: String(progress) })}
        </span>
      )}
    </li>
  );
}

/** Presents generic initialization or the measured, parallel-aware main-window startup flow. */
function LoadingScreen(props: LoadingScreenProps): JSX.Element {
  const { t } = useI18n();
  if (props.mode !== 'startup') {
    const status = t('loading.initializing');

    return (
      <main className="flex h-full w-full items-center justify-center text-sm text-muted-foreground [-webkit-app-region:no-drag]">
        <div className="flex items-center gap-2">
          <Spinner active announce={false} label={status} />
          <p aria-live="polite" data-slot="startup-status" role="status">
            {status}
          </p>
        </div>
      </main>
    );
  }

  const {
    hasRetryableFailure = false,
    isComplete = false,
    isRetryPending = false,
    onRetry,
    progress = null,
    retryFailed = false,
    stages,
  } = props;
  const visibleStages = stages.filter(isVisibleStartupStage);
  const activeJobs = visibleStages
    .filter((stage) => stage.state === 'active')
    .map((stage) => t(STARTUP_JOB_LABEL_KEYS[stage.id]));
  const activeStatus =
    activeJobs.length === 0 ? t('startup.preparing') : t('startup.preparingJobs', { jobs: activeJobs.join(', ') });
  const status = hasRetryableFailure ? t(retryFailed ? 'startup.retryFailed' : 'startup.failed') : activeStatus;
  const progressLabel = t('startup.progress');
  const measuredProgress = progress === null ? null : Math.max(0, Math.min(100, progress));

  return (
    <main
      aria-busy={!isComplete && (!hasRetryableFailure || isRetryPending)}
      aria-labelledby="startup-loader-title"
      className="relative isolate flex h-full w-full items-center justify-center overflow-hidden bg-background px-4 py-3 text-sm text-muted-foreground [-webkit-app-region:no-drag]"
      data-slot="startup-loader"
    >
      <div aria-hidden="true" className="absolute -left-20 top-[-7rem] size-72 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-32 -right-16 size-80 rounded-full bg-primary/10 blur-3xl" />

      <section className="relative w-full max-w-[592px] rounded-xl border border-border/70 bg-surface/90 p-3 shadow-xl shadow-black/10 backdrop-blur-xl">
        <header className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Sparkles aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight text-foreground" id="startup-loader-title">
              GPT-Voice
            </h1>
            <p
              aria-live="polite"
              className="mt-0.5 break-words text-xs leading-4"
              data-slot="startup-status"
              role="status"
            >
              {status}
            </p>
          </div>
          {measuredProgress !== null && (
            <span className="shrink-0 text-lg font-semibold tabular-nums text-foreground" data-slot="startup-progress">
              {t('startup.progressValue', { progress: String(measuredProgress) })}
            </span>
          )}
        </header>

        <div className="mt-3">
          {measuredProgress === null ? (
            <div
              aria-hidden="true"
              className="h-1.5 overflow-hidden rounded-full bg-foreground/10"
              data-progress-state="indeterminate"
            >
              <span className="block h-full w-full animate-pulse rounded-full bg-primary/45 motion-reduce:animate-none" />
            </div>
          ) : (
            <div
              aria-label={progressLabel}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(measuredProgress)}
              aria-valuetext={`${progressLabel}: ${Math.round(measuredProgress)}%`}
              className="h-1.5 overflow-hidden rounded-full bg-foreground/10"
              data-progress-state="determinate"
              role="progressbar"
            >
              <span
                className={cn(
                  'block h-full rounded-full transition-[width] duration-300',
                  hasRetryableFailure ? 'bg-destructive' : 'bg-primary',
                )}
                style={{ width: `${measuredProgress}%` }}
              />
            </div>
          )}
        </div>

        <ul aria-label={progressLabel} className="mt-3 grid grid-cols-3 gap-2" data-slot="startup-stage-grid">
          {visibleStages.map((stage) => (
            <StartupStageCard key={stage.id} stage={stage} />
          ))}
        </ul>

        {hasRetryableFailure && onRetry && (
          <div className="mt-3 flex justify-end">
            <Button disabled={isRetryPending} onClick={onRetry} size="sm" variant="outline">
              {t('startup.retry')}
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}

export default LoadingScreen;
export { type LoadingScreenProps };
