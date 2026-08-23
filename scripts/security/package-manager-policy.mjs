export const CURRENT_COREPACK_VERSION = '0.35.0';
export const CURRENT_PACKAGE_MANAGER = 'npm@12.0.2';
export const HISTORICAL_SIZE_BASELINE_PACKAGE_MANAGER = 'npm@11.9.0';

const APPROVED_PACKAGE_MANAGERS = Object.freeze([CURRENT_PACKAGE_MANAGER, HISTORICAL_SIZE_BASELINE_PACKAGE_MANAGER]);

/** Resolves the current package-manager pin or one explicitly approved historical baseline. */
export function resolveApprovedPackageManager(requestedPackageManager = null) {
  const packageManager = requestedPackageManager ?? CURRENT_PACKAGE_MANAGER;
  if (!APPROVED_PACKAGE_MANAGERS.includes(packageManager)) {
    throw new Error('PACKAGE_MANAGER_UNAPPROVED');
  }
  return packageManager;
}

/** Verifies the current project manifest owns the expected npm and Corepack pins. */
export function verifyCurrentPackageManagerManifest(value) {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    value.packageManager !== CURRENT_PACKAGE_MANAGER ||
    typeof value.devDependencies !== 'object' ||
    value.devDependencies === null ||
    Array.isArray(value.devDependencies) ||
    value.devDependencies.corepack !== CURRENT_COREPACK_VERSION
  ) {
    throw new Error('PACKAGE_MANAGER_MANIFEST_INVALID');
  }
}
