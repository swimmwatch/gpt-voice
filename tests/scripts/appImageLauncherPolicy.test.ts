import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';

import { AppImageLauncherHardener, assertSandboxedAppRun } from '@scripts/security/appimage-launcher-policy.mjs';
import beforePack from '@scripts/before-pack.mjs';

const SOURCE_HASH = '70cdc560883573fa65246fbea08dd923a4905dc147769995ceb7257658a9980c';
const PATCHED_HASH = '8b2dc742316bb72fce2fc9efc0a1bb34c3e431b16feeb65b96eb1cab5cdab912';
const MODULE_PATH = 'node_modules/app-builder-lib/out/targets/appimage/appImageUtil.js';
const ORIGINAL_BLOCK =
  'HAVE_NO_SANDBOX=0\nfor arg in "\\${args[@]}" ; do\n  if [ "$arg" = --no-sandbox ] ; then\n    HAVE_NO_SANDBOX=1\n    break\n  fi\ndone\nNO_SANDBOX=()\n# Use \'unshare -Ur true\' as a heuristic to detect whether user namespaces are available.\n# Notes:\n#   - When running as root, this check will always succeed even if the sandbox configuration\n#     actually relies on unprivileged user namespaces. In practice, Chrome/Electron usually\n#     disables or adjusts the sandbox separately when running as root, so this probe is mostly\n#     a no-op in that scenario.\n#   - On minimal systems (e.g. Alpine or stripped-down containers) \'unshare\' may not exist.\n#     In that case the shell will return exit code 127 ("command not found"), which will cause\n#     us to add \'--no-sandbox\'. This is an intentional fail-safe: we prefer the app to start\n#     without sandboxing rather than crash on startup.\nif [ $HAVE_NO_SANDBOX -eq 0 ] && ! unshare -Ur true 2>/dev/null ; then\n  NO_SANDBOX=(--no-sandbox)\nfi\n\n';
const ORIGINAL_EXEC = 'exec "$BIN" "\\${NO_SANDBOX[@]}"';
const FORWARDED_ARGS = ' "\\${args[@]}"';

function sha256(bytes: string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function originalSource(): Promise<string> {
  const installed = await readFile(MODULE_PATH, 'utf8');
  if (sha256(installed) === SOURCE_HASH) return installed;
  assert.equal(sha256(installed), PATCHED_HASH, 'Installed generator must match a reviewed upstream or patched hash');
  const restored = installed
    .replace('atexit()\n', ORIGINAL_BLOCK + 'atexit()\n')
    .replace('exec "$BIN"\n', ORIGINAL_EXEC + '\n')
    .replace('exec "$BIN"' + FORWARDED_ARGS, ORIGINAL_EXEC + FORWARDED_ARGS);
  assert.equal(sha256(restored), SOURCE_HASH);
  return restored;
}

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'gpt-voice-appimage-policy-'));
  const module = path.join(root, MODULE_PATH);
  await mkdir(path.dirname(module), { recursive: true });
  await writeFile(module, await originalSource());
  await writeFile(
    path.join(root, 'node_modules/app-builder-lib/package.json'),
    JSON.stringify({ name: 'app-builder-lib', version: '26.17.0' }),
  );
  return root;
}

const SAFE_APP_RUN =
  '#!/usr/bin/env bash\ntrap atexit EXIT\nisEulaAccepted=1\natexit()\n{\n  if [ $isEulaAccepted == 1 ] ; then\n    if [ $NUMBER_OF_ARGS -eq 0 ] ; then\n      exec "$BIN"\n    else\n      exec "$BIN" "${args[@]}"\n    fi\n  fi\n}\n';

