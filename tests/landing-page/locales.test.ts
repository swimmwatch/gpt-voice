import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  defaultLocale,
  getDocumentationRoute,
  getLocaleDefinition,
  getLocaleFromRouteSlug,
  localeRegistry,
  publishedLocaleContent,
  publishedLocaleDefinitions,
  publishedLocaleTags,
  supportedLocales,
} from '../../src/landing-page/content';

const rootDirectory = path.resolve(__dirname, '../..');

type LocalizationMatrix = {
  defaultLocale: string;
  locales: typeof localeRegistry;
};

test('keeps the landing locale registry aligned with the approved route matrix', async () => {
  const source = await readFile(
    path.join(rootDirectory, 'docs/specs/github-pages-landing-page/assets/localization-matrix.json'),
    'utf8',
  );
  const matrix = JSON.parse(source) as LocalizationMatrix;

  assert.equal(defaultLocale, matrix.defaultLocale);
  assert.deepEqual(localeRegistry, matrix.locales);
  assert.deepEqual(
    supportedLocales,
    matrix.locales.map(({ tag }) => tag),
  );
});

test('resolves approved route slugs without an implicit locale fallback', () => {
  assert.equal(getLocaleDefinition('en').canonical, 'https://swimmwatch.github.io/gpt-voice/');
  assert.equal(getLocaleFromRouteSlug(''), 'en');
  assert.equal(getLocaleFromRouteSlug('pt-br'), 'pt-BR');
  assert.equal(getLocaleFromRouteSlug('unknown'), undefined);
});

test('derives reserved documentation routes without allowing unsafe slug aliases', () => {
  assert.deepEqual(
    localeRegistry.map((locale) => [locale.tag, getDocumentationRoute(locale)]),
    [
      ['en', '/gpt-voice/docs/'],
      ['ru', '/gpt-voice/docs/ru/'],
      ['be', '/gpt-voice/docs/be/'],
      ['uk', '/gpt-voice/docs/uk/'],
      ['es', '/gpt-voice/docs/es/'],
      ['pt-BR', '/gpt-voice/docs/pt-br/'],
      ['zh-CN', '/gpt-voice/docs/zh-cn/'],
      ['ja', '/gpt-voice/docs/ja/'],
      ['de', '/gpt-voice/docs/de/'],
      ['fr', '/gpt-voice/docs/fr/'],
      ['hi', '/gpt-voice/docs/hi/'],
    ],
  );
  assert.throws(
    () => getDocumentationRoute({ ...getLocaleDefinition('pt-BR'), routeSlug: 'pt-BR' }),
    /lowercase route slug/u,
  );
  assert.throws(
    () => getDocumentationRoute({ ...getLocaleDefinition('pt-BR'), routeSlug: '../escape' }),
    /lowercase route slug/u,
  );
});

test('publishes every locale only when it has complete localized landing content', () => {
  assert.deepEqual(publishedLocaleTags, supportedLocales);
  assert.deepEqual(publishedLocaleDefinitions, localeRegistry);

  for (const locale of localeRegistry) {
    const content = publishedLocaleContent[locale.tag];
    assert.ok(content, `Expected published landing content for ${locale.tag}`);
    assert.equal(content.links.documentation, getDocumentationRoute(locale));
    assert.equal(content.navigation.currentLanguage, locale.nativeLabel);
    assert.ok(content.hero.title.length > 0);
    assert.ok(content.demo.captionTrackLabel.length > 0);
  }
});

test('gives every non-English landing locale a complete, cue-specific subtitle source', () => {
  for (const locale of localeRegistry.filter((candidate) => candidate.tag !== 'en')) {
    const cues = publishedLocaleContent[locale.tag].demo.transcriptCues;

    assert.equal(cues.length, 9, `${locale.tag} needs one transcript entry for every demo moment`);
    assert.equal(
      new Set(cues.map((cue) => cue.narration)).size,
      cues.length,
      `${locale.tag} must not reuse one generic subtitle for every demo moment`,
    );
    assert.equal(
      new Set(cues.map((cue) => cue.visualDescription)).size,
      cues.length,
      `${locale.tag} must provide cue-specific visual text`,
    );
  }
});
