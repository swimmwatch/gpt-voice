import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  defaultLocale,
  getLocaleDefinition,
  getLocaleFromRouteSlug,
  localeRegistry,
  supportedLocales,
} from '../../src/landing-page/content/locale-registry';

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
