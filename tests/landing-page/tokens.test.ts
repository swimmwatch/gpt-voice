import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const rootDirectory = path.resolve(__dirname, '../..');

type DesignTokens = {
  shadcnCssVariables: Record<string, string>;
};

test('keeps landing shadcn variables aligned with the approved design tokens', async () => {
  const [tokensSource, css] = await Promise.all([
    readFile(path.join(rootDirectory, 'docs/specs/github-pages-landing-page/assets/design-tokens.json'), 'utf8'),
    readFile(path.join(rootDirectory, 'src/landing-page/styles/tokens.css'), 'utf8'),
  ]);
  const tokens = JSON.parse(tokensSource) as DesignTokens;

  for (const [name, value] of Object.entries(tokens.shadcnCssVariables)) {
    assert.ok(css.toLowerCase().includes(`${name}: ${value}`.toLowerCase()));
  }
});

test('keeps landing shadcn aliases within the isolated source tree', async () => {
  const source = await readFile(path.join(rootDirectory, 'src/landing-page/components.json'), 'utf8');
  const config = JSON.parse(source) as { aliases: Record<string, string>; tailwind: { css: string } };

  assert.equal(config.tailwind.css, 'styles/globals.css');
  for (const alias of Object.values(config.aliases)) {
    assert.ok(alias.startsWith('@landing/'));
  }
});
