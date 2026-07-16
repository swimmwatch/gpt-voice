import type { LandingLocale, LandingLocaleDefinition } from './schema';

export const supportedLocales = ['en', 'ru', 'be', 'uk', 'es', 'pt-BR', 'zh-CN', 'ja', 'de', 'fr', 'hi'] as const;

export const defaultLocale: LandingLocale = 'en';
const landingBasePath = '/gpt-voice/';
const landingCanonicalBaseUrl = 'https://swimmwatch.github.io/gpt-voice/';
const documentationBasePath = '/gpt-voice/docs/';
const documentationRouteSlugPattern = /^[a-z]{2}(?:-[a-z]{2})?$/u;

type LocaleDefinitionSource = Omit<
  LandingLocaleDefinition,
  'canonical' | 'captions' | 'pageText' | 'route' | 'transcriptText'
>;

function createLocaleDefinition(source: LocaleDefinitionSource): LandingLocaleDefinition {
  const routeSegment = source.routeSlug ? `${source.routeSlug}/` : '';
  const mediaSlug = source.routeSlug || source.tag.toLowerCase();
  const route = `${landingBasePath}${routeSegment}`;

  return {
    ...source,
    route,
    canonical: `${landingCanonicalBaseUrl}${routeSegment}`,
    pageText: `${route}index.txt`,
    transcriptText: `${landingBasePath}media/transcripts/${mediaSlug}.txt`,
    captions: `${landingBasePath}generated/captions/${mediaSlug}.vtt`,
  };
}

export const localeRegistry: readonly LandingLocaleDefinition[] = [
  createLocaleDefinition({
    language: 'English',
    tag: 'en',
    routeSlug: '',
    nativeLabel: 'English',
    ogLocale: 'en_US',
    direction: 'ltr',
    primaryFont: 'Ubuntu Sans Variable',
    fontPackage: '@fontsource-variable/ubuntu-sans@5.2.10',
  }),
  createLocaleDefinition({
    language: 'Russian',
    tag: 'ru',
    routeSlug: 'ru',
    nativeLabel: 'Русский',
    ogLocale: 'ru_RU',
    direction: 'ltr',
    primaryFont: 'Ubuntu Sans Variable',
    fontPackage: '@fontsource-variable/ubuntu-sans@5.2.10',
  }),
  createLocaleDefinition({
    language: 'Belarusian',
    tag: 'be',
    routeSlug: 'be',
    nativeLabel: 'Беларуская',
    ogLocale: 'be_BY',
    direction: 'ltr',
    primaryFont: 'Ubuntu Sans Variable',
    fontPackage: '@fontsource-variable/ubuntu-sans@5.2.10',
  }),
  createLocaleDefinition({
    language: 'Ukrainian',
    tag: 'uk',
    routeSlug: 'uk',
    nativeLabel: 'Українська',
    ogLocale: 'uk_UA',
    direction: 'ltr',
    primaryFont: 'Ubuntu Sans Variable',
    fontPackage: '@fontsource-variable/ubuntu-sans@5.2.10',
  }),
  createLocaleDefinition({
    language: 'Spanish',
    tag: 'es',
    routeSlug: 'es',
    nativeLabel: 'Español',
    ogLocale: 'es_ES',
    direction: 'ltr',
    primaryFont: 'Ubuntu Sans Variable',
    fontPackage: '@fontsource-variable/ubuntu-sans@5.2.10',
  }),
  createLocaleDefinition({
    language: 'Brazilian Portuguese',
    tag: 'pt-BR',
    routeSlug: 'pt-br',
    nativeLabel: 'Português (Brasil)',
    ogLocale: 'pt_BR',
    direction: 'ltr',
    primaryFont: 'Ubuntu Sans Variable',
    fontPackage: '@fontsource-variable/ubuntu-sans@5.2.10',
  }),
  createLocaleDefinition({
    language: 'Simplified Chinese',
    tag: 'zh-CN',
    routeSlug: 'zh-cn',
    nativeLabel: '简体中文',
    ogLocale: 'zh_CN',
    direction: 'ltr',
    primaryFont: 'Noto Sans SC Variable',
    fontPackage: '@fontsource-variable/noto-sans-sc@5.2.10',
  }),
  createLocaleDefinition({
    language: 'Japanese',
    tag: 'ja',
    routeSlug: 'ja',
    nativeLabel: '日本語',
    ogLocale: 'ja_JP',
    direction: 'ltr',
    primaryFont: 'Noto Sans JP Variable',
    fontPackage: '@fontsource-variable/noto-sans-jp@5.2.10',
  }),
  createLocaleDefinition({
    language: 'German',
    tag: 'de',
    routeSlug: 'de',
    nativeLabel: 'Deutsch',
    ogLocale: 'de_DE',
    direction: 'ltr',
    primaryFont: 'Ubuntu Sans Variable',
    fontPackage: '@fontsource-variable/ubuntu-sans@5.2.10',
  }),
  createLocaleDefinition({
    language: 'French',
    tag: 'fr',
    routeSlug: 'fr',
    nativeLabel: 'Français',
    ogLocale: 'fr_FR',
    direction: 'ltr',
    primaryFont: 'Ubuntu Sans Variable',
    fontPackage: '@fontsource-variable/ubuntu-sans@5.2.10',
  }),
  createLocaleDefinition({
    language: 'Hindi',
    tag: 'hi',
    routeSlug: 'hi',
    nativeLabel: 'हिन्दी',
    ogLocale: 'hi_IN',
    direction: 'ltr',
    primaryFont: 'Noto Sans Devanagari Variable',
    fontPackage: '@fontsource-variable/noto-sans-devanagari@5.2.8',
  }),
];

export function getLocaleDefinition(locale: LandingLocale): LandingLocaleDefinition {
  const definition = localeRegistry.find((candidate) => candidate.tag === locale);
  if (!definition) {
    throw new Error(`Unsupported landing locale: ${locale}`);
  }
  return definition;
}

export function getLocaleFromRouteSlug(routeSlug: string): LandingLocale | undefined {
  return localeRegistry.find((candidate) => candidate.routeSlug === routeSlug)?.tag;
}

export function getDocumentationRoute(locale: LandingLocaleDefinition): string {
  if (locale.tag === defaultLocale) {
    if (locale.routeSlug !== '') {
      throw new Error('Documentation routes require the English locale to use an empty route slug.');
    }

    return documentationBasePath;
  }

  if (!documentationRouteSlugPattern.test(locale.routeSlug) || locale.routeSlug !== locale.tag.toLowerCase()) {
    throw new Error('Documentation routes require a lowercase route slug matching the locale tag.');
  }

  return `${documentationBasePath}${locale.routeSlug}/`;
}
