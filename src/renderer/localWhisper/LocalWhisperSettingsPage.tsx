import { useEffect, useRef } from 'react';
import { Button } from '@renderer/components/ui/button';
import { Spinner } from '@renderer/components/ui/spinner';
import type { ElectronAPI } from '@renderer/types';
import LocalWhisperInferenceSections from './components/LocalWhisperInferenceSections';
import LocalWhisperRuntimeModelSection from './components/LocalWhisperRuntimeModelSection';
import LocalWhisperStatusSection from './components/LocalWhisperStatusSection';
import LocalWhisperStorageSection from './components/LocalWhisperStorageSection';
import useLocalWhisperSettings from './useLocalWhisperSettings';

/** Composes the Local Whisper status, settings, artifact, and action surfaces. */
export default function LocalWhisperSettingsPage({
  desktopApi,
}: {
  readonly desktopApi: ElectronAPI;
}): React.JSX.Element {
  const controller = useLocalWhisperSettings(desktopApi);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const { snapshot, draft, validation } = controller;
  const platformUnavailable =
    snapshot?.runtime.supportTier === 'Planned' || snapshot?.runtime.supportTier === 'Unsupported';
  const commandBusy = controller.pendingAction !== null;
  const lifecycleBusy = commandBusy || (snapshot?.progress.length ?? 0) > 0;

  useEffect(() => {
    if (controller.actionError) errorSummaryRef.current?.focus();
  }, [controller.actionError]);

  if (controller.loading && (!snapshot || !draft)) {
    return (
      <div aria-live="polite" className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner label="Loading Local Whisper settings" />
        Loading Local Whisper settings…
      </div>
    );
  }

  if (!snapshot || !draft || !validation) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4" role="alert">
        <p className="font-medium text-destructive">Local Whisper settings are unavailable.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {controller.actionError ?? 'Close this window and retry after the desktop application is ready.'}
        </p>
      </div>
    );
  }

  const validationMessages = Object.entries(validation.errors).map(([field, message]) => `${field}: ${message}`);
  const persistedIssues = snapshot.validationIssues.map((issue) => `${issue.path}: ${issue.reason}`);
  const disabled = lifecycleBusy || platformUnavailable;
  const saveDisabledReason = platformUnavailable
    ? 'This platform is unavailable in the current release.'
    : lifecycleBusy
      ? 'Another Local Whisper action is in progress.'
      : validation.candidate === null
        ? 'Fix the highlighted settings before saving.'
        : !controller.dirty
          ? 'No unsaved changes.'
          : null;

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden pb-24">
      <div className="space-y-4">
        {controller.actionError || persistedIssues.length > 0 ? (
          <div
            aria-live="assertive"
            className="rounded-md border border-destructive/40 bg-destructive/5 p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
          >
            <p className="text-sm font-medium text-destructive">Local Whisper needs attention</p>
            {controller.actionError ? (
              <p className="mt-1 text-sm text-muted-foreground">{controller.actionError}</p>
            ) : null}
            {persistedIssues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {persistedIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <LocalWhisperStatusSection
          onCheck={() => void controller.checkCompatibility()}
          onLoad={() => void controller.loadModel()}
          onUnload={() => void controller.unloadModel()}
          pendingAction={controller.pendingAction}
          snapshot={snapshot}
        />

        <LocalWhisperRuntimeModelSection
          disabled={disabled}
          draft={draft}
          errors={validation.errors}
          snapshot={snapshot}
          updateDraft={controller.updateDraft}
        />

        <LocalWhisperInferenceSections
          disabled={disabled}
          draft={draft}
          errors={validation.errors}
          snapshot={snapshot}
          updateDraft={controller.updateDraft}
        />

        <LocalWhisperStorageSection
          actionsDisabledReason={
            platformUnavailable
              ? 'Artifact actions are unavailable on a planned or unsupported platform.'
              : commandBusy
                ? 'Artifact actions are disabled while another action is in progress.'
                : null
          }
          aggregateBytes={snapshot.storage.installedBytes}
          artifacts={snapshot.artifacts}
          onArtifactAction={controller.performArtifactAction}
          onOpenStorageFolder={() => void controller.openStorageFolder()}
          onViewReference={controller.viewArtifactReference}
          pendingAction={controller.pendingAction}
          progress={snapshot.progress}
          storageSummary={snapshot.storage.label}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-wrap items-start justify-end gap-3">
          <div>
            <Button disabled={disabled} onClick={() => void controller.reset()} type="button" variant="outline">
              {controller.pendingAction === 'reset' ? 'Resetting…' : 'Reset to defaults'}
            </Button>
            {disabled ? (
              <p className="mt-1 max-w-64 text-xs text-muted-foreground">
                {platformUnavailable
                  ? 'Reset is unavailable on a planned or unsupported platform.'
                  : 'Reset is disabled while another action is in progress.'}
              </p>
            ) : null}
          </div>
          <div>
            <Button disabled={saveDisabledReason !== null} onClick={() => void controller.save()} type="button">
              {controller.pendingAction === 'save' ? 'Saving…' : 'Save settings'}
            </Button>
            {saveDisabledReason ? (
              <p className="mt-1 max-w-64 text-xs text-muted-foreground">{saveDisabledReason}</p>
            ) : null}
          </div>
        </div>
      </div>

      {validationMessages.length > 0 ? (
        <span className="sr-only" role="status">
          {validationMessages.join(' ')}
        </span>
      ) : null}
    </div>
  );
}
