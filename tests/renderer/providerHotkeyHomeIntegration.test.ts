import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('provider hotkey home integration contract', () => {
  it('reconciles every authoritative snapshot and keeps incomplete data fail-closed', () => {
    const integration = readProjectFile('src/renderer/useProviderHotkeyHomeIntegration.ts');

    assert.match(integration, /onMainInteractionLockChanged\(acceptSnapshot\)/u);
    assert.match(
      integration,
      /getMainInteractionLocked\(\)[\s\S]*?\.then\(acceptSnapshot\)[\s\S]*?\.catch\(\(\) => undefined\)/u,
    );
    assert.match(integration, /onProviderHomeActionStateChanged\(\(nextState\)/u);
    assert.match(integration, /getProviderHomeActionState\(\)[\s\S]*?eventVersion === queryEventVersion/u);
    assert.match(integration, /onHotkeyRuntimeStateChanged\(acceptRuntimeState\)/u);
    assert.match(
      integration,
      /getHotkeyRuntimeState\(\)[\s\S]*?\.then\(acceptRuntimeState\)[\s\S]*?\.catch\(\(\) => undefined\)/u,
    );
    assert.match(integration, /state\.revision < latestRevision/u);
    assert.match(integration, /prettifyEnabled: providerHomeActionState\?\.settings\.prettifyEnabled \?\? false/u);
    assert.match(integration, /translationEnabled: providerHomeActionState\?\.settings\.translateEnabled \?\? false/u);
    assert.match(integration, /textActionCancellability: providerHomeActionState !== null/u);
    assert.match(integration, /textActionEnablement: providerHomeActionState !== null/u);
    assert.match(integration, /textActionOwner: providerHomeActionState !== null/u);
  });

  it('maps the Voice key to Start, Pause, and Resume only', () => {
    const integration = readProjectFile('src/renderer/useProviderHotkeyHomeIntegration.ts');
    const voiceActivation = integration.slice(
      integration.indexOf('const activateVoice'),
      integration.indexOf('const dispatchProviderHomeAction'),
    );

    assert.match(voiceActivation, /case 'idle':[\s\S]*?onVoiceStart\(\)/u);
    assert.match(voiceActivation, /case 'recording':[\s\S]*?onVoicePause\(\)/u);
    assert.match(voiceActivation, /case 'paused':[\s\S]*?onVoiceResume\(\)/u);
    assert.doesNotMatch(voiceActivation, /onVoiceStop|runProviderHomeAction/u);
    assert.match(integration, /recordingState === 'recording'[\s\S]*?'recording\.pause'/u);
    assert.match(integration, /recordingState === 'paused'[\s\S]*?'recording\.resume'/u);
  });

  it('routes idle Voice activation through the authoritative recording-start request', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const integration = readProjectFile('src/renderer/useProviderHotkeyHomeIntegration.ts');

    assert.match(integration, /voiceProviderAvailable: activeProviderId !== null && isVoiceProviderReady/u);
    assert.match(app, /onVoiceStart: \(\) => \{[\s\S]*?desktopApi\.requestRecordingStart\(\)/u);
    assert.match(
      app,
      /onRecordingStartRejected\(\(\) => \{[\s\S]*?providerStatus\('voice', 'error\.selectedProviderNotReady'\)/u,
    );
    assert.doesNotMatch(app, /onVoiceStart: \(\) => void startRecording\(\)/u);
  });

  it('dispatches only bounded normal provider starts and rejects repeated or locked activation', () => {
    const integration = readProjectFile('src/renderer/useProviderHotkeyHomeIntegration.ts');
    const dispatch = integration.slice(
      integration.indexOf('const dispatchProviderHomeAction'),
      integration.indexOf('const activateProviderHomeAction'),
    );
    const providerActivation = integration.slice(
      integration.indexOf('const activateProviderHomeAction'),
      integration.indexOf('const activateTextActionCancel'),
    );

    assert.match(dispatch, /if \(pendingProviderHomeActionRef\.current !== null\) return;/u);
    assert.match(dispatch, /runProviderHomeAction\(\{ action, provider \}\)/u);
    assert.match(dispatch, /pendingProviderHomeActionRef\.current = null/u);
    assert.match(providerActivation, /presentation\.eligibility\[provider\]\.locked/u);
    assert.match(providerActivation, /dispatchProviderHomeAction\('start', provider\)/u);
    assert.match(integration, /activateProviderHomeAction\('prettify'\)/u);
    assert.match(integration, /activateProviderHomeAction\('translation'\)/u);
    assert.doesNotMatch(providerActivation, /stop|prettifyQuick/u);
  });

  it('prepares localized, provider-specific contextual actions for the recording footer', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const integration = readProjectFile('src/renderer/useProviderHotkeyHomeIntegration.ts');

    assert.doesNotMatch(integration, /DEFAULT_[A-Z_]+_HOTKEY/u);
    assert.match(
      integration,
      /hotkey: stopHotkey,[\s\S]*?label: translate\('recording\.stop'\),[\s\S]*?onActivate: onVoiceStop/u,
    );
    assert.match(
      integration,
      /hotkey: cancelHotkey,[\s\S]*?label: translate\('recording\.cancel'\),[\s\S]*?onActivate: onVoiceCancel/u,
    );
    assert.match(integration, /dispatchProviderHomeAction\('cancel', provider\)/u);
    assert.match(integration, /presentation\.contextualActions\.some\(/u);
    assert.match(app, /contextualActions=\{providerHotkeyIntegration\.contextualActions\}/u);
  });

  it('uses one unchanged HotkeyActionButton in each existing provider-row seam', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const toolbar = readProjectFile('src/renderer/components/MainToolbar.tsx');
    const prettify = readProjectFile('src/renderer/components/MainPrettifyProviderBand.tsx');
    const translation = readProjectFile('src/renderer/components/TranslateSection.tsx');

    assert.equal((app.match(/<HotkeyActionButton/gu) ?? []).length, 3);
    assert.match(app, /<MainToolbar[\s\S]*?actionControl=\{[\s\S]*?voiceActionLabel/u);
    assert.match(app, /<MainPrettifyProviderBand[\s\S]*?actionControl=\{[\s\S]*?prettifyHotkey/u);
    assert.match(app, /<TranslateSection[\s\S]*?actionControl=\{[\s\S]*?translateHotkey/u);
    assert.match(toolbar, /actionControl\?: ReactNode/u);
    assert.match(toolbar, /\{actionControl\}[\s\S]*?<div[\s\S]*?command-dock-provider-controls/u);
    assert.match(prettify, /actionControl\?: ReactNode/u);
    assert.match(prettify, /\{actionControl\}[\s\S]*?<div[\s\S]*?command-dock-prettify-controls/u);
    assert.match(translation, /actionControl\?: ReactNode/u);
    assert.match(translation, /\{actionControl\}[\s\S]*?<ProviderStatusIndicator/u);
  });
});
