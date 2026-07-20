import { localeRegistry, supportedLocales } from './locale-registry';
import { englishContent } from './locales/en';
import { localizedLandingContent } from './locales/localized';
import type { LandingContent, LandingLocale } from './schema';

export {
  defaultLocale,
  getDocumentationRoute,
  getLocaleDefinition,
  getLocaleFromRouteSlug,
  localeRegistry,
  supportedLocales,
} from './locale-registry';
export { englishContent };
export const publishedLocaleContent = {
  en: englishContent,
  ...localizedLandingContent,
} satisfies Record<LandingLocale, LandingContent>;
export const publishedLocaleTags = supportedLocales;
export const publishedLocaleDefinitions = localeRegistry;
export type {
  FaqItem,
  LandingContent,
  LandingLinks,
  LandingLocale,
  LandingLocaleDefinition,
  VideoTranscriptCue,
} from './schema';
