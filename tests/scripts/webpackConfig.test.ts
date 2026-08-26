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
  assert.deepEqual(preloadConfig.entry, {
    preload: './src/main/preload.ts',
    'prettify-profile-chooser-preload': './src/main/prettifyProfileChooserPreload.ts',
  });
  assert.equal((preloadConfig.output as { filename?: string }).filename, '[name].js');
  assert.equal(webpackConfigs.length, 3);
  assert.deepEqual(rendererRule?.use, {
    loader: 'ts-loader',
    options: { configFile: path.join(rootDirectory, 'tsconfig.renderer.json') },
  });
});

test('emits the isolated chooser preload, renderer entry, and exact HTML chunk', () => {
  const webpackConfigs = require(path.join(rootDirectory, 'webpack.config.js')) as Array<Record<string, unknown>>;
  const preloadConfig = webpackConfigs[1];
  const rendererWebpackConfig = webpackConfigs[2];
  const rendererEntries = rendererWebpackConfig.entry as Record<string, string>;
  const plugins = rendererWebpackConfig.plugins as Array<{
    options?: { filename?: string };
    userOptions?: { chunks?: string[]; filename?: string };
  }>;

  assert.deepEqual(Object.keys(preloadConfig.entry as Record<string, string>).sort(), [
    'preload',
    'prettify-profile-chooser-preload',
  ]);
  assert.equal(rendererEntries.prettifyProfileChooser, './src/renderer/entries/prettifyProfileChooser.tsx');
  const chooserPlugin = plugins.find(
    (plugin) =>
      plugin.options?.filename === 'prettify-profile-chooser.html' ||
      plugin.userOptions?.filename === 'prettify-profile-chooser.html',
  );
  assert.ok(chooserPlugin);
  assert.deepEqual(chooserPlugin.userOptions?.chunks, ['prettifyProfileChooser']);
});

test('keeps the provider hotkey demo development-only and outside production navigation', async () => {
  const webpackConfig = await readFile(path.join(rootDirectory, 'webpack.config.js'), 'utf8');

  assert.match(
    webpackConfig,
    /\.\.\.\(!isProd \? \{ providerHotkeyDemo: '\.\/src\/renderer\/entries\/providerHotkeyDemo\.tsx' \} : \{\}\),/u,
  );
  assert.match(webpackConfig, /\.\.\.\(!isProd\s*\? \[\s*new HtmlWebpackPlugin\(/u);
  assert.match(webpackConfig, /filename: 'provider-hotkey-demo\.html'/u);
  assert.match(webpackConfig, /chunks: \['providerHotkeyDemo'\]/u);
});

test('emits the live PCM worklet as one local renderer asset under the strict startup CSP', async () => {
  const webpackConfigs = require(path.join(rootDirectory, 'webpack.config.js')) as Array<Record<string, unknown>>;
  const rendererWebpackConfig = webpackConfigs[2];
  const rules = (rendererWebpackConfig.module as { rules: Array<Record<string, unknown>> }).rules;
  const workletRule = rules.find((rule) => String(rule.test).includes('worklet'));
  const captureAsset = await readFile(
    path.join(rootDirectory, 'src', 'renderer', 'audio', 'livePcmCaptureAsset.ts'),
    'utf8',
  );
  const captureBrowser = await readFile(
    path.join(rootDirectory, 'src', 'renderer', 'audio', 'livePcmCaptureBrowser.ts'),
    'utf8',
  );
  const indexHtml = await readFile(path.join(rootDirectory, 'src', 'renderer', 'index.html'), 'utf8');

  assert.equal(workletRule?.type, 'asset/resource');
  assert.deepEqual(workletRule?.generator, { filename: 'renderer/assets/[name][ext]' });
  assert.match(captureAsset, /import workletAssetUrl from '\.\/livePcmCapture\.worklet\.js';/u);
  assert.match(captureBrowser, /audioWorklet\.addModule\(LIVE_PCM_WORKLET_ASSET_URL\)/u);
  assert.match(indexHtml, /default-src 'self'; script-src 'self';/u);
  assert.doesNotMatch(indexHtml, /script-src[^;]*(?:\*|https?:)/u);
});
