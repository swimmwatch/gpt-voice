import { useEffect, useRef } from 'react';
import { PiArrowCounterClockwise, PiFloppyDisk, PiInfo, PiWaveform } from 'react-icons/pi';
import { Spinner } from '@renderer/components/ui/spinner';
import type { ElectronAPI } from '@renderer/types';
import LocalWhisperInferenceSections from './components/LocalWhisperInferenceSections';
import LocalWhisperRuntimeModelSection from './components/LocalWhisperRuntimeModelSection';
import LocalWhisperStatusSection from './components/LocalWhisperStatusSection';
import LocalWhisperStorageSection from './components/LocalWhisperStorageSection';
import { isLocalWhisperArtifactProgressActive, isLocalWhisperPlatformUnavailable } from './LocalWhisperPresentation';
import useLocalWhisperSettings from './useLocalWhisperSettings';
import './LocalWhisperSettingsPage.css';

function CatalogChannelNotice({
  catalogUnavailable,
  developmentArtifactsActive,
}: {
  readonly catalogUnavailable: boolean;
  readonly developmentArtifactsActive: boolean;
}): React.JSX.Element | null {
  if (catalogUnavailable) {
    return (
      <div className="lw-notice" role="status">
        <strong>Catalog unavailable</strong>
        <span>
          Production artifacts have not been published. For qualification, launch the non-packaged app with its
          generated development activation descriptor.
        </span>
      </div>
    );
  }
  if (!developmentArtifactsActive) return null;
  return (
    <div className="lw-notice" role="status">
      <strong>Development qualification artifacts</strong>
      <span>
        This temporary channel is for local functional verification and does not indicate production readiness.
      </span>
    </div>
  );
}

function saveDisabledReason(input: {
  readonly platformUnavailable: boolean;
  readonly catalogUnavailable: boolean;
  readonly lifecycleBusy: boolean;
  readonly valid: boolean;
  readonly dirty: boolean;
}): string | null {
  if (input.platformUnavailable) return 'This platform is unavailable in the current release.';
  if (input.catalogUnavailable) return 'A trusted Local Whisper catalog is not active.';
  if (input.lifecycleBusy) return 'Another Local Whisper action is in progress.';
  if (!input.valid) return 'Fix the highlighted settings before saving.';
  return input.dirty ? null : 'No unsaved changes.';
}

function artifactDisabledReason(
  platformUnavailable: boolean,
  catalogUnavailable: boolean,
  commandBusy: boolean,
): string | null {
  if (platformUnavailable) return 'Artifact actions are unavailable on a planned or unsupported platform.';
  if (catalogUnavailable) return 'Artifact actions require an active trusted catalog.';
  return commandBusy ? 'Artifact actions are disabled while another action is in progress.' : null;
}

