import { PiCaretDown, PiCheckCircle, PiCpu, PiCube, PiGear, PiInfo, PiWarningCircle } from 'react-icons/pi';
import { SiNvidia } from 'react-icons/si';
import {
  LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE,
  LOCAL_WHISPER_MODEL_FAMILIES,
  type LocalWhisperArtifactAction,
  type LocalWhisperArtifactProgress,
  type LocalWhisperArtifactReference,
  type LocalWhisperGpuBackend,
  type LocalWhisperModelFamily,
  type LocalWhisperRendererArtifact,
  type LocalWhisperRendererOption,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';
import { getLatestLocalWhisperArtifactProgress } from '../LocalWhisperPresentation';
import {
  getLocalWhisperOptions,
  updateLocalWhisperBackend,
  updateLocalWhisperModelFamily,
  updateLocalWhisperModelRevision,
  updateLocalWhisperModelVariant,
  updateLocalWhisperRuntimeRevision,
  updateLocalWhisperTarget,
  type LocalWhisperDraftField,
  type LocalWhisperSettingsDraft,
} from '../LocalWhisperSettingsState';
import { LocalWhisperArtifactOverflowMenu, LocalWhisperArtifactProgressCard } from './LocalWhisperArtifactControls';
import { LocalWhisperOptionSelect, LocalWhisperPanel } from './LocalWhisperSection';

interface LocalWhisperRuntimeModelSectionProps {
  readonly actionsDisabledReason: string | null;
  readonly disabled: boolean;
  readonly draft: LocalWhisperSettingsDraft;
  readonly errors: Readonly<Partial<Record<LocalWhisperDraftField, string>>>;
  readonly onArtifactAction: (
    action: LocalWhisperArtifactAction,
    artifact: LocalWhisperRendererArtifact,
  ) => Promise<boolean>;
  readonly onViewReference: (reference: LocalWhisperArtifactReference) => Promise<boolean>;
  readonly pendingAction: string | null;
  readonly snapshot: LocalWhisperRendererSnapshot;
  readonly updateDraft: (updater: (draft: LocalWhisperSettingsDraft) => LocalWhisperSettingsDraft) => void;
}

function artifactForRevision(
  snapshot: LocalWhisperRendererSnapshot,
  kind: LocalWhisperRendererArtifact['kind'],
  revision: string | null,
): LocalWhisperRendererArtifact | null {
  if (revision === null) return null;
  return snapshot.artifacts.find((artifact) => artifact.kind === kind && artifact.revision === revision) ?? null;
}

function progressForArtifact(
  snapshot: LocalWhisperRendererSnapshot,
  artifact: LocalWhisperRendererArtifact | null,
): LocalWhisperArtifactProgress | null {
  return artifact ? getLatestLocalWhisperArtifactProgress(snapshot.progress, artifact.id) : null;
}

function approximateRange(range: readonly [number, number]): string {
  return `~${range[0]}–${range[1]} GiB`;
}

function preferredFamilyRevision(
  options: readonly LocalWhisperRendererOption[],
  family: LocalWhisperModelFamily,
): string | null {
  const familyOptions = options.filter(
    (option) => option.group === 'modelRevision' && option.compatibility.modelFamily === family,
  );
  return (
    familyOptions.find((option) => option.selected)?.id ??
    familyOptions.find((option) => option.saved)?.id ??
    familyOptions.find((option) => option.default)?.id ??
    familyOptions[0]?.id ??
    null
  );
}

function ArtifactStatusColumn({
  actionsDisabledReason,
  artifact,
  label,
  onArtifactAction,
  pendingAction,
  progress,
}: {
  readonly actionsDisabledReason: string | null;
  readonly artifact: LocalWhisperRendererArtifact | null;
  readonly label: string;
  readonly onArtifactAction: LocalWhisperRuntimeModelSectionProps['onArtifactAction'];
  readonly pendingAction: string | null;
  readonly progress: LocalWhisperArtifactProgress | null;
}): React.JSX.Element {
  return (
    <div className="lw-status-column">
      <span className="lw-field-label">{label}</span>
      {artifact ? (
        <LocalWhisperArtifactProgressCard
          actionsDisabledReason={actionsDisabledReason}
          artifact={artifact}
          onAction={onArtifactAction}
          pendingAction={pendingAction}
          progress={progress}
        />
      ) : (
        <div className="lw-transfer-field lw-empty-status">
          <PiWarningCircle aria-hidden="true" />
          <div>
            <strong>Not available</strong>
            <span>No trusted artifact matches this selection.</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders the approved compact engine and model configuration panels. */
export default function LocalWhisperRuntimeModelSection({
  actionsDisabledReason,
  snapshot,
  draft,
  errors,
  disabled,
  onArtifactAction,
  onViewReference,
  pendingAction,
  updateDraft,
}: LocalWhisperRuntimeModelSectionProps): React.JSX.Element {
  const runtimeOptions = getLocalWhisperOptions(snapshot, 'runtime');
  const backendOptions = getLocalWhisperOptions(snapshot, 'backend');
  const deviceOptions = getLocalWhisperOptions(snapshot, 'device').filter(
    (option) => draft.backend && option.compatibility.eligibleBackends.includes(draft.backend),
  );
  const modelRevisionOptions = getLocalWhisperOptions(snapshot, 'modelRevision').filter(
    (option) => option.compatibility.modelFamily === draft.modelFamily,
  );
  const modelVariants = new Set(modelRevisionOptions.map((option) => option.compatibility.modelVariant));
  const modelVariantOptions = getLocalWhisperOptions(snapshot, 'modelVariant').filter((option) =>
    modelVariants.has(option.id as 'full' | 'q5_0'),
  );
  const runtimeArtifact = artifactForRevision(snapshot, 'runtime', draft.runtimeRevision);
  const modelArtifact = artifactForRevision(snapshot, 'model', draft.modelRevision);
  const runtimeProgress = progressForArtifact(snapshot, runtimeArtifact);
  const modelProgress = progressForArtifact(snapshot, modelArtifact);
  const selectedModelDownloaded = modelArtifact?.state === 'Installed';
  const selectedVariant = draft.modelVariant === 'q5_0' ? 'Q5_0' : 'Full';
  const backendValue = draft.executionTarget === 'cpu' ? 'cpu' : (draft.backend ?? '');

  return (
    <>
      <LocalWhisperPanel
        actions={
          runtimeArtifact ? (
            <LocalWhisperArtifactOverflowMenu
              actionsDisabledReason={actionsDisabledReason}
              artifact={runtimeArtifact}
              onAction={onArtifactAction}
              onViewReference={onViewReference}
              pendingAction={pendingAction}
              progress={runtimeProgress}
            />
          ) : null
        }
        className="lw-engine-section"
        icon={PiGear}
        title="Engine backend"
      >
        <div className="lw-engine-layout">
          <div className="lw-engine-controls">
            <label>
              <span>Backend</span>
              <span className="lw-select-control">
                {draft.executionTarget === 'gpu' && draft.backend === 'cuda' ? (
                  <SiNvidia aria-hidden="true" />
                ) : (
                  <PiCpu aria-hidden="true" />
                )}
                <select
                  aria-label="Backend"
                  disabled={disabled}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateDraft((current) => {
                      if (value === 'cpu') return updateLocalWhisperTarget(current, 'cpu', snapshot);
                      const gpuDraft = updateLocalWhisperTarget(current, 'gpu', snapshot);
                      return updateLocalWhisperBackend(gpuDraft, value as LocalWhisperGpuBackend, snapshot);
                    });
                  }}
                  value={backendValue}
                >
                  <option value="cpu">CPU</option>
                  {backendOptions.map((option) => (
                    <option disabled={!option.available} key={option.id} value={option.id}>
                      {option.label}
                      {option.available ? '' : ' · Unavailable'}
                    </option>
                  ))}
                </select>
                <PiCaretDown aria-hidden="true" />
              </span>
            </label>
            <span className="lw-field-note">
              {draft.executionTarget === 'cpu'
                ? `Production fallback · ${snapshot.host.label}`
                : `${snapshot.runtime.supportTier} support`}
            </span>

            <label>
              <span>Runtime revision</span>
              <span className="lw-input-with-info">
                <LocalWhisperOptionSelect
                  disabled={disabled}
                  id="local-whisper-runtime"
                  onChange={(runtimeRevision) =>
                    updateDraft((current) => updateLocalWhisperRuntimeRevision(current, runtimeRevision, snapshot))
                  }
                  options={runtimeOptions}
                  placeholder="Select runtime revision"
                  value={draft.runtimeRevision}
                />
                <PiInfo aria-hidden="true" title="Installed runtime revision" />
              </span>
              {errors.runtimeRevision ? <span className="lw-field-error">{errors.runtimeRevision}</span> : null}
            </label>

            <label>
              <span>Device</span>
              <span className="lw-select-control no-brand">
                <PiCpu aria-hidden="true" />
                {draft.executionTarget === 'gpu' ? (
                  <select
                    aria-label="GPU device"
                    disabled={disabled || draft.backend === null}
                    onChange={(event) => updateDraft((current) => ({ ...current, deviceId: event.target.value }))}
                    value={draft.deviceId ?? ''}
                  >
                    <option disabled value="">
                      Select device
                    </option>
                    {deviceOptions.map((option) => (
                      <option disabled={!option.available} key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="lw-readonly-value">{snapshot.host.label}</span>
                )}
                <PiCaretDown aria-hidden="true" />
              </span>
              {errors.deviceId ? <span className="lw-field-error">{errors.deviceId}</span> : null}
            </label>
          </div>

          <ArtifactStatusColumn
            actionsDisabledReason={actionsDisabledReason}
            artifact={runtimeArtifact}
            label="Install status"
            onArtifactAction={onArtifactAction}
            pendingAction={pendingAction}
            progress={runtimeProgress}
          />
        </div>
      </LocalWhisperPanel>

      <LocalWhisperPanel
        actions={
          modelArtifact ? (
            <LocalWhisperArtifactOverflowMenu
              actionsDisabledReason={actionsDisabledReason}
              artifact={modelArtifact}
              onAction={onArtifactAction}
              onViewReference={onViewReference}
              pendingAction={pendingAction}
              progress={modelProgress}
            />
          ) : null
        }
        className="lw-model-section"
        icon={PiCube}
        title="Model"
      >
        <div className="lw-model-layout">
          <div className="lw-selected-model-control">
            <span className="lw-model-selector">
              <PiCube aria-hidden="true" />
              <span className="lw-model-select-stack">
                <LocalWhisperOptionSelect
                  disabled={disabled}
                  id="local-whisper-model-revision"
                  onChange={(modelRevision) =>
                    updateDraft((current) => updateLocalWhisperModelRevision(current, modelRevision, snapshot))
                  }
                  options={modelRevisionOptions}
                  placeholder="Select model revision"
                  value={draft.modelRevision}
                />
                {modelVariantOptions.length > 1 ? (
                  <LocalWhisperOptionSelect
                    disabled={disabled}
                    id="local-whisper-model-variant"
                    onChange={(modelVariant) =>
                      updateDraft((current) =>
                        updateLocalWhisperModelVariant(current, modelVariant as 'full' | 'q5_0', snapshot),
                      )
                    }
                    options={modelVariantOptions}
                    placeholder="Select variant"
                    value={draft.modelVariant}
                  />
                ) : (
                  <span className="lw-variant-label">{selectedVariant}</span>
                )}
              </span>
              <span
                className={`lw-artifact-state ${selectedModelDownloaded ? 'installed' : 'missing'}`}
                title={selectedModelDownloaded ? 'Downloaded' : 'Not downloaded'}
              >
                {selectedModelDownloaded ? (
                  <PiCheckCircle aria-hidden="true" />
                ) : (
                  <PiWarningCircle aria-hidden="true" />
                )}
                <span className="sr-only">{selectedModelDownloaded ? 'Downloaded' : 'Not downloaded'}</span>
              </span>
            </span>
            {errors.modelRevision ? <span className="lw-field-error">{errors.modelRevision}</span> : null}
            {errors.modelVariant ? <span className="lw-field-error">{errors.modelVariant}</span> : null}
          </div>

          <ArtifactStatusColumn
            actionsDisabledReason={actionsDisabledReason}
            artifact={modelArtifact}
            label="Download status"
            onArtifactAction={onArtifactAction}
            pendingAction={pendingAction}
            progress={modelProgress}
          />
        </div>

        <div aria-label="Available Local Whisper models" className="lw-model-table" role="table">
          <div className="lw-model-table-header" role="row">
            <span role="columnheader">Model</span>
            <span role="columnheader">RAM</span>
            <span role="columnheader">VRAM</span>
            <span className="sr-only" role="columnheader">
              Actions
            </span>
          </div>
          {LOCAL_WHISPER_MODEL_FAMILIES.map((family) => {
            const selected = family === draft.modelFamily;
            const guidance = LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE[family];
            const revision = preferredFamilyRevision(snapshot.options, family);
            const artifact = artifactForRevision(snapshot, 'model', revision);
            const progress = progressForArtifact(snapshot, artifact);
            return (
              <div className={`lw-model-row${selected ? ' selected' : ''}`} key={family} role="row">
                <button
                  aria-pressed={selected}
                  className="lw-model-name-cell"
                  disabled={disabled}
                  onClick={() => updateDraft((current) => updateLocalWhisperModelFamily(current, family, snapshot))}
                  role="cell"
                  type="button"
                >
                  <span aria-hidden="true" className="lw-radio-mark" />
                  <PiCube aria-hidden="true" />
                  <strong>{family}</strong>
                  {family === 'large-v3-turbo' ? <span>· Q5_0</span> : null}
                </button>
                <span data-label="RAM" role="cell">
                  {approximateRange(guidance.approximateSystemRamGiB)}
                </span>
                <span data-label="VRAM" role="cell">
                  {approximateRange(guidance.approximateVramGiB)}
                </span>
                <span className="lw-row-action" role="cell">
                  {artifact ? (
                    <LocalWhisperArtifactOverflowMenu
                      actionsDisabledReason={actionsDisabledReason}
                      artifact={artifact}
                      onAction={onArtifactAction}
                      onViewReference={onViewReference}
                      pendingAction={pendingAction}
                      progress={progress}
                    />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </LocalWhisperPanel>
    </>
  );
}
