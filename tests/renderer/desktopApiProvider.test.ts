import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesktopApiProvider, useDesktopApi, useSelectOpenCoordinator } from '@renderer/DesktopApiProvider';
import type { ElectronAPI } from '@renderer/types';
import type { SelectOpenCoordinator } from '@renderer/selectOpenCoordinator';

const TEST_API = {
  getActiveProvider: async () => 'test-provider',
} as ElectronAPI;

describe('DesktopApiProvider', () => {
  it('injects the exact renderer API without mutating a window global', () => {
    let observedApi: ElectronAPI | null = null;

    function Consumer(): JSX.Element {
      observedApi = useDesktopApi();
      return createElement('span', null, 'ready');
    }

    const markup = renderToStaticMarkup(
      createElement(DesktopApiProvider, { api: TEST_API, children: createElement(Consumer) }),
    );

    assert.equal(markup, '<span>ready</span>');
    assert.equal(observedApi, TEST_API);
  });

  it('shares one mutable coordinator inside a window and isolates separate roots', () => {
    const firstRootCoordinators: SelectOpenCoordinator[] = [];
    const secondRootCoordinators: SelectOpenCoordinator[] = [];

    function FirstRootConsumer(): null {
      firstRootCoordinators.push(useSelectOpenCoordinator());
      return null;
    }

    function SecondRootConsumer(): null {
      secondRootCoordinators.push(useSelectOpenCoordinator());
      return null;
    }

    renderToStaticMarkup(
      createElement(DesktopApiProvider, {
        api: TEST_API,
        children: createElement('div', null, createElement(FirstRootConsumer), createElement(FirstRootConsumer)),
      }),
    );
    renderToStaticMarkup(
      createElement(DesktopApiProvider, {
        api: TEST_API,
        children: createElement(SecondRootConsumer),
      }),
    );

    assert.equal(firstRootCoordinators[0], firstRootCoordinators[1]);
    assert.notEqual(firstRootCoordinators[0], secondRootCoordinators[0]);
  });
});
