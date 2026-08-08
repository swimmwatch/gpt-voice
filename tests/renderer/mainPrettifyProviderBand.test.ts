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
    assert.match(
      styles,
      /\.command-dock \.command-dock-prettify-settings-shortcut \{[^}]*grid-column: 2;[^}]*grid-row: 1;[^}]*justify-self: end;/u,
    );
    assert.match(styles, /\.command-dock-prettify-band \{[\s\S]*?min-height: 60px;[\s\S]*?flex: 0 0 60px;/u);
    assert.match(styles, /\.command-dock \{[\s\S]*?overflow-y: auto;/u);
  });

  it('persists only the provider ID before checking the authoritative active provider', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const refresh = app.slice(
      app.indexOf('const refreshPrettifyProviderState'),
      app.indexOf('const {', app.indexOf('const refreshPrettifyProviderState')),
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
    assert.match(refresh, /isPrettifyCliProviderId\(settings\.providerId\)/u);
    assert.match(refresh, /const providerId = settings\.providerId/u);
    assert.match(refresh, /listPrettifyModels\(\s*providerId,\s*createPrettifyProviderSettingsInput\(settings\)/u);
    assert.match(refresh, /setPrettifyConnectionError/u);
  });

  it('uses the strict prompt-free provider DTO for main-window model operations', () => {
    const app = readProjectFile('src/renderer/App.tsx');

    assert.match(app, /const providerSettingsInput = createPrettifyProviderSettingsInput\(prettifySettings\)/u);
    assert.match(
      app,
      /desktopApi\.listPrettifyModels\(\s*providerId,\s*createPrettifyProviderSettingsInput\(settings\)/u,
    );
    assert.match(app, /desktopApi\.unloadPrettifyModel\('ollama', providerSettingsInput\)/u);
    assert.match(app, /desktopApi\.loadPrettifyModel\('ollama', providerSettingsInput\)/u);
  });

  it('opens App Settings directly on Prettify and keeps Ollama as the only main-band model action', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const band = readProjectFile('src/renderer/components/MainPrettifyProviderBand.tsx');
    const styles = readProjectFile('src/renderer/styles/globals.css');

    assert.match(app, /openAppSettingsWindow\('prettify'\)/u);
    assert.match(band, /viewState\.ollamaControl &&/u);
    assert.match(band, /onClick=\{onModelAction\}/u);
    assert.match(band, /className="command-dock-prettify-controls" data-has-model-action=\{hasModelAction\}/u);
    assert.match(
      band,
      /className="command-dock-prettify-model-action"[\s\S]*?size="icon"[\s\S]*?<Spinner[\s\S]*?active=\{isModelActionRunning\}[\s\S]*?viewState\.ollamaControl\.isLoaded[\s\S]*?<PowerOff aria-hidden="true"[\s\S]*?<HardDriveDownload aria-hidden="true"/u,
    );
    assert.doesNotMatch(band, /<span>\{isModelActionRunning \? t\('prettify\.loadingModel'\)/u);
    assert.match(
      styles,
      /\.command-dock-prettify-controls\[data-has-model-action='true'\] \{[^}]*grid-template-columns: minmax\(0, 1fr\) 37px 37px;/u,
    );
    assert.match(
      styles,
      /\.command-dock \.command-dock-prettify-model-action \{[^}]*width: 37px;[^}]*height: 34px;[^}]*grid-column: 2;/u,
    );
    assert.match(
      styles,
      /\.command-dock-prettify-controls\[data-has-model-action='true'\] \.command-dock-prettify-settings-shortcut \{[^}]*grid-column: 3;/u,
    );
  });

  it('keeps the band at 60 pixels inside the fixed 520 by 420 main window', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const windowSource = readProjectFile('src/main/window.ts');

    assert.match(windowSource, /MAIN_WINDOW_CONTENT_WIDTH = 520/u);
    assert.match(windowSource, /MAIN_WINDOW_CONTENT_HEIGHT = 420/u);
    assert.match(windowSource, /resizable: false/u);
    assert.doesNotMatch(styles, /command-dock-prettify-band[\s\S]{0,120}(?:min-height|flex-basis): 78px/u);
    assert.match(styles, /@media \(max-width: 439px\)[\s\S]*?command-dock-prettify-summary[\s\S]*?display: none;/u);
  });

  it('keeps compact provider copy on one line', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const english = readProjectFile('src/main/i18n/en.ts');

    assert.match(english, /'mainDock\.prettifyProviderLabel': 'Prettify provider'/u);
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
    assert.match(styles, /\.command-dock-provider-field \{[\s\S]*?position: relative;/u);
    assert.match(
      styles,
      /\.command-dock \.command-dock-provider-trigger svg \{[\s\S]*?position: absolute;[\s\S]*?top: 50%;[\s\S]*?right: 0;[\s\S]*?transform: translateY\(-50%\);/u,
    );
    assert.match(
      styles,
      /\.command-dock-prettify-provider-field \{[\s\S]*?position: relative;[\s\S]*?padding-left: 8px;/u,
    );
    assert.match(
      styles,
      /\.command-dock \.command-dock-prettify-provider-trigger svg \{[\s\S]*?position: absolute;[\s\S]*?top: 50%;[\s\S]*?right: 0;[\s\S]*?transform: translateY\(-50%\);/u,
    );
  });

  it('uses one value text size across Voice, Prettify, model, and Translation columns', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');

    assert.match(styles, /--dock-field-value-font-size: 14\.37px;/u);
    assert.match(
      styles,
      /\.command-dock \.command-dock-provider-trigger \{[\s\S]*?font-size: var\(--dock-field-value-font-size\);/u,
    );
    assert.match(
      styles,
      /\.command-dock \.command-dock-prettify-provider-trigger \{[\s\S]*?font-size: var\(--dock-field-value-font-size\);/u,
    );
    assert.match(
      styles,
      /\.command-dock-prettify-summary strong \{[\s\S]*?font-size: var\(--dock-field-value-font-size\);/u,
    );
  });

  it('places provider connection status in the stable Voice-aligned right-side controls', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const band = readProjectFile('src/renderer/components/MainPrettifyProviderBand.tsx');
    const styles = readProjectFile('src/renderer/styles/globals.css');

    assert.match(app, /checkPrettifyCliConnection\(providerId\)/u);
    assert.match(band, /className="command-dock-prettify-controls"/u);
    assert.match(app, /httpConnection=\{prettifyHttpConnection\}/u);
    assert.match(band, /dataSlot="prettify-provider-connection"/u);
    assert.match(band, /command-dock-provider-state command-dock-prettify-connection/u);
    assert.match(band, /<ProviderStatusIndicator/u);
    assert.match(band, /const providerConnectionTooltip =/u);
    assert.match(band, /connectionError \|\|/u);
    assert.match(band, /tooltip=\{providerConnectionTooltip\}/u);
    assert.doesNotMatch(band, /dataSlot="prettify-provider-state"/u);
    assert.doesNotMatch(band, /connectionError\s+\?\s+t\('provider\.notConnected'\)/u);
    assert.match(styles, /\.command-dock-provider-controls \{[\s\S]*?width: var\(--dock-provider-controls-width\);/u);
    assert.match(styles, /\.command-dock-prettify-controls \{[\s\S]*?width: var\(--dock-provider-controls-width\);/u);
    assert.match(
      styles,
      /\.command-dock-prettify-layout \{[\s\S]*?grid-template-columns: 22px 147px minmax\(0, 1fr\) var\(--dock-provider-controls-width\);/u,
    );
    assert.match(styles, /\.command-dock-prettify-connection \{[^}]*white-space: nowrap;/u);
    assert.doesNotMatch(styles, /\.command-dock-prettify-connection \{[^}]*font-size:/u);
    assert.doesNotMatch(styles, /\.command-dock-prettify-connection > svg/u);
    assert.doesNotMatch(styles, /\.command-dock-prettify-connection(?:\s|>)[\s\S]{0,180}text-overflow:\s*ellipsis/u);
  });
});
