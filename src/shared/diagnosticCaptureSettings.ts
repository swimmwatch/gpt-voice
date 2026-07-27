export const DIAGNOSTIC_CAPTURE_CATEGORIES = ['translation', 'prettify'] as const;
export const DIAGNOSTIC_CAPTURE_CLEAR_TARGETS = [...DIAGNOSTIC_CAPTURE_CATEGORIES, 'all'] as const;

export type DiagnosticCaptureCategory = (typeof DIAGNOSTIC_CAPTURE_CATEGORIES)[number];
export type DiagnosticCaptureClearTarget = (typeof DIAGNOSTIC_CAPTURE_CLEAR_TARGETS)[number];

export interface DiagnosticCaptureSettings {
  readonly captureTranslationDiagnostics: boolean;
  readonly capturePrettifyDiagnostics: boolean;
}

export const DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS: DiagnosticCaptureSettings = Object.freeze({
  captureTranslationDiagnostics: false,
  capturePrettifyDiagnostics: false,
});

export interface DiagnosticCaptureSettingsMutationRequest {
  readonly settings: DiagnosticCaptureSettings;
  readonly confirmedPurgeCategories: readonly DiagnosticCaptureCategory[];
}

export interface DiagnosticCaptureClearRequest {
  readonly target: DiagnosticCaptureClearTarget;
  readonly confirmed: true;
}

export const DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES = {
  ConfirmationRequired: 'confirmation-required',
  InvalidRequest: 'invalid-request',
  SaveFailed: 'save-failed',
  StorageFailed: 'storage-failed',
  StorageUnavailable: 'storage-unavailable',
} as const;

export type DiagnosticCaptureSettingsErrorCode =
  (typeof DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES)[keyof typeof DIAGNOSTIC_CAPTURE_SETTINGS_ERROR_CODES];

export type DiagnosticCaptureSettingsMutationResult =
  | {
      readonly success: true;
      readonly settings: DiagnosticCaptureSettings;
    }
  | {
      readonly success: false;
      readonly errorCode: DiagnosticCaptureSettingsErrorCode;
      readonly settings: DiagnosticCaptureSettings;
    };

export type DiagnosticCaptureClearResult =
  | { readonly success: true }
  | {
      readonly success: false;
      readonly errorCode: DiagnosticCaptureSettingsErrorCode;
    };

export const DIAGNOSTIC_CAPTURE_SETTINGS_IPC_CHANNELS = {
  clear: 'clear-diagnostic-capture',
  get: 'get-diagnostic-capture-settings',
  set: 'set-diagnostic-capture-settings',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) => actualKeys.includes(key));
}

export function isDiagnosticCaptureCategory(value: unknown): value is DiagnosticCaptureCategory {
  return typeof value === 'string' && DIAGNOSTIC_CAPTURE_CATEGORIES.includes(value as DiagnosticCaptureCategory);
}

export function isDiagnosticCaptureClearTarget(value: unknown): value is DiagnosticCaptureClearTarget {
  return typeof value === 'string' && DIAGNOSTIC_CAPTURE_CLEAR_TARGETS.includes(value as DiagnosticCaptureClearTarget);
}

export function isDiagnosticCaptureSettings(value: unknown): value is DiagnosticCaptureSettings {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['captureTranslationDiagnostics', 'capturePrettifyDiagnostics']) &&
    typeof value.captureTranslationDiagnostics === 'boolean' &&
    typeof value.capturePrettifyDiagnostics === 'boolean'
  );
}

export function normalizeDiagnosticCaptureSettings(value: unknown): DiagnosticCaptureSettings {
  const candidate = isRecord(value) ? value : {};
  return Object.freeze({
    captureTranslationDiagnostics:
      typeof candidate.captureTranslationDiagnostics === 'boolean'
        ? candidate.captureTranslationDiagnostics
        : DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS.captureTranslationDiagnostics,
    capturePrettifyDiagnostics:
      typeof candidate.capturePrettifyDiagnostics === 'boolean'
        ? candidate.capturePrettifyDiagnostics
        : DEFAULT_DIAGNOSTIC_CAPTURE_SETTINGS.capturePrettifyDiagnostics,
  });
}

export function isDiagnosticCaptureCategoryList(value: unknown): value is readonly DiagnosticCaptureCategory[] {
  if (!Array.isArray(value) || !value.every(isDiagnosticCaptureCategory)) return false;
  return new Set(value).size === value.length;
}

export function isDiagnosticCaptureSettingsMutationRequest(
  value: unknown,
): value is DiagnosticCaptureSettingsMutationRequest {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['settings', 'confirmedPurgeCategories']) &&
    isDiagnosticCaptureSettings(value.settings) &&
    isDiagnosticCaptureCategoryList(value.confirmedPurgeCategories)
  );
}

export function isDiagnosticCaptureClearRequest(value: unknown): value is DiagnosticCaptureClearRequest {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['target', 'confirmed']) &&
    isDiagnosticCaptureClearTarget(value.target) &&
    value.confirmed === true
  );
}

export function areDiagnosticCaptureSettingsEqual(
  left: DiagnosticCaptureSettings,
  right: DiagnosticCaptureSettings,
): boolean {
  return (
    left.captureTranslationDiagnostics === right.captureTranslationDiagnostics &&
    left.capturePrettifyDiagnostics === right.capturePrettifyDiagnostics
  );
}

export function getDisabledDiagnosticCaptureCategories(
  current: DiagnosticCaptureSettings,
  candidate: DiagnosticCaptureSettings,
): DiagnosticCaptureCategory[] {
  const categories: DiagnosticCaptureCategory[] = [];
  if (current.captureTranslationDiagnostics && !candidate.captureTranslationDiagnostics) {
    categories.push('translation');
  }
  if (current.capturePrettifyDiagnostics && !candidate.capturePrettifyDiagnostics) {
    categories.push('prettify');
  }
  return categories;
}

export function getDiagnosticCaptureCategoriesForClearTarget(
  target: DiagnosticCaptureClearTarget,
): readonly DiagnosticCaptureCategory[] {
  return target === 'all' ? DIAGNOSTIC_CAPTURE_CATEGORIES : [target];
}