describe('AppImage launcher sandbox policy', () => {
  it('patches only reviewed upstream bytes and is idempotent', async () => {
    const root = await createFixture();
    try {
      const hardener = new AppImageLauncherHardener(root);
      await assert.rejects(hardener.verify(), /APPIMAGE_LAUNCHER/u);
      await hardener.apply();
      const patched = await readFile(path.join(root, MODULE_PATH), 'utf8');
      assert.equal(sha256(patched), PATCHED_HASH);
      await hardener.apply();
      await hardener.verify();
      assert.equal(await readFile(path.join(root, MODULE_PATH), 'utf8'), patched);
      if (process.platform !== 'win32') {
        assert.equal((await lstat(path.join(root, MODULE_PATH))).mode & 0o777, 0o644);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it(
    'executes the real patched generator without probing or bypassing a denied sandbox',
    { skip: process.platform !== 'linux' },
    async () => {
      const root = await createFixture();
      try {
        await new AppImageLauncherHardener(root).apply();
        const generatorSource = await readFile(path.join(root, MODULE_PATH), 'utf8');
        const exports = {
          generateAppRunScript: (_config: Record<string, string | boolean>): string => {
            throw new Error('Generator not loaded');
          },
        };
        runInNewContext(generatorSource, { exports, require: createRequire(path.resolve(MODULE_PATH)) });
        const launcher = exports.generateAppRunScript({
          ExecutableName: 'fixture-app',
          ProductFilename: 'fixture-app',
          ProductName: 'Fixture App',
          EulaFile: 'license.txt',
          IsHtmlEula: false,
        });
        assertSandboxedAppRun(launcher);
        assert.ok(launcher.includes('EULA_MARK_FILE='));
        const config = path.join(root, 'config');
        await mkdir(path.join(config, 'fixture-app'), { recursive: true });
        await writeFile(path.join(config, 'fixture-app/eulaAccepted'), '');
        const receipt = path.join(root, 'receipt');
        const probe = path.join(root, 'probe');
        await writeFile(path.join(root, 'AppRun'), launcher);
        await writeFile(path.join(root, 'fixture-app'), '#!/bin/bash\nprintf "%s\\0" "$@" > "$RECEIPT"\nexit 23\n', {
          mode: 0o700,
        });
        await writeFile(path.join(root, 'unshare'), '#!/bin/bash\ntouch "$PROBE"\nexit 1\n', { mode: 0o700 });
        const environment = {
          ...process.env,
          PATH: root + path.delimiter + process.env.PATH,
          APPDIR: root,
          XDG_CONFIG_HOME: config,
          RECEIPT: receipt,
          PROBE: probe,
          APPIMAGE_SILENT_INSTALL: '',
          APPIMAGE_EXIT_AFTER_INSTALL: '',
          ELECTRON_DISABLE_SANDBOX: '',
        };
        const execute = promisify(execFile);
        await assert.rejects(execute(path.join(root, 'unshare'), ['-Ur', 'true'], { env: environment }), { code: 1 });
        assert.ok((await lstat(probe)).isFile());
        await rm(probe);
        for (const args of [[], ['argument with spaces', 'literal;$value', 'кириллица']]) {
          await assert.rejects(execute('/bin/bash', [path.join(root, 'AppRun'), ...args], { env: environment }), {
            code: 23,
          });
          const captured = await readFile(receipt, 'utf8');
          assert.equal(captured, (args.length ? args.join('\0') : '') + '\0');
        }
        await assert.rejects(lstat(probe), { code: 'ENOENT' });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it('rejects changed source and unsupported versions without modifying the file', async () => {
    const root = await createFixture();
    try {
      const module = path.join(root, MODULE_PATH);
      const hardener = new AppImageLauncherHardener(root);
      await writeFile(module, 'unreviewed');
      await assert.rejects(hardener.apply(), /APPIMAGE_LAUNCHER/u);
      assert.equal(await readFile(module, 'utf8'), 'unreviewed');
      await writeFile(module, await originalSource());
      await writeFile(
        path.join(root, 'node_modules/app-builder-lib/package.json'),
        JSON.stringify({ name: 'app-builder-lib', version: '26.18.0' }),
      );
      await assert.rejects(hardener.apply(), /APPIMAGE_LAUNCHER/u);
      assert.equal(sha256(await readFile(module, 'utf8')), SOURCE_HASH);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it(
    'rejects redirected package files without writing through them',
    { skip: process.platform === 'win32' },
    async () => {
      const root = await createFixture();
      const outside = await mkdtemp(path.join(tmpdir(), 'gpt-voice-appimage-outside-'));
      try {
        const module = path.join(root, MODULE_PATH);
        const sentinel = path.join(outside, 'generator.js');
        await writeFile(sentinel, await originalSource());
        await rm(module);
        await symlink(sentinel, module);
        await assert.rejects(new AppImageLauncherHardener(root).apply(), /APPIMAGE_LAUNCHER/u);
        assert.equal(sha256(await readFile(sentinel, 'utf8')), SOURCE_HASH);
      } finally {
        await rm(root, { recursive: true, force: true });
        await rm(outside, { recursive: true, force: true });
      }
    },
  );

  it('rejects a redirected dependency directory without writing into its junction target', async () => {
    const root = await createFixture();
    const outside = await mkdtemp(path.join(tmpdir(), 'gpt-voice-appimage-junction-'));
    try {
      const sentinel = path.join(outside, 'sentinel');
      await writeFile(sentinel, 'unchanged');
      await rm(path.join(root, 'node_modules'), { recursive: true });
      await symlink(outside, path.join(root, 'node_modules'), 'junction');
      await assert.rejects(new AppImageLauncherHardener(root).apply(), /APPIMAGE_LAUNCHER/u);
      assert.equal(await readFile(sentinel, 'utf8'), 'unchanged');
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('blocks AppImage packing until patched but leaves unrelated targets alone', async () => {
    const root = await createFixture();
    try {
      const context = {
        electronPlatformName: 'linux',
        packager: { projectDir: root },
        targets: [{ name: 'appImage' }],
      };
      await assert.rejects(beforePack(context), /APPIMAGE_LAUNCHER/u);
      await beforePack({ ...context, targets: [{ name: 'dir' }] });
      await beforePack({ ...context, electronPlatformName: 'win32' });
      await new AppImageLauncherHardener(root).apply();
      await beforePack(context);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects sandbox bypass in the actual AppRun and accepts the guarded argument forwarding', () => {
    assertSandboxedAppRun(SAFE_APP_RUN);
    for (const bypass of ['--no-sandbox', '--disable-setuid-sandbox', 'ELECTRON_DISABLE_SANDBOX', 'NO_SANDBOX']) {
      assert.throws(() => assertSandboxedAppRun(SAFE_APP_RUN + '\n' + bypass), /APPIMAGE_LAUNCHER/u);
    }
    assert.throws(() => assertSandboxedAppRun('#!/bin/bash\nexec "$BIN"'), /APPIMAGE_LAUNCHER/u);
  });
});
