import { useRef, useState } from 'react';
import { Button } from '@renderer/components/ui/button';
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
  getLatestLocalWhisperArtifactProgress,
} from '../LocalWhisperPresentation';
import { LocalWhisperSection } from './LocalWhisperSection';

interface LocalWhisperStorageSectionProps {
  readonly artifacts: readonly LocalWhisperRendererArtifact[];
  readonly aggregateBytes: number;
  readonly storageSummary: string;
  readonly progress: readonly LocalWhisperArtifactProgress[];
  readonly pendingAction: string | null;
  readonly actionsDisabledReason: string | null;
  readonly onArtifactAction: (
    action: LocalWhisperArtifactAction,
    artifact: LocalWhisperRendererArtifact,
  ) => Promise<boolean>;
  readonly onViewReference: (reference: LocalWhisperArtifactReference) => Promise<boolean>;
  readonly onOpenStorageFolder: () => void;
}

const ACTION_LABELS: Readonly<Record<LocalWhisperArtifactAction, string>> = Object.freeze({
  download: 'Download',
  resume: 'Resume',
  cancel: 'Cancel download',
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

function artifactActions(
  artifact: LocalWhisperRendererArtifact,
  progress: LocalWhisperArtifactProgress | null,
): readonly LocalWhisperArtifactAction[] {
  if (progress && CANCELLABLE_PROGRESS_STATES.has(progress.state)) return ['cancel'];
  if (progress?.state === 'Resumable') return ['resume', 'retry'];
  if (progress?.failure?.retryable === true && RECOVERABLE_PROGRESS_STATES.has(progress.state)) return ['retry'];
  return artifact.actions;
}

function ArtifactProgress({
  artifact,
  progress,
}: {
  readonly artifact: LocalWhisperRendererArtifact;
  readonly progress: LocalWhisperArtifactProgress | null;
}): React.JSX.Element | null {
  if (!progress) return null;
  const value = progress.totalBytes > 0 ? (progress.receivedBytes / progress.totalBytes) * 100 : null;
  return (
    <div aria-live="polite" className="mt-3 min-w-0">
      <div className="flex min-w-0 justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {ACTION_LABELS[progress.action]}
          {progress.queuedPosition === null ? '' : ` · queue ${progress.queuedPosition}`}
        </span>
        <span>
          {formatLocalWhisperBytes(progress.receivedBytes)} / {formatLocalWhisperBytes(progress.totalBytes)}
        </span>
      </div>
      <progress
        aria-label={`${artifact.label} ${ACTION_LABELS[progress.action].toLowerCase()} progress`}
        className="mt-1 h-2 w-full"
        max={100}
        value={value ?? undefined}
      />
      {progress.failure ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {formatLocalWhisperFailureCode(progress.failure.code)}. Recovery:{' '}
          {formatLocalWhisperRecoveryAction(progress.failure.recoveryAction)}.
        </p>
      ) : null}
    </div>
  );
}

/** Renders one artifact and retains destructive-action focus ownership. */
function ArtifactRow({
  artifact,
  pendingAction,
  actionsDisabledReason,
  progress,
  onAction,
  onViewReference,
}: {
  readonly artifact: LocalWhisperRendererArtifact;
  readonly pendingAction: string | null;
  readonly actionsDisabledReason: string | null;
  readonly progress: LocalWhisperArtifactProgress | null;
  readonly onAction: (action: LocalWhisperArtifactAction, artifact: LocalWhisperRendererArtifact) => Promise<boolean>;
  readonly onViewReference: (reference: LocalWhisperArtifactReference) => Promise<boolean>;
}): React.JSX.Element {
  const [removeOpen, setRemoveOpen] = useState(false);
  const removeTriggerRef = useRef<HTMLButtonElement>(null);
  const pending = actionsDisabledReason !== null;
  const actions = artifactActions(artifact, progress);
  const triggerAction = (action: LocalWhisperArtifactAction): void => {
    if (action === 'remove') {
      setRemoveOpen(true);
      return;
    }
    void onAction(action, artifact);
  };

  return (
    <article className="min-w-0 rounded-md border border-border p-3">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-medium text-foreground">{artifact.label}</h3>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {artifact.kind === 'runtime' ? 'Runtime' : 'Model'} · {artifact.revision} · {artifact.state}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatLocalWhisperBytes(artifact.installedSizeBytes)} installed ·{' '}
            {formatLocalWhisperBytes(artifact.transferSizeBytes)} download
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
          {actions.map((action) => (
            <Button
              disabled={pending}
              key={action}
              onClick={() => triggerAction(action)}
              ref={action === 'remove' ? removeTriggerRef : undefined}
              size="sm"
              type="button"
              variant={action === 'remove' ? 'destructive' : 'outline'}
            >
              {pendingAction === action ? 'Working…' : ACTION_LABELS[action]}
            </Button>
          ))}
          {artifact.references.map((reference) => (
            <Button
              disabled={pending}
              key={reference.referenceId}
              onClick={() => void onViewReference(reference)}
              size="sm"
              type="button"
              variant="outline"
            >
              {reference.label}
            </Button>
          ))}
        </div>
      </div>
      {pending && (actions.length > 0 || artifact.references.length > 0) ? (
        <p className="mt-2 text-xs text-muted-foreground">{actionsDisabledReason}</p>
      ) : null}
      <ArtifactProgress artifact={artifact} progress={progress} />

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
                  if (!success) requestAnimationFrame(() => removeTriggerRef.current?.focus());
                });
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

/** Renders managed artifacts, progress, bounded references, and destructive confirmation. */
export default function LocalWhisperStorageSection({
  artifacts,
  aggregateBytes,
  storageSummary,
  progress,
  pendingAction,
  actionsDisabledReason,
  onArtifactAction,
  onViewReference,
  onOpenStorageFolder,
}: LocalWhisperStorageSectionProps): React.JSX.Element {
  return (
    <LocalWhisperSection
      description="Only app-issued artifact IDs and opaque references cross the renderer boundary."
      title="Downloaded versions & storage"
    >
      <div className="space-y-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-md bg-muted/50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Managed storage</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {storageSummary} · {formatLocalWhisperBytes(aggregateBytes)} total
            </p>
          </div>
          <div>
            <Button disabled={pendingAction !== null} onClick={onOpenStorageFolder} type="button" variant="outline">
              Open storage folder
            </Button>
            {pendingAction !== null ? (
              <p className="mt-1 text-xs text-muted-foreground">Disabled while another action is in progress.</p>
            ) : null}
          </div>
        </div>

        {artifacts.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No managed Local Whisper runtime or model versions are listed for this selection.
          </p>
        ) : (
          <div className="space-y-3">
            {artifacts.map((artifact) => (
              <ArtifactRow
                artifact={artifact}
                actionsDisabledReason={actionsDisabledReason}
                key={`${artifact.kind}:${artifact.id}`}
                onAction={onArtifactAction}
                onViewReference={onViewReference}
                pendingAction={pendingAction}
                progress={getLatestLocalWhisperArtifactProgress(progress, artifact.id)}
              />
            ))}
          </div>
        )}
      </div>
    </LocalWhisperSection>
  );
}
