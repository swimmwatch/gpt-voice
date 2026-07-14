import { getLocaleDefinition } from './locale-registry';
import { englishContent } from './locales/en';
import type { LandingContent, LandingLocale } from './schema';

export {
  defaultLocale,
  getLocaleDefinition,
  getLocaleFromRouteSlug,
  localeRegistry,
  supportedLocales,
} from './locale-registry';
export { englishContent };
export const publishedLocaleContent = {
  en: englishContent,
} satisfies Partial<Record<LandingLocale, LandingContent>>;
export const publishedLocaleTags = Object.keys(publishedLocaleContent) as Array<keyof typeof publishedLocaleContent>;
export const publishedLocaleDefinitions = publishedLocaleTags.map(getLocaleDefinition);
export type {
  FaqItem,
  LandingContent,
  LandingLinks,
  LandingLocale,
  LandingLocaleDefinition,
  VideoTranscriptCue,
} from './schema';
