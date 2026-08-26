export const CURRENT_COREPACK_VERSION: '0.35.0';
export const CURRENT_PACKAGE_MANAGER: 'npm@12.0.2';
export const HISTORICAL_SIZE_BASELINE_PACKAGE_MANAGER: 'npm@11.9.0';

export function resolveApprovedPackageManager(
  requestedPackageManager?: string | null,
): typeof CURRENT_PACKAGE_MANAGER | typeof HISTORICAL_SIZE_BASELINE_PACKAGE_MANAGER;

export function verifyCurrentPackageManagerManifest(value: unknown): void;
