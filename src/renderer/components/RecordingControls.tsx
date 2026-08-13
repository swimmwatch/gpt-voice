import { CircleDot, LoaderCircle, Mic, Pause } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ContextualActionTile from '@renderer/components/ContextualActionTile';
import { useI18n } from '@renderer/hooks/useI18n';
import { RecordingWorkspaceStatus, getRecordingWorkspaceViewState } from '@renderer/mainWindowViewState';
import { useCapturedAudioElapsedTime } from '@renderer/recordingElapsedTime';
import { cn } from '@renderer/lib/cn';
import { getRendererStatusDetail, renderRendererStatus, type RendererStatus } from '@renderer/statusPresentation';
import type { ProviderHotkeyContextualAction } from '@renderer/useProviderHotkeyHomeIntegration';
import type { RecordingLifecycleState } from '@shared/recordingLifecycle';

interface RecordingControlsProps {
  readonly contextualActions: readonly ProviderHotkeyContextualAction[];
  readonly state: RecordingLifecycleState;
  readonly status: RendererStatus | null;
}

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

function getContextualActionId(action: ProviderHotkeyContextualAction): string {
  return `${action.provider}:${action.action}`;
}

/** Presents lifecycle status and the provider-neutral actions currently available to the user. */
function RecordingControls({ contextualActions, state, status }: RecordingControlsProps): React.JSX.Element {
  const { t } = useI18n();
  const footerRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedActionRef = useRef<string | null>(null);
  const capturedDuration = useCapturedAudioElapsedTime(state);
  const viewState = getRecordingWorkspaceViewState(state);
  const translatedState = t(viewState.status.labelKey);
  const statusDetail = getRendererStatusDetail(status, state);
  const showCapturedDuration = !statusDetail && (state === 'recording' || state === 'paused');
  const capturedDurationLabel = t('recording.capturedAudioDuration', { duration: capturedDuration });

  useEffect(() => {
    const focusedActionId = previouslyFocusedActionRef.current;
    if (focusedActionId && !contextualActions.some((action) => getContextualActionId(action) === focusedActionId)) {
      footerRef.current?.focus();
      previouslyFocusedActionRef.current = null;
    }
  }, [contextualActions]);

  return (
    <section
      className="command-dock-recording"
      data-slot="recording-controls"
      onFocusCapture={(event) => {
        previouslyFocusedActionRef.current = event.target.dataset.contextualActionId ?? null;
      }}
      ref={footerRef}
      tabIndex={-1}
    >
      <div className="command-dock-status-band" data-slot="recording-state-row">
        <div
          className={cn('command-dock-recording-state', getStatusClassName(viewState.status.kind))}
          data-slot="recording-state"
        >
          <RecordingStatusIcon status={viewState.status.kind} />
          <span>{translatedState}</span>
        </div>

        {statusDetail ? (
          <p
            aria-live="polite"
            className="command-dock-status-detail"
            data-slot="recording-status"
            role="status"
            title={renderRendererStatus(statusDetail, t)}
          >
            {renderRendererStatus(statusDetail, t)}
          </p>
        ) : (
          showCapturedDuration && (
            <p
              aria-label={capturedDurationLabel}
              className="command-dock-status-detail command-dock-captured-duration"
              data-slot="captured-audio-duration"
              title={capturedDurationLabel}
            >
              {capturedDuration}
            </p>
          )
        )}

        <div className="command-dock-recording-actions" data-slot="recording-contextual-actions">
          {contextualActions.map((action) => (
            <ContextualActionTile action={action} key={getContextualActionId(action)} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default RecordingControls;
