import type { IconType } from 'react-icons';
import {
  PiBrain,
  PiCaretRight,
  PiCheckCircle,
  PiCloudArrowUp,
  PiCpu,
  PiCube,
  PiInfo,
  PiMemory,
  PiShieldCheck,
  PiSlidersHorizontal,
  PiTag,
  PiTerminalWindow,
  PiWarningCircle,
} from 'react-icons/pi';
import { SiNvidia } from 'react-icons/si';
import type { LocalWhisperRendererSnapshot } from '@shared/localWhisper';
import {
  formatLocalWhisperBytes,
  formatLocalWhisperFailureCode,
  formatLocalWhisperRecoveryAction,
  getLocalWhisperCheckAvailability,
  getLocalWhisperLoadAvailability,
  getLocalWhisperResourceSafetyPresentation,
  getLocalWhisperUnloadAvailability,
  isLocalWhisperArtifactProgressActive,
  type LocalWhisperActionAvailability,
  type LocalWhisperResourceMeterPresentation,
} from '../LocalWhisperPresentation';
import { getLocalWhisperOption } from '../LocalWhisperSettingsState';
import { LocalWhisperDisclosure, LocalWhisperPanel } from './LocalWhisperSection';

type StatusTone = 'success' | 'warning' | 'active';

function ReadinessStep({
  label,
  last = false,
  state,
  tone,
}: {
  readonly label: string;
  readonly last?: boolean;
  readonly state: string;
  readonly tone: StatusTone;
}): React.JSX.Element {
  const StatusIcon = tone === 'warning' ? PiWarningCircle : PiCheckCircle;
  return (
    <div className="lw-readiness-step">
      <StatusIcon aria-hidden="true" className={`lw-readiness-icon ${tone}`} />
      <div>
        <strong>{label}</strong>
        <span>{state}</span>
      </div>
      {last ? null : <PiCaretRight aria-hidden="true" className="lw-readiness-divider" />}
    </div>
  );
}

function setupTone(state: LocalWhisperRendererSnapshot['runtime']['runtimeSetup'], active = false): StatusTone {
  if (state === 'Installed') return active ? 'active' : 'success';
  if (state === 'Downloading' || state === 'Verifying' || state === 'Installing') return 'active';
  return 'warning';
}

function capabilityTone(state: LocalWhisperRendererSnapshot['runtime']['capability']): StatusTone {
  if (state === 'Validated') return 'success';
  if (state === 'Checking' || state === 'EstimateOnly') return 'active';
  return 'warning';
}

function residencyTone(state: LocalWhisperRendererSnapshot['runtime']['residency']): StatusTone {
  if (state === 'Loaded') return 'success';
  if (state === 'Loading' || state === 'Unloading') return 'active';
  return 'warning';
}

interface DetailItemProps {
  readonly accent?: 'nvidia' | 'blue' | 'purple' | 'green';
  readonly icon: IconType;
  readonly label: string;
  readonly title?: string;
  readonly value: string;
}

function DetailItem({ accent, icon: Icon, label, title, value }: DetailItemProps): React.JSX.Element {
  return (
    <div className="lw-detail-item" title={title}>
      <span className={`lw-detail-icon${accent ? ` accent-${accent}` : ''}`}>
        <Icon aria-hidden="true" />
      </span>
      <span className="lw-detail-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      {title ? <PiInfo aria-hidden="true" className="lw-detail-info" /> : null}
    </div>
  );
}

function numericBytes(value: number | 'notApplicable' | null): number | null {
  return typeof value === 'number' ? value : null;
}

function ResourceMeter({
  label,
  meter,
  tone,
}: {
  readonly label: string;
  readonly meter: LocalWhisperResourceMeterPresentation;
  readonly tone: 'ram' | 'vram';
}): React.JSX.Element {
  const safe = numericBytes(meter.safeReservableBytes);
  const peak = numericBytes(meter.peakBytes);
  const scale = Math.max(meter.availableBytes ?? 0, safe ?? 0, peak ?? 0, 1);
  const safeWidth = safe === null ? 0 : Math.min(100, (safe / scale) * 100);
  const peakWidth = peak === null ? 0 : Math.min(100, (peak / scale) * 100);
  return (
    <div className="lw-resource-meter">
      <div className="lw-resource-meter-heading">
        <strong>{label}</strong>
        <span>{formatLocalWhisperBytes(meter.availableBytes)} available</span>
      </div>
      <div
        aria-label={`${label}: ${formatLocalWhisperBytes(meter.peakBytes)} peak, ${formatLocalWhisperBytes(
          meter.safeReservableBytes,
        )} safe to reserve`}
        className="lw-capacity-track"
        role="img"
      >
        {safe === null ? null : <span className={`lw-safe-capacity ${tone}`} style={{ width: `${safeWidth}%` }} />}
        {peak === null ? null : <span className={`lw-required-capacity ${tone}`} style={{ width: `${peakWidth}%` }} />}
        {safe === null ? null : <span className="lw-safe-marker" style={{ left: `${safeWidth}%` }} />}
      </div>
      <div className="lw-resource-meter-meta">
        <span>{formatLocalWhisperBytes(meter.safeReservableBytes)} safe to reserve</span>
        <span>{formatLocalWhisperBytes(meter.peakBytes)} peak</span>
      </div>
    </div>
  );
}

