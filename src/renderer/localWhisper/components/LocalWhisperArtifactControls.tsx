import { useCallback, useRef, useState } from 'react';
import {
  PiArrowClockwise,
  PiDotsThreeVertical,
  PiDownloadSimple,
  PiFolderOpen,
  PiInfo,
  PiTrash,
  PiX,
} from 'react-icons/pi';
import { ConfirmationDialog } from '@renderer/components/ui/confirmation-dialog';
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
  getLocalWhisperArtifactProgressPresentation,
  translateLocalWhisperRendererLabel,
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
  readonly cancelDisabledReason?: string | null;
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
  cancelDisabledReason = null,
  onAction,
  pendingAction,
  progress,
}: Omit<ArtifactControlProps, 'onViewReference'>): React.JSX.Element {
  const { t } = useI18n();
  const actions = getLocalWhisperArtifactActions(artifact, progress).filter((action) => action !== 'remove');
  const transferProgress = progress?.state === 'Downloading' && progress.totalBytes > 0 ? progress : null;
  const presentation = getLocalWhisperArtifactProgressPresentation(artifact, progress, t);
  const progressLabel = t('localWhisper.settings.transferProgress', {
    artifact: translateLocalWhisperRendererLabel(artifact.label, t),
    action: progress ? actionLabel(progress.action, t).toLocaleLowerCase() : t('localWhisper.settings.transfer'),
  });

  return (
    <div className="lw-transfer-field">
      <div className="lw-transfer-heading">
        <div className="lw-transfer-phase">
          {presentation.indeterminate ? <Spinner announce={false} label={progressLabel} size="sm" /> : null}
          <strong>{presentation.label}</strong>
        </div>
        {presentation.percent === null ? null : (
          <div className="lw-transfer-percentage">
            <ProgressSpinner announce={false} label={progressLabel} progress={presentation.percent} size="sm" />
            <span>{Math.round(presentation.percent)}%</span>
          </div>
        )}
      </div>
      <p aria-live="polite" className="lw-transfer-description" role="status">
        {presentation.description}
      </p>
      {transferProgress !== null && presentation.percent !== null ? (
        <>
          <progress aria-label={progressLabel} className="lw-progress-track" max={100} value={presentation.percent} />
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
      ) : null}
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
                  disabled={(action === 'cancel' ? cancelDisabledReason : actionsDisabledReason) !== null}
                  onClick={() => void onAction(action, artifact)}
                  type="button"
                >
                  {actionIcon(action)}
                  {pendingAction === action ? t('localWhisper.settings.working') : actionLabel(action, t)}
                </button>
              </TooltipTrigger>
              {(action === 'cancel' ? cancelDisabledReason : actionsDisabledReason) ? (
                <TooltipContent>{action === 'cancel' ? cancelDisabledReason : actionsDisabledReason}</TooltipContent>
              ) : null}
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
  const handleRemoveOpenChange = useCallback((open: boolean): void => {
    setRemoveOpen(open);
    if (!open) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  if (secondaryActions.length === 0 && artifact.references.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={t('localWhisper.settings.manageArtifact', {
                  artifact: translateLocalWhisperRendererLabel(artifact.label, t),
                })}
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
            {actionsDisabledReason ??
              t('localWhisper.settings.manageArtifact', {
                artifact: translateLocalWhisperRendererLabel(artifact.label, t),
              })}
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
              {translateLocalWhisperRendererLabel(reference.label, t)}
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

      <ConfirmationDialog
        cancelLabel={t('localWhisper.settings.keepArtifact')}
        confirmLabel={t('localWhisper.settings.actionRemove')}
        description={t('localWhisper.settings.removeDialogDescription', { kind: artifactKindLabel(artifact.kind, t) })}
        onConfirm={() => onAction('remove', artifact)}
        onOpenChange={handleRemoveOpenChange}
        open={removeOpen}
        title={t('localWhisper.settings.removeDialogTitle', {
          artifact: translateLocalWhisperRendererLabel(artifact.label, t),
          kind: artifactKindLabel(artifact.kind, t),
        })}
        tone="destructive"
      />
    </>
  );
}
