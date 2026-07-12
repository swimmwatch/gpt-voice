import { CircleDot, LoaderCircle, Mic, Pause, Play, Square, X, type LucideIcon } from 'lucide-react';
import { useI18n } from '@renderer/hooks/useI18n';
import {
  getRecordingWorkspaceViewState,
  RecordingWorkspacePrimaryAction,
  RecordingWorkspaceSecondaryAction,
  RecordingWorkspaceStatus,
} from '@renderer/mainWindowViewState';
import { Button } from '@renderer/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { cn } from '@renderer/lib/cn';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

interface RecordingControlsProps {
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  onStart: () => void | Promise<void>;
  onStop: () => void;
  recordHotkey: string;
  state: RecordingLifecycleState;
  status: string;
}

interface SecondaryActionConfig {
  icon: LucideIcon;
  labelKey: string;
  variant: 'destructive' | 'outline';
}

const secondaryActionConfig: Record<RecordingWorkspaceSecondaryAction, SecondaryActionConfig> = {
  [RecordingWorkspaceSecondaryAction.Cancel]: {
    icon: X,
    labelKey: 'recording.cancel',
    variant: 'destructive',
  },
  [RecordingWorkspaceSecondaryAction.Pause]: {
    icon: Pause,
    labelKey: 'recording.pause',
    variant: 'outline',
  },
  [RecordingWorkspaceSecondaryAction.Resume]: {
    icon: Play,
    labelKey: 'recording.resume',
    variant: 'outline',
  },
};

function RecordingStatusIcon({ status }: { status: RecordingWorkspaceStatus }): React.JSX.Element {
  switch (status) {
    case RecordingWorkspaceStatus.Recording:
      return <Mic aria-hidden="true" className="size-4 shrink-0" />;
    case RecordingWorkspaceStatus.Paused:
      return <Pause aria-hidden="true" className="size-4 shrink-0" />;
    case RecordingWorkspaceStatus.Processing:
      return <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />;
    case RecordingWorkspaceStatus.Idle:
      return <CircleDot aria-hidden="true" className="size-6 shrink-0" />;
  }
}

function getStatusClassName(status: RecordingWorkspaceStatus): string {
  switch (status) {
    case RecordingWorkspaceStatus.Recording:
      return 'is-recording';
    case RecordingWorkspaceStatus.Paused:
      return 'is-paused';
    case RecordingWorkspaceStatus.Processing:
      return 'is-processing';
    case RecordingWorkspaceStatus.Idle:
      return 'is-idle';
  }
}

/** Presents recording lifecycle controls and routes user actions to the active recording state. */
function RecordingControls({
  onCancel,
  onPause,
  onResume,
  onStart,
  onStop,
  recordHotkey,
  state,
  status,
}: RecordingControlsProps): React.JSX.Element {
  const { t } = useI18n();
  const viewState = getRecordingWorkspaceViewState(state);
  const isPrimaryStop = viewState.primary.action === RecordingWorkspacePrimaryAction.Stop;
  const defaultIdleStatus = t('status.pressToRecord', { hotkey: recordHotkey });
  const translatedState = t(viewState.status.labelKey);
  const statusDetail = status && status !== defaultIdleStatus && status !== translatedState ? status : '';

  const handlePrimaryAction = (): void => {
    if (viewState.primary.action === RecordingWorkspacePrimaryAction.Record) {
      void onStart();
    } else if (viewState.primary.action === RecordingWorkspacePrimaryAction.Stop) {
      onStop();
    }
  };

  const handleSecondaryAction = (action: RecordingWorkspaceSecondaryAction): void => {
    switch (action) {
      case RecordingWorkspaceSecondaryAction.Cancel:
        onCancel();
        return;
      case RecordingWorkspaceSecondaryAction.Pause:
        onPause();
        return;
      case RecordingWorkspaceSecondaryAction.Resume:
        onResume();
        return;
    }
  };

  return (
    <section className="command-dock-recording" data-slot="recording-controls">
      <div className="command-dock-record-command-band">
        <Button
          className="command-dock-record-button"
          disabled={viewState.primary.disabled}
          onClick={handlePrimaryAction}
          size="lg"
          variant={isPrimaryStop ? 'destructive' : 'primary'}
        >
          <span className="command-dock-record-button-main">
            {viewState.primary.action === RecordingWorkspacePrimaryAction.Busy ? (
              <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : isPrimaryStop ? (
              <Square aria-hidden="true" className="fill-current" />
            ) : (
              <Mic aria-hidden="true" strokeWidth={1.75} />
            )}
            <span>{t(viewState.primary.labelKey)}</span>
          </span>
          <kbd>{recordHotkey}</kbd>
        </Button>
      </div>

      <div className="command-dock-status-band" data-slot="recording-state-row">
        <div
          aria-live="polite"
          className={cn('command-dock-recording-state', getStatusClassName(viewState.status.kind))}
          data-slot="recording-state"
          role="status"
        >
          <RecordingStatusIcon status={viewState.status.kind} />
          <span>{translatedState}</span>
        </div>

        {statusDetail && (
          <p className="command-dock-status-detail" data-slot="recording-status" role="status" title={statusDetail}>
            {statusDetail}
          </p>
        )}

        <div className="command-dock-recording-actions" data-slot="recording-secondary-actions">
          {viewState.secondaryActions.map((action) => {
            const config = secondaryActionConfig[action];
            const Icon = config.icon;
            const label = t(config.labelKey);

            return (
              <Tooltip key={action}>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={label}
                    className="command-dock-recording-secondary-action"
                    onClick={() => handleSecondaryAction(action)}
                    size="sm"
                    title={label}
                    variant={config.variant}
                  >
                    <Icon aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default RecordingControls;