/** Composes the approved Local Whisper readiness dashboard over the protected settings controller. */
export default function LocalWhisperSettingsPage({
  desktopApi,
}: {
  readonly desktopApi: ElectronAPI;
}): React.JSX.Element {
  const controller = useLocalWhisperSettings(desktopApi);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const { snapshot, draft, validation } = controller;
  const platformUnavailable = snapshot ? isLocalWhisperPlatformUnavailable(snapshot) : false;
  const catalogUnavailable =
    snapshot?.runtime.blockingCode === 'CATALOG_UNAVAILABLE' || snapshot?.failure?.code === 'CATALOG_UNAVAILABLE';
  const developmentArtifactsActive =
    snapshot?.prerequisites.some(({ id }) => id === 'development-qualification-artifacts') ?? false;
  const commandBusy = controller.pendingAction !== null;
  const lifecycleBusy = commandBusy || (snapshot?.progress.some(isLocalWhisperArtifactProgressActive) ?? false);

  useEffect(() => {
    if (controller.actionError) errorSummaryRef.current?.focus();
  }, [controller.actionError]);

  if (controller.loading && (!snapshot || !draft)) {
    return (
      <div aria-live="polite" className="lw-loading">
        <Spinner label="Loading Local Whisper settings" />
        Loading Local Whisper settings…
      </div>
    );
  }

  if (!snapshot || !draft || !validation) {
    return (
      <div className="lw-alert" role="alert">
        <strong>Local Whisper settings are unavailable.</strong>
        <span>{controller.actionError ?? 'Close this window and retry after the desktop application is ready.'}</span>
      </div>
    );
  }

  const validationMessages = Object.entries(validation.errors).map(([field, message]) => `${field}: ${message}`);
  const persistedIssues = snapshot.validationIssues.map((issue) => `${issue.path}: ${issue.reason}`);
  const disabled = lifecycleBusy || platformUnavailable || catalogUnavailable;
  const saveReason = saveDisabledReason({
    platformUnavailable,
    catalogUnavailable,
    lifecycleBusy,
    valid: validation.candidate !== null,
    dirty: controller.dirty,
  });
  const artifactReason = artifactDisabledReason(platformUnavailable, catalogUnavailable, commandBusy);

  return (
    <div className="local-whisper-settings min-w-0 max-w-full overflow-x-hidden" data-slot="local-whisper-settings">
      <header className="lw-page-heading">
        <PiWaveform aria-hidden="true" className="lw-product-mark" />
        <div>
          <h1>Local Whisper</h1>
          <p>Run Whisper.cpp locally with explicit model, backend, and memory lifecycle controls.</p>
        </div>
        <PiInfo
          aria-hidden="true"
          className="lw-heading-info"
          title="Local processing keeps audio and transcripts on this device."
        />
      </header>

      <CatalogChannelNotice
        catalogUnavailable={catalogUnavailable}
        developmentArtifactsActive={developmentArtifactsActive}
      />

      {controller.actionError || persistedIssues.length > 0 ? (
        <div
          aria-live="assertive"
          className="lw-alert lw-focusable-alert"
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >
          <strong>Local Whisper needs attention</strong>
          {controller.actionError ? <span>{controller.actionError}</span> : null}
          {persistedIssues.length > 0 ? (
            <ul>
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
        actionsDisabledReason={artifactReason}
        disabled={disabled}
        draft={draft}
        errors={validation.errors}
        onArtifactAction={controller.performArtifactAction}
        onViewReference={controller.viewArtifactReference}
        pendingAction={controller.pendingAction}
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
        actionsDisabledReason={artifactReason}
        aggregateBytes={snapshot.storage.installedBytes}
        artifacts={snapshot.artifacts}
        onArtifactAction={controller.performArtifactAction}
        onOpenStorageFolder={() => void controller.openStorageFolder()}
        onViewReference={controller.viewArtifactReference}
        pendingAction={controller.pendingAction}
        progress={snapshot.progress}
        storageSummary={snapshot.storage.label}
      />

      <footer className="lw-page-actions">
        <button
          className="lw-secondary-button"
          disabled={disabled}
          onClick={() => void controller.reset()}
          title={
            disabled
              ? platformUnavailable
                ? 'Reset is unavailable on a planned or unsupported platform.'
                : catalogUnavailable
                  ? 'Reset requires an active trusted catalog.'
                  : 'Reset is disabled while another action is in progress.'
              : undefined
          }
          type="button"
        >
          <PiArrowCounterClockwise aria-hidden="true" />
          {controller.pendingAction === 'reset' ? 'Resetting…' : 'Reset to defaults'}
        </button>
        <div>
          <button
            className="lw-primary-button"
            disabled={saveReason !== null}
            onClick={() => void controller.save()}
            title={saveReason ?? undefined}
            type="button"
          >
            <PiFloppyDisk aria-hidden="true" />
            {controller.pendingAction === 'save' ? 'Saving…' : 'Save settings'}
          </button>
          <span>{controller.dirty ? 'You have unsaved changes.' : 'No unsaved changes.'}</span>
        </div>
      </footer>

      {validationMessages.length > 0 ? (
        <span className="sr-only" role="status">
          {validationMessages.join(' ')}
        </span>
      ) : null}
    </div>
  );
}
