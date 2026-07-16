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

test('publishes only locale routes with complete content', () => {
  assert.deepEqual(publishedLocaleTags, ['en']);
  assert.deepEqual(publishedLocaleDefinitions, [getLocaleDefinition('en')]);
  assert.equal(publishedLocaleContent.ru, undefined);
});
