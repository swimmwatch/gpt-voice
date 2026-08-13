import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesktopApiProvider } from '@renderer/DesktopApiProvider';
import RecordingControls from '@renderer/components/RecordingControls';
import type { ProviderHotkeyContextualAction } from '@renderer/useProviderHotkeyHomeIntegration';
import type { ElectronAPI } from '@renderer/types';

const EMPTY_DESKTOP_API = {} as ElectronAPI;
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RECORDING_ACTIONS: readonly ProviderHotkeyContextualAction[] = [
  {
    action: 'pause',
    available: true,
    busy: false,
    hotkey: 'F9',
    icon: 'pause',
    label: 'Pause recording',
    onActivate: () => undefined,
    provider: 'voice',
  },
  {
    action: 'stop',
    available: true,
    busy: false,
    hotkey: 'F10',
    icon: 'stop',
    label: 'Stop recording',
    onActivate: () => undefined,
    provider: 'voice',
  },
  {
    action: 'cancel',
    available: true,
    busy: false,
    hotkey: 'Escape',
    icon: 'cancel',
    label: 'Cancel recording',
    onActivate: () => undefined,
    provider: 'voice',
  },
];

function renderWithDesktopApi(element: ReactElement): string {
  return renderToStaticMarkup(createElement(DesktopApiProvider, { api: EMPTY_DESKTOP_API, children: element }));
}

describe('recording controls', () => {
  it('renders only compact contextual tiles for the supplied actions, with no primary command', () => {
    const markup = renderWithDesktopApi(
      createElement(RecordingControls, {
        contextualActions: RECORDING_ACTIONS,
        state: 'recording',
        status: null,
      }),
    );

    assert.match(markup, /data-slot="recording-contextual-actions"/u);
    assert.match(markup, /aria-label="Pause recording: F9"/u);
    assert.match(markup, /aria-label="Stop recording: F10"/u);
    assert.match(markup, /aria-label="Cancel recording: Escape"/u);
    assert.equal((markup.match(/type="button"/gu) ?? []).length, 3);
    assert.doesNotMatch(markup, /command-dock-record-button|Start recording|Busy/u);
  });

  it('uses native button activation, compact styling, and deterministic focus recovery for disappearing tiles', () => {
    const controls = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/components/RecordingControls.tsx'), 'utf8');
    const tile = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/components/ContextualActionTile.tsx'), 'utf8');
    const styles = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/styles/contextualActionTile.css'), 'utf8');

    assert.match(tile, /type="button"/u);
    assert.match(tile, /onClick=\{action\.onActivate\}/u);
    assert.match(tile, /data-contextual-action-id/u);
    assert.match(controls, /footerRef\.current\?\.focus\(\)/u);
    assert.match(styles, /\.command-dock-contextual-action:not\(:disabled\):hover/u);
    assert.match(styles, /\.command-dock-contextual-action:disabled/u);
  });
});
