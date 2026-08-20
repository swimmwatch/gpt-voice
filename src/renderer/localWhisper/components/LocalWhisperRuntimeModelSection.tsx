import { PiCheckCircle, PiCube, PiGear, PiInfo, PiWarningCircle } from 'react-icons/pi';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useI18n } from '@renderer/hooks/useI18n';
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
import { getLatestLocalWhisperArtifactProgress, translateLocalWhisperRendererLabel } from '../LocalWhisperPresentation';
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
  type LocalWhisperValidationMessage,
} from '../LocalWhisperSettingsState';
import { LocalWhisperArtifactOverflowMenu, LocalWhisperArtifactProgressCard } from './LocalWhisperArtifactControls';
import { LocalWhisperOptionSelect, LocalWhisperPanel } from './LocalWhisperSection';

interface LocalWhisperRuntimeModelSectionProps {
  readonly actionsDisabledReason: string | null;
  readonly cancelDisabledReason: string | null;
  readonly disabled: boolean;
  readonly draft: LocalWhisperSettingsDraft;
  readonly errors: Readonly<Partial<Record<LocalWhisperDraftField, LocalWhisperValidationMessage>>>;
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

function approximateRange(range: readonly [number, number], translate: ReturnType<typeof useI18n>['t']): string {
  return translate('localWhisper.settings.approximateRange', { from: String(range[0]), to: String(range[1]) });
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
  cancelDisabledReason,
  label,
  onArtifactAction,
  pendingAction,
  progress,
}: {
  readonly actionsDisabledReason: string | null;
  readonly artifact: LocalWhisperRendererArtifact | null;
  readonly cancelDisabledReason: string | null;
  readonly label: string;
  readonly onArtifactAction: LocalWhisperRuntimeModelSectionProps['onArtifactAction'];
  readonly pendingAction: string | null;
  readonly progress: LocalWhisperArtifactProgress | null;
}): React.JSX.Element {
  const { t } = useI18n();
  return (
    <div className="lw-status-column">
      <span className="lw-field-label">{label}</span>
      {artifact ? (
        <LocalWhisperArtifactProgressCard
          actionsDisabledReason={actionsDisabledReason}
          artifact={artifact}
          cancelDisabledReason={cancelDisabledReason}
          onAction={onArtifactAction}
          pendingAction={pendingAction}
          progress={progress}
        />
      ) : (
        <div className="lw-transfer-field lw-empty-status">
          <PiWarningCircle aria-hidden="true" />
          <div>
            <strong>{t('localWhisper.settings.notAvailable')}</strong>
            <span>{t('localWhisper.settings.noArtifactSelection')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Renders the approved compact engine and model configuration panels. */
export default function LocalWhisperRuntimeModelSection({
  actionsDisabledReason,
  cancelDisabledReason,
  snapshot,
  draft,
  errors,
  disabled,
  onArtifactAction,
  onViewReference,
  pendingAction,
  updateDraft,
}: LocalWhisperRuntimeModelSectionProps): React.JSX.Element {
  const { t } = useI18n();
  const runtimeOptions = getLocalWhisperOptions(snapshot, 'runtime');
  const backendOptions = getLocalWhisperOptions(snapshot, 'backend');
  const deviceOptions = getLocalWhisperOptions(snapshot, 'device').filter(
    (option) => draft.backend && option.compatibility.eligibleBackends.includes(draft.backend),
  );
  const selectedDeviceUnavailable =
    draft.deviceId !== null && !deviceOptions.some((option) => option.id === draft.deviceId);
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
  const selectedVariant = draft.modelVariant === 'q5_0' ? 'Q5_0' : t('localWhisper.settings.full');
  const backendValue = draft.executionTarget === 'cpu' ? 'cpu' : (draft.backend ?? '');
  const backendSelectionOptions = [{ id: 'cpu', label: 'CPU', available: true }, ...backendOptions];

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
        title={t('localWhisper.settings.engineBackend')}
      >
        <div className="lw-engine-layout">
          <div className="lw-engine-controls">
            <label>
              <span>{t('localWhisper.settings.backend')}</span>
              <LocalWhisperOptionSelect
                disabled={disabled}
                id="local-whisper-backend"
                onChange={(value) => {
                  updateDraft((current) => {
                    if (value === 'cpu') return updateLocalWhisperTarget(current, 'cpu', snapshot);
                    const gpuDraft = updateLocalWhisperTarget(current, 'gpu', snapshot);
                    return updateLocalWhisperBackend(gpuDraft, value as LocalWhisperGpuBackend, snapshot);
                  });
                }}
                options={backendSelectionOptions}
                placeholder={t('localWhisper.settings.selectBackend')}
                value={backendValue}
              />
            </label>
            <span className="lw-field-note">
              {draft.executionTarget === 'cpu'
                ? t('localWhisper.settings.productionFallback', {
                    host: translateLocalWhisperRendererLabel(snapshot.host.label, t),
                  })
                : t('localWhisper.settings.support', { tier: snapshot.runtime.supportTier })}
            </span>

            <label>
              <span>{t('localWhisper.settings.runtimeRevisionLabel')}</span>
              <span className="lw-input-with-info">
                <LocalWhisperOptionSelect
                  disabled={disabled}
                  id="local-whisper-runtime"
                  onChange={(runtimeRevision) =>
                    updateDraft((current) => updateLocalWhisperRuntimeRevision(current, runtimeRevision, snapshot))
                  }
                  options={runtimeOptions}
                  placeholder={t('localWhisper.settings.selectRuntimeRevision')}
                  value={draft.runtimeRevision}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="lw-field-info">
                      <PiInfo aria-hidden="true" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('localWhisper.settings.installedRuntimeRevision')}</TooltipContent>
                </Tooltip>
              </span>
              {errors.runtimeRevision ? (
                <span className="lw-field-error">{t(errors.runtimeRevision.key, errors.runtimeRevision.params)}</span>
              ) : null}
            </label>

            <label>
              <span>{t('localWhisper.settings.device')}</span>
              {draft.executionTarget === 'gpu' ? (
                <LocalWhisperOptionSelect
                  disabled={disabled || draft.backend === null}
                  id="local-whisper-device"
                  onChange={(deviceId) => updateDraft((current) => ({ ...current, deviceId }))}
                  options={deviceOptions}
                  placeholder={t('localWhisper.settings.selectDevice')}
                  value={selectedDeviceUnavailable ? null : draft.deviceId}
                />
              ) : (
                <span className="lw-readonly-value">{translateLocalWhisperRendererLabel(snapshot.host.label, t)}</span>
              )}
              {selectedDeviceUnavailable ? (
                <span className="lw-field-error">{t('localWhisper.settings.savedDeviceUnavailable')}</span>
              ) : null}
              {errors.deviceId ? (
                <span className="lw-field-error">{t(errors.deviceId.key, errors.deviceId.params)}</span>
              ) : null}
            </label>
          </div>

          <ArtifactStatusColumn
            actionsDisabledReason={actionsDisabledReason}
            artifact={runtimeArtifact}
            cancelDisabledReason={cancelDisabledReason}
            label={t('localWhisper.settings.installStatus')}
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
        title={t('localWhisper.settings.model')}
      >
        <div className="lw-model-layout">
          <div className="lw-selected-model-control">
            <span className="lw-model-selector">
              <span className="lw-model-select-stack">
                <LocalWhisperOptionSelect
                  disabled={disabled}
                  id="local-whisper-model-revision"
                  onChange={(modelRevision) =>
                    updateDraft((current) => updateLocalWhisperModelRevision(current, modelRevision, snapshot))
                  }
                  options={modelRevisionOptions}
                  placeholder={t('localWhisper.settings.selectModelRevision')}
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
                    placeholder={t('localWhisper.settings.selectVariant')}
                    value={draft.modelVariant}
                  />
                ) : (
                  <span className="lw-variant-label">{selectedVariant}</span>
                )}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`lw-artifact-state ${selectedModelDownloaded ? 'installed' : 'missing'}`}>
                    {selectedModelDownloaded ? (
                      <PiCheckCircle aria-hidden="true" />
                    ) : (
                      <PiWarningCircle aria-hidden="true" />
                    )}
                    <span className="sr-only">
                      {selectedModelDownloaded
                        ? t('localWhisper.settings.downloaded')
                        : t('localWhisper.settings.notDownloaded')}
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedModelDownloaded
                    ? t('localWhisper.settings.downloaded')
                    : t('localWhisper.settings.notDownloaded')}
                </TooltipContent>
              </Tooltip>
            </span>
            {errors.modelRevision ? (
              <span className="lw-field-error">{t(errors.modelRevision.key, errors.modelRevision.params)}</span>
            ) : null}
            {errors.modelVariant ? (
              <span className="lw-field-error">{t(errors.modelVariant.key, errors.modelVariant.params)}</span>
            ) : null}
          </div>

          <ArtifactStatusColumn
            actionsDisabledReason={actionsDisabledReason}
            artifact={modelArtifact}
            cancelDisabledReason={cancelDisabledReason}
            label={t('localWhisper.settings.downloadStatus')}
            onArtifactAction={onArtifactAction}
            pendingAction={pendingAction}
            progress={modelProgress}
          />
        </div>

        <div aria-label={t('localWhisper.settings.availableModels')} className="lw-model-table" role="table">
          <div className="lw-model-table-header" role="row">
            <span role="columnheader">{t('localWhisper.settings.model')}</span>
            <span role="columnheader">{t('modelMemory.ram')}</span>
            <span role="columnheader">{t('modelMemory.vram')}</span>
            <span className="sr-only" role="columnheader">
              {t('localWhisper.settings.actions')}
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
                  {approximateRange(guidance.approximateSystemRamGiB, t)}
                </span>
                <span data-label="VRAM" role="cell">
                  {approximateRange(guidance.approximateVramGiB, t)}
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
