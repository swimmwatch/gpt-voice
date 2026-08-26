import { HardDriveDownload, PowerOff } from 'lucide-react';

import { Button } from '@renderer/components/ui/button';
import { Spinner } from '@renderer/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useI18n } from '@renderer/hooks/useI18n';
import type { LocalWhisperMainResidencyAction, LocalWhisperMainStatusSnapshot } from '@shared/localWhisper';

import { getLocalWhisperMainResidencyControl } from '../LocalWhisperPresentation';
import type { LocalWhisperMainResidencyFailure } from '../LocalWhisperRendererService';

interface LocalWhisperMainResidencyControlProps {
  readonly disabled?: boolean;
  readonly failure: LocalWhisperMainResidencyFailure | null;
  readonly failureSequence: number;
  readonly onAction: (action: LocalWhisperMainResidencyAction) => void;
  readonly pendingAction: LocalWhisperMainResidencyAction | null;
  readonly snapshot: LocalWhisperMainStatusSnapshot | null;
}

/** Renders the main-window-only Local Whisper residency command without owning lifecycle state. */
export default function LocalWhisperMainResidencyControl({
  disabled = false,
  failure,
  failureSequence,
  onAction,
  pendingAction,
  snapshot,
}: LocalWhisperMainResidencyControlProps): React.JSX.Element {
  const { t } = useI18n();
  const presentation = getLocalWhisperMainResidencyControl(snapshot, pendingAction);
  const enabled = presentation.enabled && !disabled;
  const label = t(presentation.labelKey);
  const reason = presentation.reasonKey
    ? t(presentation.reasonKey, presentation.reasonCode === null ? undefined : { code: presentation.reasonCode })
    : label;
  const disabledReasonId = 'local-whisper-main-residency-reason';
  const failureMessage =
    failure?.kind === 'command'
      ? t('localWhisper.main.operationFailedCode', { code: failure.value.code })
      : failure?.kind === 'transport'
        ? t('localWhisper.main.operationFailed')
        : null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-busy={presentation.pending || undefined}
            aria-describedby={!enabled ? disabledReasonId : undefined}
            aria-disabled={!enabled}
            aria-label={label}
            className="command-dock-local-whisper-residency"
            data-action={presentation.action}
            data-enabled={enabled}
            data-pending={presentation.pending}
            disabled={!enabled}
            onClick={() => {
              if (enabled) onAction(presentation.action);
            }}
            size="icon"
            variant="outline"
          >
            <Spinner
              active={presentation.pending}
              fallback={
                presentation.action === 'load' ? (
                  <HardDriveDownload aria-hidden="true" strokeWidth={1.75} />
                ) : (
                  <PowerOff aria-hidden="true" strokeWidth={1.75} />
                )
              }
              label={label}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
      {!enabled && (
        <span className="sr-only" id={disabledReasonId}>
          {reason}
        </span>
      )}
      {failureMessage && (
        <span className="sr-only" key={failureSequence} role="alert">
          {failureMessage}
        </span>
      )}
    </>
  );
}
