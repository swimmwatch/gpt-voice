import * as path from 'node:path';

const APP_ICON_FILE_NAME = 'icon.png';

export interface AssetPathResolverDependencies {
  readonly isPackaged: boolean;
  readonly mainDirectory: string;
  readonly resourcesPath: string;
}

/** Resolves immutable application asset paths for one main-process graph. */
export class AssetPathResolver {
  public constructor(private readonly dependencies: AssetPathResolverDependencies) {}

  public readonly getAssetPath = (filename: string): string => {
    return this.dependencies.isPackaged
      ? path.join(this.dependencies.resourcesPath, 'assets', filename)
      : path.join(this.dependencies.mainDirectory, '..', 'assets', filename);
  };

  public readonly getAppIconPath = (): string => this.getAssetPath(APP_ICON_FILE_NAME);

  public getApplicationRoot(): string {
    return path.resolve(this.dependencies.mainDirectory);
  }
}
