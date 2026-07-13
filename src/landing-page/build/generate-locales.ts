import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LandingPage } from '../components/LandingPage.js';
import { englishContent, getLocaleDefinition, type LandingContent, type LandingLocale } from '../content/index.js';

const repositoryRoot = path.resolve(__dirname, '../../..');
const defaultOutputDirectory = path.join(repositoryRoot, 'build/github-pages');
const contentByLocale = new Map<LandingLocale, LandingContent>([['en', englishContent]]);

export type LocaleGenerationOptions = {
  outputDirectory?: string;
};

export async function generateLocalePages(options: LocaleGenerationOptions = {}): Promise<void> {
  const outputDirectory = options.outputDirectory ?? defaultOutputDirectory;
  const baseDocument = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');

  for (const [localeTag, content] of contentByLocale) {
    const locale = getLocaleDefinition(localeTag);
    const pageDirectory = locale.routeSlug ? path.join(outputDirectory, locale.routeSlug) : outputDirectory;
    await mkdir(pageDirectory, { recursive: true });
    await writeFile(path.join(pageDirectory, 'index.html'), renderDocument(baseDocument, content, localeTag));
  }
}

function renderDocument(baseDocument: string, content: LandingContent, localeTag: LandingLocale): string {
  const locale = getLocaleDefinition(localeTag);
  const head = getDocumentHead(baseDocument);
  const staticMarkup = renderToStaticMarkup(createElement(LandingPage, { content, locale }));
  const localizedHead = injectLocalizedMetadata(head, content, locale.canonical, locale.pageText);

  return [
    '<!doctype html>',
    `<html lang="${locale.tag}" dir="${locale.direction}">`,
    localizedHead,
    '<body>',
    `<a class="skip-link" href="#main-content">${content.navigation.skipLink}</a>`,
    `<div id="root">${staticMarkup}</div>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function getDocumentHead(baseDocument: string): string {
  const head = baseDocument.match(/<head>([\s\S]*?)<\/head>/i)?.[1];
  if (!head) {
    throw new Error('Landing build output does not contain a head element');
  }
  return `<head>${head}</head>`;
}

function injectLocalizedMetadata(head: string, content: LandingContent, canonical: string, pageText: string): string {
  const title = `<title>${content.metadata.title}</title>`;
  const description = `<meta name="description" content="${content.metadata.description}" />`;
  const canonicalLink = `<link rel="canonical" href="${canonical}" />`;
  const plainTextLink = `<link rel="alternate" type="text/plain" href="${pageText}" />`;
  const withTitle = head.replace(/<title>[\s\S]*?<\/title>/i, title);

  return withTitle.replace('</head>', `${description}\n${canonicalLink}\n${plainTextLink}\n</head>`);
}

if (process.argv[1]?.endsWith(path.join('src', 'landing-page', 'build', 'generate-locales.ts'))) {
  void generateLocalePages().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
