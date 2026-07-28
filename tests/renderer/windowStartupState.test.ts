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

  it('keeps the main loader until all three selected provider families settle', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/App.tsx'), 'utf8');

    assert.match(source, /isInitialProviderStartupPending\(\{/u);
    assert.match(source, /prettifyPending: isInitialPrettifyProviderLoading/u);
    assert.match(source, /translationConnection: translationConnectionState/u);
    assert.match(source, /translationSettingsPending: !hasLoadedInitialTranslationSettings/u);
    assert.match(source, /voicePending: isLoading/u);
    assert.match(source, /useWindowStartupReady\(isI18nReady && !providerStartupPending\)/u);
    assert.match(source, /if \(!isI18nReady \|\| providerStartupPending\) return <LoadingScreen \/>;/u);
    assert.match(source, /setTranslationConnectionState\(FAILED_INITIAL_TRANSLATION_CONNECTION_STATE\)/u);
  });

  it('clears the busy cursor after the startup content becomes ready', () => {
    const source = readFileSync(path.join(PROJECT_ROOT, 'src/renderer/WindowStartupGate.tsx'), 'utf8');

    assert.match(source, /document\.body\.dataset\.windowStartup = startupState/u);
  });
});
