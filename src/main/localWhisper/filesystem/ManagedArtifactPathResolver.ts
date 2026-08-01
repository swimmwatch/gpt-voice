import * as path from 'node:path';

import { ManagedArtifactPathResolutionError } from './ManagedArtifactPathResolutionError';

export { ManagedArtifactPathResolutionError } from './ManagedArtifactPathResolutionError';

export const LOCAL_WHISPER_CANONICAL_APP_ID = 'com.swimmwatch.gptvoice';
export const LOCAL_WHISPER_STORAGE_DIRECTORY_NAME = 'local-whisper';

const SANITIZED_STORAGE_LABEL = 'Local Whisper managed storage';

export type ManagedArtifactRootResolution =
  | {
      readonly availability: 'available';
      readonly baseDirectory: string;
      readonly managedRoot: string;
      readonly platform: 'linux' | 'win32';
      readonly sanitizedLabel: typeof SANITIZED_STORAGE_LABEL;
    }
  | {
      readonly availability: 'planned';
      readonly code: 'PLANNED_UNAVAILABLE';
      readonly platform: 'darwin';
      readonly sanitizedLabel: typeof SANITIZED_STORAGE_LABEL;
    }
  | {
      readonly availability: 'unsupported';
      readonly code: 'UNSUPPORTED_PLATFORM';
      readonly platform: NodeJS.Platform;
      readonly sanitizedLabel: typeof SANITIZED_STORAGE_LABEL;
    };

export interface ManagedArtifactPathResolverDependencies {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly homeDirectory: () => string;
  readonly platform: NodeJS.Platform;
}

function isUsableAbsolutePath(candidate: string, platformPath: typeof path.posix): boolean {
  if (!candidate || !platformPath.isAbsolute(candidate)) return false;
  const normalized = platformPath.normalize(candidate);
  const root = platformPath.parse(normalized).root;
  return normalized !== root && !normalized.includes('\0');
}

/** Resolves the fixed, main-owned, non-roaming Local Whisper data root without creating it. */
export class ManagedArtifactPathResolver {
  public constructor(private readonly dependencies: ManagedArtifactPathResolverDependencies) {}

  public resolve(): ManagedArtifactRootResolution {
    if (this.dependencies.platform === 'darwin') {
      return Object.freeze({
        availability: 'planned',
        code: 'PLANNED_UNAVAILABLE',
        platform: 'darwin',
        sanitizedLabel: SANITIZED_STORAGE_LABEL,
      });
    }
    if (this.dependencies.platform !== 'linux' && this.dependencies.platform !== 'win32') {
      return Object.freeze({
        availability: 'unsupported',
        code: 'UNSUPPORTED_PLATFORM',
        platform: this.dependencies.platform,
        sanitizedLabel: SANITIZED_STORAGE_LABEL,
      });
    }

    const platformPath = this.dependencies.platform === 'win32' ? path.win32 : path.posix;
    const configuredBase =
      this.dependencies.platform === 'win32'
        ? this.dependencies.environment.LOCALAPPDATA
        : this.dependencies.environment.XDG_DATA_HOME;
    if (this.dependencies.platform === 'win32' && !configuredBase) {
      throw new ManagedArtifactPathResolutionError('INVALID_STORAGE_BASE');
    }
    const home = configuredBase ? '' : this.dependencies.homeDirectory();
    if (!configuredBase && !isUsableAbsolutePath(home, platformPath)) {
      throw new ManagedArtifactPathResolutionError('INVALID_STORAGE_BASE');
    }
    const fallbackBase = this.dependencies.platform === 'win32' ? '' : path.posix.join(home, '.local', 'share');
    const baseDirectory = configuredBase || fallbackBase;
    if (!isUsableAbsolutePath(baseDirectory, platformPath)) {
      throw new ManagedArtifactPathResolutionError('INVALID_STORAGE_BASE');
    }
    const managedRoot = platformPath.join(
      platformPath.normalize(baseDirectory),
      LOCAL_WHISPER_CANONICAL_APP_ID,
      LOCAL_WHISPER_STORAGE_DIRECTORY_NAME,
    );
    return Object.freeze({
      availability: 'available',
      baseDirectory: platformPath.normalize(baseDirectory),
      managedRoot,
      platform: this.dependencies.platform,
      sanitizedLabel: SANITIZED_STORAGE_LABEL,
    });
  }
}
