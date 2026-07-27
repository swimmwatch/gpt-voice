import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import en from '@main/i18n/en';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('Audit Log App Settings', () => {
  it('routes a dedicated section through the closed navigation contract', () => {
    const navigation = readProjectFile('src/renderer/components/settings/SettingsNavigation.tsx');
    const appSettings = readProjectFile('src/renderer/AppSettingsWindow.tsx');

    assert.match(navigation, /id: 'audit-log', labelKey: 'settingsSection\.auditLog'/u);
    assert.match(appSettings, /<TabsContent className="mt-0" value="audit-log">/u);
    assert.match(appSettings, /<AuditLogSection/u);
  });

  it('renders controlled accessible switches and three independently disabled clear actions', () => {
    const section = readProjectFile('src/renderer/components/settings/AuditLogSection.tsx');

    assert.match(section, /htmlFor="capture-translation-diagnostics"/u);
    assert.match(section, /id="capture-translation-diagnostics"/u);
    assert.match(section, /aria-label=\{t\('auditLog\.captureTranslation'\)\}/u);
    assert.match(section, /checked=\{settings\.captureTranslationDiagnostics\}/u);
    assert.match(section, /htmlFor="capture-prettify-diagnostics"/u);
    assert.match(section, /id="capture-prettify-diagnostics"/u);
    assert.match(section, /aria-label=\{t\('auditLog\.capturePrettify'\)\}/u);
    assert.match(section, /checked=\{settings\.capturePrettifyDiagnostics\}/u);
    assert.match(section, /DIAGNOSTIC_CAPTURE_CLEAR_TARGETS\.map/u);
    assert.match(section, /<Button disabled=\{disabled\}/u);
  });

  it('discloses sensitive plaintext, best-effort redaction, archive inclusion, and no encryption', () => {
    assert.match(en['auditLog.sensitiveDataWarning'], /private or sensitive/u);
    assert.match(en['auditLog.plaintextStorageWarning'], /best-effort-redacted plaintext SQLite/u);
    assert.match(en['auditLog.plaintextStorageWarning'], /per-user filesystem permissions/u);
    assert.match(en['auditLog.plaintextStorageWarning'], /not encrypted/u);
    assert.match(en['auditLog.redactionLimitWarning'], /miss arbitrary embedded secrets/u);
    assert.match(en['auditLog.archiveInclusionWarning'], /included automatically/u);
    assert.match(en['auditLog.archiveEncryptionWarning'], /not encrypted/u);
  });

  it('locks competing save and clear actions while confirmation or IPC is active', () => {
    const appSettings = readProjectFile('src/renderer/AppSettingsWindow.tsx');

    assert.match(appSettings, /if \(\s*isSaving \|\|\s*isDiagnosticActionPending \|\|\s*diagnosticConfirmation/u);
    assert.match(
      appSettings,
      /return state\.isSaving \|\| state\.isDiagnosticActionPending \|\| state\.hasDiagnosticConfirmation/u,
    );
    assert.match(appSettings, /hasDiagnosticConfirmation: diagnosticConfirmation !== null/u);
    assert.match(appSettings, /const saveDisabled = isAppSettingsSaveDisabled\(\{[\s\S]*?\.\.\.actionLockState/u);
    assert.match(appSettings, /const diagnosticControlsDisabled = areDiagnosticControlsDisabled\(actionLockState\)/u);
    assert.match(appSettings, /disabled=\{isPending\}/u);
  });

  it('keeps destructive dialogs retryable and restores the prior focus after close', () => {
    const appSettings = readProjectFile('src/renderer/AppSettingsWindow.tsx');
    const clearAction = appSettings.slice(
      appSettings.indexOf('const confirmDiagnosticAction'),
      appSettings.indexOf('const handleDiagnosticConfirmationOpenChange'),
    );
    const diagnosticDialog = appSettings.slice(
      appSettings.indexOf('function DiagnosticCaptureConfirmationDialog'),
      appSettings.indexOf('/** Coordinates the transactional'),
    );

    assert.match(appSettings, /diagnosticConfirmationFocusRef\.current =\s*document\.activeElement/u);
    assert.match(
      appSettings,
      /window\.requestAnimationFrame\(\(\) => diagnosticConfirmationFocusRef\.current\?\.focus\(\)\)/u,
    );
    assert.match(clearAction, /if \(result\.success\) \{\s*closeDiagnosticConfirmation\(\);/u);
    assert.match(clearAction, /setError\(t\(getDiagnosticCaptureErrorTranslationKey\(result\.errorCode\)\)\)/u);
    assert.doesNotMatch(clearAction, /forceCloseWindow|setDiagnosticCaptureSettings/u);
    assert.doesNotMatch(diagnosticDialog, /<AlertDialogAction/u);
  });

  it('cancels disable confirmation without sending destructive IPC and restores only affected drafts', () => {
    const appSettings = readProjectFile('src/renderer/AppSettingsWindow.tsx');
    const cancelAction = appSettings.slice(
      appSettings.indexOf('const cancelDiagnosticConfirmation'),
      appSettings.indexOf('const confirmDiagnosticAction'),
    );

    assert.match(cancelAction, /restoreCancelledDiagnosticCaptureSettings/u);
    assert.doesNotMatch(cancelAction, /saveSettings|clearDiagnosticCapture/u);
    assert.match(appSettings, /getDisabledDiagnosticCaptureCategories\(\s*initialDiagnosticCaptureSettings/u);
    assert.match(appSettings, /saveSettings\(confirmation\.categories\)/u);
  });
});
