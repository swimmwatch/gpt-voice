import { PiDatabase, PiHardDrives } from 'react-icons/pi';
import type {
  LocalWhisperArtifactAction,
  LocalWhisperArtifactProgress,
  LocalWhisperArtifactReference,
  LocalWhisperRendererArtifact,
} from '@shared/localWhisper';
import { formatLocalWhisperBytes, getLatestLocalWhisperArtifactProgress } from '../LocalWhisperPresentation';
import { LocalWhisperArtifactOverflowMenu, LocalWhisperArtifactProgressCard } from './LocalWhisperArtifactControls';
import { LocalWhisperDisclosure } from './LocalWhisperSection';

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

/** Keeps the complete managed inventory available without expanding the default settings view. */
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
    <LocalWhisperDisclosure
      className="lw-storage-disclosure"
      icon={PiDatabase}
      summary={`${formatLocalWhisperBytes(aggregateBytes)} used · ${artifacts.length} installed artifacts`}
      title="Storage"
    >
      <div className="lw-storage-summary">
        <PiHardDrives aria-hidden="true" />
        <div>
          <strong>Local Whisper storage</strong>
          <span>{storageSummary} · Runtime packages, model files, and verification metadata.</span>
        </div>
        <button
          className="lw-secondary-button"
          disabled={pendingAction !== null}
          onClick={onOpenStorageFolder}
          title={pendingAction === null ? undefined : 'Disabled while another action is in progress.'}
          type="button"
        >
          Open folder
        </button>
      </div>

      {artifacts.length === 0 ? (
        <p className="lw-empty-message">No managed Local Whisper runtime or model versions are listed.</p>
      ) : (
        <div className="lw-storage-artifacts">
          {artifacts.map((artifact) => {
            const artifactProgress = getLatestLocalWhisperArtifactProgress(progress, artifact.id);
            return (
              <article className="lw-storage-artifact" key={`${artifact.kind}:${artifact.id}`}>
                <div className="lw-storage-artifact-heading">
                  <div>
                    <strong>{artifact.label}</strong>
                    <span>
                      {artifact.kind === 'runtime' ? 'Runtime' : 'Model'} · {artifact.revision}
                    </span>
                  </div>
                  <LocalWhisperArtifactOverflowMenu
                    actionsDisabledReason={actionsDisabledReason}
                    artifact={artifact}
                    onAction={onArtifactAction}
                    onViewReference={onViewReference}
                    pendingAction={pendingAction}
                    progress={artifactProgress}
                  />
                </div>
                <LocalWhisperArtifactProgressCard
                  actionsDisabledReason={actionsDisabledReason}
                  artifact={artifact}
                  onAction={onArtifactAction}
                  pendingAction={pendingAction}
                  progress={artifactProgress}
                />
              </article>
            );
          })}
        </div>
      )}
    </LocalWhisperDisclosure>
  );
}
