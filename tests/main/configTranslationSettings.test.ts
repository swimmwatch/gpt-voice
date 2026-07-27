import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import type * as fs from 'node:fs';

import { writeTextFileAtomically, type AtomicFileSystem } from '@main/translationSettings';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

class MemoryFileSystem implements AtomicFileSystem {
  failRename = false;
  failWrite = false;
  readonly files = new Map<string, string>();
  readonly removed: string[] = [];
  readonly writes: Array<{ options?: fs.WriteFileOptions; path: string }> = [];

  writeFileSync(file: fs.PathOrFileDescriptor, data: string, options?: fs.WriteFileOptions): void {
    const filePath = String(file);
    this.writes.push({ options, path: filePath });
    if (this.failWrite) throw new Error('write failed');
    this.files.set(filePath, data);
  }

  renameSync(oldPath: fs.PathLike, newPath: fs.PathLike): void {
    if (this.failRename) throw new Error('rename failed');
    const oldKey = String(oldPath);
    const contents = this.files.get(oldKey);
    if (contents === undefined) throw new Error('temporary file missing');
    this.files.set(String(newPath), contents);
    this.files.delete(oldKey);
  }

  rmSync(filePath: fs.PathLike): void {
    const key = String(filePath);
    this.removed.push(key);
    this.files.delete(key);
  }
}

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

describe('config translation settings', () => {
  it('writes mode-0600 temporary bytes before an atomic rename', () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.files.set('/config/config.json', 'previous');

    writeTextFileAtomically('/config/config.json', 'next', {
      createTemporaryPath: () => '/config/config.json.pending',
      fileSystem,
    });

    assert.equal(fileSystem.files.get('/config/config.json'), 'next');
    assert.equal(fileSystem.files.has('/config/config.json.pending'), false);
    assert.deepEqual(fileSystem.writes, [
      {
        options: { encoding: 'utf8', flag: 'wx', mode: 0o600 },
        path: '/config/config.json.pending',
      },
    ]);
  });

  it('preserves previous bytes and removes temporary files after write or rename failures', () => {
    for (const failure of ['write', 'rename'] as const) {
      const fileSystem = new MemoryFileSystem();
      fileSystem.files.set('/config/config.json', 'previous');
      fileSystem.failWrite = failure === 'write';
      fileSystem.failRename = failure === 'rename';

      assert.throws(() =>
        writeTextFileAtomically('/config/config.json', 'next', {
          createTemporaryPath: () => '/config/config.json.pending',
          fileSystem,
        }),
      );
      assert.equal(fileSystem.files.get('/config/config.json'), 'previous');
      assert.equal(fileSystem.files.has('/config/config.json.pending'), false);
      assert.deepEqual(fileSystem.removed, ['/config/config.json.pending']);
    }
  });

  it('serializes the complete new shape without a legacy targetLang mirror', () => {
    const config = readProjectFile('src/main/config.ts');
    const serializer = config.slice(
      config.indexOf('private createPersistedSnapshot('),
      config.indexOf('private persistSnapshot('),
    );

    assert.match(serializer, /translationSettings,/u);
    assert.doesNotMatch(serializer, /\btargetLang\s*:/u);
    for (const field of [
      'hotkey',
      'cancelHotkey',
      'stopHotkey',
      'translateHotkey',
      'prettifyHotkey',
      'retryTranscriptionHotkey',
      'translateEnabled',
      'prettifyEnabled',
      'provider',
      'locale',
      'localeExplicit',
      'fingerprintSeed',
      'prettifySettings',
    ]) {
      assert.equal(serializer.includes(field), true, field);
    }
  });

  it('removes the temporary legacy Google target compatibility mirror', () => {
    const config = readProjectFile('src/main/config.ts');
    const save = config.slice(config.indexOf('public saveTranslationSettings('), config.indexOf('public load(): void'));

    assert.match(
      save,
      /return this\.translationSettingsState\.save\(candidate, \(settings\) => this\.persistSnapshot\(settings\)\)/u,
    );
    assert.doesNotMatch(config, /currentTargetLang|getLegacyGoogleTarget|synchronizeLegacy/u);
  });

  it('keeps mutable configuration behind the application-owned store', () => {
    const config = readProjectFile('src/main/config.ts');

    assert.match(config, /export class AppConfigStore/u);
    assert.doesNotMatch(config, /\bexport let\b/u);
    assert.doesNotMatch(
      config,
      /\bexport function (?:loadConfig|saveConfig|setHotkeys|setTextActionSettings|setProvider|setCurrentLocale)\b/u,
    );
    assert.doesNotMatch(config, /^migrateLegacyAppDir\(\);/mu);
  });
});
