import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS,
  DIAGNOSTIC_CAPTURE_CATEGORIES,
  DIAGNOSTIC_CAPTURE_CLEAR_TARGETS,
  DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES,
  DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS,
  areDiagnosticCaptureSettingsEqual,
  getDiagnosticCaptureCategoriesForClearTarget,
  getDisabledDiagnosticCaptureCategories,
  isDiagnosticCaptureCategory,
  isDiagnosticCaptureCategoryList,
  isDiagnosticCaptureClearRequest,
  isDiagnosticCaptureClearTarget,
  isDiagnosticCaptureSettings,
  isDiagnosticCaptureSettingsMutationRequest,
  normalizeDiagnosticCaptureSettings,
} from '@shared/diagnosticCaptureSettings';

const ENABLED_SETTINGS = Object.freeze({
  capturePrettifyDiagnostics: true,
  captureTranslationDiagnostics: true,
});

describe('diagnostic capture settings contracts', () => {
  it('keeps categories, clear targets, IPC channels, failures, and defaults closed', () => {
    assert.deepEqual(DIAGNOSTIC_CAPTURE_CATEGORIES, ['translation', 'prettify']);
    assert.deepEqual(DIAGNOSTIC_CAPTURE_CLEAR_TARGETS, ['translation', 'prettify', 'all']);
    assert.deepEqual(DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS, {
      clear: 'clear-diagnostic-capture',
      get: 'get-diagnostic-capture-settings',
      set: 'set-diagnostic-capture-settings',
    });
    assert.deepEqual(Object.values(DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES).sort(), [
      'confirmation-required',
      'invalid-request',
      'save-failed',
      'storage-failed',
      'storage-unavailable',
    ]);
    assert.deepEqual(DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS, {
      capturePrettifyDiagnostics: false,
      captureTranslationDiagnostics: false,
    });
    assert.equal(Object.isFrozen(DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS), true);
  });

  it('strictly validates complete settings without accepting extra or inherited shapes', () => {
    assert.equal(isDiagnosticCaptureSettings(ENABLED_SETTINGS), true);
    for (const value of [
      null,
      [],
      {},
      { capturePrettifyDiagnostics: true },
      { captureTranslationDiagnostics: true },
      { capturePrettifyDiagnostics: 1, captureTranslationDiagnostics: true },
      { capturePrettifyDiagnostics: false, captureTranslationDiagnostics: 'false' },
      { ...ENABLED_SETTINGS, extra: false },
    ]) {
      assert.equal(isDiagnosticCaptureSettings(value), false);
    }
  });

  it('normalizes independently corrupt or missing values to false', () => {
    assert.deepEqual(normalizeDiagnosticCaptureSettings(null), DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS);
    assert.deepEqual(normalizeDiagnosticCaptureSettings([]), DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS);
    assert.deepEqual(
      normalizeDiagnosticCaptureSettings({
        capturePrettifyDiagnostics: true,
        captureTranslationDiagnostics: 'true',
      }),
      {
        capturePrettifyDiagnostics: true,
        captureTranslationDiagnostics: false,
      },
    );
    assert.deepEqual(
      normalizeDiagnosticCaptureSettings({
        capturePrettifyDiagnostics: {},
        captureTranslationDiagnostics: true,
      }),
      {
        capturePrettifyDiagnostics: false,
        captureTranslationDiagnostics: true,
      },
    );
  });

  it('strictly validates unique confirmation categories and mutation requests', () => {
    assert.equal(isDiagnosticCaptureCategory('translation'), true);
    assert.equal(isDiagnosticCaptureCategory('all'), false);
    assert.equal(isDiagnosticCaptureCategoryList([]), true);
    assert.equal(isDiagnosticCaptureCategoryList(['translation', 'prettify']), true);
    assert.equal(isDiagnosticCaptureCategoryList(['translation', 'translation']), false);
    assert.equal(isDiagnosticCaptureCategoryList(['translation', 'all']), false);
    assert.equal(
      isDiagnosticCaptureSettingsMutationRequest({
        confirmedPurgeCategories: ['translation'],
        settings: ENABLED_SETTINGS,
      }),
      true,
    );
    for (const value of [
      { confirmedPurgeCategories: ['translation'] },
      { confirmedPurgeCategories: ['translation'], settings: ENABLED_SETTINGS, extra: true },
      { confirmedPurgeCategories: ['translation', 'translation'], settings: ENABLED_SETTINGS },
      { confirmedPurgeCategories: 'translation', settings: ENABLED_SETTINGS },
    ]) {
      assert.equal(isDiagnosticCaptureSettingsMutationRequest(value), false);
    }
  });

  it('strictly validates literal-confirmed clear requests and target mappings', () => {
    for (const target of DIAGNOSTIC_CAPTURE_CLEAR_TARGETS) {
      assert.equal(isDiagnosticCaptureClearTarget(target), true);
      assert.equal(isDiagnosticCaptureClearRequest({ confirmed: true, target }), true);
    }
    for (const value of [
      { confirmed: false, target: 'translation' },
      { confirmed: true, target: 'unknown' },
      { confirmed: true, target: 'all', extra: true },
      { target: 'prettify' },
    ]) {
      assert.equal(isDiagnosticCaptureClearRequest(value), false);
    }
    assert.deepEqual(getDiagnosticCaptureCategoriesForClearTarget('translation'), ['translation']);
    assert.deepEqual(getDiagnosticCaptureCategoriesForClearTarget('prettify'), ['prettify']);
    assert.deepEqual(getDiagnosticCaptureCategoriesForClearTarget('all'), ['translation', 'prettify']);
  });

  it('derives exact disable transitions and compares both independent toggles', () => {
    const translationDisabled = {
      capturePrettifyDiagnostics: true,
      captureTranslationDiagnostics: false,
    };
    assert.deepEqual(getDisabledDiagnosticCaptureCategories(ENABLED_SETTINGS, translationDisabled), ['translation']);
    assert.deepEqual(getDisabledDiagnosticCaptureCategories(ENABLED_SETTINGS, DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS), [
      'translation',
      'prettify',
    ]);
    assert.deepEqual(getDisabledDiagnosticCaptureCategories(DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS, ENABLED_SETTINGS), []);
    assert.equal(areDiagnosticCaptureSettingsEqual(ENABLED_SETTINGS, { ...ENABLED_SETTINGS }), true);
    assert.equal(areDiagnosticCaptureSettingsEqual(ENABLED_SETTINGS, translationDisabled), false);
  });
});
