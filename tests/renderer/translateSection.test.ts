import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('main translation Select controls', () => {
  it('renders provider and complete target Selects as accessible text controls', () => {
    const section = readProjectFile('src/renderer/components/TranslateSection.tsx');

    assert.equal((section.match(/<Select\b/gu) ?? []).length, 2);
    assert.match(section, /TRANSLATION_PROVIDER_OPTIONS\.map/u);
    assert.match(section, /getTranslationLanguageOptions\(settings\.providerId, locale\)/u);
    assert.match(section, /aria-label=\{t\('translate\.provider'\)\}/u);
    assert.match(section, /aria-label=\{t\('translate\.targetLanguage'\)\}/u);
    assert.match(section, /<SelectValue \/>/u);
    assert.equal((section.match(/disabled=\{isSaving \|\| isProviderChangesLocked\}/gu) ?? []).length, 2);
    assert.equal((section.match(/if \(isSaving \|\| isProviderChangesLocked\) return;/gu) ?? []).length, 2);
    assert.match(section, /role="alert"/u);
    assert.match(section, /<ProviderStatusIndicator/u);
    assert.match(section, /dataSlot="translation-provider-connection"/u);
    assert.match(section, /provider\.notConnected/u);
    assert.match(section, /TRANSLATION_CONNECTION_TOOLTIP_KEYS/u);
    assert.doesNotMatch(section, /translate\.saving|is-saving/u);
    assert.doesNotMatch(section, /assets\/flags|<img|deepl|Yandex.*warning/iu);
  });

  it('keeps the reusable provider action-control seam ahead of the existing connection status', () => {
    const section = readProjectFile('src/renderer/components/TranslateSection.tsx');

    assert.match(section, /actionControl\?: ReactNode/u);
    assert.match(section, /\{actionControl\}[\s\S]*?<ProviderStatusIndicator/u);
  });

  it('bounds the full inventories and preserves fixed main-window geometry', () => {
    const section = readProjectFile('src/renderer/components/TranslateSection.tsx');
    const selectPrimitive = readProjectFile('src/renderer/components/ui/select.tsx');
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const windowSource = readProjectFile('src/main/window.ts');

    assert.equal((section.match(/showScrollButtons=\{false\}/gu) ?? []).length, 1);
    assert.match(section, /viewportClassName="command-dock-translation-select-viewport"/u);
    assert.match(selectPrimitive, /showScrollButtons = true/u);
    assert.match(selectPrimitive, /\{showScrollButtons && <SelectScrollUpButton \/>\}/u);
    assert.match(selectPrimitive, /\{showScrollButtons && <SelectScrollDownButton \/>\}/u);
    assert.match(
      styles,
      /\.command-dock-translation-select-content \{[\s\S]*?max-height: min\(var\(--radix-select-content-available-height\), 240px\);/u,
    );
    assert.match(
      styles,
      /\.command-dock-translation-select-content \[data-slot='select-viewport'\] \{[\s\S]*?overflow-y: auto;[\s\S]*?scrollbar-gutter: stable;/u,
    );
    assert.match(styles, /@media \(max-width: 439px\)[\s\S]*?\.command-dock-language-band \{/u);
    assert.match(styles, /--dock-translation-target-width: 175px;/u);
    assert.match(
      styles,
      /grid-template-columns:[\s\S]*?22px 147px var\(--dock-translation-target-width\)[\s\S]*?var\(--dock-provider-controls-width\);/u,
    );
    assert.match(
      styles,
      /@media \(max-width: 439px\)[\s\S]*?grid-template-columns: 22px minmax\(0, 1fr\) var\(--dock-provider-controls-width\);/u,
    );
    assert.match(styles, /\.command-dock-translation-connection \{[\s\S]*?grid-column: 4;/u);
    assert.match(windowSource, /MAIN_WINDOW_CONTENT_WIDTH = 520/u);
    assert.match(windowSource, /MAIN_WINDOW_CONTENT_HEIGHT = 420/u);
  });

  it('persists only complete settings candidates and suppresses stale or disposed results', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const handlerStart = app.indexOf('const saveTranslationSettings');
    const handler = app.slice(handlerStart, app.indexOf('return (', handlerStart));
    const sectionUsage = app.slice(app.indexOf('<TranslateSection'), app.indexOf('</main>'));

    assert.match(handler, /if \(translationSettingsSavePendingRef\.current\) return;/u);
    assert.match(handler, /translationSettingsSavePendingRef\.current = true;/u);
    assert.match(handler, /desktopApi\.setTranslateSettings\(candidate\)/u);
    assert.match(handler, /requestId !== translationSettingsRequestRef\.current/u);
    assert.doesNotMatch(
      handler,
      /translateText|providerLogin|getBgBrowserStatus|checkSession|navigate|clear|probe|createTranslationProvider/u,
    );
    assert.match(app, /disposed \|\| translationSettingsRequestId !== translationSettingsRequestRef\.current/u);
    assert.match(app, /translationSettingsRequestRef\.current \+= 1/u);
    assert.match(app, /desktopApi[\s\S]{0,40}\.getTranslationProviderConnection\(\)/u);
    assert.match(app, /desktopApi\.onTranslationProviderConnectionChanged/u);
    assert.match(app, /translationConnectionRequestId !== translationConnectionRequestRef\.current/u);
    assert.match(sectionUsage, /createTranslationProviderCandidate/u);
    assert.match(sectionUsage, /createTranslationSettingsCandidate/u);
    assert.match(sectionUsage, /confirmedSettings/u);
  });

  it('places a compact shared-style translation band directly after prettify', () => {
    const app = readProjectFile('src/renderer/App.tsx');
    const section = readProjectFile('src/renderer/components/TranslateSection.tsx');
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const prettifyIndex = app.indexOf('<MainPrettifyProviderBand');
    const translationIndex = app.indexOf('<TranslateSection');
    const recordingIndex = app.indexOf('<RecordingControls');

    assert.ok(prettifyIndex >= 0);
    assert.ok(translationIndex > prettifyIndex);
    assert.ok(recordingIndex > translationIndex);
    assert.match(
      styles,
      /\.command-dock-language-band > \.command-dock-section-icon \{[^}]*align-self: center;[^}]*grid-row: 1;/u,
    );
    assert.equal((section.match(/className="command-dock-field-label"/gu) ?? []).length, 2);
    assert.equal(
      (section.match(/className="command-dock-provider-trigger command-dock-translation-trigger"/gu) ?? []).length,
      2,
    );
    assert.doesNotMatch(section, /data-has-state/u);
    assert.doesNotMatch(styles, /\.command-dock-language-band\[data-has-state/u);
    assert.doesNotMatch(section, /command-dock-language-(?:label|trigger)/u);
    assert.match(styles, /\.command-dock-language-band \{[^}]*flex: 0 0 60px;/u);
    assert.match(
      styles,
      /\.command-dock-language-band > \.command-dock-language-field:first-of-type \{[^}]*padding-left: 8px;/u,
    );
    assert.match(
      styles,
      /\.command-dock \.command-dock-language-field:last-of-type \.command-dock-translation-trigger > svg \{[^}]*right: 10px;/u,
    );
    assert.match(styles, /\.command-dock-language-state \{[^}]*position: absolute;[^}]*bottom: 1px;/u);
    assert.match(styles, /\.command-dock-recording \{[^}]*flex: 1 0 142px;/u);
    assert.match(styles, /\.command-dock-language-band,\n\.command-dock-record-command-band,/u);
    assert.doesNotMatch(styles, /\.command-dock-language-band > \.command-dock-section-icon \{[^}]*margin-top:/u);
  });
});
