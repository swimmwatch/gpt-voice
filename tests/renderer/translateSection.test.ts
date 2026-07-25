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
    assert.match(section, /disabled=\{isSaving\}/u);
    assert.match(section, /role=\{error \? 'alert' : 'status'\}/u);
    assert.doesNotMatch(section, /assets\/flags|<img|deepl|Yandex.*warning/iu);
  });

  it('bounds the full inventories and preserves fixed main-window geometry', () => {
    const styles = readProjectFile('src/renderer/styles/globals.css');
    const windowSource = readProjectFile('src/main/window.ts');

    assert.match(
      styles,
      /\.command-dock-translation-select-content \{[\s\S]*?max-height: min\(var\(--radix-select-content-available-height\), 240px\);/u,
    );
    assert.match(
      styles,
      /\.command-dock-translation-select-content \[data-slot='select-viewport'\] \{[\s\S]*?overflow-y: auto;/u,
    );
    assert.match(styles, /@media \(max-width: 439px\)[\s\S]*?\.command-dock-language-band \{/u);
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
    assert.match(handler, /window\.electronAPI\.setTranslateSettings\(candidate\)/u);
    assert.match(handler, /requestId !== translationSettingsRequestRef\.current/u);
    assert.doesNotMatch(
      handler,
      /translateText|providerLogin|getBgBrowserStatus|checkSession|navigate|clear|probe|createTranslationProvider/u,
    );
    assert.match(app, /disposed \|\| translationSettingsRequestId !== translationSettingsRequestRef\.current/u);
    assert.match(app, /translationSettingsRequestRef\.current \+= 1/u);
    assert.match(sectionUsage, /createTranslationProviderCandidate/u);
    assert.match(sectionUsage, /createTranslationSettingsCandidate/u);
    assert.match(sectionUsage, /confirmedSettings/u);
  });
});
