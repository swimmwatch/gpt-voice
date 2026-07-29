import type { AppInfo } from '@shared/appInfo';

export const APP_ID = 'com.swimmwatch.gptvoice';
export const APP_NAME = 'GPT-Voice';
export const APP_WEBSITE = 'https://github.com/swimmwatch/gpt-voice';
export const APP_COPYRIGHT = 'Copyright (c) 2026 Dmitry Vasiliev';
export const APP_LICENSE = 'PolyForm-Noncommercial-1.0.0';
export const APP_LICENSE_URL = `${APP_WEBSITE}/blob/main/LICENSE`;

export function createAppInfo(version: string): AppInfo {
  return {
    copyright: APP_COPYRIGHT,
    license: APP_LICENSE,
    licenseUrl: APP_LICENSE_URL,
    name: APP_NAME,
    projectUrl: APP_WEBSITE,
    version,
  };
}
