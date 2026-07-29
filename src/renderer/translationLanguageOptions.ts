import {
  TRANSLATION_PROVIDER_IDS,
  TRANSLATION_PROVIDER_INFO,
  type TranslationProviderId,
} from '@shared/translationProvider';

export interface TranslationLanguageOption {
  readonly label: string;
  readonly value: string;
}

export interface TranslationProviderOption {
  readonly label: string;
  readonly value: TranslationProviderId;
}

interface DisplayNamesLike {
  of(code: string): string | undefined;
}

interface CollatorLike {
  compare(left: string, right: string): number;
}

export interface TranslationLanguageOptionDependencies {
  readonly createCollator?: (locale: string) => CollatorLike;
  readonly createDisplayNames?: (locale: string) => DisplayNamesLike;
}

export const TRANSLATION_PROVIDER_OPTIONS: readonly TranslationProviderOption[] = Object.freeze(
  TRANSLATION_PROVIDER_IDS.map((providerId) =>
    Object.freeze({
      label: TRANSLATION_PROVIDER_INFO[providerId].name,
      value: providerId,
    }),
  ),
);

function createDisplayNames(locale: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' });
  } catch {
    return null;
  }
}

function createCollator(locale: string): Intl.Collator | null {
  try {
    return new Intl.Collator([locale], { sensitivity: 'base' });
  } catch {
    return null;
  }
}

function getDisplayLabel(displayNames: DisplayNamesLike | null, code: string, providerLabel: string): string {
  if (!displayNames) return providerLabel;

  try {
    const displayName = displayNames.of(code)?.trim();
    return displayName && displayName !== code ? displayName : providerLabel;
  } catch {
    return providerLabel;
  }
}

function compareExact(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Builds a provider's complete target inventory without mutating shared metadata. */
export function getTranslationLanguageOptions(
  providerId: TranslationProviderId,
  locale: string,
  dependencies: TranslationLanguageOptionDependencies = {},
): TranslationLanguageOption[] {
  let displayNames: DisplayNamesLike | null = null;
  let collator: CollatorLike | null = null;

  try {
    displayNames = dependencies.createDisplayNames?.(locale) ?? createDisplayNames(locale);
  } catch {
    displayNames = null;
  }

  try {
    collator = dependencies.createCollator?.(locale) ?? createCollator(locale);
  } catch {
    collator = null;
  }

  return TRANSLATION_PROVIDER_INFO[providerId].targetLanguages
    .map(({ code, providerLabel }) => ({
      label: getDisplayLabel(displayNames, code, providerLabel),
      value: code,
    }))
    .sort((left, right) => {
      const labelOrder = collator?.compare(left.label, right.label) ?? compareExact(left.label, right.label);
      return labelOrder || compareExact(left.value, right.value);
    });
}
