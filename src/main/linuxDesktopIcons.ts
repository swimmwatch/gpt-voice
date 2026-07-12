import { copyFileSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';

export const LINUX_ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512] as const;

const ICON_FILE_NAME = 'gpt-voice.png';
const ICON_THEME_NAME = 'hicolor';

export function syncLinuxDesktopIcons(dataHome: string, getAssetPath: (filename: string) => string): void {
  for (const size of LINUX_ICON_SIZES) {
    const iconDirectory = path.join(dataHome, 'icons', ICON_THEME_NAME, `${size}x${size}`, 'apps');
    mkdirSync(iconDirectory, { recursive: true });
    copyFileSync(getAssetPath(`icons/${size}x${size}.png`), path.join(iconDirectory, ICON_FILE_NAME));
  }
}
