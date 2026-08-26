import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesktopApiProvider } from '@renderer/DesktopApiProvider';
import RecordingControls from '@renderer/components/RecordingControls';
import type { ElectronAPI } from '@renderer/types';
import type { ProviderHotkeyContextualAction } from '@renderer/useProviderHotkeyHomeIntegration';

const EMPTY_DESKTOP_API = {} as ElectronAPI;

function createAction(
  provider: ProviderHotkeyContextualAction['provider'],
  action: ProviderHotkeyContextualAction['action'],
  label: string,
  hotkey: string,
): ProviderHotkeyContextualAction {
  return {
    action,
    available: true,
    busy: false,
    hotkey,
    icon: action,
    label,
    onActivate: () => undefined,
    provider,
  };
}

function render(actions: readonly ProviderHotkeyContextualAction[]): string {
  return renderToStaticMarkup(
    createElement(DesktopApiProvider, {
      api: EMPTY_DESKTOP_API,
      children: createElement(RecordingControls, { contextualActions: actions, state: 'recording', status: null }),
    }),
  );
}

describe('contextual provider actions', () => {
  it('renders the Voice recording matrix in descriptor order with no disabled placeholders', () => {
    const markup = render([
      createAction('voice', 'pause', 'Pause recording', 'F9'),
      createAction('voice', 'stop', 'Stop recording', 'F10'),
      createAction('voice', 'cancel', 'Cancel recording', 'Escape'),
    ]);

    assert.ok(markup.indexOf('Pause recording: F9') < markup.indexOf('Stop recording: F10'));
    assert.ok(markup.indexOf('Stop recording: F10') < markup.indexOf('Cancel recording: Escape'));
    assert.doesNotMatch(markup, /disabled=""/u);
  });

  it('renders provider-owned Prettify and Translation Cancel as the same compact native tile', () => {
    for (const provider of ['prettify', 'translation'] as const) {
      const markup = render([createAction(provider, 'cancel', 'Cancel', 'Escape')]);

      assert.match(markup, /command-dock-contextual-action/u);
      assert.match(markup, /aria-label="Cancel: Escape"/u);
      assert.match(markup, /type="button"/u);
    }
  });
});
