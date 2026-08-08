import assert from 'node:assert/strict';
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
});
