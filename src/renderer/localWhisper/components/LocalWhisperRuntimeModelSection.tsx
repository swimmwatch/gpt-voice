import {
  LOCAL_WHISPER_MODEL_FAMILIES,
  type LocalWhisperGpuBackend,
  type LocalWhisperModelFamily,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';
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
import { getLocalWhisperFamilyRequirement } from '../LocalWhisperPresentation';
import { LocalWhisperField, LocalWhisperOptionSelect, LocalWhisperSection } from './LocalWhisperSection';

interface LocalWhisperRuntimeModelSectionProps {
  readonly snapshot: LocalWhisperRendererSnapshot;
  readonly draft: LocalWhisperSettingsDraft;
  readonly errors: Readonly<Partial<Record<LocalWhisperDraftField, string>>>;
  readonly disabled: boolean;
  readonly updateDraft: (updater: (draft: LocalWhisperSettingsDraft) => LocalWhisperSettingsDraft) => void;
}

function TargetChoice({
  checked,
  description,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly description: string;
  readonly label: string;
  readonly onChange: () => void;
}): React.JSX.Element {
  return (
    <label className="flex min-w-0 cursor-pointer gap-3 rounded-md border border-border p-3 focus-within:ring-2 focus-within:ring-ring">
      <input checked={checked} className="mt-1" name="local-whisper-target" onChange={onChange} type="radio" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function ModelFamilyChoice({
  checked,
  family,
  onChange,
}: {
  readonly checked: boolean;
  readonly family: LocalWhisperModelFamily;
  readonly onChange: () => void;
}): React.JSX.Element {
  return (
    <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-md border border-border p-3 focus-within:ring-2 focus-within:ring-ring">
      <input checked={checked} className="mt-1" name="local-whisper-model-family" onChange={onChange} type="radio" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{family}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{getLocalWhisperFamilyRequirement(family)}</span>
      </span>
    </label>
  );
}

/** Renders engine, target, backend, device, model, and support controls. */
export default function LocalWhisperRuntimeModelSection({
  snapshot,
  draft,
  errors,
  disabled,
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

  return (
    <LocalWhisperSection
      description="Selections are saved atomically. Changing a parent keeps remembered dependent values where possible."
      title="Runtime & model"
    >
      <div className="space-y-5">
        <LocalWhisperField
          error={errors.runtimeRevision}
          htmlFor="local-whisper-runtime"
          label="Engine and runtime revision"
        >
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-foreground">
              Whisper.cpp
            </div>
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
          </div>
        </LocalWhisperField>

        <fieldset className="min-w-0 space-y-2" disabled={disabled}>
          <legend className="text-sm font-medium text-foreground">Execution target</legend>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <TargetChoice
              checked={draft.executionTarget === 'gpu'}
              description="Requires an explicit available backend and device."
              label="GPU"
              onChange={() => updateDraft((current) => updateLocalWhisperTarget(current, 'gpu', snapshot))}
            />
            <TargetChoice
              checked={draft.executionTarget === 'cpu'}
              description={`Production fallback · ${snapshot.host.label}`}
              label="CPU"
              onChange={() => updateDraft((current) => updateLocalWhisperTarget(current, 'cpu', snapshot))}
            />
          </div>
        </fieldset>

        {draft.executionTarget === 'gpu' ? (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <LocalWhisperField error={errors.backend} htmlFor="local-whisper-backend" label="GPU backend">
              <LocalWhisperOptionSelect
                disabled={disabled}
                id="local-whisper-backend"
                onChange={(backend) =>
                  updateDraft((current) =>
                    updateLocalWhisperBackend(current, backend as LocalWhisperGpuBackend, snapshot),
                  )
                }
                options={backendOptions}
                placeholder="Select backend"
                value={draft.backend}
              />
            </LocalWhisperField>
            <LocalWhisperField error={errors.deviceId} htmlFor="local-whisper-device" label="GPU device">
              <LocalWhisperOptionSelect
                disabled={disabled || draft.backend === null}
                id="local-whisper-device"
                onChange={(deviceId) => updateDraft((current) => ({ ...current, deviceId }))}
                options={deviceOptions}
                placeholder="Select device"
                value={draft.deviceId}
              />
            </LocalWhisperField>
          </div>
        ) : (
          <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            CPU target: {snapshot.host.label}. Thread count is available under Advanced.
          </p>
        )}

        <fieldset className="min-w-0 space-y-2" disabled={disabled}>
          <legend className="text-sm font-medium text-foreground">Model family and approximate requirements</legend>
          <p className="text-xs text-muted-foreground">
            Estimates are planning guidance, not guaranteed acceptance. Exact revision/variant estimates appear in
            Status.
          </p>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {LOCAL_WHISPER_MODEL_FAMILIES.map((family) => (
              <ModelFamilyChoice
                checked={draft.modelFamily === family}
                family={family}
                key={family}
                onChange={() => updateDraft((current) => updateLocalWhisperModelFamily(current, family, snapshot))}
              />
            ))}
          </div>
          {errors.modelFamily ? <p className="text-xs font-medium text-destructive">{errors.modelFamily}</p> : null}
        </fieldset>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <LocalWhisperField error={errors.modelRevision} htmlFor="local-whisper-model-revision" label="Model revision">
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
          </LocalWhisperField>
          {modelVariantOptions.length > 1 ? (
            <LocalWhisperField error={errors.modelVariant} htmlFor="local-whisper-model-variant" label="Model variant">
              <LocalWhisperOptionSelect
                disabled={disabled}
                id="local-whisper-model-variant"
                onChange={(modelVariant) =>
                  updateDraft((current) =>
                    updateLocalWhisperModelVariant(current, modelVariant as 'full' | 'q5_0', snapshot),
                  )
                }
                options={modelVariantOptions}
                placeholder="Select reviewed variant"
                value={draft.modelVariant}
              />
            </LocalWhisperField>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p className="rounded-md border border-border p-3">
            NVIDIA CUDA: production path on supported Windows and Linux hosts.
          </p>
          <p className="rounded-md border border-border p-3">
            CPU: production fallback; performance depends on the selected model.
          </p>
          <p className="rounded-md border border-border p-3">
            AMD Windows: Vulkan preview. AMD Linux: HIP preview only for exact allowlisted stacks; Vulkan is a separate
            preview path.
          </p>
          <p className="rounded-md border border-border p-3">
            Apple Silicon/macOS: planned only. Controls remain unavailable in this release and no production support is
            promised.
          </p>
        </div>

        {snapshot.prerequisites.length > 0 ? (
          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-medium text-foreground">Prerequisites</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {snapshot.prerequisites.map((prerequisite) => (
                <li key={`${prerequisite.id}:${prerequisite.version ?? 'missing'}`}>
                  {prerequisite.label}: {prerequisite.version ?? 'Not detected'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </LocalWhisperSection>
  );
}
