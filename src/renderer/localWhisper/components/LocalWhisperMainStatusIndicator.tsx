import { ProviderStatusIndicator } from '@renderer/components/ProviderStatusIndicator';
import type { LocalWhisperMainStatusSnapshot } from '@shared/localWhisper';
import { getLocalWhisperMainStatusPresentation } from '../LocalWhisperPresentation';

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
  const presentation = snapshot
    ? getLocalWhisperMainStatusPresentation(snapshot)
    : { label: 'Not ready' as const, tone: 'blocked' as const, detail: 'Local Whisper status is loading.' };
  const loading = presentation.label === 'Busy';
  const label =
    presentation.tone === 'ready'
      ? connectedLabel
      : presentation.tone === 'busy'
        ? presentation.label
        : notConnectedLabel;
  const tooltip = presentation.detail ?? `Local Whisper is ${presentation.label.toLowerCase()}.`;
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
