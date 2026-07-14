import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { minify } from 'html-minifier-terser';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LandingPage } from '../components/LandingPage.js';
import {
  getLocaleDefinition,
  publishedLocaleContent,
  publishedLocaleTags,
  type LandingContent,
  type LandingLocale,
} from '../content/index.js';
import { getLocalizedSeoTags } from './seo.js';

const repositoryRoot = path.resolve(__dirname, '../../..');
const defaultOutputDirectory = path.join(repositoryRoot, 'build/github-pages');
export type LocaleGenerationOptions = {
  outputDirectory?: string;
};

export async function generateLocalePages(options: LocaleGenerationOptions = {}): Promise<void> {
  const outputDirectory = options.outputDirectory ?? defaultOutputDirectory;
  const baseDocument = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');

  for (const localeTag of publishedLocaleTags) {
    const content = publishedLocaleContent[localeTag];
    const locale = getLocaleDefinition(localeTag);
    const pageDirectory = locale.routeSlug ? path.join(outputDirectory, locale.routeSlug) : outputDirectory;
    await mkdir(pageDirectory, { recursive: true });
    await writeFile(
      path.join(pageDirectory, 'index.html'),
      await minifyDocument(renderDocument(baseDocument, content, localeTag)),
    );
  }
}

async function minifyDocument(document: string): Promise<string> {
  return minify(document, {
    collapseWhitespace: true,
    minifyCSS: true,
    minifyJS: true,
    removeComments: true,
    removeRedundantAttributes: false,
    sortAttributes: false,
    sortClassName: false,
  });
}

function renderDocument(baseDocument: string, content: LandingContent, localeTag: LandingLocale): string {
  const locale = getLocaleDefinition(localeTag);
  const head = getDocumentHead(baseDocument);
  const bodySuffix = getBodySuffix(baseDocument);
  const staticMarkup = renderToStaticMarkup(createElement(LandingPage, { content, locale }));
  const localizedHead = injectLocalizedMetadata(head, content, localeTag);

  return [
    '<!doctype html>',
    `<html lang="${locale.tag}" dir="${locale.direction}">`,
    localizedHead,
    '<body>',
    `<a class="skip-link" href="#main-content">${content.navigation.skipLink}</a>`,
    `<div id="root">${staticMarkup}</div>`,
    bodySuffix,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function getBodySuffix(baseDocument: string): string {
  const body = baseDocument.match(/<body>([\s\S]*?)<\/body>/i)?.[1];
  if (body === undefined) {
    throw new Error('Landing build output does not contain a body element');
  }

  return body
    .replace(/<a class="skip-link" href="#main-content">[\s\S]*?<\/a>/i, '')
    .replace(/<div id="root"><\/div>/i, '')
    .replace(/<div id="root"><main\b[^>]*><\/main><\/div>/i, '')
    .trim();
}

function getDocumentHead(baseDocument: string): string {
  const head = baseDocument.match(/<head>([\s\S]*?)<\/head>/i)?.[1];
  if (!head) {
    throw new Error('Landing build output does not contain a head element');
  }
  return `<head>${head}</head>`;
}

function injectLocalizedMetadata(head: string, content: LandingContent, localeTag: LandingLocale): string {
  const tags = getLocalizedSeoTags(content, getLocaleDefinition(localeTag));
  const withTitle = head.replace(/<title>[\s\S]*?<\/title>/i, '');

  return withTitle.replace('</head>', `${tags}\n</head>`);
}

if (process.argv[1]?.endsWith(path.join('src', 'landing-page', 'build', 'generate-locales.ts'))) {
  void generateLocalePages().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
