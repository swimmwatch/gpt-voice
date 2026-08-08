import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();

function source(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

describe('destructive confirmation migrations', () => {
  it('uses the shared confirmation composition for history, provider auth, settings, and non-default profiles', () => {
    const sources = [
      source('src/renderer/HistoryWindow.tsx'),
      source('src/renderer/components/ProviderSettingsForm.tsx'),
      source('src/renderer/AppSettingsWindow.tsx'),
      source('src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx'),
    ];

    for (const featureSource of sources) {
      assert.match(featureSource, /@renderer\/components\/ui\/confirmation-dialog/u);
      assert.match(featureSource, /<ConfirmationDialog/u);
      assert.doesNotMatch(featureSource, /AlertDialogAction/u);
    }
  });

  it('keeps failed destructive work open and closes only from an explicit true result', () => {
    const history = source('src/renderer/HistoryWindow.tsx');
    const provider = source('src/renderer/components/ProviderSettingsForm.tsx');
    const settings = source('src/renderer/AppSettingsWindow.tsx');
    const profiles = source('src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx');

    assert.match(history, /const clearHistory = async \(\): Promise<boolean>/u);
    assert.match(history, /if \(!result\.success\) \{[\s\S]*?return false;/u);
    assert.match(history, /setIsCleared\(true\);\s*return true;/u);
    assert.match(provider, /const clearAuth = async \(\): Promise<boolean>/u);
    assert.match(provider, /onSaved\(result\.settings\);[\s\S]*?return true;/u);
    assert.match(provider, /return false;\n\s*\};\n\s*const login/u);
    assert.match(settings, /const confirmDiagnosticAction = async \(\): Promise<boolean>/u);
    assert.match(settings, /onPendingChange=\{setIsDiagnosticActionPending\}/u);
    assert.match(settings, /diagnosticConfirmationSucceededRef\.current = true;\s*return true;/u);
    assert.match(settings, /const discardChanges = useCallback\(\(\): boolean/u);
    assert.match(profiles, /const confirmNonDefaultDelete = \(\): boolean/u);
    assert.match(profiles, /setAnnouncement\(t\('prettify\.profiles\.announcement\.deleted'\)\);\s*return true;/u);
  });

  it('restores feature trigger focus only after cancellation or a successful close', () => {
    const history = source('src/renderer/HistoryWindow.tsx');
    const provider = source('src/renderer/components/ProviderSettingsForm.tsx');
    const settings = source('src/renderer/AppSettingsWindow.tsx');
    const profiles = source('src/renderer/components/settings/PrettifyProfilesSettingsSection.tsx');

    assert.match(
      history,
      /if \(!open\) \{\s*window\.requestAnimationFrame\(\(\) => clearButtonRef\.current\?\.focus\(\)\);/u,
    );
    assert.match(provider, /if \(!open\) \{\s*restoreFocus\(clearAuthButtonRef\.current\);/u);
    assert.match(settings, /if \(diagnosticConfirmationSucceededRef\.current\) \{\s*closeDiagnosticConfirmation\(\);/u);
    assert.match(profiles, /if \(!open && deleteCandidate && !deleteCandidate\.isDefault\) closeDelete\(\);/u);
  });
});
