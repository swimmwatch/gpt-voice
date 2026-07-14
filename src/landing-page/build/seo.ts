import type { LandingContent, LandingLocaleDefinition } from '../content/index.js';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function createStructuredData(content: LandingContent, locale: LandingLocaleDefinition): object {
  const websiteId = `${locale.canonical}#website`;
  const applicationId = `${locale.canonical}#application`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': websiteId,
        '@type': 'WebSite',
        description: content.metadata.description,
        inLanguage: locale.tag,
        name: content.navigation.brand,
        url: locale.canonical,
      },
      {
        '@id': applicationId,
        '@type': 'SoftwareApplication',
        applicationCategory: 'UtilitiesApplication',
        codeRepository: content.links.repository,
        description: content.metadata.description,
        inLanguage: locale.tag,
        isAccessibleForFree: true,
        license: content.links.license,
        name: content.navigation.brand,
        operatingSystem: 'Windows, Linux',
        url: locale.canonical,
      },
      {
        '@id': `${locale.canonical}#faq`,
        '@type': 'FAQPage',
        inLanguage: locale.tag,
        mainEntity: content.faq.items.map((item) => ({
          '@type': 'Question',
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
          name: item.question,
        })),
      },
    ],
  };
}

/** Builds safe, content-derived metadata for an already-rendered locale route. */
export function getLocalizedSeoTags(content: LandingContent, locale: LandingLocaleDefinition): string {
  const title = escapeHtml(content.metadata.title);
  const description = escapeHtml(content.metadata.description);
  const canonical = escapeHtml(locale.canonical);
  const plainText = escapeHtml(locale.pageText);

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    `<link rel="canonical" href="${canonical}">`,
    `<link rel="alternate" type="text/plain" href="${plainText}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${escapeHtml(content.navigation.brand)}">`,
    `<meta property="og:locale" content="${escapeHtml(locale.ogLocale)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<script type="application/ld+json">${serializeJsonLd(createStructuredData(content, locale))}</script>`,
  ].join('\n');
}
