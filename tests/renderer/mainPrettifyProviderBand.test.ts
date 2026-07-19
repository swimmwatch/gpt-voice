import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('main Prettify provider band contract', () => {
  it('always renders the complete provider selector and accessible settings shortcut', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const band = readProjectFile('src/renderer/components/MainPrettifyProviderBand.tsx');
    const styles = readProjectFile('src/renderer/styles/globals.css');

    assert.match(app, /<MainPrettifyProviderBand\b/u);
    assert.doesNotMatch(app, /\{ollamaModelControl && \(\s*<MainPrettifyProviderBand/u);
    assert.doesNotMatch(app, /prettifyEnabled[\s\S]{0,120}<MainPrettifyProviderBand/u);
    for (const providerId of ['ollama', 'vllm', 'claude-cli', 'codex-cli']) {
      assert.equal(band.includes(`'${providerId}'`), true, providerId);
    }
    assert.match(band, /<SelectSeparator/u);
    assert.match(band, /aria-label=\{t\('prettify\.provider'\)\}/u);
    assert.match(band, /aria-label=\{providerSettingsLabel\}/u);
    assert.match(band, /<Settings aria-hidden="true"/u);
    assert.match(styles, /\.command-dock-prettify-band \{[\s\S]*?min-height: 60px;[\s\S]*?flex: 0 0 60px;/u);
  });

  it('persists only the provider ID and keeps non-Ollama selection free of availability probes', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const refresh = app.slice(
      app.indexOf('const refreshOllamaModelState'),
      app.indexOf('const {', app.indexOf('const refreshOllamaModelState')),
    );
    const handler = app.slice(
      app.indexOf('const handlePrettifyProviderChange'),
      app.indexOf('const handleOllamaModelAction'),
    );

    assert.match(handler, /setPrettifySettings\(\{ providerId \}\)/u);
    assert.match(handler, /pendingRequestId !== null/u);
    assert.match(handler, /type: 'begin'/u);
    assert.match(handler, /type: 'rejected'/u);
    assert.doesNotMatch(handler, /listPrettifyModels|loadPrettifyModel|prettifyText|auth/u);
    assert.match(refresh, /settings\.providerId !== 'ollama'/u);
    assert.match(refresh, /listPrettifyModels\('ollama', settings\)/u);
  });

  it('opens App Settings directly on Prettify and keeps Ollama as the only main-band model action', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const band = readProjectFile('src/renderer/components/MainPrettifyProviderBand.tsx');

    assert.match(app, /openAppSettingsWindow\('prettify'\)/u);
    assert.match(band, /viewState\.ollamaControl &&/u);
    assert.match(band, /onClick=\{onModelAction\}/u);
  });

  it('keeps the band at 60 pixels inside the fixed 460 by 420 main window', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const windowSource = readProjectFile('src/main/window.ts');

    assert.match(windowSource, /MAIN_WINDOW_CONTENT_WIDTH = 460/u);
    assert.match(windowSource, /MAIN_WINDOW_CONTENT_HEIGHT = 420/u);
    assert.match(windowSource, /resizable: false/u);
    assert.doesNotMatch(styles, /command-dock-prettify-band[\s\S]{0,120}(?:min-height|flex-basis): 78px/u);
    assert.match(styles, /@media \(max-width: 439px\)[\s\S]*?command-dock-prettify-summary[\s\S]*?display: none;/u);
  });

  it('keeps compact provider copy on one line', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const english = readProjectFile('src/main/i18n/en.ts');

    assert.match(english, /'mainDock\.prettifyProviderLabel': 'Prettify'/u);
    assert.match(english, /'prettify\.provider\.codexCli': 'Codex CLI'/u);
    assert.doesNotMatch(english, /'prettify\.provider\.codexCli':[^\n]*Experimental/u);
    assert.match(styles, /\.command-dock \.command-dock-prettify-provider-trigger \{[\s\S]*?white-space: nowrap;/u);
    assert.match(
      styles,
      /\.command-dock-prettify-provider-field > \.command-dock-field-label,[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/u,
    );
  });

  it('aligns the Prettify icon, provider text, and selector chevron with the Voice provider row', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');

    assert.match(styles, /\.command-dock-provider-band \{[\s\S]*?padding: 0 11px 0 16px;/u);
    assert.match(styles, /\.command-dock-provider-field \{[\s\S]*?margin-left: 16px;/u);
    assert.match(
      styles,
      /\.command-dock-prettify-layout \{[\s\S]*?padding: 0 11px 0 16px;[\s\S]*?gap: 8px;[\s\S]*?grid-template-columns: 22px 147px/u,
    );
    assert.match(styles, /\.command-dock-prettify-provider-field \{[\s\S]*?padding-left: 8px;/u);
    assert.match(styles, /\.command-dock \.command-dock-provider-trigger \{[\s\S]*?width: 139px;/u);
    assert.match(styles, /\.command-dock \.command-dock-prettify-provider-trigger \{[\s\S]*?width: 139px;/u);
  });
});
