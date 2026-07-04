import type { CloakBrowserSettingsInput, CloakBrowserSettingsView } from '@shared/cloakBrowserSettings';
import type { PrettifySettings } from '@shared/prettifySettings';

export interface EditableCloakBrowserSettings extends Omit<CloakBrowserSettingsView, 'proxy'> {
  proxy: CloakBrowserSettingsView['proxy'] & {
    password: string;
    clearPassword: boolean;
  };
}

export interface AppSettingsSaveDependencies {
  saveCloakBrowserSettings: (
    settings: CloakBrowserSettingsInput,
  ) => Promise<{ success: boolean; settings?: CloakBrowserSettingsView; error?: string }>;
  setPrettifySettings: (
    settings: PrettifySettings,
  ) => Promise<{ success: boolean; settings?: PrettifySettings; error?: string }>;
}

export interface AppSettingsSaveInput {
  initialPrettifySettings: PrettifySettings;
  initialSettings: EditableCloakBrowserSettings;
  prettifySettings: PrettifySettings;
  settings: EditableCloakBrowserSettings;
}

export interface AppSettingsSaveResult {
  success: boolean;
  error?: string;
  prettifySettingsSaved?: boolean;
  prettifySettings?: PrettifySettings;
  settingsSaved?: boolean;
  settings?: EditableCloakBrowserSettings;
}

export function createEditableSettings(settings: CloakBrowserSettingsView): EditableCloakBrowserSettings {
  return {
    ...settings,
    proxy: {
      ...settings.proxy,
      password: '',
      clearPassword: false,
    },
  };
}

export function createCloakBrowserSettingsInput(settings: EditableCloakBrowserSettings): CloakBrowserSettingsInput {
  return {
    humanize: settings.humanize,
    humanPreset: settings.humanPreset,
    backgroundMode: settings.backgroundMode,
    fingerprintSeed: settings.fingerprintSeed,
    locale: settings.locale,
    timezone: settings.timezone,
    proxy: {
      enabled: settings.proxy.enabled,
      server: settings.proxy.server,
      bypass: settings.proxy.bypass,
      username: settings.proxy.username,
      password: settings.proxy.password,
      clearPassword: settings.proxy.clearPassword,
      geoip: settings.proxy.geoip,
    },
  };
}

export function arePrettifySettingsEqual(left: PrettifySettings, right: PrettifySettings): boolean {
  return left.prompt === right.prompt && left.reasoning === right.reasoning;
}

export function areCloakBrowserSettingsEqual(
  current: EditableCloakBrowserSettings,
  initial: EditableCloakBrowserSettings,
): boolean {
  return (
    current.humanize === initial.humanize &&
    current.humanPreset === initial.humanPreset &&
    current.backgroundMode === initial.backgroundMode &&
    current.fingerprintSeed === initial.fingerprintSeed &&
    current.locale === initial.locale &&
    current.timezone === initial.timezone &&
    current.proxy.enabled === initial.proxy.enabled &&
    current.proxy.server === initial.proxy.server &&
    current.proxy.bypass === initial.proxy.bypass &&
    current.proxy.username === initial.proxy.username &&
    current.proxy.geoip === initial.proxy.geoip &&
    current.proxy.hasPassword === initial.proxy.hasPassword &&
    !current.proxy.password &&
    !current.proxy.clearPassword
  );
}

export async function saveAppSettingsState(
  input: AppSettingsSaveInput,
  deps: AppSettingsSaveDependencies,
): Promise<AppSettingsSaveResult> {
  const shouldSavePrettify = !arePrettifySettingsEqual(input.prettifySettings, input.initialPrettifySettings);
  const shouldSaveCloakBrowser = !areCloakBrowserSettingsEqual(input.settings, input.initialSettings);
  const result: AppSettingsSaveResult = {
    success: true,
  };

  if (shouldSavePrettify) {
    const prettifyResult = await deps.setPrettifySettings(input.prettifySettings);
    if (prettifyResult.success && prettifyResult.settings) {
      result.prettifySettings = prettifyResult.settings;
      result.prettifySettingsSaved = true;
    } else {
      result.success = false;
    }
  }

  if (shouldSaveCloakBrowser) {
    const cloakResult = await deps.saveCloakBrowserSettings(createCloakBrowserSettingsInput(input.settings));
    if (cloakResult.success && cloakResult.settings) {
      result.settings = createEditableSettings(cloakResult.settings);
      result.settingsSaved = true;
    } else {
      result.success = false;
      result.error = cloakResult.error;
      if (cloakResult.settings) {
        result.settings = createEditableSettings(cloakResult.settings);
      }
    }
  }

  return result;
}
