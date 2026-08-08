import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import LoadingScreen from '@renderer/components/LoadingScreen';
import { FIRST_LAUNCH_STARTUP_JOB_IDS } from '@shared/firstLaunchStartup';

describe('startup loading screen', () => {
  it('keeps generic initialization copy for callers outside startup', () => {
    const markup = renderToStaticMarkup(createElement(LoadingScreen));

    assert.match(markup, /Initializing\.\.\./u);
    assert.doesNotMatch(markup, /Preparing startup/u);
    assert.equal((markup.match(/role="status"/gu) ?? []).length, 1);
  });

  it('renders centered determinate progress and bounded localized concurrent work', () => {
    const markup = renderToStaticMarkup(
      createElement(LoadingScreen, {
        activeJobIds: [
          FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser,
          FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider,
          FIRST_LAUNCH_STARTUP_JOB_IDS.Translation,
        ],
        mode: 'startup',
        progress: 42,
      }),
    );

    assert.match(markup, /items-center justify-center/u);
    assert.match(markup, /flex-col/u);
    assert.match(markup, /data-progress-state="determinate"/u);
    assert.match(markup, /role="progressbar"/u);
    assert.match(markup, /aria-valuenow="42"/u);
    assert.match(markup, /Preparing CloakBrowser, Voice provider and 1 more/u);
    assert.match(markup, /data-slot="startup-progress">42%/u);
    assert.doesNotMatch(markup, /Preparing.*Translation/u);
  });

  it('uses the shared indeterminate spinner only without a measured aggregate', () => {
    const markup = renderToStaticMarkup(
      createElement(LoadingScreen, {
        activeJobIds: [FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser],
        mode: 'startup',
        progress: null,
      }),
    );

    assert.match(markup, /data-progress-state="indeterminate"/u);
    assert.match(markup, /lucide-loader-circle/u);
    assert.doesNotMatch(markup, /role="progressbar"/u);
    assert.equal((markup.match(/role="status"/gu) ?? []).length, 1);
  });

  it('shows a safe, keyboard-accessible Retry action and disables it while retry is pending', () => {
    const markup = renderToStaticMarkup(
      createElement(LoadingScreen, {
        activeJobIds: [],
        hasRetryableFailure: true,
        isRetryPending: true,
        mode: 'startup',
        onRetry: () => undefined,
        retryFailed: true,
      }),
    );

    assert.match(markup, /Could not retry startup preparation. Try again./u);
    assert.match(markup, /<button[^>]*disabled=""[^>]*>Retry/u);
    assert.match(markup, /data-slot="startup-status"[^>]*role="status"/u);
  });
});
