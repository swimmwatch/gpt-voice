import {
  LOCAL_WHISPER_FAMILY_MEMORY_GUIDANCE,
  type LocalWhisperFailureCode,
  type LocalWhisperMainStatusSnapshot,
  type LocalWhisperModelFamily,
  type LocalWhisperRendererSnapshot,
} from '@shared/localWhisper';

export interface LocalWhisperActionAvailability {
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly disabledReason: string | null;
}

export interface LocalWhisperMainStatusPresentation {
  readonly label: 'Ready' | 'Busy' | 'Validated · Unloaded' | 'Not ready' | 'Planned' | 'Unsupported';
  readonly tone: 'ready' | 'busy' | 'idle' | 'blocked';
  readonly detail: string | null;
}

function sentenceCaseIdentifier(value: string): string {
  const normalized = value.replace(/[_-]/gu, ' ').toLowerCase();
  return normalized.length === 0 ? normalized : `${normalized[0]?.toUpperCase()}${normalized.slice(1)}`;
}

export function formatLocalWhisperFailureCode(code: LocalWhisperFailureCode): string {
  return `${sentenceCaseIdentifier(code)} (${code})`;
}

export function formatLocalWhisperRecoveryAction(action: string): string {
  return sentenceCaseIdentifier(action);
}

export function formatLocalWhisperBytes(bytes: number | 'notApplicable' | null): string {
  if (bytes === 'notApplicable') return 'Not applicable';
  if (bytes === null) return 'Unknown';
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
  if (snapshot.runtime.capability !== 'Validated')
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
      return Object.freeze({ label: 'Validated · Unloaded', tone: 'idle', detail });
    case 'Planned':
      return Object.freeze({ label: 'Planned', tone: 'blocked', detail: detail ?? 'Unavailable in this release.' });
    case 'Unsupported':
      return Object.freeze({ label: 'Unsupported', tone: 'blocked', detail });
    case 'NotReady':
      return Object.freeze({ label: 'Not ready', tone: 'blocked', detail });
  }
}
