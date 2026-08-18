import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { LoggerFactory, type ElectronLogRuntime, type ScopedLogger } from '@main/logger';

interface TestLogEntry {
  readonly level: string;
  readonly scope: string;
  readonly values: readonly unknown[];
}

function createRuntime(entries: TestLogEntry[], logFilePath = '/logs/main.log'): ElectronLogRuntime {
  const scoped = new Map<string, ScopedLogger>();
  const createMethod =
    (scope: string, level: string) =>
    (...values: unknown[]): void => {
      entries.push({ level, scope, values });
    };

  return {
    debug: createMethod('root', 'debug'),
    error: createMethod('root', 'error'),
    errorHandler: { startCatching: () => undefined },
    info: createMethod('root', 'info'),
    initialize: () => undefined,
    scope: (scope) => {
      const existing = scoped.get(scope);
      if (existing) return existing;
      const logger = {
        debug: createMethod(scope, 'debug'),
        error: createMethod(scope, 'error'),
        info: createMethod(scope, 'info'),
        warn: createMethod(scope, 'warn'),
      };
      scoped.set(scope, logger);
      return logger;
    },
    transports: {
      console: { level: 'unset' },
      file: {
        getFile: () => ({ path: logFilePath }),
        level: 'unset',
      },
    },
    warn: createMethod('root', 'warn'),
  };
}

describe('LoggerFactory', () => {
  it('loads once, configures levels, and returns stable scoped loggers', () => {
    const entries: TestLogEntry[] = [];
    const runtime = createRuntime(entries);
    let loads = 0;
    const factory = new LoggerFactory({
      fileSystem: {
        existsSync: () => false,
        readFileSync: () => '',
      },
      loadModule: () => {
        loads += 1;
        return { default: runtime };
      },
    });

    const first = factory.getLogger('scope');
    const second = factory.getLogger('scope');
    assert.equal(loads, 0);
    first.info('event');

    assert.equal(first, second);
    assert.equal(factory.getRootLogger(), factory.getRootLogger());
    assert.equal(loads, 1);
    assert.equal(runtime.transports.file.level, 'info');
    assert.equal(runtime.transports.console.level, false);
    assert.deepEqual(entries, [{ level: 'info', scope: 'scope', values: ['event'] }]);
  });

  it('caches a fail-open no-op result without retrying the loader', () => {
    let loads = 0;
    const factory = new LoggerFactory({
      fileSystem: {
        existsSync: () => false,
        readFileSync: () => '',
      },
      loadModule: () => {
        loads += 1;
        throw new Error('unavailable');
      },
    });

    assert.doesNotThrow(() => {
      factory.getLogger('first').warn('private canary');
      factory.getLogger('second').error('private canary');
      factory.getRootLogger().initialize();
      factory.getRootLogger().errorHandler.startCatching();
    });
    assert.equal(loads, 1);
  });

  it('isolates module loading and logger state between factories', () => {
    let firstLoads = 0;
    let secondLoads = 0;
    const firstRuntime = createRuntime([]);
    const secondRuntime = createRuntime([]);
    const first = new LoggerFactory({
      fileSystem: {
        existsSync: () => false,
        readFileSync: () => '',
      },
      loadModule: () => {
        firstLoads += 1;
        return firstRuntime;
      },
    });
    const second = new LoggerFactory({
      fileSystem: {
        existsSync: () => false,
        readFileSync: () => '',
      },
      loadModule: () => {
        secondLoads += 1;
        return secondRuntime;
      },
    });

    const firstLogger = first.getLogger('shared');
    const secondLogger = second.getLogger('shared');
    assert.notEqual(firstLogger, secondLogger);
    firstLogger.info('first');
    secondLogger.info('second');
    assert.equal(firstLoads, 1);
    assert.equal(secondLoads, 1);
  });

  it('reads only current and rotated main logs in oldest-first order without exposing paths', () => {
    const reads: string[] = [];
    const currentLogPath = path.resolve('private', 'main.log');
    const rotatedLogPath = path.resolve('private', 'main.old.log');
    const factory = new LoggerFactory({
      fileSystem: {
        existsSync: (filePath) => [rotatedLogPath, currentLogPath].includes(String(filePath)),
        readFileSync: (filePath) => {
          reads.push(String(filePath));
          return String(filePath).includes('.old.') ? 'old contents' : 'current contents';
        },
      },
      loadModule: () => createRuntime([], currentLogPath),
    });

    assert.deepEqual(factory.getMainLogFileAccessor().readRetainedLogs(), [
      { contents: 'old contents', generation: 'rotated' },
      { contents: 'current contents', generation: 'current' },
    ]);
    assert.deepEqual(reads, [rotatedLogPath, currentLogPath]);
  });
});
