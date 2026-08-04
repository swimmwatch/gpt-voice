import type { ReactNode } from 'react';
import { Button } from '@renderer/components/ui/button';
import type { LocalWhisperRendererSnapshot } from '@shared/localWhisper';
import {
  formatLocalWhisperBytes,
  formatLocalWhisperFailureCode,
  formatLocalWhisperRecoveryAction,
  getLocalWhisperCheckAvailability,
  getLocalWhisperLoadAvailability,
  getLocalWhisperSupportLabel,
  getLocalWhisperUnloadAvailability,
  isLocalWhisperArtifactProgressActive,
  type LocalWhisperActionAvailability,
} from '../LocalWhisperPresentation';
import { getLocalWhisperOption } from '../LocalWhisperSettingsState';
import { LocalWhisperSection } from './LocalWhisperSection';

interface ActionButtonProps {
  readonly availability: LocalWhisperActionAvailability;
  readonly children: ReactNode;
  readonly pending: boolean;
  readonly onClick: () => void;
}

function ActionButton({ availability, children, pending, onClick }: ActionButtonProps): React.JSX.Element | null {
  if (!availability.visible) return null;
  return (
    <div className="min-w-0">
      <Button disabled={!availability.enabled} onClick={onClick} type="button" variant="outline">
        {pending ? 'Working…' : children}
      </Button>
      {!availability.enabled && availability.disabledReason ? (
        <p className="mt-1 max-w-64 text-xs text-muted-foreground">{availability.disabledReason}</p>
      ) : null}
    </div>
  );
}

function StatusFact({ label, value }: { readonly label: string; readonly value: ReactNode }): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function selectedIdentity(snapshot: LocalWhisperRendererSnapshot): string {
  const settings = snapshot.settings;
  const backend = settings.execution.target === 'gpu' ? settings.execution.backend : 'cpu';
  return `${settings.model.family} · ${settings.model.revision} · ${settings.model.variant} · ${backend}`;
}

interface LocalWhisperStatusSectionProps {
  readonly snapshot: LocalWhisperRendererSnapshot;
  readonly pendingAction: string | null;
  readonly onCheck: () => void;
  readonly onLoad: () => void;
  readonly onUnload: () => void;
}

/** Renders independent setup, capability, residency, resource, and action state. */
export default function LocalWhisperStatusSection({
  snapshot,
  pendingAction,
  onCheck,
  onLoad,
  onUnload,
}: LocalWhisperStatusSectionProps): React.JSX.Element {
  const pending = pendingAction !== null || snapshot.progress.some(isLocalWhisperArtifactProgressActive);
  const selectedRuntime = getLocalWhisperOption(snapshot, 'runtime', snapshot.settings.runtimeRevision)?.label;
  const selectedDevice =
    snapshot.settings.execution.target === 'cpu'
      ? snapshot.host.label
      : (getLocalWhisperOption(snapshot, 'device', snapshot.selectedDeviceId)?.label ?? 'Selected GPU');
  const failure = snapshot.failure;
  const exactEstimate = snapshot.memory.selectedEstimate;
  const qualifiedPeak = snapshot.memory.qualifiedPeak;
  const resources = snapshot.resources;

  return (
    <LocalWhisperSection
      description="Setup, compatibility, and residency are independent states. A downloaded model is not automatically loaded."
      title="Status"
    >
      <div aria-live="polite" className="space-y-4">
        <dl className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <StatusFact label="Runtime setup" value={snapshot.runtime.runtimeSetup} />
          <StatusFact label="Model setup" value={snapshot.runtime.modelSetup} />
          <StatusFact label="Compatibility" value={snapshot.runtime.capability} />
          <StatusFact label="Memory residency" value={snapshot.runtime.residency} />
        </dl>

        <div className="grid min-w-0 gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected stack</p>
            <p className="mt-1 break-words text-sm text-foreground">
              Whisper.cpp · {selectedRuntime ?? snapshot.settings.runtimeRevision} · {snapshot.settings.model.family} ·{' '}
              {snapshot.settings.model.revision} · {snapshot.settings.model.variant}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Execution</p>
            <p className="mt-1 break-words text-sm text-foreground">
              {snapshot.settings.execution.target.toUpperCase()} · {selectedDevice}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Support</p>
            <p className="mt-1 break-words text-sm text-foreground">{getLocalWhisperSupportLabel(snapshot)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity</p>
            <p className="mt-1 text-sm text-foreground">{snapshot.runtime.activity}</p>
          </div>
        </div>

        {failure ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3" role="status">
            <p className="text-sm font-medium text-destructive">{formatLocalWhisperFailureCode(failure.code)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Recovery: {formatLocalWhisperRecoveryAction(failure.recoveryAction)}.
            </p>
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Selected configuration estimate</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">{selectedIdentity(snapshot)}</p>
            {exactEstimate ? (
              <div className="mt-2 space-y-1 text-sm text-foreground">
                <p>
                  Catalog estimate: {formatLocalWhisperBytes(exactEstimate.estimatedPeakRamBytes)} RAM ·{' '}
                  {formatLocalWhisperBytes(exactEstimate.estimatedPeakVramBytes)} VRAM · {exactEstimate.evidenceBasis}
                </p>
                {qualifiedPeak ? (
                  <p>
                    Qualified peak: {formatLocalWhisperBytes(qualifiedPeak.measuredPeakRamBytes)} RAM ·{' '}
                    {formatLocalWhisperBytes(qualifiedPeak.measuredPeakVramBytes)} VRAM
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Exact estimate unavailable for the selected backend, model revision, and variant.
              </p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Current resource check</p>
            {resources ? (
              <dl className="mt-2 space-y-1 text-sm text-foreground">
                <div className="flex min-w-0 justify-between gap-3">
                  <dt>Required RAM with headroom</dt>
                  <dd>{formatLocalWhisperBytes(resources.requiredRamBytes)}</dd>
                </div>
                <div className="flex min-w-0 justify-between gap-3">
                  <dt>Free RAM</dt>
                  <dd>{formatLocalWhisperBytes(resources.freeRamBytes)}</dd>
                </div>
                <div className="flex min-w-0 justify-between gap-3">
                  <dt>Required VRAM with headroom</dt>
                  <dd>{formatLocalWhisperBytes(resources.requiredVramBytes)}</dd>
                </div>
                <div className="flex min-w-0 justify-between gap-3">
                  <dt>Free VRAM</dt>
                  <dd>{formatLocalWhisperBytes(resources.freeVramBytes)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Current free RAM/VRAM and required headroom have not been checked for this exact configuration.
              </p>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-start gap-3">
          <ActionButton
            availability={getLocalWhisperCheckAvailability(snapshot, pending)}
            onClick={onCheck}
            pending={pendingAction === 'checkCompatibility'}
          >
            Check compatibility
          </ActionButton>
          <ActionButton
            availability={getLocalWhisperLoadAvailability(snapshot, pending)}
            onClick={onLoad}
            pending={pendingAction === 'load'}
          >
            Load model
          </ActionButton>
          <ActionButton
            availability={getLocalWhisperUnloadAvailability(snapshot, pending)}
            onClick={onUnload}
            pending={pendingAction === 'unload'}
          >
            Unload model
          </ActionButton>
        </div>
      </div>
    </LocalWhisperSection>
  );
}