interface LocalWhisperStatusSectionProps {
  readonly snapshot: LocalWhisperRendererSnapshot;
  readonly pendingAction: string | null;
  readonly onCheck: () => void;
  readonly onLoad: () => void;
  readonly onUnload: () => void;
}

interface PrimaryAction {
  readonly availability: LocalWhisperActionAvailability;
  readonly label: string;
  readonly onClick: () => void;
  readonly icon: IconType;
}

function primaryAction(
  connected: boolean,
  check: LocalWhisperActionAvailability,
  load: LocalWhisperActionAvailability,
  unload: LocalWhisperActionAvailability,
  callbacks: Pick<LocalWhisperStatusSectionProps, 'onCheck' | 'onLoad' | 'onUnload'>,
): PrimaryAction {
  if (connected || unload.visible) {
    return { availability: unload, icon: PiMemory, label: 'Free model', onClick: callbacks.onUnload };
  }
  if (check.visible && check.enabled && !load.enabled) {
    return { availability: check, icon: PiShieldCheck, label: 'Check compatibility', onClick: callbacks.onCheck };
  }
  return { availability: load, icon: PiCloudArrowUp, label: 'Load model', onClick: callbacks.onLoad };
}

/** Renders readiness, exact technical identity, residency, and main-owned resource safety. */
export default function LocalWhisperStatusSection({
  snapshot,
  pendingAction,
  onCheck,
  onLoad,
  onUnload,
}: LocalWhisperStatusSectionProps): React.JSX.Element {
  const pending = pendingAction !== null || snapshot.progress.some(isLocalWhisperArtifactProgressActive);
  const runtime = snapshot.runtime;
  const connected = runtime.residency === 'Loaded';
  const selectedRuntime = getLocalWhisperOption(snapshot, 'runtime', snapshot.settings.runtimeRevision)?.label;
  const selectedDevice =
    snapshot.settings.execution.target === 'cpu'
      ? snapshot.host.label
      : (getLocalWhisperOption(snapshot, 'device', snapshot.selectedDeviceId)?.label ?? 'Selected GPU');
  const backend =
    snapshot.settings.execution.target === 'cpu'
      ? 'CPU'
      : (snapshot.settings.execution.backend?.toUpperCase() ?? 'GPU');
  const model = snapshot.settings.model.family
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
  const quantization = snapshot.settings.model.variant === 'q5_0' ? 'Q5_0' : 'Full';
  const resourceSafety = getLocalWhisperResourceSafetyPresentation(snapshot);
  const check = getLocalWhisperCheckAvailability(snapshot, pending);
  const load = getLocalWhisperLoadAvailability(snapshot, pending);
  const unload = getLocalWhisperUnloadAvailability(snapshot, pending);
  const action = primaryAction(connected, check, load, unload, { onCheck, onLoad, onUnload });
  const ActionIcon = action.icon;
  const actionPending =
    pendingAction === 'checkCompatibility' || pendingAction === 'load' || pendingAction === 'unload';
  const bannerTitle = connected
    ? 'Connected'
    : runtime.residency === 'Loading'
      ? 'Loading model'
      : runtime.capability === 'Checking'
        ? 'Checking resources'
        : 'Not connected';
  const verdictLabel =
    resourceSafety.status === 'safe'
      ? 'Safe to load'
      : resourceSafety.status === 'blocked'
        ? 'Load blocked'
        : 'Check required';

  const technicalDetails: readonly DetailItemProps[] = [
    { icon: PiTerminalWindow, label: 'Runtime', value: 'Whisper.cpp' },
    {
      accent: backend === 'CUDA' ? 'nvidia' : undefined,
      icon: backend === 'CUDA' ? SiNvidia : PiCpu,
      label: 'Backend',
      value: backend,
    },
    { accent: 'green', icon: PiCpu, label: 'Device', value: selectedDevice },
    { accent: 'blue', icon: PiBrain, label: 'Model', value: model },
    { accent: 'purple', icon: PiSlidersHorizontal, label: 'Quantization', value: quantization },
    {
      accent: 'blue',
      icon: PiTag,
      label: 'Revision',
      title: snapshot.settings.model.revision,
      value: snapshot.settings.model.revision,
    },
  ];

  return (
    <div aria-live="polite" className="lw-status-stack">
      <section aria-label="Local Whisper readiness" className="lw-readiness-rail">
        <ReadinessStep label="Runtime" state={runtime.runtimeSetup} tone={setupTone(runtime.runtimeSetup, true)} />
        <ReadinessStep label="Model" state={runtime.modelSetup} tone={setupTone(runtime.modelSetup)} />
        <ReadinessStep label="Compatibility" state={runtime.capability} tone={capabilityTone(runtime.capability)} />
        <ReadinessStep label="Model state" last state={runtime.residency} tone={residencyTone(runtime.residency)} />
      </section>

      <section className={`lw-provider-banner${connected ? ' connected' : ''}`}>
        {connected ? <PiCheckCircle aria-hidden="true" /> : <PiWarningCircle aria-hidden="true" />}
        <div>
          <strong>{bannerTitle}</strong>
          <span>
            {connected
              ? 'Local Whisper is ready for transcription.'
              : 'Local Whisper becomes available after a model is loaded.'}
          </span>
          {!action.availability.enabled && action.availability.disabledReason ? (
            <span className="lw-disabled-reason">{action.availability.disabledReason}</span>
          ) : null}
        </div>
        {action.availability.visible ? (
          <button
            className="lw-primary-button"
            disabled={!action.availability.enabled}
            onClick={action.onClick}
            title={action.availability.disabledReason ?? undefined}
            type="button"
          >
            <ActionIcon aria-hidden="true" />
            {actionPending ? 'Working…' : action.label}
          </button>
        ) : null}
      </section>

      <LocalWhisperDisclosure className="lw-technical-disclosure" defaultOpen title="Technical details">
        <div className="lw-technical-grid">
          {technicalDetails.map((item) => (
            <DetailItem key={item.label} {...item} />
          ))}
        </div>
        <span className="sr-only">Runtime revision: {selectedRuntime ?? snapshot.settings.runtimeRevision}</span>
      </LocalWhisperDisclosure>

      <LocalWhisperPanel
        actions={
          <span className={`lw-safety-verdict ${resourceSafety.status}`}>
            {resourceSafety.status === 'safe' ? (
              <PiShieldCheck aria-hidden="true" />
            ) : (
              <PiWarningCircle aria-hidden="true" />
            )}
            {verdictLabel}
          </span>
        }
        className="lw-resource-panel"
        icon={PiShieldCheck}
        title="Resource safety"
      >
        <div className="lw-resource-grid">
          <ResourceMeter label="System RAM" meter={resourceSafety.ram} tone="ram" />
          <ResourceMeter label="GPU VRAM" meter={resourceSafety.vram} tone="vram" />
        </div>
        <div className="lw-requirement-row">
          <PiCube aria-hidden="true" />
          <span>Model requirement</span>
          <strong>
            {formatLocalWhisperBytes(resourceSafety.vram.peakBytes)} VRAM +{' '}
            {formatLocalWhisperBytes(resourceSafety.ram.peakBytes)} RAM
          </strong>
        </div>
        <div className={`lw-safety-note ${resourceSafety.status}`}>
          {resourceSafety.status === 'safe' ? (
            <PiShieldCheck aria-hidden="true" />
          ) : (
            <PiWarningCircle aria-hidden="true" />
          )}
          <span>Rechecked immediately before loading. Loading is blocked if safe headroom is unavailable.</span>
        </div>
      </LocalWhisperPanel>

      {snapshot.failure ? (
        <div className="lw-alert" role="status">
          <strong>{formatLocalWhisperFailureCode(snapshot.failure.code)}</strong>
          <span>Recovery: {formatLocalWhisperRecoveryAction(snapshot.failure.recoveryAction)}.</span>
        </div>
      ) : null}
    </div>
  );
}
