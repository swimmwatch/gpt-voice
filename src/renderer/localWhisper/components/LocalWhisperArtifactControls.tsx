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
} from '../LocalWhisperPresentation';

const ACTION_LABELS: Readonly<Record<LocalWhisperArtifactAction, string>> = Object.freeze({
  download: 'Download',
  resume: 'Resume',
  cancel: 'Cancel',
  retry: 'Retry',
  update: 'Update',
  remove: 'Remove',
});

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

export function LocalWhisperArtifactProgressCard({
  actionsDisabledReason,
  artifact,
  onAction,
  pendingAction,
  progress,
}: Omit<ArtifactControlProps, 'onViewReference'>): React.JSX.Element {
  const actions = getLocalWhisperArtifactActions(artifact, progress).filter((action) => action !== 'remove');
  const percent =
    progress && progress.totalBytes > 0 ? Math.min(100, (progress.receivedBytes / progress.totalBytes) * 100) : null;
  const state = progress?.state ?? artifact.state;

  return (
    <div aria-live="polite" className="lw-transfer-field">
      <div className="lw-transfer-heading">
        <strong>{state}</strong>
        {percent === null ? null : <span>{Math.round(percent)}%</span>}
      </div>
      {progress ? (
        <>
          <progress
            aria-label={`${artifact.label} ${ACTION_LABELS[progress.action].toLowerCase()} progress`}
            className="lw-progress-track"
            max={100}
            value={percent ?? undefined}
          />
          <div className="lw-transfer-meta">
            <span>
              {formatLocalWhisperBytes(progress.receivedBytes)} / {formatLocalWhisperBytes(progress.totalBytes)}
            </span>
            <span>
              {progress.queuedPosition === null ? ACTION_LABELS[progress.action] : `Queue ${progress.queuedPosition}`}
            </span>
          </div>
        </>
      ) : (
        <p className="lw-transfer-description">
          {artifact.state === 'Installed'
            ? `${formatLocalWhisperBytes(artifact.installedSizeBytes)} installed`
            : `${formatLocalWhisperBytes(artifact.transferSizeBytes)} download`}
        </p>
      )}
      {progress?.failure ? (
        <p className="lw-inline-error" role="alert">
          {formatLocalWhisperFailureCode(progress.failure.code)}. Recovery:{' '}
          {formatLocalWhisperRecoveryAction(progress.failure.recoveryAction)}.
        </p>
      ) : null}
      {actions.length > 0 ? (
        <div className="lw-transfer-actions">
          {actions.map((action) => (
            <button
              className="lw-compact-button"
              disabled={actionsDisabledReason !== null}
              key={action}
              onClick={() => void onAction(action, artifact)}
              title={actionsDisabledReason ?? undefined}
              type="button"
            >
              {actionIcon(action)}
              {pendingAction === action ? 'Working…' : ACTION_LABELS[action]}
            </button>
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
  const [removeOpen, setRemoveOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const actions = getLocalWhisperArtifactActions(artifact, progress);
  const secondaryActions = actions.filter((action) => action === 'remove' || action === 'update');
  if (secondaryActions.length === 0 && artifact.references.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Manage ${artifact.label}`}
            className="lw-icon-button lw-menu-trigger"
            disabled={actionsDisabledReason !== null}
            ref={triggerRef}
            title={actionsDisabledReason ?? `Manage ${artifact.label}`}
            type="button"
          >
            <PiDotsThreeVertical aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="lw-menu-content">
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
              {pendingAction === action ? 'Working…' : ACTION_LABELS[action]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog onOpenChange={setRemoveOpen} open={removeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {artifact.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected {artifact.kind} artifact from managed storage. Other versions are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep artifact</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void onAction('remove', artifact).then((success) => {
                  setRemoveOpen(false);
                  if (!success) requestAnimationFrame(() => triggerRef.current?.focus());
                });
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
