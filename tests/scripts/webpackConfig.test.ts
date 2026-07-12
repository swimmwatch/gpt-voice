import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const rootDirectory = path.resolve(__dirname, '..', '..');
const require = createRequire(__filename);

test('uses ESM only for the renderer TypeScript compilation', async () => {
  const rendererConfig = JSON.parse(await readFile(path.join(rootDirectory, 'tsconfig.renderer.json'), 'utf8'));
  const webpackConfigs = require(path.join(rootDirectory, 'webpack.config.js')) as Array<Record<string, unknown>>;
  const [mainConfig, preloadConfig, rendererWebpackConfig] = webpackConfigs;
  const rendererRule = (rendererWebpackConfig.module as { rules: Array<Record<string, unknown>> }).rules.find((rule) =>
    String(rule.test).includes('tsx'),
  );

  assert.deepEqual(rendererConfig.compilerOptions, {
    module: 'ESNext',
    moduleResolution: 'bundler',
    target: 'ES2022',
    types: ['node'],
  });
  assert.equal(mainConfig.target, 'electron-main');
  assert.equal(preloadConfig.target, 'electron-preload');
  assert.deepEqual(rendererRule?.use, {
    loader: 'ts-loader',
    options: { configFile: path.join(rootDirectory, 'tsconfig.renderer.json') },
  });
});
