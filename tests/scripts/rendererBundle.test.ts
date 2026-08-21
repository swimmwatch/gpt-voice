import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { RENDERER_WINDOW_ENTRIES, RendererBundleVerifier } from '@scripts/renderer-bundle-verifier';

const rootDirectory = path.resolve(__dirname, '..', '..');
const require = createRequire(__filename);

interface RendererRule {
  generator?: { filename?: string };
  test: RegExp;
  type?: string;
  use: string[];
}

interface RendererPlugin {
  constructor: { name: string };
  options?: { chunkFilename?: string; filename?: string };
  userOptions?: { chunks?: string[]; filename?: string };
}

interface RendererConfig {
  entry: Record<string, string>;
  module: { rules: RendererRule[] };
  optimization: {
    minimizer?: Array<string | { constructor: { name: string } }>;
    runtimeChunk: string;
    splitChunks: { chunks: string };
  };
  output: { assetModuleFilename: string; chunkFilename: string; filename: string; path: string };
  plugins: RendererPlugin[];
}

function loadRendererConfig(nodeEnvironment: 'development' | 'production'): RendererConfig {
  const configPath = path.join(rootDirectory, 'webpack.config.js');
  const originalNodeEnvironment = process.env.NODE_ENV;

  process.env.NODE_ENV = nodeEnvironment;
  delete require.cache[configPath];

  try {
    const webpackConfigs = require(configPath) as RendererConfig[];
    return webpackConfigs[2];
  } finally {
    delete require.cache[configPath];
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  }
}

function getStyleRule(rendererConfig: RendererConfig, extension: 'css' | 'scss'): RendererRule {
  const rule = rendererConfig.module.rules.find((candidate) => candidate.test.test(`styles.${extension}`));

  assert.ok(rule, `Expected a ${extension} loader rule.`);
  return rule;
}

test('assigns a dedicated renderer entry to every application window', () => {
  const rendererConfig = loadRendererConfig('development');

  assert.deepEqual(rendererConfig.entry, {
    about: './src/renderer/entries/about.tsx',
    history: './src/renderer/entries/history.tsx',
    main: './src/renderer/entries/main.tsx',
    providerHotkeyDemo: './src/renderer/entries/providerHotkeyDemo.tsx',
    prettifyProfileChooser: './src/renderer/entries/prettifyProfileChooser.tsx',
    providerSettings: './src/renderer/entries/providerSettings.tsx',
    settings: './src/renderer/entries/settings.tsx',
  });
  assert.equal(rendererConfig.output.filename, 'renderer/[name].js');
  assert.equal(rendererConfig.output.chunkFilename, 'renderer/[id].js');
  assert.equal(rendererConfig.output.assetModuleFilename, 'renderer/assets/[name].[contenthash][ext]');
  assert.equal(rendererConfig.optimization.runtimeChunk, 'single');
  assert.equal(rendererConfig.optimization.splitChunks.chunks, 'all');

  const workletRule = rendererConfig.module.rules.find((rule) => rule.test.test('livePcmCapture.worklet.js'));
  assert.ok(workletRule);
  assert.equal(workletRule.type, 'asset/resource');
  assert.equal(workletRule.generator?.filename, 'renderer/assets/[name][ext]');

  const htmlChunks = new Map(
    rendererConfig.plugins.map((plugin) => [plugin.userOptions?.filename, plugin.userOptions?.chunks]),
  );
  assert.deepEqual(htmlChunks.get('index.html'), ['main']);
  assert.deepEqual(htmlChunks.get('provider-hotkey-demo.html'), ['providerHotkeyDemo']);
  assert.deepEqual(htmlChunks.get('provider-settings.html'), ['providerSettings']);
  assert.deepEqual(htmlChunks.get('prettify-profile-chooser.html'), ['prettifyProfileChooser']);
  assert.deepEqual(htmlChunks.get('settings.html'), ['settings']);
  assert.deepEqual(htmlChunks.get('history.html'), ['history']);
  assert.deepEqual(htmlChunks.get('about.html'), ['about']);
});

test('verifies renderer bundles under a separate nested path from Electron main', async () => {
  const outputPath = await mkdtemp(path.join(tmpdir(), 'gpt-voice-renderer-bundle-'));

  try {
    const rendererPath = path.join(outputPath, 'renderer');
    const assetPath = path.join(rendererPath, 'assets');
    await mkdir(assetPath, { recursive: true });
    await writeFile(path.join(outputPath, 'main.js'), 'electron-main');
    await writeFile(path.join(rendererPath, 'main.js'), 'renderer-main');
    await writeFile(
      path.join(assetPath, 'livePcmCapture.worklet.js'),
      'gpt-voice-live-pcm-capture;registerProcessor();',
    );
    for (const { entry, htmlFile } of RENDERER_WINDOW_ENTRIES) {
      const cssHref = `renderer/${entry}.hash.css`;
      await writeFile(path.join(rendererPath, `${entry}.hash.css`), '.fixture{display:block}');
      await writeFile(
        path.join(outputPath, htmlFile),
        `<link rel="stylesheet" href="${cssHref}"><script src="renderer/${entry}.js"></script>`,
      );
    }

    const verifier = new RendererBundleVerifier(outputPath);
    await verifier.verify();

    await writeFile(path.join(outputPath, 'provider-hotkey-demo.html'), 'development-only');
    await assert.rejects(
      verifier.verify(),
      (error: unknown) =>
        error instanceof Error &&
        error.name === 'RendererBundleVerificationError' &&
        error.message === 'DEVELOPMENT_DEMO_EMITTED',
    );
  } finally {
    await rm(outputPath, { force: true, recursive: true });
  }
});

test('extracts and minifies production CSS without changing development style injection', () => {
  const developmentConfig = loadRendererConfig('development');
  const productionConfig = loadRendererConfig('production');

  assert.equal(getStyleRule(developmentConfig, 'css').use[0], 'style-loader');
  assert.equal(getStyleRule(developmentConfig, 'scss').use[0], 'style-loader');
  assert.match(getStyleRule(productionConfig, 'css').use[0], /mini-css-extract-plugin/u);
  assert.match(getStyleRule(productionConfig, 'scss').use[0], /mini-css-extract-plugin/u);

  const cssExtractionPlugin = productionConfig.plugins.find(
    (plugin) => plugin.constructor.name === 'MiniCssExtractPlugin',
  );
  assert.ok(cssExtractionPlugin);
  assert.equal(cssExtractionPlugin.options?.filename, 'renderer/[name].[contenthash].css');
  assert.equal(cssExtractionPlugin.options?.chunkFilename, 'renderer/[id].[contenthash].css');

  assert.ok(productionConfig.optimization.minimizer?.includes('...'));
  assert.ok(
    productionConfig.optimization.minimizer?.some(
      (minimizer) => typeof minimizer !== 'string' && minimizer.constructor.name === 'CssMinimizerPlugin',
    ),
  );
});
