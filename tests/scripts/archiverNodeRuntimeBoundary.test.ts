import assert from 'node:assert/strict';
import * as fs from 'node:fs';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Node >=24 test-only synchronous hook verifies forbidden module resolution and is always deregistered.
import { registerHooks } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

type DiagnosticsArchiveFormatModule = typeof import('../../src/main/services/diagnosticsArchiveFormat');

const WORKSPACE_PATH = path.resolve(__dirname, '../..');
const ARCHIVE_FORMAT_MODULE_PATH = path.join(WORKSPACE_PATH, 'src/main/services/diagnosticsArchiveFormat.ts');
const BARE_ONLY_RUNTIME_MODULES = new Set(['bare-fs', 'bare-path', 'bare-stream', 'bare-url', 'teex']);
const ARCHIVE_MEMBERS = [
  { name: 'manifest.json', payload: Buffer.from('{"schemaVersion":1}', 'utf8') },
  { name: 'provider-audit/events.jsonl', payload: Buffer.from('{"event":"started"}\n', 'utf8') },
] as const;
const temporaryDirectories: string[] = [];

function isBareOnlySpecifier(specifier: string): boolean {
  const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  return BARE_ONLY_RUNTIME_MODULES.has(packageName);
}

afterEach(() => {
  for (const directory of temporaryDirectories) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
  temporaryDirectories.length = 0;
});

describe('Archiver Electron/Node runtime boundary', () => {
  it('creates and verifies ZIP and tar.gz without loading the Bare-only branch', async () => {
    const attemptedBareModules: string[] = [];
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        if (isBareOnlySpecifier(specifier)) {
          attemptedBareModules.push(specifier);
          throw new Error('Bare-only module load rejected');
        }
        return nextResolve(specifier, context);
      },
    });

    try {
      const imported: DiagnosticsArchiveFormatModule = await import(
        `${pathToFileURL(ARCHIVE_FORMAT_MODULE_PATH).href}?electron-node-runtime-boundary`
      );
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-voice-archive-runtime-'));
      temporaryDirectories.push(directory);
      const adapter = new imported.DiagnosticsArchiveFormatAdapter({
        fileSystem: {
          chmod: (filePath, mode) => fs.promises.chmod(filePath, mode),
          createWriteStream: (filePath, options) => fs.createWriteStream(filePath, options),
          readFile: (filePath) => fs.promises.readFile(filePath),
        },
        platform: 'linux',
        writerFactory: new imported.ArchiverDiagnosticsArchiveWriterFactory(),
      });

      for (const { format, suffix } of [
        { format: 'zip', suffix: 'zip' },
        { format: 'tar-gzip', suffix: 'tar.gz' },
      ] as const) {
        const outputPath = path.join(directory, `diagnostics.${suffix}`);
        await adapter.writeAndVerify(format, outputPath, ARCHIVE_MEMBERS);
        assert.equal(fs.statSync(outputPath).isFile(), true);
        assert.ok(fs.statSync(outputPath).size > 0);
      }
      assert.deepEqual(attemptedBareModules, []);
    } finally {
      hooks.deregister();
    }
  });
});
