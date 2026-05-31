import { createRequire } from 'node:module';

interface ScopedLogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

interface ElectronLogRuntime extends ScopedLogger {
  transports: {
    file: {
      level: string;
    };
    console: {
      level: string;
    };
  };
  scope(scope: string): ScopedLogger;
  initialize(): void;
  errorHandler: {
    startCatching(): void;
  };
}

const loadRuntimeModule = createRequire(__filename);
const noop = (): void => undefined;
const noopLogger: ScopedLogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

let electronLog: ElectronLogRuntime | null | undefined;

function normalizeElectronLogModule(moduleValue: unknown): ElectronLogRuntime {
  const maybeDefault = moduleValue as { default?: unknown };
  return (maybeDefault.default ?? moduleValue) as ElectronLogRuntime;
}

function loadElectronLog(): ElectronLogRuntime | null {
  if (electronLog !== undefined) {
    return electronLog;
  }

  try {
    const loaded = normalizeElectronLogModule(loadRuntimeModule('electron-log/main'));
    loaded.transports.file.level = 'info';
    loaded.transports.console.level = 'debug';
    electronLog = loaded;
  } catch {
    electronLog = null;
  }

  return electronLog;
}

function getScopedLogger(scope: string): ScopedLogger {
  return loadElectronLog()?.scope(scope) ?? noopLogger;
}

function getRootLogger(): ScopedLogger {
  return loadElectronLog() ?? noopLogger;
}

export function createLogger(scope: string): ScopedLogger {
  return {
    debug: (...args) => getScopedLogger(scope).debug(...args),
    info: (...args) => getScopedLogger(scope).info(...args),
    warn: (...args) => getScopedLogger(scope).warn(...args),
    error: (...args) => getScopedLogger(scope).error(...args),
  };
}

export default {
  debug: (...args: unknown[]) => getRootLogger().debug(...args),
  info: (...args: unknown[]) => getRootLogger().info(...args),
  warn: (...args: unknown[]) => getRootLogger().warn(...args),
  error: (...args: unknown[]) => getRootLogger().error(...args),
  initialize: () => loadElectronLog()?.initialize(),
  errorHandler: {
    startCatching: () => loadElectronLog()?.errorHandler.startCatching(),
  },
};
