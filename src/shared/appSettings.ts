export const APP_SETTINGS_SECTION_IDS = ['system', 'shortcuts', 'prettify', 'browser', 'network'] as const;

export type AppSettingsSectionId = (typeof APP_SETTINGS_SECTION_IDS)[number];

export function isAppSettingsSectionId(value: unknown): value is AppSettingsSectionId {
  return typeof value === 'string' && APP_SETTINGS_SECTION_IDS.includes(value as AppSettingsSectionId);
}
