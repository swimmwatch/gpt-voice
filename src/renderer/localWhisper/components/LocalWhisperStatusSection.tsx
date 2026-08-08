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
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useI18n } from '@renderer/hooks/useI18n';
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
  formatLocalWhisperRuntimeState,
  translateLocalWhisperPresentationMessage,
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

function setupTone(state: LocalWhisperRendererSnapshot['runtime']['runtimeSetup']): StatusTone {
  if (state === 'Installed') return 'success';
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
    <div className="lw-detail-item">
      <span className={`lw-detail-icon${accent ? ` accent-${accent}` : ''}`}>
        <Icon aria-hidden="true" />
      </span>
      <span className="lw-detail-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      {title ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="lw-detail-info">
              <PiInfo aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{title}</TooltipContent>
        </Tooltip>
      ) : null}
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
  const { t } = useI18n();
  const safe = numericBytes(meter.safeReservableBytes);
  const peak = numericBytes(meter.peakBytes);
  const scale = Math.max(meter.availableBytes ?? 0, safe ?? 0, peak ?? 0, 1);
  const safeWidth = safe === null ? 0 : Math.min(100, (safe / scale) * 100);
  const peakWidth = peak === null ? 0 : Math.min(100, (peak / scale) * 100);
  return (
    <div className="lw-resource-meter">
      <div className="lw-resource-meter-heading">
        <strong>{label}</strong>
        <span>
          {formatLocalWhisperBytes(meter.availableBytes, t)} {t('localWhisper.settings.available')}
        </span>
      </div>
      <div
        aria-label={t('localWhisper.settings.resourceMeterLabel', {
          label,
          peak: formatLocalWhisperBytes(meter.peakBytes, t),
          safe: formatLocalWhisperBytes(meter.safeReservableBytes, t),
        })}
        className="lw-capacity-track"
        role="img"
      >
        {safe === null ? null : <span className={`lw-safe-capacity ${tone}`} style={{ width: `${safeWidth}%` }} />}
        {peak === null ? null : <span className={`lw-required-capacity ${tone}`} style={{ width: `${peakWidth}%` }} />}
        {safe === null ? null : <span className="lw-safe-marker" style={{ left: `${safeWidth}%` }} />}
      </div>
      <div className="lw-resource-meter-meta">
        <span>
          {formatLocalWhisperBytes(meter.safeReservableBytes, t)} {t('localWhisper.settings.safeToReserve')}
        </span>
        <span>
          {formatLocalWhisperBytes(meter.peakBytes, t)} {t('localWhisper.settings.peak')}
        </span>
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
  translate: ReturnType<typeof useI18n>['t'],
): PrimaryAction {
  if (connected || unload.visible) {
    return {
      availability: unload,
      icon: PiMemory,
      label: translate('localWhisper.settings.freeModel'),
      onClick: callbacks.onUnload,
    };
  }
  if (check.visible && check.enabled && !load.enabled) {
    return {
      availability: check,
      icon: PiShieldCheck,
      label: translate('localWhisper.settings.checkCompatibility'),
      onClick: callbacks.onCheck,
    };
  }
  return {
    availability: load,
    icon: PiCloudArrowUp,
    label: translate('localWhisper.settings.loadModel'),
    onClick: callbacks.onLoad,
  };
}

