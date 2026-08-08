import { useEffect, useRef } from 'react';
import { PiArrowCounterClockwise, PiFloppyDisk, PiInfo, PiWaveform } from 'react-icons/pi';
import { Spinner } from '@renderer/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip';
import { useI18n } from '@renderer/hooks/useI18n';
import type { ElectronAPI } from '@renderer/types';
import LocalWhisperInferenceSections from './components/LocalWhisperInferenceSections';
import LocalWhisperRuntimeModelSection from './components/LocalWhisperRuntimeModelSection';
import LocalWhisperStatusSection from './components/LocalWhisperStatusSection';
import LocalWhisperStorageSection from './components/LocalWhisperStorageSection';
import {
  isLocalWhisperArtifactProgressActive,
  isLocalWhisperPlatformUnavailable,
  translateLocalWhisperActionError,
} from './LocalWhisperPresentation';
import useLocalWhisperSettings from './useLocalWhisperSettings';
import './LocalWhisperSettingsPage.css';

function CatalogChannelNotice({
  catalogUnavailable,
  developmentArtifactsActive,
}: {
  readonly catalogUnavailable: boolean;
  readonly developmentArtifactsActive: boolean;
}): React.JSX.Element | null {
  const { t } = useI18n();
  if (catalogUnavailable) {
    return (
      <div className="lw-notice" role="status">
        <strong>{t('localWhisper.settings.catalogUnavailable')}</strong>
        <span>{t('localWhisper.settings.catalogUnavailableDescription')}</span>
      </div>
    );
  }
  if (!developmentArtifactsActive) return null;
  return (
    <div className="lw-notice" role="status">
      <strong>{t('localWhisper.settings.developmentArtifacts')}</strong>
      <span>{t('localWhisper.settings.developmentArtifactsDescription')}</span>
    </div>
  );
}

function saveDisabledReason(
  translate: ReturnType<typeof useI18n>['t'],
  input: {
    readonly platformUnavailable: boolean;
    readonly catalogUnavailable: boolean;
    readonly lifecycleBusy: boolean;
    readonly valid: boolean;
    readonly dirty: boolean;
  },
): string | null {
  if (input.platformUnavailable) return translate('localWhisper.settings.disabledPlatform');
  if (input.catalogUnavailable) return translate('localWhisper.settings.disabledCatalog');
  if (input.lifecycleBusy) return translate('localWhisper.settings.disabledBusy');
  if (!input.valid) return translate('localWhisper.settings.disabledInvalid');
  return input.dirty ? null : translate('localWhisper.settings.disabledNoChanges');
}

function artifactDisabledReason(
  translate: ReturnType<typeof useI18n>['t'],
  platformUnavailable: boolean,
  catalogUnavailable: boolean,
  commandBusy: boolean,
): string | null {
  if (platformUnavailable) return translate('localWhisper.settings.resetDisabledPlatform');
  if (catalogUnavailable) return translate('localWhisper.settings.resetDisabledCatalog');
  return commandBusy ? translate('localWhisper.settings.disabledBusy') : null;
}

function persistedIssueMessage(path: string, reason: string, translate: ReturnType<typeof useI18n>['t']): string {
  if (path === 'execution.deviceId' && reason === 'unknown-value') {
    return translate('localWhisper.settings.savedDeviceUnavailable');
  }
  return translate('localWhisper.settings.savedSettingInvalid');
}

/** Composes the approved Local Whisper readiness dashboard over the protected settings controller. */
export default function LocalWhisperSettingsPage({
  desktopApi,
}: {
  readonly desktopApi: ElectronAPI;
}): React.JSX.Element {
  const { t } = useI18n();
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
        <Spinner label={t('localWhisper.settings.loadingSettings')} />
        {t('localWhisper.settings.loadingSettings')}
      </div>
    );
  }

  if (!snapshot || !draft || !validation) {
    return (
      <div className="lw-alert" role="alert">
        <strong>{t('localWhisper.settings.settingsUnavailable')}</strong>
        <span>
          {controller.actionError
            ? translateLocalWhisperActionError(controller.actionError, t)
            : t('localWhisper.settings.closeRetry')}
        </span>
      </div>
    );
  }

  const validationMessages = Object.entries(validation.errors).map(
    ([field, message]) => `${field}: ${t(message.key, message.params)}`,
  );
  const persistedIssues = snapshot.validationIssues.map(({ path, reason }) => persistedIssueMessage(path, reason, t));
  const disabled = lifecycleBusy || platformUnavailable || catalogUnavailable;
  const saveReason = saveDisabledReason(t, {
    platformUnavailable,
    catalogUnavailable,
    lifecycleBusy,
    valid: validation.candidate !== null,
    dirty: controller.dirty,
  });
  const artifactReason = artifactDisabledReason(t, platformUnavailable, catalogUnavailable, commandBusy);
  const resetDisabledReason = disabled
    ? platformUnavailable
      ? t('localWhisper.settings.resetDisabledPlatform')
      : catalogUnavailable
        ? t('localWhisper.settings.resetDisabledCatalog')
        : t('localWhisper.settings.disabledBusy')
    : null;

  return (
    <div className="local-whisper-settings min-w-0 max-w-full overflow-x-hidden" data-slot="local-whisper-settings">
      <header className="lw-page-heading">
        <PiWaveform aria-hidden="true" className="lw-product-mark" />
        <div>
          <h1>{t('localWhisper.settings.title')}</h1>
          <p>{t('localWhisper.settings.pageDescription')}</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <PiInfo aria-hidden="true" className="lw-heading-info" />
          </TooltipTrigger>
          <TooltipContent>{t('localWhisper.settings.privacyTooltip')}</TooltipContent>
        </Tooltip>
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
          <strong>{t('localWhisper.settings.attention')}</strong>
          {controller.actionError ? <span>{translateLocalWhisperActionError(controller.actionError, t)}</span> : null}
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
        aggregateBytes={snapshot.storage.installedBytes}
        onOpenStorageFolder={() => void controller.openStorageFolder()}
        pendingAction={controller.pendingAction}
        storageSummary={snapshot.storage.label}
      />

      <footer className="lw-page-actions">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="lw-secondary-button"
              disabled={disabled}
              onClick={() => void controller.reset()}
              type="button"
            >
              <PiArrowCounterClockwise aria-hidden="true" />
              {controller.pendingAction === 'reset'
                ? t('localWhisper.settings.resetting')
                : t('localWhisper.settings.reset')}
            </button>
          </TooltipTrigger>
          {resetDisabledReason ? <TooltipContent>{resetDisabledReason}</TooltipContent> : null}
        </Tooltip>
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="lw-primary-button"
                disabled={saveReason !== null}
                onClick={() => void controller.save()}
                type="button"
              >
                <PiFloppyDisk aria-hidden="true" />
                {controller.pendingAction === 'save'
                  ? t('localWhisper.settings.saving')
                  : t('localWhisper.settings.save')}
              </button>
            </TooltipTrigger>
            {saveReason ? <TooltipContent>{saveReason}</TooltipContent> : null}
          </Tooltip>
          <span>{controller.dirty ? t('localWhisper.settings.unsaved') : t('localWhisper.settings.clean')}</span>
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
