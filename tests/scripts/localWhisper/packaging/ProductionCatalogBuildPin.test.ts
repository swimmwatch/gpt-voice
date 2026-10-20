import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';

const CONFIG_PATH = path.resolve(__dirname, '../../../../webpack.config.js');
const DEFINITION_NAME = '__LOCAL_WHISPER_PRODUCTION_BUNDLE_MANIFEST_SHA256__';
const READ_DEFINITION = `const configs = require(process.argv[1]);
console.log(configs[0].plugins[0].definitions[${JSON.stringify(DEFINITION_NAME)}]);`;

function buildEnvironment(descriptor: string, directory: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LOCAL_WHISPER_PRODUCTION_BUNDLE_DESCRIPTOR: descriptor,
    LOCAL_WHISPER_PRODUCTION_BUNDLE_DIRECTORY: directory,
  };
}

function definition(environment: NodeJS.ProcessEnv): string {
  return execFileSync(process.execPath, ['-e', READ_DEFINITION, CONFIG_PATH], {
    env: environment,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

describe('production catalog build pin', () => {
  it('keeps ordinary development builds untrusted and rejects incomplete release inputs', () => {
    assert.equal(definition(buildEnvironment('', '')), 'null');
    assert.throws(() => definition(buildEnvironment('descriptor.json', '')), /incomplete/u);
  });

  it('compiles only the independently pinned approved manifest digest into the main-process build', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'production-catalog-build-pin-'));
    try {
      const bundle = path.join(root, 'bundle');
      await mkdir(bundle);
      const manifest = Buffer.from('{"purpose":"production","schemaVersion":1}', 'utf8');
      const digest = createHash('sha256').update(manifest).digest('hex');
      await writeFile(path.join(bundle, 'bundle-manifest.json'), manifest);
      const descriptorPath = path.join(root, 'descriptor.json');
      const descriptor = { schemaVersion: 1, purpose: 'production', platform: 'linux', bundleManifestSha256: digest };
      await writeFile(descriptorPath, JSON.stringify(descriptor));
      const environment = buildEnvironment(descriptorPath, bundle);
      assert.equal(definition(environment), JSON.stringify(digest));

      const entry = path.join(root, 'entry.cjs');
      await writeFile(entry, `module.exports = ${DEFINITION_NAME};`);
      const compile = `const webpack = require('webpack');
const main = require(process.argv[1])[0];
webpack({ mode: 'development', target: 'node', entry: process.argv[2],
  output: { path: process.argv[3], filename: 'pin.cjs', library: { type: 'commonjs2' } },
  plugins: main.plugins }, (error, stats) => {
    if (error || stats.hasErrors()) { console.error(error || stats.toString()); process.exitCode = 1; }
  });`;
      const output = path.join(root, 'compiled');
      execFileSync(process.execPath, ['-e', compile, CONFIG_PATH, entry, output], {
        cwd: path.dirname(CONFIG_PATH),
        env: environment,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const compiledDigest = execFileSync(
        process.execPath,
        ['-e', 'console.log(require(process.argv[1]))', path.join(output, 'pin.cjs')],
        {
          encoding: 'utf8',
        },
      ).trim();
      assert.equal(compiledDigest, digest);
      assert.ok((await readFile(path.join(output, 'pin.cjs'), 'utf8')).includes(digest));

      await writeFile(descriptorPath, JSON.stringify({ ...descriptor, purpose: 'fixture' }));
      assert.throws(() => definition(environment), /does not match/u);
      await writeFile(descriptorPath, JSON.stringify(descriptor));
      await writeFile(path.join(bundle, 'bundle-manifest.json'), '{}');
      assert.throws(() => definition(environment), /does not match/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
