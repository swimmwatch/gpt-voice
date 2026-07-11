import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import webpack, { type Configuration } from 'webpack';

const rootDirectory = path.resolve(__dirname, '..', '..');
const require = createRequire(__filename);

interface RendererConfig {
  entry: Record<string, string>;
  optimization: { runtimeChunk: string; splitChunks: { chunks: string } };
  output: { assetModuleFilename: string; chunkFilename: string; filename: string; path: string };
  plugins: Array<{ userOptions?: { chunks?: string[]; filename?: string } }>;
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

function emitRendererBundle(config: RendererConfig, outputPath: string): Promise<void> {
  const compiler = webpack({
    ...config,
    output: {
      ...config.output,
      path: outputPath,
    },
  } as Configuration);

  return new Promise((resolve, reject) => {
    compiler.run((runError, stats) => {
      compiler.close((closeError) => {
        if (runError) {
          reject(runError);
          return;
        }
        if (closeError) {
          reject(closeError);
          return;
        }
        if (!stats) {
          reject(new Error('Webpack renderer compiler did not return build stats.'));
          return;
        }
        if (stats.hasErrors()) {
          const messages = stats
            .toJson({ all: false, errors: true })
            .errors?.map((error) => error.message)
            .join('\n');
          reject(new Error(messages || 'Webpack renderer compilation failed.'));
          return;
        }
        resolve();
      });
    });
  });
}

test('assigns a dedicated renderer entry to every application window', () => {
  const rendererConfig = loadRendererConfig('development');

  assert.deepEqual(rendererConfig.entry, {
    about: './src/renderer/entries/about.tsx',
    history: './src/renderer/entries/history.tsx',
    main: './src/renderer/entries/main.tsx',
    settings: './src/renderer/entries/settings.tsx',
  });
  assert.equal(rendererConfig.output.filename, 'renderer/[name].js');
  assert.equal(rendererConfig.output.chunkFilename, 'renderer/[id].js');
  assert.equal(rendererConfig.output.assetModuleFilename, 'renderer/assets/[name].[contenthash][ext]');
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

test('emits renderer bundles under a separate nested path from Electron main', async () => {
  const outputPath = await mkdtemp(path.join(tmpdir(), 'gpt-voice-renderer-bundle-'));

  try {
    await emitRendererBundle(loadRendererConfig('production'), outputPath);

    const outputFiles = await readdir(outputPath);
    assert.ok(!outputFiles.includes('main.js'));

    const windows = [
      ['index.html', 'main'],
      ['settings.html', 'settings'],
      ['history.html', 'history'],
      ['about.html', 'about'],
    ] as const;
    for (const [htmlFile, entry] of windows) {
      const html = await readFile(path.join(outputPath, htmlFile), 'utf8');

      assert.ok(html.includes(`src="renderer/${entry}.js"`));
      for (const [, otherEntry] of windows) {
        if (otherEntry !== entry) {
          assert.ok(!html.includes(`src="renderer/${otherEntry}.js"`));
        }
      }
    }
  } finally {
    await rm(outputPath, { force: true, recursive: true });
  }
});
