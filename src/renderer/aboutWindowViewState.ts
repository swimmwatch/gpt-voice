import type { AppInfo } from '@shared/appInfo';

export type AboutWindowInfoState = 'failed' | 'loaded' | 'loading';

export function getAboutWindowInfoState(appInfo: AppInfo | null, loadFailed: boolean): AboutWindowInfoState {
  if (appInfo) {
    return 'loaded';
  }

  return loadFailed ? 'failed' : 'loading';
}
