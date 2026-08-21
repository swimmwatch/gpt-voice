export function createLinuxAppImageCleanupEnvironment(
  sourceEnvironment: NodeJS.ProcessEnv,
  appImage: string,
  cleanupDataHome: string,
): Readonly<Record<string, string>>;
