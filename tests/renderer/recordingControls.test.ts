import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesktopApiProvider } from '@renderer/DesktopApiProvider';
import MainToolbar from '@renderer/components/MainToolbar';
import RecordingControls from '@renderer/components/RecordingControls';
import { TooltipProvider } from '@renderer/components/ui/tooltip';
import { PROVIDER_CONNECTION_REASONS } from '@renderer/providerState';
import type { ElectronAPI } from '@renderer/types';

const EMPTY_DESKTOP_API = {} as ElectronAPI;
const PROJECT_ROOT = path.resolve(__dirname, '../..');

function renderWithDesktopApi(element: ReactElement): string {
  return renderToStaticMarkup(
    createElement(DesktopApiProvider, {
      api: EMPTY_DESKTOP_API,
      children: createElement(TooltipProvider, { children: element }),
    }),
  );
}

describe('unselected provider controls', () => {
  it('keeps the shared provider Select unselected without connection actions', () => {
    const markup = renderWithDesktopApi(
      createElement(MainToolbar, {
        activeProviderAuthType: null,
        activeProviderHasSettings: false,
        activeProviderId: null,
        activeProviderName: '',
        isLoggedIn: false,
        isLoggingIn: false,
        isProviderChangesLocked: false,
        isVoiceProviderSwitching: false,
        localWhisperPendingAction: null,
        localWhisperResidencyFailure: null,
        localWhisperResidencyFailureSequence: 0,
        localWhisperStatus: null,
        onLocalWhisperResidencyAction: () => undefined,
        onOpenAbout: () => undefined,
        onOpenAppSettings: () => undefined,
        onOpenHistory: () => undefined,
        onOpenProviderSettings: () => undefined,
        onProviderChange: () => undefined,
        onProviderLogin: () => undefined,
        providerConnectionFailureTooltip: '',
        providerConnectionReason: PROVIDER_CONNECTION_REASONS.SessionMissing,
        providers: [],
      }),
    );

    assert.match(markup, /command-dock-provider-trigger/u);
    assert.match(markup, /data-placeholder=""/u);
    assert.match(markup, /Select a provider to start recording\./u);
    assert.match(markup, /Provider:/u);
    assert.doesNotMatch(markup, /voice-provider-connection|command-dock-provider-action|provider-settings-shortcut/u);
  });

  it('disables recording before a provider is selected', () => {
    const markup = renderWithDesktopApi(
      createElement(RecordingControls, {
        onCancel: () => undefined,
        onPause: () => undefined,
        onResume: () => undefined,
        onStart: () => undefined,
        onStop: () => undefined,
        recordHotkey: 'F9',
        recordingDisabled: true,
        state: 'idle',
        status: null,
      }),
    );

    assert.match(markup, /command-dock-record-button[^>]*disabled=""/u);
  });

  it('keeps the disabled recording button visibly and behaviorally distinct', () => {
    const controls = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/components/RecordingControls.tsx'), 'utf8');
    const styles = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/styles/globals.css'), 'utf8');

    assert.match(controls, /disabled=\{recordingDisabled \|\| viewState\.primary\.disabled\}/u);
    assert.match(styles, /\.command-dock \.command-dock-record-button:not\(:disabled\):hover \{/u);
    assert.match(styles, /\.command-dock \.command-dock-record-button:disabled \{[\s\S]*?opacity: 0\.55;/u);
  });

  it('renders the Voice Provider settings control as a native disabled button while work is active', () => {
    const markup = renderWithDesktopApi(
      createElement(MainToolbar, {
        activeProviderAuthType: 'browserSession',
        activeProviderHasSettings: true,
        activeProviderId: 'chatgpt',
        activeProviderName: 'ChatGPT Web',
        isLoggedIn: true,
        isLoggingIn: false,
        isProviderChangesLocked: true,
        isVoiceProviderSwitching: false,
        localWhisperPendingAction: null,
        localWhisperResidencyFailure: null,
        localWhisperResidencyFailureSequence: 0,
        localWhisperStatus: null,
        onLocalWhisperResidencyAction: () => undefined,
        onOpenAbout: () => undefined,
        onOpenAppSettings: () => undefined,
        onOpenHistory: () => undefined,
        onOpenProviderSettings: () => undefined,
        onProviderChange: () => undefined,
        onProviderLogin: () => undefined,
        providerConnectionFailureTooltip: '',
        providerConnectionReason: PROVIDER_CONNECTION_REASONS.BrowserReady,
        providers: [
          {
            authType: 'browserSession',
            category: 'web',
            hasSettings: true,
            id: 'chatgpt',
            name: 'ChatGPT Web',
            transcriptionMode: 'batch',
          },
        ],
      }),
    );

    assert.match(
      markup,
      /command-dock-provider-settings-shortcut[^>]*disabled=""|disabled=""[^>]*command-dock-provider-settings-shortcut/u,
    );
  });
});
