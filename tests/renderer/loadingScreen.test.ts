import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import LoadingScreen from '@renderer/components/LoadingScreen';
import type { FirstLaunchStartupStage, FirstLaunchStartupStageState } from '@renderer/firstLaunchStartupState';
import { FIRST_LAUNCH_STARTUP_JOB_IDS } from '@shared/firstLaunchStartup';

function stage(
  id: FirstLaunchStartupStage['id'],
  state: FirstLaunchStartupStageState,
  progress: number | null,
): FirstLaunchStartupStage {
  return { id, progress, state };
}

describe('startup loading screen', () => {
  it('keeps generic initialization copy for callers outside startup', () => {
    const markup = renderToStaticMarkup(createElement(LoadingScreen));

    assert.match(markup, /Initializing\.\.\./u);
    assert.doesNotMatch(markup, /Preparing startup/u);
    assert.equal((markup.match(/role="status"/gu) ?? []).length, 1);
  });

  it('renders measured progress and simultaneous stages in a compact one-row startup card', () => {
    const markup = renderToStaticMarkup(
      createElement(LoadingScreen, {
        mode: 'startup',
        progress: 42,
        stages: [
          stage(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, 'completed', 100),
          stage(FIRST_LAUNCH_STARTUP_JOB_IDS.VoiceProvider, 'active', 50),
          stage(FIRST_LAUNCH_STARTUP_JOB_IDS.Translation, 'active', 33),
          stage(FIRST_LAUNCH_STARTUP_JOB_IDS.Prettify, 'waiting', 0),
        ],
      }),
    );

    assert.match(markup, /items-center justify-center/u);
    assert.match(markup, /data-slot="startup-stage-grid"/u);
    assert.match(markup, /max-w-\[592px\]/u);
    assert.match(markup, /p-3/u);
    assert.match(markup, /grid-cols-4/u);
    assert.match(markup, /gap-2/u);
    assert.match(markup, /data-progress-state="determinate"/u);
    assert.match(markup, /role="progressbar"/u);
    assert.match(markup, /aria-valuenow="42"/u);
    assert.match(markup, /Preparing Voice provider, Translation/u);
    assert.match(markup, /data-slot="startup-progress">42%/u);
    assert.equal((markup.match(/data-state="active"/gu) ?? []).length, 2);
    assert.match(markup, /data-stage-id="cloakbrowser"/u);
    assert.match(markup, /data-stage-id="voice-provider"/u);
    assert.match(markup, /data-stage-id="translation"/u);
    assert.match(markup, /data-stage-id="prettify"/u);
    assert.doesNotMatch(markup, /<ol/u);
  });

  it('uses indeterminate activity only without a measured aggregate', () => {
    const markup = renderToStaticMarkup(
      createElement(LoadingScreen, {
        mode: 'startup',
        progress: null,
        stages: [stage(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, 'active', null)],
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
        hasRetryableFailure: true,
        isRetryPending: true,
        mode: 'startup',
        onRetry: () => undefined,
        retryFailed: true,
        stages: [stage(FIRST_LAUNCH_STARTUP_JOB_IDS.CloakBrowser, 'failed', 0)],
      }),
    );

    assert.match(markup, /Could not retry startup preparation. Try again./u);
    assert.match(markup, /<button[^>]*disabled=""[^>]*>Retry/u);
    assert.match(markup, /data-slot="startup-status"[^>]*role="status"/u);
  });
});
