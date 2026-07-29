/* eslint-disable max-classes-per-file -- the factory and its private lazy logger views form one adapter. */
import type * as fs from 'node:fs';
import * as path from 'node:path';

export interface ScopedLogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface RootLogger extends ScopedLogger {
  readonly errorHandler: {
    startCatching(): void;
  };
  initialize(): void;
}

export interface ElectronLogRuntime extends RootLogger {
  readonly transports: {
    readonly file: {
      getFile(): {
        readonly path: string;
      };
      level: string;
    };
    readonly console: {
      level: string;
    };
  };
  scope(scope: string): ScopedLogger;
}

export interface LoggerFactoryDependencies {
  readonly fileSystem: {
    existsSync(filePath: fs.PathLike): boolean;
    readFileSync(filePath: fs.PathOrFileDescriptor, encoding: 'utf8'): string;
  };
  readonly loadModule: () => unknown;
}

export interface RetainedMainLog {
  readonly contents: string;
  readonly generation: 'rotated' | 'current';
}

export interface MainLogFileAccessor {
  readRetainedLogs(): readonly RetainedMainLog[];
}

const FILE_LOG_LEVEL = 'info';
const CONSOLE_LOG_LEVEL = 'debug';
const NOOP = (): void => undefined;
const NOOP_LOGGER: ScopedLogger = Object.freeze({
  debug: NOOP,
  info: NOOP,
  warn: NOOP,
  error: NOOP,
});
const NOOP_ROOT_LOGGER: RootLogger = Object.freeze({
  ...NOOP_LOGGER,
  initialize: NOOP,
  errorHandler: Object.freeze({
    startCatching: NOOP,
  }),
});

function normalizeElectronLogModule(moduleValue: unknown): ElectronLogRuntime {
  const maybeDefault = moduleValue as { default?: unknown };
  return (maybeDefault.default ?? moduleValue) as ElectronLogRuntime;
}

/** Holds the lazy module result shared by one factory's logger views. */
class LoggerRuntimeState {
  private electronLog: ElectronLogRuntime | null | undefined;

  public constructor(private readonly dependencies: LoggerFactoryDependencies) {}

  public getScopedLogger(scope: string): ScopedLogger {
    return this.loadElectronLog()?.scope(scope) ?? NOOP_LOGGER;
  }

  public getRootLogger(): RootLogger {
    return this.loadElectronLog() ?? NOOP_ROOT_LOGGER;
  }

  public getMainLogFilePath(): string | null {
    const runtime = this.loadElectronLog();
    if (!runtime) return null;
    const filePath = runtime.transports.file.getFile().path;
    return typeof filePath === 'string' && path.isAbsolute(filePath) ? filePath : null;
  }

  private loadElectronLog(): ElectronLogRuntime | null {
    if (this.electronLog !== undefined) return this.electronLog;

    try {
      const loaded = normalizeElectronLogModule(this.dependencies.loadModule());
      loaded.transports.file.level = FILE_LOG_LEVEL;
      loaded.transports.console.level = CONSOLE_LOG_LEVEL;
      this.electronLog = loaded;
    } catch {
      this.electronLog = null;
    }

    return this.electronLog;
  }
}

/** Reads only the retained main log generations in deterministic oldest-first order. */
class ElectronMainLogFileAccessor implements MainLogFileAccessor {
  public constructor(
    private readonly state: LoggerRuntimeState,
    private readonly fileSystem: LoggerFactoryDependencies['fileSystem'],
  ) {}

  public readRetainedLogs(): readonly RetainedMainLog[] {
    const activePath = this.state.getMainLogFilePath();
    if (!activePath) return [];
    const parsed = path.parse(activePath);
    const candidates = [
      {
        filePath: path.join(parsed.dir, `${parsed.name}.old${parsed.ext}`),
        generation: 'rotated' as const,
      },
      { filePath: activePath, generation: 'current' as const },
    ];
    const retainedLogs: RetainedMainLog[] = [];
    for (const candidate of candidates) {
      if (!this.fileSystem.existsSync(candidate.filePath)) continue;
      retainedLogs.push({
        contents: this.fileSystem.readFileSync(candidate.filePath, 'utf8'),
        generation: candidate.generation,
      });
    }
    return Object.freeze(retainedLogs);
  }
}

/** Defers scoped logger resolution until an actual log call occurs. */
class LazyScopedLogger implements ScopedLogger {
  public constructor(
    private readonly state: LoggerRuntimeState,
    private readonly scope: string,
  ) {}

  public debug(...args: unknown[]): void {
    this.state.getScopedLogger(this.scope).debug(...args);
  }

  public info(...args: unknown[]): void {
    this.state.getScopedLogger(this.scope).info(...args);
  }

  public warn(...args: unknown[]): void {
    this.state.getScopedLogger(this.scope).warn(...args);
  }

  public error(...args: unknown[]): void {
    this.state.getScopedLogger(this.scope).error(...args);
  }
}

/** Defers root logger resolution until startup or an actual log call occurs. */
class LazyRootLogger implements RootLogger {
  public readonly errorHandler = {
    startCatching: (): void => this.state.getRootLogger().errorHandler.startCatching(),
  };

  public constructor(private readonly state: LoggerRuntimeState) {}

  public initialize(): void {
    this.state.getRootLogger().initialize();
  }

  public debug(...args: unknown[]): void {
    this.state.getRootLogger().debug(...args);
  }

  public info(...args: unknown[]): void {
    this.state.getRootLogger().info(...args);
  }

  public warn(...args: unknown[]): void {
    this.state.getRootLogger().warn(...args);
  }

  public error(...args: unknown[]): void {
    this.state.getRootLogger().error(...args);
  }
}

/** Owns one isolated lazy electron-log runtime and its stable scoped logger views. */
export class LoggerFactory {
  private readonly mainLogAccessor: MainLogFileAccessor;
  private readonly rootLogger: RootLogger;
  private readonly scopedLoggers = new Map<string, ScopedLogger>();
  private readonly state: LoggerRuntimeState;

  public constructor(dependencies: LoggerFactoryDependencies) {
    this.state = new LoggerRuntimeState(dependencies);
    this.rootLogger = new LazyRootLogger(this.state);
    this.mainLogAccessor = new ElectronMainLogFileAccessor(this.state, dependencies.fileSystem);
  }

  public getLogger(scope: string): ScopedLogger {
    const existing = this.scopedLoggers.get(scope);
    if (existing) return existing;

    const logger = new LazyScopedLogger(this.state, scope);
    this.scopedLoggers.set(scope, logger);
    return logger;
  }

  public getRootLogger(): RootLogger {
    return this.rootLogger;
  }

  public getMainLogFileAccessor(): MainLogFileAccessor {
    return this.mainLogAccessor;
  }
}
