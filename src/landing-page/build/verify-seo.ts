import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { englishContent, getLocaleDefinition } from '../content/index.js';

const repositoryRoot = path.resolve(__dirname, '../../..');
const defaultOutputDirectory = path.join(repositoryRoot, 'build/github-pages');
const englishLocale = getLocaleDefinition('en');

type JsonLdNode = Record<string, unknown> & { '@type': string };

type JsonLdGraph = {
  '@graph': JsonLdNode[];
  '@context': string;
};

export async function verifySeoOutput(outputDirectory = defaultOutputDirectory): Promise<void> {
  const document = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');

  assertIncludes(document, '<html lang="en" dir="ltr">', 'English document language');
  assertIncludes(document, `<title>${englishContent.metadata.title}</title>`, 'page title');
  assertIncludes(
    document,
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    'indexable robots directive',
  );
  assertIncludes(document, `<link rel="canonical" href="${englishLocale.canonical}">`, 'self-canonical link');
  assertIncludes(
    document,
    `<link rel="alternate" type="text/plain" href="${englishLocale.pageText}">`,
    'plain-text alternate',
  );
  assertIncludes(document, `<meta property="og:url" content="${englishLocale.canonical}">`, 'Open Graph canonical URL');
  assertIncludes(document, '<meta name="twitter:card" content="summary">', 'Twitter card');

  if (/\bnoindex\b/i.test(document)) {
    throw new Error('English landing output must not contain a noindex directive');
  }

  const graph = getJsonLdGraph(document);
  assertEnglishStructuredData(graph);
}

function assertEnglishStructuredData(graph: JsonLdGraph): void {
  if (graph['@context'] !== 'https://schema.org') {
    throw new Error('JSON-LD must use the Schema.org context');
  }
  const types = graph['@graph'].map((node) => node['@type']);
  const expectedTypes = ['WebSite', 'SoftwareApplication', 'VideoObject', 'FAQPage'];
  if (types.join(',') !== expectedTypes.join(',')) {
    throw new Error(`JSON-LD graph must contain: ${expectedTypes.join(', ')}`);
  }

  const [website, application, video, faq] = graph['@graph'];
  assertNodeValue(website, 'url', englishLocale.canonical, 'WebSite canonical URL');
  assertNodeValue(application, 'url', englishLocale.canonical, 'SoftwareApplication canonical URL');
  assertNodeValue(application, 'codeRepository', englishContent.links.repository, 'SoftwareApplication repository URL');
  assertNodeValue(video, 'contentUrl', `${englishLocale.canonical}generated/media/demo.mp4`, 'VideoObject media URL');
  assertNodeValue(
    video,
    'thumbnailUrl',
    `${englishLocale.canonical}generated/media/demo-poster.webp`,
    'VideoObject poster URL',
  );
  assertNodeValue(video, 'duration', 'PT1M', 'VideoObject duration');
  assertNodeValue(
    video,
    'transcript',
    englishContent.demo.transcriptCues.map((cue) => cue.visualDescription).join(' '),
    'VideoObject transcript',
  );

  const questions = faq?.mainEntity;
  if (!Array.isArray(questions) || questions.length !== englishContent.faq.items.length) {
    throw new Error('FAQPage must contain every visible English FAQ item');
  }
  assertAbsoluteStructuredDataUrls(graph);
}

function getJsonLdGraph(document: string): JsonLdGraph {
  const source = document.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1];
  if (!source) {
    throw new Error('English landing output is missing JSON-LD');
  }

  const parsed: unknown = JSON.parse(source);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('@context' in parsed) ||
    !('@graph' in parsed) ||
    !Array.isArray(parsed['@graph'])
  ) {
    throw new Error('English landing JSON-LD must contain a graph');
  }

  return parsed as JsonLdGraph;
}

function assertNodeValue(node: JsonLdNode | undefined, key: string, expected: string, label: string): void {
  if (node?.[key] !== expected) {
    throw new Error(`${label} is missing or incorrect`);
  }
}

function assertAbsoluteStructuredDataUrls(graph: JsonLdGraph): void {
  const urlKeys = new Set(['@id', 'codeRepository', 'contentUrl', 'license', 'thumbnailUrl', 'url']);
  for (const node of graph['@graph']) {
    for (const [key, value] of Object.entries(node)) {
      if (!urlKeys.has(key) || typeof value !== 'string') {
        continue;
      }
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new Error(`JSON-LD ${key} must be an absolute URL: ${value}`);
      }
      if (url.protocol !== 'https:') {
        throw new Error(`JSON-LD ${key} must use HTTPS: ${value}`);
      }
    }
  }
}

function assertIncludes(document: string, expected: string, label: string): void {
  if (!document.includes(expected)) {
    throw new Error(`English landing output is missing ${label}`);
  }
}

if (process.argv[1]?.endsWith(path.join('src', 'landing-page', 'build', 'verify-seo.ts'))) {
  void verifySeoOutput().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
