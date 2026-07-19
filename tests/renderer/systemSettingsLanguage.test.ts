import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('System application-language settings', () => {
  it('renders a dedicated section with named supported locales', () => {
    const appSettings = readProjectFile('src/renderer/AppSettingsWindow.tsx');
    const navigation = readProjectFile('src/renderer/components/settings/SettingsNavigation.tsx');
    const section = readProjectFile('src/renderer/components/settings/SystemSection.tsx');
    const localeContract = readProjectFile('src/shared/appLocale.ts');
    const i18nProvider = readProjectFile('src/renderer/hooks/useI18n.tsx');

    assert.match(navigation, /id: 'system'/u);
    assert.match(appSettings, /<TabsContent className="mt-0" value="system">/u);
    assert.match(appSettings, /<SystemSection/u);
    assert.match(section, /APP_LOCALES\.filter/u);
    assert.match(section, /\{nativeName\}/u);
    assert.match(localeContract, /'en', 'ru', 'be', 'uk', 'es', 'pt-BR', 'zh', 'ja', 'de', 'fr', 'hi'/u);
    assert.match(localeContract, /Português \(Brasil\)/u);
    assert.match(localeContract, /简体中文/u);
    assert.match(localeContract, /हिन्दी/u);
    assert.match(i18nProvider, /document\.documentElement\.lang = currentLocale/u);
    assert.doesNotMatch(section, /appSettings\.language\.\$\{/u);
    assert.doesNotMatch(section, /CloakBrowser|browser-locale/u);
  });

  it('persists immediately and presents only a localized safe failure', () => {
    const section = readProjectFile('src/renderer/components/settings/SystemSection.tsx');

    assert.match(section, /await onLocaleChange\(value\)/u);
    assert.match(section, /setError\(t\('appSettings\.languageSaveFailed'\)\)/u);
    assert.match(section, /disabled=\{isSaving\}/u);
    assert.doesNotMatch(section, /error instanceof Error|String\(error\)|error\.message/u);
  });
});
