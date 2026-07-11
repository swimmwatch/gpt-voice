import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const rootDirectory = path.resolve(__dirname, '..', '..');
const require = createRequire(__filename);

test('assigns a dedicated renderer entry to every application window', () => {
  const webpackConfigs = require(path.join(rootDirectory, 'webpack.config.js')) as Array<Record<string, unknown>>;
  const rendererConfig = webpackConfigs[2] as {
    entry: Record<string, string>;
    optimization: { runtimeChunk: string; splitChunks: { chunks: string } };
    output: { filename: string };
    plugins: Array<{ userOptions?: { chunks?: string[]; filename?: string } }>;
  };

  assert.deepEqual(rendererConfig.entry, {
    about: './src/renderer/entries/about.tsx',
    history: './src/renderer/entries/history.tsx',
    main: './src/renderer/entries/main.tsx',
    settings: './src/renderer/entries/settings.tsx',
  });
  assert.equal(rendererConfig.output.filename, '[name].js');
  assert.equal(rendererConfig.optimization.runtimeChunk, 'single');
  assert.equal(rendererConfig.optimization.splitChunks.chunks, 'all');

  const htmlChunks = new Map(
    rendererConfig.plugins.map((plugin) => [plugin.userOptions?.filename, plugin.userOptions?.chunks]),
  );
  assert.deepEqual(htmlChunks.get('index.html'), ['main']);
  assert.deepEqual(htmlChunks.get('settings.html'), ['settings']);
  assert.deepEqual(htmlChunks.get('history.html'), ['history']);
  assert.deepEqual(htmlChunks.get('about.html'), ['about']);
});
