import { useRef, useState } from 'react';
import {
  PiArrowClockwise,
  PiDotsThreeVertical,
  PiDownloadSimple,
  PiFolderOpen,
  PiInfo,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { ProgressSpinner, Spinner } from '@renderer/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useI18n } from '@renderer/hooks/useI18n';
import {
  LOCAL_WHISPER_CANCELLABLE_ARTIFACT_PROGRESS_STATES,
  LOCAL_WHISPER_RECOVERABLE_ARTIFACT_PROGRESS_STATES,
  type LocalWhisperArtifactAction,
  type LocalWhisperArtifactProgress,
  type LocalWhisperArtifactReference,
  type LocalWhisperRendererArtifact,
} from '@shared/localWhisper';
import {
  formatLocalWhisperBytes,
  formatLocalWhisperFailureCode,
  formatLocalWhisperRecoveryAction,
  formatLocalWhisperRuntimeState,
} from '../LocalWhisperPresentation';

function actionLabel(action: LocalWhisperArtifactAction, translate: ReturnType<typeof useI18n>['t']): string {
  const key = {
    download: 'localWhisper.settings.actionDownload',
    resume: 'localWhisper.settings.actionResume',
    cancel: 'localWhisper.settings.actionCancel',
    retry: 'localWhisper.settings.actionRetry',
    update: 'localWhisper.settings.actionUpdate',
    remove: 'localWhisper.settings.actionRemove',
  } as const;
  return translate(key[action]);
}

function artifactKindLabel(
  kind: LocalWhisperRendererArtifact['kind'],
  translate: ReturnType<typeof useI18n>['t'],
): string {
  return translate(kind === 'runtime' ? 'localWhisper.settings.runtime' : 'localWhisper.settings.model');
}

const CANCELLABLE_PROGRESS_STATES: ReadonlySet<LocalWhisperArtifactProgress['state']> = new Set([
  ...LOCAL_WHISPER_CANCELLABLE_ARTIFACT_PROGRESS_STATES,
]);

const RECOVERABLE_PROGRESS_STATES: ReadonlySet<LocalWhisperArtifactProgress['state']> = new Set([
  ...LOCAL_WHISPER_RECOVERABLE_ARTIFACT_PROGRESS_STATES,
]);

const INDETERMINATE_ARTIFACT_PROGRESS_STATES: ReadonlySet<LocalWhisperArtifactProgress['state']> = new Set([
  'Queued',
  'Verifying',
  'Installing',
  'Deleting',
]);

export function getLocalWhisperArtifactActions(
  artifact: LocalWhisperRendererArtifact,
  progress: LocalWhisperArtifactProgress | null,
): readonly LocalWhisperArtifactAction[] {
  if (progress && CANCELLABLE_PROGRESS_STATES.has(progress.state)) return ['cancel'];
  if (progress?.state === 'Resumable') return ['resume', 'retry'];
  if (progress?.failure?.retryable === true && RECOVERABLE_PROGRESS_STATES.has(progress.state)) return ['retry'];
  return artifact.actions;
}

interface ArtifactControlProps {
  readonly actionsDisabledReason: string | null;
  readonly artifact: LocalWhisperRendererArtifact;
  readonly onAction: (action: LocalWhisperArtifactAction, artifact: LocalWhisperRendererArtifact) => Promise<boolean>;
  readonly onViewReference: (reference: LocalWhisperArtifactReference) => Promise<boolean>;
  readonly pendingAction: string | null;
  readonly progress: LocalWhisperArtifactProgress | null;
}

function actionIcon(action: LocalWhisperArtifactAction): React.JSX.Element {
  if (action === 'download') return <PiDownloadSimple aria-hidden="true" />;
  if (action === 'cancel') return <PiX aria-hidden="true" />;
  if (action === 'remove') return <PiTrash aria-hidden="true" />;
  return <PiArrowClockwise aria-hidden="true" />;
}

/** Renders one artifact's transfer state with measured or indeterminate progress as appropriate. */
export function LocalWhisperArtifactProgressCard({
  actionsDisabledReason,
  artifact,
  onAction,
  pendingAction,
  progress,
}: Omit<ArtifactControlProps, 'onViewReference'>): React.JSX.Element {
  const { t } = useI18n();
  const actions = getLocalWhisperArtifactActions(artifact, progress).filter((action) => action !== 'remove');
  const transferProgress = progress?.state === 'Downloading' && progress.totalBytes > 0 ? progress : null;
  const percent =
    transferProgress === null
      ? null
      : Math.min(100, (transferProgress.receivedBytes / transferProgress.totalBytes) * 100);
  const state = progress?.state ?? artifact.state;
  const isIndeterminateOperation = progress !== null && INDETERMINATE_ARTIFACT_PROGRESS_STATES.has(progress.state);
  const progressLabel = t('localWhisper.settings.transferProgress', {
    artifact: artifact.label,
    action: progress ? actionLabel(progress.action, t).toLocaleLowerCase() : t('localWhisper.settings.transfer'),
  });

  return (
    <div aria-live="polite" className="lw-transfer-field">
      <div className="lw-transfer-heading">
        <strong>{formatLocalWhisperRuntimeState(state, t)}</strong>
        {percent === null ? (
          isIndeterminateOperation ? (
            <Spinner announce={false} label={progressLabel} size="sm" />
          ) : null
        ) : (
          <ProgressSpinner announce={false} label={progressLabel} progress={percent} size="sm" />
        )}
        {percent === null ? null : <span>{Math.round(percent)}%</span>}
      </div>
      {transferProgress !== null && percent !== null ? (
        <>
          <progress aria-label={progressLabel} className="lw-progress-track" max={100} value={percent} />
          <div className="lw-transfer-meta">
            <span>
              {formatLocalWhisperBytes(transferProgress.receivedBytes, t)} /{' '}
              {formatLocalWhisperBytes(transferProgress.totalBytes, t)}
            </span>
            <span>
              {transferProgress.queuedPosition === null
                ? actionLabel(transferProgress.action, t)
                : t('localWhisper.settings.queue', { position: String(transferProgress.queuedPosition) })}
            </span>
          </div>
        </>
      ) : (
        <p className="lw-transfer-description">
          {artifact.state === 'Installed'
            ? t('localWhisper.settings.installed', { size: formatLocalWhisperBytes(artifact.installedSizeBytes, t) })
            : t('localWhisper.settings.download', { size: formatLocalWhisperBytes(artifact.transferSizeBytes, t) })}
        </p>
      )}
      {progress?.failure ? (
        <p className="lw-inline-error" role="alert">
          {formatLocalWhisperFailureCode(progress.failure.code, t)}.{' '}
          {t('localWhisper.settings.recovery', {
            action: formatLocalWhisperRecoveryAction(progress.failure.recoveryAction, t),
          })}
        </p>
      ) : null}
      {actions.length > 0 ? (
        <div className="lw-transfer-actions">
          {actions.map((action) => (
            <Tooltip key={action}>
              <TooltipTrigger asChild>
                <button
                  className="lw-compact-button"
                  disabled={actionsDisabledReason !== null}
                  onClick={() => void onAction(action, artifact)}
                  type="button"
                >
                  {actionIcon(action)}
                  {pendingAction === action ? t('localWhisper.settings.working') : actionLabel(action, t)}
                </button>
              </TooltipTrigger>
              {actionsDisabledReason ? <TooltipContent>{actionsDisabledReason}</TooltipContent> : null}
            </Tooltip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Keeps references and destructive lifecycle actions in one restrained overflow menu. */
export function LocalWhisperArtifactOverflowMenu({
  actionsDisabledReason,
  artifact,
  onAction,
  onViewReference,
  pendingAction,
  progress,
}: ArtifactControlProps): React.JSX.Element | null {
  const { t } = useI18n();
  const [removeOpen, setRemoveOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const actions = getLocalWhisperArtifactActions(artifact, progress);
  const secondaryActions = actions.filter((action) => action === 'remove' || action === 'update');
  if (secondaryActions.length === 0 && artifact.references.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={t('localWhisper.settings.manageArtifact', { artifact: artifact.label })}
                className="lw-icon-button lw-menu-trigger"
                disabled={actionsDisabledReason !== null}
                ref={triggerRef}
                type="button"
              >
                <PiDotsThreeVertical aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {actionsDisabledReason ?? t('localWhisper.settings.manageArtifact', { artifact: artifact.label })}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          {artifact.references.map((reference) => (
            <DropdownMenuItem key={reference.referenceId} onSelect={() => void onViewReference(reference)}>
              {reference.kind === 'openProvenanceReference' ? (
                <PiFolderOpen aria-hidden="true" />
              ) : (
                <PiInfo aria-hidden="true" />
              )}
              {reference.label}
            </DropdownMenuItem>
          ))}
          {artifact.references.length > 0 && secondaryActions.length > 0 ? <DropdownMenuSeparator /> : null}
          {secondaryActions.map((action) => (
            <DropdownMenuItem
              className={action === 'remove' ? 'text-destructive focus:text-destructive' : undefined}
              key={action}
              onSelect={(event) => {
                if (action === 'remove') {
                  event.preventDefault();
                  setRemoveOpen(true);
                  return;
                }
                void onAction(action, artifact);
              }}
            >
              {actionIcon(action)}
              {pendingAction === action ? t('localWhisper.settings.working') : actionLabel(action, t)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog onOpenChange={setRemoveOpen} open={removeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('localWhisper.settings.removeDialogTitle', { artifact: artifact.label })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('localWhisper.settings.removeDialogDescription', { kind: artifactKindLabel(artifact.kind, t) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('localWhisper.settings.keepArtifact')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void onAction('remove', artifact).then((success) => {
                  setRemoveOpen(false);
                  if (!success) requestAnimationFrame(() => triggerRef.current?.focus());
                });
              }}
            >
              {t('localWhisper.settings.actionRemove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
