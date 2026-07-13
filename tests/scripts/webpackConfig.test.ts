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

test('excludes landing-page source from Electron TypeScript compilation', async () => {
  const rootConfig = JSON.parse(await readFile(path.join(rootDirectory, 'tsconfig.json'), 'utf8')) as { exclude: string[] };
  const testConfig = JSON.parse(await readFile(path.join(rootDirectory, 'tsconfig.test.json'), 'utf8')) as { exclude: string[] };
  const webpackConfigs = require(path.join(rootDirectory, 'webpack.config.js')) as Array<Record<string, unknown>>;

  assert.ok(rootConfig.exclude.includes('src/landing-page/**'));
  assert.ok(testConfig.exclude.includes('src/landing-page/**'));

  for (const webpackConfig of webpackConfigs) {
    const typeScriptRule = (webpackConfig.module as { rules: Array<Record<string, unknown>> }).rules.find((rule) =>
      String(rule.test).includes('ts'),
    );
    const exclude = typeScriptRule?.exclude as RegExp | undefined;

    assert.ok(exclude?.test(path.join(rootDirectory, 'src', 'landing-page', 'entry-client.tsx')));
  }
});
