import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';

import { createLinuxAppImageCleanupEnvironment } from '@scripts/linux-appimage-cleanup-environment.mjs';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Linux AppImage cleanup environment', () => {
  it('retains the X11 session while excluding unsafe ambient variables', () => {
    const environment = createLinuxAppImageCleanupEnvironment(
      {
        APPIMAGE: '/untrusted.AppImage',
        DISPLAY: ':1',
        ELECTRON_RUN_AS_NODE: '1',
        HOME: '/home/tester',
        LD_PRELOAD: '/tmp/injected.so',
        NODE_OPTIONS: '--require=/tmp/injected.cjs',
        PATH: '/untrusted/bin',
        XAUTHORITY: '/run/user/1000/xauth',
        XDG_DATA_HOME: '/untrusted/data',
      },
      '/release/GPT-Voice.AppImage',
      '/tmp/cleanup-data',
    );

    assert.deepEqual(environment, {
      APPIMAGE: '/release/GPT-Voice.AppImage',
      DISPLAY: ':1',
      HOME: '/home/tester',
      XAUTHORITY: '/run/user/1000/xauth',
      XDG_DATA_HOME: '/tmp/cleanup-data',
    });
  });

  it('retains the Wayland socket location and omits empty optional values', () => {
    const environment = createLinuxAppImageCleanupEnvironment(
      {
        DISPLAY: '',
        HOME: undefined,
        WAYLAND_DISPLAY: 'wayland-0',
        XAUTHORITY: undefined,
        XDG_RUNTIME_DIR: '/run/user/1000',
      },
      '/release/GPT-Voice.AppImage',
      '/tmp/cleanup-data',
    );

    assert.deepEqual(environment, {
      APPIMAGE: '/release/GPT-Voice.AppImage',
      WAYLAND_DISPLAY: 'wayland-0',
      XDG_DATA_HOME: '/tmp/cleanup-data',
      XDG_RUNTIME_DIR: '/run/user/1000',
    });
  });

  it('uses the allowlisted environment builder in the installer verifier', async () => {
    const verifierSource = await readFile(path.join(PROJECT_ROOT, 'scripts', 'verify-installers.mjs'), 'utf8');

    assert.match(
      verifierSource,
      /env: createLinuxAppImageCleanupEnvironment\(process\.env, appImage, cleanupDataHome\)/u,
    );
    assert.doesNotMatch(verifierSource, /\.\.\.process\.env/u);
  });
});
