import React, { useCallback, useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { useDesktopApi } from '@renderer/DesktopApiProvider';
import { useRendererLogger } from '@renderer/RendererLoggerProvider';
import HotkeyModal from '@renderer/components/HotkeyModal';
import BrowserSection from '@renderer/components/settings/BrowserSection';
import AuditLogSection from '@renderer/components/settings/AuditLogSection';
import NetworkSection from '@renderer/components/settings/NetworkSection';
import PrettifySection from '@renderer/components/settings/PrettifySection';
import PrettifyProfilesSettingsSection from '@renderer/components/settings/PrettifyProfilesSettingsSection';
import SettingsFooter from '@renderer/components/settings/SettingsFooter';
import SettingsNavigation, { type SettingsSectionId } from '@renderer/components/settings/SettingsNavigation';
import ShortcutsSection from '@renderer/components/settings/ShortcutsSection';
import SystemSection from '@renderer/components/settings/SystemSection';
import type { TranslationFunction } from '@renderer/components/settings/types';
import { useWindowStartupReady } from '@renderer/WindowStartupGate';
import { ConfirmationDialog } from '@renderer/components/ui/confirmation-dialog';
import { Spinner } from '@renderer/components/ui/spinner';
import { Separator } from '@renderer/components/ui/separator';
import { Tabs, TabsContent } from '@renderer/components/ui/tabs';
import {
  createAppSettingsLogSummary,
  createEditableSettings,
  createPrettifySettingsDraft,
  getCloakBrowserLocaleOptions,
  getCloakBrowserTimezoneOptions,
  getAppSettingsFormState,
  hasAppSettingsFieldErrors,
  restoreCancelledDiagnosticCaptureSettings,
  saveAppSettingsState,
  type AppSettingsSaveResult,
  type AppSettingsSaveInput,
  type AppSettingsFieldErrors,
  type AppSettingsFieldKey,
  type EditableCloakBrowserSettings,
} from '@renderer/appSettingsUtils';
import { prettifyProfilesDraftControllerReducer } from '@renderer/prettifyProfilesDraft';
import { presentAppSettingsFieldErrors } from '@renderer/appSettingsValidationPresentation';
import { useI18n } from '@renderer/hooks/useI18n';
import { usePrettifySettingsController } from '@renderer/hooks/usePrettifySettingsController';
import { getSettingsCloseDisposition } from '@renderer/settingsCloseViewState';
import type { HotkeyRuntimeState } from '@shared/hotkeyIpc';
import type { HotkeyTarget } from '@shared/hotkeys';
import type { TextActionSettings } from '@shared/textActionSettings';
import { isAppSettingsSectionId } from '@shared/appSettings';
import {
  getDisabledDiagnosticCaptureCategories,
  type DiagnosticCaptureCategory,
  type DiagnosticCaptureClearTarget,
  type DiagnosticCaptureSettings,
  type DiagnosticCaptureSettingsErrorCode,
} from '@shared/diagnosticCaptureSettings';

const EMPTY_DIAGNOSTIC_CAPTURE_CATEGORIES: readonly DiagnosticCaptureCategory[] = [];

type DiagnosticCaptureConfirmation =
  | {
      readonly kind: 'disable';
      readonly categories: readonly DiagnosticCaptureCategory[];
    }
  | {
      readonly kind: 'clear';
      readonly target: DiagnosticCaptureClearTarget;
    };

function getInitialSettingsSection(): SettingsSectionId {
  const section = new URLSearchParams(window.location.search).get('section');
  return isAppSettingsSectionId(section) ? section : 'shortcuts';
}

function generateFingerprintSeed(): string {
  return String(Math.floor(Math.random() * 90000) + 10000);
}

function getDiagnosticCaptureErrorTranslationKey(errorCode: DiagnosticCaptureSettingsErrorCode): string {
  return `auditLog.error.${errorCode}`;
}

function getDisableConfirmationScope(categories: readonly DiagnosticCaptureCategory[]): DiagnosticCaptureClearTarget {
  return categories.length === 2 ? 'all' : (categories[0] ?? 'all');
}

interface AppSettingsFormInputCandidates {
  readonly diagnosticCaptureSettings: AppSettingsSaveInput['diagnosticCaptureSettings'] | null;
  readonly initialDiagnosticCaptureSettings: AppSettingsSaveInput['initialDiagnosticCaptureSettings'] | null;
  readonly initialPrettifySettings: AppSettingsSaveInput['initialPrettifySettings'] | null;
  readonly initialPrettifyProfileCatalog: AppSettingsSaveInput['initialPrettifyProfileCatalog'] | null;
  readonly initialSettings: AppSettingsSaveInput['initialSettings'] | null;
  readonly initialTextActionSettings: AppSettingsSaveInput['initialTextActionSettings'] | null;
  readonly localeValues: readonly string[];
  readonly prettifySettings: AppSettingsSaveInput['prettifySettings'] | null;
  readonly prettifyProfileCatalog: AppSettingsSaveInput['prettifyProfileCatalog'] | null;
  readonly settings: AppSettingsSaveInput['settings'] | null;
  readonly textActionSettings: AppSettingsSaveInput['textActionSettings'] | null;
  readonly timezoneValues: readonly string[];
}

function createLoadedAppSettingsFormInput(input: AppSettingsFormInputCandidates): AppSettingsSaveInput | null {
  if (
    !input.diagnosticCaptureSettings ||
    !input.initialDiagnosticCaptureSettings ||
    !input.initialPrettifySettings ||
    !input.initialPrettifyProfileCatalog ||
    !input.initialSettings ||
    !input.initialTextActionSettings ||
    !input.prettifySettings ||
    !input.prettifyProfileCatalog ||
    !input.settings ||
    !input.textActionSettings
  ) {
    return null;
  }
  return {
    confirmedDiagnosticPurgeCategories: EMPTY_DIAGNOSTIC_CAPTURE_CATEGORIES,
    diagnosticCaptureSettings: input.diagnosticCaptureSettings,
    initialDiagnosticCaptureSettings: input.initialDiagnosticCaptureSettings,
    initialPrettifySettings: input.initialPrettifySettings,
    initialPrettifyProfileCatalog: input.initialPrettifyProfileCatalog,
    initialSettings: input.initialSettings,
    initialTextActionSettings: input.initialTextActionSettings,
    localeValues: input.localeValues,
    prettifySettings: input.prettifySettings,
    prettifyProfileCatalog: input.prettifyProfileCatalog,
    settings: input.settings,
    textActionSettings: input.textActionSettings,
    timezoneValues: input.timezoneValues,
  };
}

interface SettingsActionLockState {
  readonly hasDiagnosticConfirmation: boolean;
  readonly isDiagnosticActionPending: boolean;
  readonly isDiagnosticsExportPending: boolean;
  readonly isSaving: boolean;
}

function areDiagnosticControlsDisabled(state: SettingsActionLockState): boolean {
  return (
    state.isSaving ||
    state.isDiagnosticActionPending ||
    state.isDiagnosticsExportPending ||
    state.hasDiagnosticConfirmation
  );
}

function isAppSettingsSaveDisabled(
  state: SettingsActionLockState & {
    readonly isDirty: boolean;
    readonly isLoaded: boolean;
    readonly isValid: boolean;
  },
): boolean {
  return areDiagnosticControlsDisabled(state) || !state.isLoaded || !state.isDirty || !state.isValid;
}

interface DiagnosticCaptureConfirmationDialogProps {
  readonly confirmation: DiagnosticCaptureConfirmation | null;
  readonly onConfirm: () => Promise<boolean>;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPendingChange: (pending: boolean) => void;
  readonly t: TranslationFunction;
}

function DiagnosticCaptureConfirmationDialog({
  confirmation,
  onConfirm,
  onOpenChange,
  onPendingChange,
  t,
}: DiagnosticCaptureConfirmationDialogProps): React.ReactNode {
  return (
    <ConfirmationDialog
      cancelLabel={t('auditLog.cancel')}
      confirmLabel={
        confirmation?.kind === 'disable' ? t('auditLog.disableConfirm.action') : t('auditLog.clearConfirm.action')
      }
      description={
        confirmation?.kind === 'disable'
          ? t(`auditLog.disableConfirm.${getDisableConfirmationScope(confirmation.categories)}`)
          : t(`auditLog.clearConfirm.${confirmation?.target ?? 'all'}.description`)
      }
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      onPendingChange={onPendingChange}
      open={confirmation !== null}
      pendingLabel={t('auditLog.processing')}
      title={
        confirmation?.kind === 'disable'
          ? t('auditLog.disableConfirm.title')
          : t(`auditLog.clearConfirm.${confirmation?.target ?? 'all'}.title`)
      }
      tone="destructive"
    />
  );
}

/** Coordinates the transactional CloakBrowser, prettify, text-action, and shortcut settings form. */
const AppSettingsWindow: React.FC = () => {
  const desktopApi = useDesktopApi();
  const log = useRendererLogger('app-settings');
  const { isReady: isI18nReady, locale, setLocale, supportedLocales, t } = useI18n();
  const [settings, setSettings] = useState<EditableCloakBrowserSettings | null>(null);
  const [initialSettings, setInitialSettings] = useState<EditableCloakBrowserSettings | null>(null);
  const [textActionSettings, setTextActionSettings] = useState<TextActionSettings | null>(null);
  const [initialTextActionSettings, setInitialTextActionSettings] = useState<TextActionSettings | null>(null);
  const [diagnosticCaptureSettings, setDiagnosticCaptureSettings] = useState<DiagnosticCaptureSettings | null>(null);
  const [initialDiagnosticCaptureSettings, setInitialDiagnosticCaptureSettings] =
    useState<DiagnosticCaptureSettings | null>(null);
  const [hotkeyRuntimeState, setHotkeyRuntimeState] = useState<HotkeyRuntimeState | null>(null);
  const [prettifyProfilesState, dispatchPrettifyProfiles] = useReducer(prettifyProfilesDraftControllerReducer, null);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(getInitialSettingsSection);
  const [hotkeyTarget, setHotkeyTarget] = useState<HotkeyTarget>('record');
  const [showHotkeyModal, setShowHotkeyModal] = useState(false);
  const [platform, setPlatform] = useState<NodeJS.Platform>('linux');
  const [isSaving, setIsSaving] = useState(false);
  const [isDiagnosticActionPending, setIsDiagnosticActionPending] = useState(false);
  const [isDiagnosticsExportPending, setIsDiagnosticsExportPending] = useState(false);
  const [diagnosticConfirmation, setDiagnosticConfirmation] = useState<DiagnosticCaptureConfirmation | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AppSettingsFieldErrors>({});
  const [isDiscardConfirmationOpen, setIsDiscardConfirmationOpen] = useState(false);
  const closeRequestFocusRef = useRef<HTMLElement | null>(null);
  const diagnosticConfirmationFocusRef = useRef<HTMLElement | null>(null);
  const diagnosticConfirmationSucceededRef = useRef(false);
  const diagnosticsExportPendingRef = useRef(false);
  const settingsWindowMountedRef = useRef(true);
  const {
    applySavedSnapshot: applySavedPrettifySnapshot,
    changeProvider: changePrettifyProvider,
    clearVllmApiKey,
    initialPrettifySettings,
    initialize: initializePrettifySettings,
    isLoadingModel: isLoadingPrettifyModel,
    isLoadingModels: isLoadingPrettifyModels,
    isModelActionMenuOpen: isPrettifyModelActionMenuOpen,
    loadSelectedOllamaModel,
    modelError: prettifyModelError,
    modelLoadError: prettifyModelLoadError,
    modelLoadStatus: prettifyModelLoadStatus,
    modelOptions: prettifyModelOptions,
    prettifySettings,
    providerModelStates: prettifyProviderModelStates,
    refreshModels: refreshPrettifyModels,
    selectedOllamaModelLoaded,
    setIsModelActionMenuOpen: setIsPrettifyModelActionMenuOpen,
    unloadSelectedOllamaModel,
    updateClaudeCliSetting,
    updateCodexCliSetting,
    updateHttpSetting: updateHttpPrettifyProviderSetting,
    updateModel: updatePrettifyModel,
    updateSetting: updatePrettifySetting,
    updateVllmApiKey,
  } = usePrettifySettingsController({ setFieldErrors, t });
  const initializePrettifySettingsEvent = useEffectEvent(initializePrettifySettings);

  useEffect(() => {
    let disposed = false;
    /** Loads transactional settings and performs the existing HTTP-only model inspection. */
    const loadSettings = async (): Promise<void> => {
      try {
        const [
          nextSettings,
          nextPrettifySettings,
          nextPrettifyProfiles,
          nextTextActionSettings,
          nextDiagnosticCaptureSettings,
          nextPlatform,
        ] = await Promise.all([
          desktopApi.getCloakBrowserSettings(),
          desktopApi.getPrettifySettings(),
          desktopApi.getPrettifyProfileCatalog(),
          desktopApi.getTextActionSettings(),
          desktopApi.getDiagnosticCaptureSettings(),
          desktopApi.getPlatform(),
        ]);
        if (disposed) return;

        const editableSettings = createEditableSettings(nextSettings);
        setSettings(editableSettings);
        setInitialSettings(editableSettings);
        initializePrettifySettingsEvent(createPrettifySettingsDraft(nextPrettifySettings));
        dispatchPrettifyProfiles({ snapshot: nextPrettifyProfiles, type: 'initialize' });
        setTextActionSettings(nextTextActionSettings);
        setInitialTextActionSettings(nextTextActionSettings);
        setDiagnosticCaptureSettings(nextDiagnosticCaptureSettings);
        setInitialDiagnosticCaptureSettings(nextDiagnosticCaptureSettings);
        setPlatform(nextPlatform);
      } catch {
        if (!disposed) {
          setError(t('appSettings.saveFailed'));
        }
      }
    };

    void loadSettings();

    return () => {
      disposed = true;
    };
  }, [desktopApi, t]);

  useEffect(() => {
    let disposed = false;
    let latestRevision = -1;
    const acceptRuntimeState = (state: HotkeyRuntimeState): void => {
      if (disposed || state.revision < latestRevision) return;
      latestRevision = state.revision;
      setHotkeyRuntimeState(state);
    };
    const unsubscribe = desktopApi.onHotkeyRuntimeStateChanged(acceptRuntimeState);

    void desktopApi
      .getHotkeyRuntimeState()
      .then(acceptRuntimeState)
      .catch(() => {
        if (!disposed) setError(t('appSettings.saveFailed'));
      });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [desktopApi, t]);

  useEffect(() => {
    settingsWindowMountedRef.current = true;
    return () => {
      settingsWindowMountedRef.current = false;
    };
  }, []);

  const updateSetting = <Key extends keyof EditableCloakBrowserSettings>(
    key: Key,
    value: EditableCloakBrowserSettings[Key],
    fieldKey?: AppSettingsFieldKey,
  ): void => {
    if (fieldKey) clearFieldErrors(fieldKey);
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateProxySetting = <Key extends keyof EditableCloakBrowserSettings['proxy']>(
    key: Key,
    value: EditableCloakBrowserSettings['proxy'][Key],
    fieldKey?: AppSettingsFieldKey,
  ): void => {
    const fieldsToClear: AppSettingsFieldKey[] = [];
    if (fieldKey) fieldsToClear.push(fieldKey);
    if (key === 'enabled' && value === false) fieldsToClear.push('proxyServer', 'proxyUsername', 'proxyPassword');
    if (key === 'server') fieldsToClear.push('proxyUsername', 'proxyPassword');
    if (key === 'geoip' && value === true) fieldsToClear.push('locale', 'timezone');
    if (fieldsToClear.length) clearFieldErrors(...fieldsToClear);

    setSettings((current) =>
      current
        ? {
            ...current,
            proxy: {
              ...current.proxy,
              [key]: value,
            },
          }
        : current,
    );
  };

  const updateTextActionSetting = <Key extends keyof TextActionSettings>(
    key: Key,
    value: TextActionSettings[Key],
  ): void => {
    setTextActionSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateDiagnosticCaptureSetting = <Key extends keyof DiagnosticCaptureSettings>(
    key: Key,
    value: DiagnosticCaptureSettings[Key],
  ): void => {
    setDiagnosticCaptureSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  function clearFieldErrors(...keys: AppSettingsFieldKey[]): void {
    setFieldErrors((current) => {
      if (!keys.some((key) => current[key])) return current;
      const next = { ...current };
      for (const key of keys) {
        delete next[key];
      }
      return next;
    });
  }

  const getHotkeyValue = (target: HotkeyTarget): string | null => {
    const hotkeySettings = hotkeyRuntimeState?.settings;
    if (!hotkeySettings) return null;
    switch (target) {
      case 'record':
        return hotkeySettings.hotkey;
      case 'stop':
        return hotkeySettings.stopHotkey;
      case 'cancel':
        return hotkeySettings.cancelHotkey;
      case 'translate':
        return hotkeySettings.translateHotkey;
      case 'prettify':
        return hotkeySettings.prettifyHotkey;
      case 'prettifyQuick':
        return hotkeySettings.prettifyQuickHotkey;
      case 'retryTranscription':
        return hotkeySettings.retryTranscriptionHotkey;
    }
  };

  const openHotkeyModal = (target: HotkeyTarget): void => {
    setError('');
    setHotkeyTarget(target);
    setShowHotkeyModal(true);
  };

  const closeHotkeyModal = (): void => {
    setShowHotkeyModal(false);
  };

  const applyHotkey = async (newHotkey: string): Promise<void> => {
    setError('');
    try {
      const result = await desktopApi.setHotkey({ accelerator: newHotkey, target: hotkeyTarget });
      setHotkeyRuntimeState(result.state);
      if (result.status === 'success') {
        setError('');
      } else {
        setError(t('appSettings.saveFailed'));
      }
    } catch {
      setError(t('appSettings.saveFailed'));
    } finally {
      closeHotkeyModal();
    }
  };

  const clearProxyPassword = (): void => {
    clearFieldErrors('proxyPassword');
    setSettings((current) =>
      current
        ? {
            ...current,
            proxy: {
              ...current.proxy,
              password: '',
              hasPassword: false,
              clearPassword: true,
            },
          }
        : current,
    );
  };

  const forceCloseWindow = useCallback((): void => {
    void desktopApi.closeAppSettings();
  }, [desktopApi]);

  /** Saves all dirty settings groups in their dependency-safe order. */
  const saveSettings = async (
    confirmedDiagnosticPurgeCategories: readonly DiagnosticCaptureCategory[],
  ): Promise<AppSettingsSaveResult | null> => {
    if (
      !settings ||
      !initialSettings ||
      !prettifySettings ||
      !initialPrettifySettings ||
      !prettifyProfilesState ||
      !textActionSettings ||
      !initialTextActionSettings ||
      !diagnosticCaptureSettings ||
      !initialDiagnosticCaptureSettings
    ) {
      log.debug('App Settings save ignored because settings are not fully loaded');
      return null;
    }

    setIsSaving(true);
    setError('');
    setFieldErrors({});
    const localeOptions = getCloakBrowserLocaleOptions(settings.locale);
    const timezoneOptions = getCloakBrowserTimezoneOptions(settings.timezone);
    const saveInput = {
      confirmedDiagnosticPurgeCategories,
      diagnosticCaptureSettings,
      initialDiagnosticCaptureSettings,
      settings,
      initialSettings,
      localeValues: localeOptions,
      prettifySettings,
      initialPrettifySettings,
      prettifyProfileCatalog: prettifyProfilesState.draft,
      initialPrettifyProfileCatalog: prettifyProfilesState.baseline,
      textActionSettings,
      initialTextActionSettings,
      timezoneValues: timezoneOptions,
    };
    const logSummary = createAppSettingsLogSummary(saveInput);
    log.info('Saving App Settings:', { changedGroups: logSummary.changedGroups });
    log.debug('App Settings save summary:', logSummary);
    if (logSummary.changedGroups.length === 0) {
      log.debug('App Settings save requested with no changes');
    }

    let saveResult: AppSettingsSaveResult;
    try {
      saveResult = await saveAppSettingsState(saveInput, {
        saveCloakBrowserSettings: desktopApi.saveCloakBrowserSettings,
        setDiagnosticCaptureSettings: desktopApi.setDiagnosticCaptureSettings,
        setPrettifySettings: desktopApi.setPrettifySettings,
        savePrettifyProfileCatalog: desktopApi.savePrettifyProfileCatalog,
        setTextActionSettings: desktopApi.setTextActionSettings,
      });
    } catch {
      setIsSaving(false);
      log.error('App Settings save IPC error');
      setError(t('appSettings.saveFailed'));
      return null;
    }
    if (saveResult.prettifySettings) {
      applySavedPrettifySnapshot(saveResult.prettifySettings, Boolean(saveResult.prettifySettingsSaved));
    }
    if (saveResult.prettifyProfileCatalog && saveResult.prettifyProfileCatalogSaved) {
      dispatchPrettifyProfiles({
        catalog: saveResult.prettifyProfileCatalog,
        type: 'reconcile-saved',
      });
    }
    if (saveResult.textActionSettings) {
      setTextActionSettings(saveResult.textActionSettings);
      if (saveResult.textActionSettingsSaved) {
        setInitialTextActionSettings(saveResult.textActionSettings);
      }
    }
    if (saveResult.settings) {
      setSettings(saveResult.settings);
      if (saveResult.settingsSaved) {
        setInitialSettings(saveResult.settings);
      }
    }
    if (saveResult.diagnosticCaptureSettings) {
      setDiagnosticCaptureSettings(saveResult.diagnosticCaptureSettings);
      if (saveResult.diagnosticCaptureSettingsSaved) {
        setInitialDiagnosticCaptureSettings(saveResult.diagnosticCaptureSettings);
      }
    }

    setIsSaving(false);
    if (!saveResult.success) {
      if (saveResult.fieldErrors && hasAppSettingsFieldErrors(saveResult.fieldErrors)) {
        log.warn('App Settings save blocked by validation:', {
          fields: Object.keys(saveResult.fieldErrors).filter(
            (field) => saveResult.fieldErrors?.[field as AppSettingsFieldKey],
          ),
        });
        setFieldErrors(saveResult.fieldErrors);
        return saveResult;
      }
      log.warn('App Settings save failed:', {
        diagnosticCaptureErrorCode: saveResult.diagnosticCaptureErrorCode,
        diagnosticCaptureSettingsSaved: Boolean(saveResult.diagnosticCaptureSettingsSaved),
        error: saveResult.error,
        prettifySettingsSaved: Boolean(saveResult.prettifySettingsSaved),
        prettifyProfileCatalogSaved: Boolean(saveResult.prettifyProfileCatalogSaved),
        prettifyProfileCatalogErrorCode: saveResult.prettifyProfileCatalogErrorCode,
        textActionSettingsSaved: Boolean(saveResult.textActionSettingsSaved),
        cloakBrowserSettingsSaved: Boolean(saveResult.settingsSaved),
      });
      setError(
        saveResult.diagnosticCaptureErrorCode
          ? t(getDiagnosticCaptureErrorTranslationKey(saveResult.diagnosticCaptureErrorCode))
          : saveResult.prettifyProfileCatalogErrorCode
            ? t('prettify.profiles.error.catalogSave')
            : saveResult.error || t('appSettings.saveFailed'),
      );
      return saveResult;
    }
    log.info('App Settings saved:', {
      changedGroups: logSummary.changedGroups,
      diagnosticCaptureSettingsSaved: Boolean(saveResult.diagnosticCaptureSettingsSaved),
      prettifySettingsSaved: Boolean(saveResult.prettifySettingsSaved),
      prettifyProfileCatalogSaved: Boolean(saveResult.prettifyProfileCatalogSaved),
      textActionSettingsSaved: Boolean(saveResult.textActionSettingsSaved),
      cloakBrowserSettingsSaved: Boolean(saveResult.settingsSaved),
    });
    log.info('App Settings save succeeded; closing settings window');
    forceCloseWindow();
    return saveResult;
  };

  const restoreDiagnosticConfirmationFocus = (): void => {
    window.requestAnimationFrame(() => diagnosticConfirmationFocusRef.current?.focus());
  };

  const closeDiagnosticConfirmation = (): void => {
    diagnosticConfirmationSucceededRef.current = false;
    setDiagnosticConfirmation(null);
    restoreDiagnosticConfirmationFocus();
  };

  const requestSaveSettings = (): void => {
    if (
      isSaving ||
      isDiagnosticActionPending ||
      diagnosticsExportPendingRef.current ||
      diagnosticConfirmation ||
      !diagnosticCaptureSettings ||
      !initialDiagnosticCaptureSettings
    ) {
      return;
    }
    const disabledCategories = getDisabledDiagnosticCaptureCategories(
      initialDiagnosticCaptureSettings,
      diagnosticCaptureSettings,
    );
    if (disabledCategories.length === 0) {
      void saveSettings(EMPTY_DIAGNOSTIC_CAPTURE_CATEGORIES);
      return;
    }

    diagnosticConfirmationFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDiagnosticConfirmation({ categories: disabledCategories, kind: 'disable' });
  };

  const requestDiagnosticClear = (target: DiagnosticCaptureClearTarget): void => {
    if (isSaving || isDiagnosticActionPending || diagnosticsExportPendingRef.current || diagnosticConfirmation) return;
    diagnosticConfirmationFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError('');
    setDiagnosticConfirmation({ kind: 'clear', target });
  };

  const requestDiagnosticsExport = (): void => {
    if (diagnosticsExportPendingRef.current || isSaving || isDiagnosticActionPending || diagnosticConfirmation) {
      return;
    }
    diagnosticsExportPendingRef.current = true;
    setIsDiagnosticsExportPending(true);
    void desktopApi
      .exportDiagnostics()
      .catch(() => undefined)
      .finally(() => {
        diagnosticsExportPendingRef.current = false;
        if (settingsWindowMountedRef.current) setIsDiagnosticsExportPending(false);
      });
  };

  const cancelDiagnosticConfirmation = (): void => {
    if (!diagnosticConfirmation) return;
    if (diagnosticConfirmation.kind === 'disable' && initialDiagnosticCaptureSettings) {
      const cancelledCategories = diagnosticConfirmation.categories;
      setDiagnosticCaptureSettings((current) => {
        if (!current) return current;
        return restoreCancelledDiagnosticCaptureSettings(
          current,
          initialDiagnosticCaptureSettings,
          cancelledCategories,
        );
      });
    }
    closeDiagnosticConfirmation();
  };

  const confirmDiagnosticAction = async (): Promise<boolean> => {
    if (!diagnosticConfirmation) return false;
    const confirmation = diagnosticConfirmation;
    setError('');
    try {
      if (confirmation.kind === 'disable') {
        const result = await saveSettings(confirmation.categories);
        if (!result?.diagnosticCaptureSettingsSaved) return false;
        diagnosticConfirmationSucceededRef.current = true;
        return true;
      }

      const result = await desktopApi.clearDiagnosticCapture({
        confirmed: true,
        target: confirmation.target,
      });
      if (result.success) {
        diagnosticConfirmationSucceededRef.current = true;
        return true;
      }
      setError(t(getDiagnosticCaptureErrorTranslationKey(result.errorCode)));
    } catch {
      log.error('Diagnostic capture destructive action IPC error');
      setError(t('auditLog.error.storage-failed'));
    }
    return false;
  };

  const handleDiagnosticConfirmationOpenChange = (open: boolean): void => {
    if (open) return;
    if (diagnosticConfirmationSucceededRef.current) {
      closeDiagnosticConfirmation();
      return;
    }
    cancelDiagnosticConfirmation();
  };

  const proxyGeoipActive = Boolean(settings?.proxy.enabled && settings.proxy.geoip);
  const localeOptions = getCloakBrowserLocaleOptions(settings?.locale);
  const timezoneOptions = getCloakBrowserTimezoneOptions(settings?.timezone);
  const loadedFormInput = createLoadedAppSettingsFormInput({
    diagnosticCaptureSettings,
    initialDiagnosticCaptureSettings,
    initialPrettifyProfileCatalog: prettifyProfilesState?.baseline ?? null,
    initialPrettifySettings,
    initialSettings,
    initialTextActionSettings,
    localeValues: localeOptions,
    prettifySettings,
    prettifyProfileCatalog: prettifyProfilesState?.draft ?? null,
    settings,
    textActionSettings,
    timezoneValues: timezoneOptions,
  });
  const formState = loadedFormInput ? getAppSettingsFormState(loadedFormInput) : null;
  const visibleFieldErrors = formState?.isDirty ? { ...formState.validationErrors, ...fieldErrors } : fieldErrors;
  const visibleFieldErrorMessages = presentAppSettingsFieldErrors(visibleFieldErrors, t);
  const hotkeySettings = hotkeyRuntimeState?.settings ?? null;
  const isSettingsReady = Boolean(formState && hotkeySettings);
  useWindowStartupReady(isI18nReady && (isSettingsReady || Boolean(error)));
  const renderFieldError = (fieldKey: AppSettingsFieldKey): React.ReactNode => {
    const message = visibleFieldErrorMessages[fieldKey];
    return message || null;
  };
  const isDirty = formState?.isDirty ?? false;
  const actionLockState = {
    hasDiagnosticConfirmation: diagnosticConfirmation !== null,
    isDiagnosticActionPending,
    isDiagnosticsExportPending,
    isSaving,
  };
  const saveDisabled = isAppSettingsSaveDisabled({
    ...actionLockState,
    isDirty,
    isLoaded: formState !== null,
    isValid: formState?.isValid ?? false,
  });
  const diagnosticControlsDisabled = areDiagnosticControlsDisabled(actionLockState);
  const restoreCloseRequestFocus = useCallback((): void => {
    window.requestAnimationFrame(() => closeRequestFocusRef.current?.focus());
  }, []);
  const handleDiscardConfirmationOpenChange = useCallback(
    (open: boolean): void => {
      setIsDiscardConfirmationOpen(open);
      if (!open) {
        restoreCloseRequestFocus();
      }
    },
    [restoreCloseRequestFocus],
  );
  const requestCloseWindow = useCallback((): void => {
    if (diagnosticConfirmation || isDiagnosticActionPending || diagnosticsExportPendingRef.current) return;
    const disposition = getSettingsCloseDisposition({ isDirty, isSaving });
    if (disposition === 'block') {
      return;
    }
    if (disposition === 'confirm') {
      if (isDiscardConfirmationOpen) {
        return;
      }
      closeRequestFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setIsDiscardConfirmationOpen(true);
      return;
    }
    forceCloseWindow();
  }, [
    diagnosticConfirmation,
    forceCloseWindow,
    isDiagnosticActionPending,
    isDirty,
    isDiscardConfirmationOpen,
    isSaving,
  ]);
  const discardChanges = useCallback((): boolean => {
    forceCloseWindow();
    return true;
  }, [forceCloseWindow]);

  useEffect(() => desktopApi.onAppSettingsCloseRequested(requestCloseWindow), [desktopApi, requestCloseWindow]);
  useEffect(() => desktopApi.onAppSettingsSectionRequested(setActiveSection), [desktopApi]);

  return (
    <>
      <main className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden p-4 [-webkit-app-region:no-drag]">
        <header className="shrink-0">
          <h1 className="text-lg font-semibold text-foreground">{t('appSettings.title')}</h1>
        </header>
        {!isSettingsReady && !error && (
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner label={t('loading.initializing')} />
            {t('loading.initializing')}
          </div>
        )}

        {settings &&
          initialSettings &&
          prettifySettings &&
          initialPrettifySettings &&
          prettifyProfilesState &&
          textActionSettings &&
          initialTextActionSettings &&
          diagnosticCaptureSettings &&
          initialDiagnosticCaptureSettings &&
          hotkeySettings && (
            <>
              <Tabs
                className="flex min-h-0 flex-1 flex-col"
                onValueChange={(value) => setActiveSection(value as SettingsSectionId)}
                orientation="vertical"
                value={activeSection}
              >
                <div className="flex min-h-0 flex-1 gap-4">
                  <SettingsNavigation t={t} />
                  <div
                    className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
                    data-slot="settings-content"
                  >
                    <TabsContent className="mt-0" value="system">
                      <SystemSection
                        locale={locale}
                        onLocaleChange={setLocale}
                        supportedLocales={supportedLocales}
                        t={t}
                      />
                    </TabsContent>
                    <TabsContent className="mt-0" value="shortcuts">
                      <ShortcutsSection
                        getHotkeyValue={getHotkeyValue}
                        onHotkeyChange={(target) => void openHotkeyModal(target)}
                        onTextActionEnabledChange={updateTextActionSetting}
                        t={t}
                        textActionSettings={textActionSettings}
                      />
                    </TabsContent>
                    <TabsContent className="mt-0" value="prettify">
                      <section aria-labelledby="prettify-heading" className="grid gap-5 pb-4">
                        <h2 className="text-base font-semibold text-foreground" id="prettify-heading">
                          {t('appSettings.prettify')}
                        </h2>
                        <PrettifyProfilesSettingsSection
                          disabled={isSaving}
                          dispatch={dispatchPrettifyProfiles}
                          state={prettifyProfilesState}
                          t={t}
                        />
                        <Separator />
                        <PrettifySection
                          availability={prettifyProviderModelStates[prettifySettings.providerId].availability}
                          fieldError={renderFieldError}
                          isLoadingModel={isLoadingPrettifyModel}
                          isLoadingModels={isLoadingPrettifyModels}
                          isModelActionMenuOpen={isPrettifyModelActionMenuOpen}
                          modelCheckStatus={prettifyProviderModelStates[prettifySettings.providerId].checkStatus}
                          modelLoadError={prettifyModelLoadError}
                          modelLoadStatus={prettifyModelLoadStatus}
                          modelOptions={prettifyModelOptions[prettifySettings.providerId]}
                          modelRefreshError={prettifyModelError}
                          onBaseUrlChange={(value) =>
                            updateHttpPrettifyProviderSetting('baseUrl', value, 'prettifyBaseUrl')
                          }
                          onClaudeEffortChange={(value) => updateClaudeCliSetting('effort', value, 'prettifyEffort')}
                          onClearVllmApiKey={clearVllmApiKey}
                          onCodexReasoningEffortChange={(value) =>
                            updateCodexCliSetting('reasoningEffort', value, 'prettifyReasoningEffort')
                          }
                          onCodexVerbosityChange={(value) =>
                            updateCodexCliSetting('verbosity', value, 'prettifyVerbosity')
                          }
                          onExecutablePathChange={(value) => {
                            if (prettifySettings.providerId === 'claude-cli') {
                              updateClaudeCliSetting('executablePath', value, 'prettifyExecutablePath');
                            } else if (prettifySettings.providerId === 'codex-cli') {
                              updateCodexCliSetting('executablePath', value, 'prettifyExecutablePath');
                            }
                          }}
                          onFallbackModelChange={(value) =>
                            updateClaudeCliSetting('fallbackModel', value, 'prettifyFallbackModel')
                          }
                          onLoadModel={() => void loadSelectedOllamaModel()}
                          onMaxOutputTokensChange={(value) =>
                            updatePrettifySetting('maxOutputTokens', value, 'prettifyMaxOutputTokens')
                          }
                          onMinPChange={(value) => updatePrettifySetting('minP', value, 'prettifyMinP')}
                          onModelActionMenuOpenChange={setIsPrettifyModelActionMenuOpen}
                          onModelChange={updatePrettifyModel}
                          onProviderChange={changePrettifyProvider}
                          onRefreshModels={() => void refreshPrettifyModels()}
                          onRepeatPenaltyChange={(value) =>
                            updatePrettifySetting('repeatPenalty', value, 'prettifyRepeatPenalty')
                          }
                          onSeedChange={(value) => updatePrettifySetting('seed', value, 'prettifySeed')}
                          onTemperatureChange={(value) =>
                            updatePrettifySetting('temperature', value, 'prettifyTemperature')
                          }
                          onTimeoutChange={(value) => {
                            if (prettifySettings.providerId === 'claude-cli') {
                              updateClaudeCliSetting('timeoutSeconds', value, 'prettifyTimeout');
                            } else if (prettifySettings.providerId === 'codex-cli') {
                              updateCodexCliSetting('timeoutSeconds', value, 'prettifyTimeout');
                            }
                          }}
                          onTopKChange={(value) => updatePrettifySetting('topK', value, 'prettifyTopK')}
                          onTopPChange={(value) => updatePrettifySetting('topP', value, 'prettifyTopP')}
                          onUnloadModel={() => void unloadSelectedOllamaModel()}
                          onVllmApiKeyChange={updateVllmApiKey}
                          prettifySettings={prettifySettings}
                          selectedOllamaModelLoaded={selectedOllamaModelLoaded}
                          t={t}
                        />
                      </section>
                    </TabsContent>
                    <TabsContent className="mt-0" value="browser">
                      <BrowserSection
                        fieldError={renderFieldError}
                        localeOptions={localeOptions}
                        onBackgroundModeChange={(value) => updateSetting('backgroundMode', value, 'backgroundMode')}
                        onFingerprintSeedChange={(value) => updateSetting('fingerprintSeed', value, 'fingerprintSeed')}
                        onHumanizeChange={(value) => updateSetting('humanize', value)}
                        onHumanPresetChange={(value) => updateSetting('humanPreset', value, 'humanPreset')}
                        onLocaleChange={(value) => updateSetting('locale', value, 'locale')}
                        onResetFingerprint={() =>
                          updateSetting('fingerprintSeed', generateFingerprintSeed(), 'fingerprintSeed')
                        }
                        onTimezoneChange={(value) => updateSetting('timezone', value, 'timezone')}
                        proxyGeoipActive={proxyGeoipActive}
                        settings={settings}
                        t={t}
                        timezoneOptions={timezoneOptions}
                      />
                    </TabsContent>
                    <TabsContent className="mt-0" value="network">
                      <NetworkSection
                        fieldError={renderFieldError}
                        onBypassChange={(value) => updateProxySetting('bypass', value, 'proxyBypass')}
                        onClearPassword={clearProxyPassword}
                        onEnabledChange={(value) => updateProxySetting('enabled', value)}
                        onGeoipChange={(value) => updateProxySetting('geoip', value)}
                        onPasswordChange={(value) => updateProxySetting('password', value, 'proxyPassword')}
                        onServerChange={(value) => updateProxySetting('server', value, 'proxyServer')}
                        onUsernameChange={(value) => updateProxySetting('username', value, 'proxyUsername')}
                        settings={settings}
                        t={t}
                      />
                    </TabsContent>
                    <TabsContent className="mt-0" value="audit-log">
                      <AuditLogSection
                        disabled={diagnosticControlsDisabled}
                        exportPending={isDiagnosticsExportPending}
                        onClear={requestDiagnosticClear}
                        onExport={requestDiagnosticsExport}
                        onSettingChange={updateDiagnosticCaptureSetting}
                        settings={diagnosticCaptureSettings}
                        t={t}
                      />
                    </TabsContent>
                  </div>
                </div>
              </Tabs>
              <SettingsFooter
                error={error}
                isDirty={isDirty}
                isSaving={isSaving}
                onSave={requestSaveSettings}
                saveDisabled={saveDisabled}
                t={t}
              />
            </>
          )}

        {!isSettingsReady && error && <p className="text-sm text-destructive">{error}</p>}
        {showHotkeyModal && (
          <HotkeyModal
            target={hotkeyTarget}
            platform={platform}
            onApply={(newHotkey) => void applyHotkey(newHotkey)}
            onClose={closeHotkeyModal}
          />
        )}
      </main>

      <ConfirmationDialog
        cancelLabel={t('common.keepEditing')}
        confirmLabel={t('common.discardChanges')}
        description={t('appSettings.discardChangesDescription')}
        onConfirm={discardChanges}
        onOpenChange={handleDiscardConfirmationOpenChange}
        open={isDiscardConfirmationOpen}
        title={t('common.discardChangesConfirm')}
        tone="destructive"
      />

      <DiagnosticCaptureConfirmationDialog
        confirmation={diagnosticConfirmation}
        onConfirm={confirmDiagnosticAction}
        onOpenChange={handleDiagnosticConfirmationOpenChange}
        onPendingChange={setIsDiagnosticActionPending}
        t={t}
      />
    </>
  );
};

export default AppSettingsWindow;