/** Renders readiness, exact technical identity, residency, and main-owned resource safety. */
export default function LocalWhisperStatusSection({
  snapshot,
  pendingAction,
  onCheck,
  onLoad,
  onUnload,
}: LocalWhisperStatusSectionProps): React.JSX.Element {
  const { t } = useI18n();
  const pending = pendingAction !== null || snapshot.progress.some(isLocalWhisperArtifactProgressActive);
  const runtime = snapshot.runtime;
  const connected = runtime.operationalStatus === 'Ready' || runtime.operationalStatus === 'Busy';
  const selectedRuntime = getLocalWhisperOption(snapshot, 'runtime', snapshot.settings.runtimeRevision)?.label;
  const selectedDevice =
    snapshot.settings.execution.target === 'cpu'
      ? snapshot.host.label
      : (getLocalWhisperOption(snapshot, 'device', snapshot.selectedDeviceId)?.label ??
        t('localWhisper.settings.selectedGpu'));
  const backend =
    snapshot.settings.execution.target === 'cpu'
      ? 'CPU'
      : (snapshot.settings.execution.backend?.toUpperCase() ?? 'GPU');
  const model = snapshot.settings.model.family
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
  const quantization = snapshot.settings.model.variant === 'q5_0' ? 'Q5_0' : t('localWhisper.settings.full');
  const resourceSafety = getLocalWhisperResourceSafetyPresentation(snapshot);
  const check = getLocalWhisperCheckAvailability(snapshot, pending);
  const load = getLocalWhisperLoadAvailability(snapshot, pending);
  const unload = getLocalWhisperUnloadAvailability(snapshot, pending);
  const action = primaryAction(connected, check, load, unload, { onCheck, onLoad, onUnload }, t);
  const ActionIcon = action.icon;
  const actionPending =
    pendingAction === 'checkCompatibility' || pendingAction === 'load' || pendingAction === 'unload';
  const primaryActionButton = (
    <button
      className="lw-primary-button"
      disabled={!action.availability.enabled}
      onClick={action.onClick}
      type="button"
    >
      <ActionIcon aria-hidden="true" />
      {actionPending ? t('localWhisper.settings.working') : action.label}
    </button>
  );
  const bannerTitle = connected
    ? t('localWhisper.settings.connected')
    : runtime.residency === 'Loading'
      ? t('localWhisper.main.loadingModel')
      : runtime.capability === 'Checking'
        ? t('localWhisper.settings.checkingResources')
        : t('localWhisper.settings.notConnected');
  const verdictLabel =
    resourceSafety.status === 'safe'
      ? t('localWhisper.settings.safeToLoad')
      : resourceSafety.status === 'blocked'
        ? t('localWhisper.settings.loadBlocked')
        : t('localWhisper.settings.checkRequired');
  const ResourceSafetyIcon = resourceSafety.status === 'safe' ? PiShieldCheck : PiWarningCircle;

  const technicalDetails: readonly DetailItemProps[] = [
    { icon: PiTerminalWindow, label: t('localWhisper.settings.runtime'), value: 'Whisper.cpp' },
    {
      accent: backend === 'CUDA' ? 'nvidia' : undefined,
      icon: backend === 'CUDA' ? SiNvidia : PiCpu,
      label: t('localWhisper.settings.backend'),
      value: backend,
    },
    { accent: 'green', icon: PiCpu, label: t('localWhisper.settings.device'), value: selectedDevice },
    { accent: 'blue', icon: PiBrain, label: t('localWhisper.settings.model'), value: model },
    {
      accent: 'purple',
      icon: PiSlidersHorizontal,
      label: t('localWhisper.settings.quantization'),
      value: quantization,
    },
    {
      accent: 'blue',
      icon: PiTag,
      label: t('localWhisper.settings.revision'),
      title: snapshot.settings.model.revision,
      value: snapshot.settings.model.revision,
    },
  ];

  return (
    <div aria-live="polite" className="lw-status-stack">
      <section aria-label={t('localWhisper.settings.readiness')} className="lw-readiness-rail">
        <ReadinessStep
          label={t('localWhisper.settings.runtime')}
          state={formatLocalWhisperRuntimeState(runtime.runtimeSetup, t)}
          tone={setupTone(runtime.runtimeSetup)}
        />
        <ReadinessStep
          label={t('localWhisper.settings.model')}
          state={formatLocalWhisperRuntimeState(runtime.modelSetup, t)}
          tone={setupTone(runtime.modelSetup)}
        />
        <ReadinessStep
          label={t('localWhisper.settings.compatibility')}
          state={formatLocalWhisperRuntimeState(runtime.capability, t)}
          tone={capabilityTone(runtime.capability)}
        />
        <ReadinessStep
          label={t('localWhisper.settings.modelState')}
          last
          state={formatLocalWhisperRuntimeState(runtime.residency, t)}
          tone={residencyTone(runtime.residency)}
        />
      </section>

      <section className={`lw-provider-banner${connected ? ' connected' : ''}`}>
        {connected ? <PiCheckCircle aria-hidden="true" /> : <PiWarningCircle aria-hidden="true" />}
        <div>
          <strong>{bannerTitle}</strong>
          <span>
            {connected ? t('localWhisper.settings.readyDescription') : t('localWhisper.settings.modelLoadRequired')}
          </span>
          {!action.availability.enabled && action.availability.disabledReason ? (
            <span className="lw-disabled-reason">
              {translateLocalWhisperPresentationMessage(action.availability.disabledReason, t)}
            </span>
          ) : null}
        </div>
        {action.availability.visible ? (
          <Tooltip>
            <TooltipTrigger asChild>{primaryActionButton}</TooltipTrigger>
            {action.availability.disabledReason ? (
              <TooltipContent>
                {translateLocalWhisperPresentationMessage(action.availability.disabledReason, t)}
              </TooltipContent>
            ) : null}
          </Tooltip>
        ) : null}
      </section>

      <LocalWhisperDisclosure
        className="lw-technical-disclosure"
        defaultOpen
        title={t('localWhisper.settings.technicalDetails')}
      >
        <div className="lw-technical-grid">
          {technicalDetails.map((item) => (
            <DetailItem key={item.label} {...item} />
          ))}
        </div>
        <span className="sr-only">
          {t('localWhisper.settings.runtimeRevision', {
            revision: selectedRuntime ?? snapshot.settings.runtimeRevision ?? t('localWhisper.settings.unknown'),
          })}
        </span>
      </LocalWhisperDisclosure>

      <LocalWhisperPanel
        className="lw-resource-panel"
        icon={PiShieldCheck}
        title={t('localWhisper.settings.resourceSafety')}
      >
        <div className="lw-resource-grid">
          <ResourceMeter label={t('localWhisper.settings.systemRam')} meter={resourceSafety.ram} tone="ram" />
          <ResourceMeter label={t('localWhisper.settings.gpuVram')} meter={resourceSafety.vram} tone="vram" />
        </div>
        <div className="lw-requirement-row">
          <PiCube aria-hidden="true" />
          <span>{t('localWhisper.settings.modelRequirement')}</span>
          <strong>
            {formatLocalWhisperBytes(resourceSafety.vram.peakBytes, t)} VRAM +{' '}
            {formatLocalWhisperBytes(resourceSafety.ram.peakBytes, t)} RAM
          </strong>
        </div>
        <div className={`lw-safety-note ${resourceSafety.status}`}>
          <ResourceSafetyIcon aria-hidden="true" />
          <span>{verdictLabel}</span>
        </div>
      </LocalWhisperPanel>

      {snapshot.failure ? (
        <div className="lw-alert" role="status">
          <strong>{formatLocalWhisperFailureCode(snapshot.failure.code, t)}</strong>
          <span>
            {t('localWhisper.settings.recovery', {
              action: formatLocalWhisperRecoveryAction(snapshot.failure.recoveryAction, t),
            })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
