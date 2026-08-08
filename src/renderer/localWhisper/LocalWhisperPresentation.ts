import {
  LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE,
  type LocalWhisperArtifactId,
  type LocalWhisperFailureCode,
  type LocalWhisperArtifactProgress,
  type LocalWhisperMainStatusSnapshot,
  type LocalWhisperMainResidencyAction,
  type LocalWhisperModelFamily,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';
import type { TranslationKey } from '@main/i18n';

export type LocalWhisperTranslate = (key: TranslationKey, params?: Readonly<Record<string, string>>) => string;

const LOCAL_WHISPER_RUNTIME_STATE_KEYS: Readonly<Record<string, TranslationKey>> = Object.freeze({
  Missing: 'localWhisper.settings.stateMissing',
  Installed: 'localWhisper.settings.stateInstalled',
  Downloading: 'localWhisper.settings.stateDownloading',
  Verifying: 'localWhisper.settings.stateVerifying',
  Installing: 'localWhisper.settings.stateInstalling',
  Checking: 'localWhisper.settings.stateChecking',
  EstimateOnly: 'localWhisper.settings.stateEstimateOnly',
  Validated: 'localWhisper.settings.stateValidated',
  Unchecked: 'localWhisper.settings.stateUnchecked',
  Stale: 'localWhisper.settings.stateStale',
  Loading: 'localWhisper.settings.stateLoading',
  Unloading: 'localWhisper.settings.stateUnloading',
  Loaded: 'localWhisper.settings.stateLoaded',
  Failed: 'localWhisper.settings.stateFailed',
  Queued: 'localWhisper.settings.stateQueued',
  Deleting: 'localWhisper.settings.stateDeleting',
  Resumable: 'localWhisper.settings.stateResumable',
});

const LOCAL_WHISPER_PRESENTATION_MESSAGE_KEYS: Readonly<Record<string, TranslationKey>> = Object.freeze({
  'Another Local Whisper action is in progress.': 'localWhisper.settings.availabilityBusy',
  'This platform is planned and not available in this release.': 'localWhisper.settings.availabilityPlanned',
  'This platform is unsupported in this release.': 'localWhisper.settings.availabilityUnsupported',
  'Install the selected runtime and model before checking compatibility.':
    'localWhisper.settings.availabilityCheckInstall',
  'Run a successful compatibility check before loading.': 'localWhisper.settings.availabilityCheckRequired',
  'The selected model is not in unloaded state.': 'localWhisper.settings.availabilityNotUnloaded',
  'No owned model load is available to unload.': 'localWhisper.settings.availabilityNoModelToFree',
  'The selected Local Whisper provider is unavailable.': 'localWhisper.settings.selectedProviderUnavailable',
  'Load the selected model before transcription.': 'localWhisper.settings.loadBeforeTranscription',
  'Local Whisper status is loading.': 'localWhisper.main.loadingStatus',
  'Local Whisper settings could not be loaded.': 'localWhisper.settings.settingsLoadFailed',
  'Fix the highlighted settings before saving.': 'localWhisper.settings.fixHighlighted',
});

/** Converts public enum names to their localized user-facing labels. */
export function formatLocalWhisperRuntimeState(value: string, translate: LocalWhisperTranslate): string {
  const key = LOCAL_WHISPER_RUNTIME_STATE_KEYS[value];
  return key ? translate(key) : value;
}

/** Localizes renderer-only status text while keeping the protected snapshot contract unchanged. */
export function translateLocalWhisperPresentationMessage(message: string, translate: LocalWhisperTranslate): string {
  const key = LOCAL_WHISPER_PRESENTATION_MESSAGE_KEYS[message];
  if (key) return translate(key);
  const failure = message.match(/^[A-Z_]+ \(([A-Z_]+)\)$/u);
  if (failure?.[1]) return translate('localWhisper.settings.failureCode', { code: failure[1] });
  return message;
}

/** Localizes controller errors without exposing internal error structure to the page. */
export function translateLocalWhisperActionError(message: string, translate: LocalWhisperTranslate): string {
  const failure = message.match(/^([A-Z_]+) \([A-Z_]+\)\. Recovery: (.+)\.$/u);
  if (failure?.[1] && failure[2]) {
    return `${translate('localWhisper.settings.failureCode', { code: failure[1] })}. ${translate(
      'localWhisper.settings.recovery',
      { action: translate('localWhisper.settings.recoveryAction', { action: failure[2] }) },
    )}`;
  }
  return translateLocalWhisperPresentationMessage(message, translate);
}

/** Distinguishes a truly unavailable platform from the transient unconfigured coordinator baseline. */
export function isLocalWhisperPlatformUnavailable(snapshot: LocalWhisperRendererSnapshot): boolean {
  const unavailableTier = snapshot.runtime.supportTier === 'Planned' || snapshot.runtime.supportTier === 'Unsupported';
  if (!unavailableTier) return false;
  return !snapshot.options.some((option) => option.group === 'target' && option.available);
}

const ACTIVE_ARTIFACT_PROGRESS_STATES: ReadonlySet<LocalWhisperArtifactProgress['state']> = new Set([
  'Queued',
  'Downloading',
  'Verifying',
  'Installing',
  'Deleting',
]);

/** Keeps terminal progress history visible without treating it as an active lifecycle operation. */
export function isLocalWhisperArtifactProgressActive(progress: LocalWhisperArtifactProgress): boolean {
  return ACTIVE_ARTIFACT_PROGRESS_STATES.has(progress.state);
}

/** Selects the newest operation for an artifact from the main-owned insertion-ordered progress history. */
export function getLatestLocalWhisperArtifactProgress(
  progress: readonly LocalWhisperArtifactProgress[],
  artifactId: LocalWhisperArtifactId,
): LocalWhisperArtifactProgress | null {
  for (let index = progress.length - 1; index >= 0; index -= 1) {
    const candidate = progress[index];
    if (candidate?.artifactId === artifactId) return candidate;
  }
  return null;
}

export interface LocalWhisperActionAvailability {
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly disabledReason: string | null;
}

export interface LocalWhisperResourceMeterPresentation {
  readonly availableBytes: number | null;
  readonly peakBytes: number | 'notApplicable' | null;
  readonly requiredBytes: number | 'notApplicable' | null;
  readonly safeReservableBytes: number | 'notApplicable' | null;
}

export interface LocalWhisperResourceSafetyPresentation {
  readonly status: 'safe' | 'blocked' | 'unknown';
  readonly evidence: 'catalog' | 'qualified' | null;
  readonly failureCode: Extract<LocalWhisperFailureCode, 'INSUFFICIENT_RAM' | 'INSUFFICIENT_VRAM'> | null;
  readonly ram: LocalWhisperResourceMeterPresentation;
  readonly vram: LocalWhisperResourceMeterPresentation;
}

function safeReservableBytes(
  peakBytes: number | 'notApplicable' | null,
  requiredBytes: number | 'notApplicable' | null,
  availableBytes: number | null,
): number | 'notApplicable' | null {
  if (peakBytes === 'notApplicable' || requiredBytes === 'notApplicable') return 'notApplicable';
  if (peakBytes === null || requiredBytes === null || availableBytes === null) return null;
  return Math.max(0, availableBytes - Math.max(0, requiredBytes - peakBytes));
}

/** Derives honest capacity labels from the main-owned peak, headroom, and current availability facts. */
export function getLocalWhisperResourceSafetyPresentation(
  snapshot: LocalWhisperRendererSnapshot,
): LocalWhisperResourceSafetyPresentation {
  const resources = snapshot.resources;
  const estimate = snapshot.memory.selectedEstimate;
  const qualifiedPeak = resources?.evidence === 'qualified' ? snapshot.memory.qualifiedPeak : null;
  const ramPeak = qualifiedPeak?.measuredPeakRamBytes ?? estimate?.estimatedPeakRamBytes ?? null;
  const vramPeak = qualifiedPeak?.measuredPeakVramBytes ?? estimate?.estimatedPeakVramBytes ?? null;
  const requiredRamBytes = resources?.requiredRamBytes ?? null;
  const requiredVramBytes = resources?.requiredVramBytes ?? null;
  const freeRamBytes = resources?.freeRamBytes ?? null;
  const freeVramBytes = resources?.freeVramBytes ?? null;
  const availabilityUnknown =
    resources === null || freeRamBytes === null || (requiredVramBytes !== 'notApplicable' && freeVramBytes === null);

  return Object.freeze({
    status: resources?.success === false ? 'blocked' : availabilityUnknown ? 'unknown' : 'safe',
    evidence: resources?.evidence ?? null,
    failureCode: resources?.failureCode ?? null,
    ram: Object.freeze({
      availableBytes: freeRamBytes,
      peakBytes: ramPeak,
      requiredBytes: requiredRamBytes,
      safeReservableBytes: safeReservableBytes(ramPeak, requiredRamBytes, freeRamBytes),
    }),
    vram: Object.freeze({
      availableBytes: freeVramBytes,
      peakBytes: vramPeak,
      requiredBytes: requiredVramBytes,
      safeReservableBytes: safeReservableBytes(vramPeak, requiredVramBytes, freeVramBytes),
    }),
  });
}

export interface LocalWhisperMainStatusPresentation {
  readonly label: 'Ready' | 'Busy' | 'Validated · Unloaded' | 'Not ready' | 'Planned' | 'Unsupported';
  readonly tone: 'ready' | 'busy' | 'blocked';
  readonly detail: string | null;
}

export interface LocalWhisperMainResidencyControlPresentation {
  readonly action: LocalWhisperMainResidencyAction;
  readonly enabled: boolean;
  readonly pending: boolean;
  readonly labelKey: TranslationKey;
  readonly reasonKey: TranslationKey | null;
  readonly reasonCode: LocalWhisperFailureCode | null;
}

function mainResidencyControl(
  action: LocalWhisperMainResidencyAction,
  labelKey: TranslationKey,
  options: {
    readonly enabled?: boolean;
    readonly pending?: boolean;
    readonly reasonKey?: TranslationKey | null;
    readonly reasonCode?: LocalWhisperFailureCode | null;
  } = {},
): LocalWhisperMainResidencyControlPresentation {
  return Object.freeze({
    action,
    labelKey,
    enabled: options.enabled ?? false,
    pending: options.pending ?? false,
    reasonKey: options.reasonKey ?? null,
    reasonCode: options.reasonCode ?? null,
  });
}

/** Derives the complete main-toolbar Load/Free matrix from authoritative status plus renderer-local pending. */
export function getLocalWhisperMainResidencyControl(
  snapshot: LocalWhisperMainStatusSnapshot | null,
  pendingAction: LocalWhisperMainResidencyAction | null,
): LocalWhisperMainResidencyControlPresentation {
  if (pendingAction === 'load') {
    return mainResidencyControl('load', 'localWhisper.main.loadingModel', {
      pending: true,
      reasonKey: 'localWhisper.main.loadingModel',
    });
  }
  if (pendingAction === 'unload') {
    return mainResidencyControl('unload', 'localWhisper.main.freeingModel', {
      pending: true,
      reasonKey: 'localWhisper.main.freeingModel',
    });
  }
  if (!snapshot) {
    return mainResidencyControl('load', 'localWhisper.main.loadingStatus', {
      pending: true,
      reasonKey: 'localWhisper.main.loadingStatus',
    });
  }

  if (snapshot.runtime.residency === 'Loading') {
    return mainResidencyControl('load', 'localWhisper.main.loadingModel', {
      pending: true,
      reasonKey: 'localWhisper.main.loadingModel',
    });
  }
  if (snapshot.runtime.residency === 'Unloading') {
    return mainResidencyControl('unload', 'localWhisper.main.freeingModel', {
      pending: true,
      reasonKey: 'localWhisper.main.freeingModel',
    });
  }
  if (snapshot.runtime.residency === 'Loaded') {
    if (snapshot.runtime.activity === 'Idle') {
      return mainResidencyControl('unload', 'localWhisper.main.freeModel', { enabled: true });
    }
    return mainResidencyControl('unload', 'localWhisper.main.freeModel', {
      reasonKey:
        snapshot.runtime.activity === 'Transcribing'
          ? 'localWhisper.main.modelInUse'
          : 'localWhisper.main.actionInProgress',
    });
  }
  if (snapshot.runtime.residency === 'Unloaded') {
    const eligible =
      snapshot.runtime.runtimeSetup === 'Installed' &&
      snapshot.runtime.modelSetup === 'Installed' &&
      snapshot.runtime.canAttempt &&
      snapshot.runtime.blockingCode === null &&
      !snapshot.selectedButUnavailable;
    if (eligible) return mainResidencyControl('load', 'localWhisper.main.loadModel', { enabled: true });
    const reasonCode = snapshot.failure?.code ?? snapshot.runtime.blockingCode;
    return mainResidencyControl('load', 'localWhisper.main.loadModel', {
      reasonKey:
        reasonCode === null &&
        (snapshot.runtime.runtimeSetup !== 'Installed' || snapshot.runtime.modelSetup !== 'Installed')
          ? 'localWhisper.main.setupRequired'
          : reasonCode === null
            ? 'localWhisper.main.modelUnavailable'
            : 'localWhisper.main.modelUnavailableCode',
      reasonCode,
    });
  }

  return mainResidencyControl('load', 'localWhisper.main.loadModel', {
    reasonKey: 'localWhisper.main.operationFailed',
    reasonCode: snapshot.failure?.code ?? snapshot.runtime.blockingCode,
  });
}

function sentenceCaseIdentifier(value: string): string {
  const normalized = value.replace(/[_-]/gu, ' ').toLowerCase();
  return normalized.length === 0 ? normalized : `${normalized[0]?.toUpperCase()}${normalized.slice(1)}`;
}

export function formatLocalWhisperFailureCode(
  code: LocalWhisperFailureCode,
  translate?: LocalWhisperTranslate,
): string {
  if (translate) return translate('localWhisper.settings.failureCode', { code });
  return `${sentenceCaseIdentifier(code)} (${code})`;
}

export function formatLocalWhisperRecoveryAction(action: string, translate?: LocalWhisperTranslate): string {
  if (translate) return translate('localWhisper.settings.recoveryAction', { action });
  return sentenceCaseIdentifier(action);
}

export function formatLocalWhisperBytes(
  bytes: number | 'notApplicable' | null,
  translate?: LocalWhisperTranslate,
): string {
  if (bytes === 'notApplicable') return translate?.('localWhisper.settings.notApplicable') ?? 'Not applicable';
  if (bytes === null) return translate?.('localWhisper.settings.unknown') ?? 'Unknown';
  if (bytes === 0) return '0 MiB';
  const gibibyte = 1024 ** 3;
  const mebibyte = 1024 ** 2;
  if (bytes >= gibibyte) return `${(bytes / gibibyte).toFixed(bytes >= 10 * gibibyte ? 1 : 2)} GiB`;
  return `${Math.max(1, Math.round(bytes / mebibyte))} MiB`;
}

export function getLocalWhisperFamilyRequirement(family: LocalWhisperModelFamily): string {
  const guidance = LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE[family];
  return `≈ ${guidance.approximateSystemRamGiB[0]}–${guidance.approximateSystemRamGiB[1]} GiB RAM · ${
    guidance.approximateVramGiB[0]
  }–${guidance.approximateVramGiB[1]} GiB VRAM`;
}

export function getLocalWhisperSupportLabel(snapshot: LocalWhisperRendererSnapshot): string {
  switch (snapshot.runtime.supportTier) {
    case 'Production':
      return 'Production';
    case 'Preview':
      return 'Preview · Untested on representative AMD hardware';
    case 'Planned':
      return 'Planned · Unavailable in this release';
    case 'Unsupported':
      return 'Unsupported';
  }
}

function blocked(reason: string, visible = true): LocalWhisperActionAvailability {
  return Object.freeze({ visible, enabled: false, disabledReason: reason });
}

function enabled(visible = true): LocalWhisperActionAvailability {
  return Object.freeze({ visible, enabled: true, disabledReason: null });
}

function checkPlatform(snapshot: LocalWhisperRendererSnapshot): LocalWhisperActionAvailability | null {
  if (snapshot.runtime.supportTier === 'Planned') {
    return blocked('This platform is planned and unavailable in this release.');
  }
  if (snapshot.runtime.supportTier === 'Unsupported') return blocked('This platform is unsupported.');
  if (!snapshot.runtime.canAttempt) {
    return blocked(
      snapshot.runtime.blockingCode
        ? formatLocalWhisperFailureCode(snapshot.runtime.blockingCode)
        : 'Setup is incomplete.',
    );
  }
  return null;
}

export function getLocalWhisperCheckAvailability(
  snapshot: LocalWhisperRendererSnapshot,
  pending: boolean,
): LocalWhisperActionAvailability {
  if (pending || snapshot.runtime.activity !== 'Idle') return blocked('Another Local Whisper action is in progress.');
  const platform = checkPlatform(snapshot);
  if (platform) return platform;
  if (snapshot.runtime.runtimeSetup !== 'Installed' || snapshot.runtime.modelSetup !== 'Installed') {
    return blocked('Install the selected runtime and model before checking compatibility.');
  }
  return enabled();
}

export function getLocalWhisperLoadAvailability(
  snapshot: LocalWhisperRendererSnapshot,
  pending: boolean,
): LocalWhisperActionAvailability {
  if (pending || snapshot.runtime.activity !== 'Idle') return blocked('Another Local Whisper action is in progress.');
  const platform = checkPlatform(snapshot);
  if (platform) return platform;
  if (snapshot.runtime.capability !== 'EstimateOnly' && snapshot.runtime.capability !== 'Validated')
    return blocked('Run a successful compatibility check before loading.');
  if (snapshot.runtime.residency !== 'Unloaded') return blocked('The selected model is not in the unloaded state.');
  if (snapshot.resources?.success === false && snapshot.resources.failureCode) {
    return blocked(formatLocalWhisperFailureCode(snapshot.resources.failureCode));
  }
  return enabled();
}

export function getLocalWhisperUnloadAvailability(
  snapshot: LocalWhisperRendererSnapshot,
  pending: boolean,
): LocalWhisperActionAvailability {
  const visible = ['Loading', 'Loaded', 'Failed'].includes(snapshot.runtime.residency);
  if (!visible) return blocked('No owned model load is available to unload.', false);
  if (pending || snapshot.runtime.activity !== 'Idle') {
    return blocked('Another Local Whisper action is in progress.');
  }
  const platform = checkPlatform(snapshot);
  if (platform) return platform;
  return enabled();
}

export function getLocalWhisperMainStatusPresentation(
  snapshot: LocalWhisperMainStatusSnapshot,
): LocalWhisperMainStatusPresentation {
  const failure = snapshot.failure?.code ?? snapshot.runtime.blockingCode;
  const detail = failure
    ? formatLocalWhisperFailureCode(failure)
    : snapshot.selectedButUnavailable
      ? 'The selected Local Whisper provider is unavailable.'
      : null;
  switch (snapshot.runtime.operationalStatus) {
    case 'Ready':
      return Object.freeze({ label: 'Ready', tone: 'ready', detail });
    case 'Busy':
      return Object.freeze({ label: 'Busy', tone: 'busy', detail });
    case 'ValidatedUnloaded':
      return Object.freeze({
        label: 'Validated · Unloaded',
        tone: 'blocked',
        detail: detail ?? 'Load the validated runtime and model before transcription.',
      });
    case 'Planned':
      return Object.freeze({ label: 'Planned', tone: 'blocked', detail: detail ?? 'Unavailable in this release.' });
    case 'Unsupported':
      return Object.freeze({ label: 'Unsupported', tone: 'blocked', detail });
    case 'NotReady':
      return Object.freeze({ label: 'Not ready', tone: 'blocked', detail });
  }
}
