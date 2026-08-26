import { ProviderStatusIndicator } from '@renderer/components/ProviderStatusIndicator';
import { useI18n } from '@renderer/hooks/useI18n';
import type { LocalWhisperMainStatusSnapshot } from '@shared/localWhisper';
import {
  getLocalWhisperMainStatusPresentation,
  translateLocalWhisperPresentationMessage,
} from '../LocalWhisperPresentation';

function mainStatusLabel(
  label: ReturnType<typeof getLocalWhisperMainStatusPresentation>['label'],
  translate: ReturnType<typeof useI18n>['t'],
): string {
  const key = {
    Ready: 'localWhisper.settings.mainStatusReady',
    Busy: 'localWhisper.settings.mainStatusBusy',
    'Validated · Unloaded': 'localWhisper.settings.mainStatusValidatedUnloaded',
    'Not ready': 'localWhisper.settings.mainStatusNotReady',
    Planned: 'localWhisper.settings.mainStatusPlanned',
    Unsupported: 'localWhisper.settings.mainStatusUnsupported',
  } as const;
  return translate(key[label]);
}

/** Presents compact Local Whisper readiness without browser-login semantics. */
export default function LocalWhisperMainStatusIndicator({
  connectedLabel,
  notConnectedLabel,
  snapshot,
}: {
  readonly connectedLabel: string;
  readonly notConnectedLabel: string;
  readonly snapshot: LocalWhisperMainStatusSnapshot | null;
}): React.JSX.Element {
  const { t } = useI18n();
  const presentation = snapshot
    ? getLocalWhisperMainStatusPresentation(snapshot)
    : { label: 'Not ready' as const, tone: 'blocked' as const, detail: t('localWhisper.main.loadingStatus') };
  const loading = presentation.label === 'Busy';
  const label =
    presentation.tone === 'ready'
      ? connectedLabel
      : presentation.tone === 'busy'
        ? mainStatusLabel(presentation.label, t)
        : notConnectedLabel;
  const tooltip = presentation.detail
    ? translateLocalWhisperPresentationMessage(presentation.detail, t)
    : t('localWhisper.settings.mainStatusTooltip', {
        status: mainStatusLabel(presentation.label, t).toLocaleLowerCase(),
      });
  const tone = presentation.tone === 'ready' ? 'success' : presentation.tone === 'busy' ? 'warning' : 'error';

  return (
    <ProviderStatusIndicator
      className="command-dock-provider-state"
      dataSlot="local-whisper-main-status"
      label={label}
      loading={loading}
      role="status"
      tone={tone}
      tooltip={tooltip}
    />
  );
}
