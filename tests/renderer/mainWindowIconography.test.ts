import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readRendererSource(filename: string): string {
  return readFileSync(path.join(PROJECT_ROOT, 'src/renderer', filename), 'utf8');
}

describe('main window iconography', () => {
  it('uses a microphone for the voice provider and a brain circuit for the Prettify provider', () => {
    const toolbar = readRendererSource('components/MainToolbar.tsx');
    const prettifyBand = readRendererSource('components/MainPrettifyProviderBand.tsx');

    assert.match(toolbar, /\bMic\b/u);
    assert.match(toolbar, /<Mic\b/u);
    assert.doesNotMatch(toolbar, /\bGlobe\b/u);
    assert.match(prettifyBand, /\bBrainCircuit\b/u);
    assert.match(prettifyBand, /<BrainCircuit\b/u);
    assert.doesNotMatch(prettifyBand, /\bBox\b/u);
  });

  it('renders provider settings as a conditional gear and connected state as passive status', () => {
    const toolbar = readRendererSource('components/MainToolbar.tsx');
    const styles = readRendererSource('styles/globals.css');

    assert.match(toolbar, /activeProviderHasSettings &&/u);
    assert.match(toolbar, /command-dock-provider-settings-shortcut/u);
    assert.match(toolbar, /groupProvidersByCategory/u);
    assert.match(toolbar, /<SelectSeparator/u);
    assert.match(toolbar, /<Settings aria-hidden="true"/u);
    assert.match(toolbar, /className="command-dock-provider-state command-dock-provider-state-success" role="status"/u);
    assert.doesNotMatch(toolbar, /command-dock-provider-state[^>]+onClick=/u);
    assert.doesNotMatch(toolbar, /\bWrench\b/u);
    assert.match(
      styles,
      /\.command-dock-provider-controls \{[\s\S]*?width: 125px;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 37px;/u,
    );
    assert.match(styles, /\.command-dock-provider-settings-shortcut \{[\s\S]*?width: 37px;[\s\S]*?height: 34px;/u);
    assert.match(styles, /\.command-dock-provider-settings-shortcut svg \{[\s\S]*?width: 22px;[\s\S]*?height: 22px;/u);
  });

  it('keeps settings closing in native window controls instead of the footer', () => {
    const appSettings = readRendererSource('AppSettingsWindow.tsx');
    const footer = readRendererSource('components/settings/SettingsFooter.tsx');
    const providerSettings = readRendererSource('components/ProviderSettingsForm.tsx');
    const providerSettingsWindow = readRendererSource('ProviderSettingsWindow.tsx');

    assert.doesNotMatch(appSettings, /<SettingsFooter(?:(?!\/>).)*onClose=/su);
    assert.doesNotMatch(footer, /\bonClose\b/u);
    assert.doesNotMatch(footer, /common\.close/u);
    assert.doesNotMatch(providerSettings, /<Dialog[\s>]/u);
    assert.doesNotMatch(providerSettings, /common\.close/u);
    assert.match(providerSettingsWindow, /useWindowStartupReady\(isI18nReady && !isLoading\)/u);
    assert.match(providerSettingsWindow, /closeProviderSettings\(\)/u);
  });

  it('loads the About logo from the app asset protocol instead of a renderer import', () => {
    const aboutWindow = readRendererSource('AboutWindow.tsx');

    assert.match(aboutWindow, /APP_ICON_ASSET_PATH/u);
    assert.doesNotMatch(aboutWindow, /\.\.\/\.\.\/assets\/icon\.png/u);
  });
});
