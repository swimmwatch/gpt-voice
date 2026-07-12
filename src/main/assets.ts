import { app, nativeImage } from 'electron';
import * as path from 'node:path';

export function getAssetPath(filename: string): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', filename)
    : path.join(__dirname, '..', 'assets', filename);
}

export function getAppIconPath(): string {
  return getAssetPath('icon.png');
}

export function getAppIcon(): Electron.NativeImage {
  return nativeImage.createFromPath(getAppIconPath());
}
