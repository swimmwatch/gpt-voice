const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { app, clipboard } = require('electron');

require('tsx/cjs');
const { ElectronRuntimeLoader } = require('../../src/main/electronRuntime.ts');

// Run only in a dedicated Xvfb session on Linux or a disposable Windows desktop.
if (process.env.GPT_VOICE_CLIPBOARD_SMOKE !== '1') {
  app.exit(1);
} else {
  app.disableHardwareAcceleration();
  run().catch(() => {
    console.error('ELECTRON_CLIPBOARD_SMOKE_FAILED');
    app.exit(1);
  });
}

async function run() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-clipboard-smoke-'));
  app.setPath('userData', temporaryRoot);
  let exitCode = 0;
  try {
    await app.whenReady();
    const runtime = new ElectronRuntimeLoader({
      loadModule: () => ({ clipboard }),
      logger: { warn: () => undefined },
      platform: process.platform,
      schedule: setTimeout,
    });
    const previous = await runtime.readClipboardText();
    try {
      await runtime.writeClipboardText('clipboard smoke fixture');
      assert.equal(await runtime.readClipboardText(), 'clipboard smoke fixture');
      if (process.platform === 'linux') {
        const selection = await runtime.readClipboardText('selection');
        try {
          await runtime.writeTypedClipboardText('selection smoke fixture', 'selection');
          assert.equal(await runtime.readClipboardText('selection'), 'selection smoke fixture');
        } finally {
          await runtime.writeTypedClipboardText(selection, 'selection');
        }
      }
    } finally {
      await runtime.writeClipboardText(previous);
    }
    console.log('ELECTRON_CLIPBOARD_SMOKE_PASSED');
  } catch {
    console.error('ELECTRON_CLIPBOARD_SMOKE_FAILED');
    exitCode = 1;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
    app.exit(exitCode);
  }
}
