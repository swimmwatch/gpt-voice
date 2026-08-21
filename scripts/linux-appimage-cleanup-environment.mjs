const GRAPHICAL_SESSION_ENVIRONMENT_KEYS = [
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'XAUTHORITY',
  'XDG_RUNTIME_DIR',
  'HOME',
];

/** Builds the minimal environment required by the packaged Linux cleanup smoke. */
export function createLinuxAppImageCleanupEnvironment(sourceEnvironment, appImage, cleanupDataHome) {
  const environment = {
    APPIMAGE: appImage,
    XDG_DATA_HOME: cleanupDataHome,
  };

  for (const key of GRAPHICAL_SESSION_ENVIRONMENT_KEYS) {
    const value = sourceEnvironment[key];
    if (typeof value === 'string' && value.length > 0) {
      environment[key] = value;
    }
  }

  return environment;
}
