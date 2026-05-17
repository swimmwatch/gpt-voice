import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function firstExisting(candidates, description) {
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `${description} not found. Checked:\n${candidates.map((candidate) => `  - ${candidate}`).join('\n')}`,
  );
}

const layouts = {
  linux: {
    app: [path.join(rootDir, 'release', 'linux-unpacked', 'chatgpt-web-voice')],
    asar: [path.join(rootDir, 'release', 'linux-unpacked', 'resources', 'app.asar')],
    cloak: [path.join(rootDir, 'release', 'linux-unpacked', 'resources', 'cloakbrowser', 'chrome')],
  },
  win32: {
    app: [
      path.join(rootDir, 'release', 'win-unpacked', 'chatgpt-web-voice.exe'),
      path.join(rootDir, 'release', 'win-unpacked', 'WebVoice.exe'),
    ],
    asar: [path.join(rootDir, 'release', 'win-unpacked', 'resources', 'app.asar')],
    cloak: [path.join(rootDir, 'release', 'win-unpacked', 'resources', 'cloakbrowser', 'chrome.exe')],
  },
  darwin: {
    app: [
      path.join(rootDir, 'release', 'mac', 'WebVoice.app'),
      path.join(rootDir, 'release', 'mac-arm64', 'WebVoice.app'),
      path.join(rootDir, 'release', 'mac-universal', 'WebVoice.app'),
    ],
    asar: [
      path.join(rootDir, 'release', 'mac', 'WebVoice.app', 'Contents', 'Resources', 'app.asar'),
      path.join(rootDir, 'release', 'mac-arm64', 'WebVoice.app', 'Contents', 'Resources', 'app.asar'),
      path.join(rootDir, 'release', 'mac-universal', 'WebVoice.app', 'Contents', 'Resources', 'app.asar'),
    ],
    cloak: [
      path.join(
        rootDir,
        'release',
        'mac',
        'WebVoice.app',
        'Contents',
        'Resources',
        'cloakbrowser',
        'Chromium.app',
        'Contents',
        'MacOS',
        'Chromium',
      ),
      path.join(
        rootDir,
        'release',
        'mac-arm64',
        'WebVoice.app',
        'Contents',
        'Resources',
        'cloakbrowser',
        'Chromium.app',
        'Contents',
        'MacOS',
        'Chromium',
      ),
      path.join(
        rootDir,
        'release',
        'mac-universal',
        'WebVoice.app',
        'Contents',
        'Resources',
        'cloakbrowser',
        'Chromium.app',
        'Contents',
        'MacOS',
        'Chromium',
      ),
    ],
  },
};

const layout = layouts[process.platform];
if (!layout) {
  throw new Error(`Unsupported platform for packaged runtime verification: ${process.platform}`);
}

const app = await firstExisting(layout.app, 'Packaged app');
const asar = await firstExisting(layout.asar, 'Packaged app.asar');
const cloak = await firstExisting(layout.cloak, 'Bundled CloakBrowser executable');

console.log('Packaged runtime verification passed');
console.log(`App: ${app}`);
console.log(`App asar: ${asar}`);
console.log(`CloakBrowser executable: ${cloak}`);
