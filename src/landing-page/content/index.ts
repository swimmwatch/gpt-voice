export {
  defaultLocale,
  getLocaleDefinition,
  getLocaleFromRouteSlug,
  localeRegistry,
  supportedLocales,
} from './locale-registry';
export { englishContent } from './locales/en';
export const publishedLocaleTags = ['en'] as const;
export type {
  FaqItem,
  LandingContent,
  LandingLinks,
  LandingLocale,
  LandingLocaleDefinition,
  VideoTranscriptCue,
} from './schema';
