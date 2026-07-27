import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  RendererLoggerProvider,
  useRendererLogger,
  type RendererLogger,
  type RendererLoggerFactory,
} from '@renderer/RendererLoggerProvider';

class RecordingRendererLoggerFactory implements RendererLoggerFactory {
  public readonly loggers: RendererLogger[] = [];
  public readonly scopes: string[] = [];

  public scope(scope: string): RendererLogger {
    const logger: RendererLogger = {
      debug: () => undefined,
      error: () => undefined,
      info: () => undefined,
      warn: () => undefined,
    };
    this.scopes.push(scope);
    this.loggers.push(logger);
    return logger;
  }
}

describe('RendererLoggerProvider', () => {
  it('resolves scoped loggers through each functional renderer root without cross-root state', () => {
    const firstFactory = new RecordingRendererLoggerFactory();
    const secondFactory = new RecordingRendererLoggerFactory();
    const firstObserved: RendererLogger[] = [];
    const secondObserved: RendererLogger[] = [];

    function FirstConsumer(): null {
      firstObserved.push(useRendererLogger('recording'));
      return null;
    }

    function SecondConsumer(): null {
      secondObserved.push(useRendererLogger('recording'));
      return null;
    }

    renderToStaticMarkup(
      createElement(RendererLoggerProvider, {
        factory: firstFactory,
        children: createElement('div', null, createElement(FirstConsumer), createElement(FirstConsumer)),
      }),
    );
    renderToStaticMarkup(
      createElement(RendererLoggerProvider, {
        factory: secondFactory,
        children: createElement(SecondConsumer),
      }),
    );

    assert.notEqual(firstObserved[0], firstObserved[1]);
    assert.notEqual(firstObserved[0], secondObserved[0]);
    assert.equal(
      firstObserved.every((logger) => firstFactory.loggers.includes(logger)),
      true,
    );
    assert.equal(
      secondObserved.every((logger) => secondFactory.loggers.includes(logger)),
      true,
    );
    assert.deepEqual(firstFactory.scopes, ['recording', 'recording']);
    assert.deepEqual(secondFactory.scopes, ['recording']);
  });
});
