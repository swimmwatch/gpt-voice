import type { JSX } from 'react';
import { FIRST_LAUNCH_STARTUP_JOB_IDS, type FirstLaunchStartupJobId } from '@shared/firstLaunchStartup';
import { Button } from '@renderer/components/ui/button';
import { ProgressSpinner, Spinner } from '@renderer/components/ui/spinner';
import { useI18n } from '@renderer/hooks/useI18n';

const STARTUP_JOB_LABEL_KEYS: Record<FirstLaunchStartupJobId, string> = {
  [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser]: 'startup.job.cloakBrowser',
  [FIRST_LAUNCH_STARTUP_JOB_IDS.Prettify]: 'startup.job.prettify',
  [FIRST_LAUNCH_STARTUP_JOB_IDS.Translation]: 'startup.job.translation',
  [FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider]: 'startup.job.voiceProvider',
};

const MAXIMUM_VISIBLE_STARTUP_JOBS = 2;

interface LoadingScreenProps {
  readonly activeJobIds?: readonly FirstLaunchStartupJobId[];
  readonly hasRetryableFailure?: boolean;
  readonly isRetryPending?: boolean;
  readonly onRetry?: () => void;
  readonly progress?: number | null;
  readonly retryFailed?: boolean;
}

function LoadingScreen({
  activeJobIds = [],
  hasRetryableFailure = false,
  isRetryPending = false,
  onRetry,
  progress = null,
  retryFailed = false,
}: LoadingScreenProps): JSX.Element {
  const { t } = useI18n();
  const visibleJobs = activeJobIds.slice(0, MAXIMUM_VISIBLE_STARTUP_JOBS).map((id) => t(STARTUP_JOB_LABEL_KEYS[id]));
  const activeStatus =
    visibleJobs.length === 0
      ? t('startup.preparing')
      : activeJobIds.length > MAXIMUM_VISIBLE_STARTUP_JOBS
        ? t('startup.preparingJobsWithMore', {
            count: String(activeJobIds.length - MAXIMUM_VISIBLE_STARTUP_JOBS),
            jobs: visibleJobs.join(', '),
          })
        : t('startup.preparingJobs', { jobs: visibleJobs.join(', ') });
  const status = hasRetryableFailure ? t(retryFailed ? 'startup.retryFailed' : 'startup.failed') : activeStatus;
  const progressLabel = t('startup.progress');

  return (
    <main className="flex h-full w-full items-center justify-center text-sm text-muted-foreground [-webkit-app-region:no-drag]">
      <div className="flex max-w-sm flex-col items-center gap-2 px-4 text-center">
        {progress === null ? (
          <Spinner active label={status} size="lg" />
        ) : (
          <ProgressSpinner label={progressLabel} progress={progress} size="lg" />
        )}
        <p aria-live="polite" className="max-w-full break-words" data-slot="startup-status" role="status">
          {status}
        </p>
        {progress !== null && (
          <span data-slot="startup-progress">{t('startup.progressValue', { progress: String(progress) })}</span>
        )}
        {hasRetryableFailure && onRetry && (
          <Button disabled={isRetryPending} onClick={onRetry} size="sm" variant="outline">
            {t('startup.retry')}
          </Button>
        )}
      </div>
    </main>
  );
}

export default LoadingScreen;
export { type LoadingScreenProps };
