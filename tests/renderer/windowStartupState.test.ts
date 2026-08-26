import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';
import { getWindowStartupState, WindowStartupState } from '@renderer/windowStartupState';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('window startup state', () => {
  it('keeps the startup shell visible until the window content is ready', () => {
    assert.equal(getWindowStartupState(false), WindowStartupState.Loading);
  });

  it('reveals the rendered window only after its initial state is stable', () => {
    assert.equal(getWindowStartupState(true), WindowStartupState.Ready);
  });

  it('uses each window route existing initial readiness signal before revealing content', () => {
    const sources = [
      'src/renderer/App.tsx',
      'src/renderer/AppSettingsWindow.tsx',
      'src/renderer/HistoryWindow.tsx',
      'src/renderer/AboutWindow.tsx',
    ].map((filePath) => readFileSync(path.join(PROJECT_ROOT, filePath), 'utf8'));

    for (const source of sources) {
      assert.match(source, /useWindowStartupReady\(/u);
    }
  });

  it('keeps the main loader until main and renderer startup work settles', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/App.tsx'), 'utf8');

    assert.match(source, /getFirstLaunchStartupPresentation\(firstLaunchStartupState, \{/u);
    assert.match(source, /prettifyPending: isInitialPrettifyProviderLoading/u);
    assert.match(source, /translationSettingsPending: !hasLoadedInitialTranslationSettings/u);
    assert.doesNotMatch(source, /translationConnection: translationConnectionState/u);
    assert.match(source, /voicePending: isInitialVoiceProviderLoading/u);
    assert.doesNotMatch(source, /voicePending: isLoading[,\s]/u);
    assert.match(source, /onFirstLaunchStartupSnapshot\(acceptSnapshot\)/u);
    assert.match(source, /getFirstLaunchStartupSnapshot\(\)\s*\.then\(acceptSnapshot\)/u);
    assert.ok(
      source.indexOf('onFirstLaunchStartupSnapshot(acceptSnapshot)') <
        source.indexOf('getFirstLaunchStartupSnapshot()'),
    );
    assert.match(source, /useWindowStartupReady\(true\)/u);
    assert.doesNotMatch(source, /useWindowStartupReady\(isI18nReady/u);
    assert.match(source, /const STARTUP_COMPLETION_HOLD_MS = 500/u);
    assert.match(source, /const STARTUP_REVEAL_DURATION_MS = 180/u);
    assert.match(source, /useStartupReveal\(!isI18nReady \|\| firstLaunchStartupPresentation\.isPending\)/u);
    assert.match(source, /if \(!isI18nReady\)/u);
    assert.match(source, /if \(phase !== 'complete-hold'\) return undefined;/u);
    assert.match(source, /phase: 'prepared'[\s\S]*?STARTUP_COMPLETION_HOLD_MS/u);
    assert.match(source, /requestAnimationFrame\(\(\) => \{\s*secondAnimationFrame = window\.requestAnimationFrame/u);
    assert.match(source, /aria-hidden=\{startupRevealPhase === 'revealing' \|\| undefined\}/u);
    assert.match(source, /retryFirstLaunchStartup\(\)/u);
    assert.match(source, /setTranslationConnectionState\(FAILED_INITIAL_TRANSLATION_CONNECTION_STATE\)/u);
  });

  it('does not synchronously update the startup reveal state from an effect', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/App.tsx'), 'utf8');
    const revealHook = source.slice(
      source.indexOf('function useStartupReveal'),
      source.indexOf('/** Coordinates the main recording lifecycle'),
    );

    assert.match(
      revealHook,
      /if \(revealState\.isStartupPending !== isStartupPending\) \{\s*setRevealState\(createStartupRevealState\(isStartupPending\)\);\s*\}/u,
    );
    assert.doesNotMatch(revealHook, /useEffect\(\(\) => \{\s*if \(isStartupPending\)/u);
  });

  it('uses the compact loader-to-dock reveal and suppresses motion when requested', () => {
    const styles = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/styles/globals.css'), 'utf8');

    assert.match(
      styles,
      /\.main-startup-reveal \{\s*position: relative;\s*height: 100%;\s*min-height: 0;\s*overflow: hidden;/u,
    );
    assert.match(styles, /transform: translateY\(5px\) scale\(0\.99\);/u);
    assert.match(styles, /transform: translateY\(-4px\) scale\(0\.985\);/u);
    assert.match(
      styles,
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.main-startup-reveal > \[data-slot='main-window'\],[\s\S]*?transition: none;\s*transform: none;/u,
    );
  });

  it('clears the busy cursor after the startup content becomes ready', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/WindowStartupGate.tsx'), 'utf8');

    assert.match(source, /document\.body\.dataset\.windowStartup = startupState/u);
    assert.match(
      source,
      /loader\?\.setAttribute\('aria-hidden', String\(startupState === WindowStartupState\.Ready\)\)/u,
    );
  });

  it('subscribes to the main interaction lock before querying and makes the app root inert', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/App.tsx'), 'utf8');
    const integration = readFileSync(
      path.join(PROJECT_ROOT, 'src/renderer/useProviderHotkeyHomeIntegration.ts'),
      'utf8',
    );
    const subscription = integration.indexOf('onMainInteractionLockChanged');
    const query = integration.indexOf('getMainInteractionLocked');
    const mainRoot = source.slice(source.indexOf('<main'), source.indexOf('<MainToolbar'));

    assert.ok(subscription >= 0);
    assert.ok(query > subscription);
    assert.match(mainRoot, /aria-disabled=\{providerHotkeyIntegration\.isMainInteractionLocked\}/u);
    assert.match(
      mainRoot,
      /inert=\{providerHotkeyIntegration\.isMainInteractionLocked \|\| !isMainScreenInteractive\}/u,
    );
  });

  it('presents settings as an accessible blocking overlay without reloading the main window', () => {
    const app = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/App.tsx'), 'utf8');
    const overlay = readFileSync(
      path.join(PROJECT_ROOT, 'src/renderer/components/SettingsPresentationOverlay.tsx'),
      'utf8',
    );
    const styles = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/styles/globals.css'), 'utf8');
    const subscription = app.indexOf('onSettingsPresentationChanged');
    const query = app.indexOf('getSettingsPresentation');

    assert.ok(subscription >= 0);
    assert.ok(query > subscription);
    assert.match(app, /<SettingsPresentationOverlay[\s\S]*?presentation=\{settingsPresentation\}/u);
    assert.match(app, /desktopApi\.focusSettingsWindow\(\)/u);
    assert.match(overlay, /aria-modal="true"/u);
    assert.match(overlay, /role="dialog"/u);
    assert.match(overlay, /<Spinner active/u);
    assert.match(overlay, /t\('settings\.show'\)/u);
    assert.match(styles, /\.settings-presentation-overlay \{[\s\S]*?backdrop-filter: blur\(4px\);/u);
    assert.match(
      styles,
      /@supports not \(\(-webkit-backdrop-filter: blur\(1px\)\) or \(backdrop-filter: blur\(1px\)\)\)/u,
    );
  });
});
