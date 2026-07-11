import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCurrentFuseWire, FuseV1Options } from '@electron/fuses';
import { listPackage } from '@electron/asar';
import {
  getElectronLocaleViolations,
  getPackagedRuntimeViolations,
  getRuntimeAssetViolations,
} from './packaged-runtime-policy.mjs';

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
    app: [path.join(rootDir, 'release', 'linux-unpacked', 'gpt-voice')],
    fuseTarget: [path.join(rootDir, 'release', 'linux-unpacked', 'gpt-voice')],
    asar: [path.join(rootDir, 'release', 'linux-unpacked', 'resources', 'app.asar')],
    icon: [path.join(rootDir, 'release', 'linux-unpacked', 'resources', 'assets', 'icon.png')],
    license: [path.join(rootDir, 'release', 'linux-unpacked', 'resources', 'LICENSE.txt')],
    locales: [path.join(rootDir, 'release', 'linux-unpacked', 'locales')],
    cloak: [path.join(rootDir, 'release', 'linux-unpacked', 'resources', 'cloakbrowser', 'chrome')],
  },
  win32: {
    app: [
      path.join(rootDir, 'release', 'win-unpacked', 'gpt-voice.exe'),
      path.join(rootDir, 'release', 'win-unpacked', 'GPT-Voice.exe'),
    ],
    fuseTarget: [
      path.join(rootDir, 'release', 'win-unpacked', 'gpt-voice.exe'),
      path.join(rootDir, 'release', 'win-unpacked', 'GPT-Voice.exe'),
    ],
    asar: [path.join(rootDir, 'release', 'win-unpacked', 'resources', 'app.asar')],
    icon: [path.join(rootDir, 'release', 'win-unpacked', 'resources', 'assets', 'icon.png')],
    license: [path.join(rootDir, 'release', 'win-unpacked', 'resources', 'LICENSE.txt')],
    locales: [path.join(rootDir, 'release', 'win-unpacked', 'locales')],
    cloak: [path.join(rootDir, 'release', 'win-unpacked', 'resources', 'cloakbrowser', 'chrome.exe')],
  },
  darwin: {
    app: [
      path.join(rootDir, 'release', 'mac', 'GPT-Voice.app'),
      path.join(rootDir, 'release', 'mac-arm64', 'GPT-Voice.app'),
      path.join(rootDir, 'release', 'mac-universal', 'GPT-Voice.app'),
    ],
    fuseTarget: [
      path.join(rootDir, 'release', 'mac', 'GPT-Voice.app', 'Contents', 'MacOS', 'GPT-Voice'),
      path.join(rootDir, 'release', 'mac-arm64', 'GPT-Voice.app', 'Contents', 'MacOS', 'GPT-Voice'),
      path.join(rootDir, 'release', 'mac-universal', 'GPT-Voice.app', 'Contents', 'MacOS', 'GPT-Voice'),
    ],
    asar: [
      path.join(rootDir, 'release', 'mac', 'GPT-Voice.app', 'Contents', 'Resources', 'app.asar'),
      path.join(rootDir, 'release', 'mac-arm64', 'GPT-Voice.app', 'Contents', 'Resources', 'app.asar'),
      path.join(rootDir, 'release', 'mac-universal', 'GPT-Voice.app', 'Contents', 'Resources', 'app.asar'),
    ],
    icon: [
      path.join(rootDir, 'release', 'mac', 'GPT-Voice.app', 'Contents', 'Resources', 'assets', 'icon.png'),
      path.join(rootDir, 'release', 'mac-arm64', 'GPT-Voice.app', 'Contents', 'Resources', 'assets', 'icon.png'),
      path.join(rootDir, 'release', 'mac-universal', 'GPT-Voice.app', 'Contents', 'Resources', 'assets', 'icon.png'),
    ],
    license: [
      path.join(rootDir, 'release', 'mac', 'GPT-Voice.app', 'Contents', 'Resources', 'LICENSE.txt'),
      path.join(rootDir, 'release', 'mac-arm64', 'GPT-Voice.app', 'Contents', 'Resources', 'LICENSE.txt'),
      path.join(rootDir, 'release', 'mac-universal', 'GPT-Voice.app', 'Contents', 'Resources', 'LICENSE.txt'),
    ],
    privacyManifest: [
      path.join(rootDir, 'release', 'mac', 'GPT-Voice.app', 'Contents', 'Resources', 'PrivacyInfo.xcprivacy'),
      path.join(rootDir, 'release', 'mac-arm64', 'GPT-Voice.app', 'Contents', 'Resources', 'PrivacyInfo.xcprivacy'),
      path.join(rootDir, 'release', 'mac-universal', 'GPT-Voice.app', 'Contents', 'Resources', 'PrivacyInfo.xcprivacy'),
    ],
    locales: [
      path.join(
        rootDir,
        'release',
        'mac',
        'GPT-Voice.app',
        'Contents',
        'Frameworks',
        'Electron Framework.framework',
        'Resources',
        'locales',
      ),
      path.join(
        rootDir,
        'release',
        'mac-arm64',
        'GPT-Voice.app',
        'Contents',
        'Frameworks',
        'Electron Framework.framework',
        'Resources',
        'locales',
      ),
      path.join(
        rootDir,
        'release',
        'mac-universal',
        'GPT-Voice.app',
        'Contents',
        'Frameworks',
        'Electron Framework.framework',
        'Resources',
        'locales',
      ),
    ],
    cloak: [
      path.join(
        rootDir,
        'release',
        'mac',
        'GPT-Voice.app',
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
        'GPT-Voice.app',
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
        'GPT-Voice.app',
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

const expectedFuses = [
  [FuseV1Options.RunAsNode, false, 'RunAsNode'],
  [FuseV1Options.EnableCookieEncryption, true, 'EnableCookieEncryption'],
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable, false, 'EnableNodeOptionsEnvironmentVariable'],
  [FuseV1Options.EnableNodeCliInspectArguments, false, 'EnableNodeCliInspectArguments'],
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, true, 'EnableEmbeddedAsarIntegrityValidation'],
  [FuseV1Options.OnlyLoadAppFromAsar, true, 'OnlyLoadAppFromAsar'],
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, false, 'LoadBrowserProcessSpecificV8Snapshot'],
  [FuseV1Options.GrantFileProtocolExtraPrivileges, false, 'GrantFileProtocolExtraPrivileges'],
];

function isFuseEnabled(fuseWire, fuse) {
  const value = fuseWire[String(fuse)];
  return value === '1'.charCodeAt(0) || value === '1' || value === true;
}

async function verifyElectronFuses(fuseTarget) {
  const fuseWire = await getCurrentFuseWire(fuseTarget);
  const mismatches = expectedFuses
    .map(([fuse, expected, name]) => ({ name, expected, actual: isFuseEnabled(fuseWire, fuse) }))
    .filter(({ expected, actual }) => expected !== actual);

  if (mismatches.length > 0) {
    throw new Error(
      `Electron fuse verification failed for ${fuseTarget}:\n${mismatches
        .map(({ name, expected, actual }) => `  - ${name}: expected ${expected}, got ${actual}`)
        .join('\n')}`,
    );
  }
}

function verifyPackagedRuntimePolicy(asarPath) {
  const violations = getPackagedRuntimeViolations(listPackage(asarPath));
  if (violations.length > 0) {
    throw new Error(`Packaged runtime policy failed:\n${violations.map((violation) => `  - ${violation}`).join('\n')}`);
  }
}

async function listRelativeFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) {
        return listRelativeFiles(path.join(directory, entry.name), relativePath);
      }
      return [relativePath];
    }),
  );
  return paths.flat();
}

function assertNoPolicyViolations(description, violations) {
  if (violations.length > 0) {
    throw new Error(`${description} failed:\n${violations.map((violation) => `  - ${violation}`).join('\n')}`);
  }
}

async function verifyExternalRuntimeResources(resourcesPath, localesPath) {
  const [assetPaths, localePaths] = await Promise.all([
    listRelativeFiles(path.join(resourcesPath, 'assets')),
    readdir(localesPath),
  ]);
  assertNoPolicyViolations('Packaged runtime asset policy', getRuntimeAssetViolations(assetPaths));
  assertNoPolicyViolations('Electron locale policy', getElectronLocaleViolations(localePaths));
}

const layout = layouts[process.platform];
if (!layout) {
  throw new Error(`Unsupported platform for packaged runtime verification: ${process.platform}`);
}

const app = await firstExisting(layout.app, 'Packaged app');
const fuseTarget = await firstExisting(layout.fuseTarget, 'Packaged Electron executable for fuse verification');
const asar = await firstExisting(layout.asar, 'Packaged app.asar');
const icon = await firstExisting(layout.icon, 'Packaged app icon');
const license = await firstExisting(layout.license, 'Packaged license metadata');
const locales = await firstExisting(layout.locales, 'Electron locale directory');
const privacyManifest = layout.privacyManifest
  ? await firstExisting(layout.privacyManifest, 'Packaged macOS privacy manifest')
  : null;
const cloak = await firstExisting(layout.cloak, 'Bundled CloakBrowser executable');
await verifyElectronFuses(fuseTarget);
verifyPackagedRuntimePolicy(asar);
await verifyExternalRuntimeResources(path.dirname(asar), locales);

console.log('Packaged runtime verification passed');
console.log(`App: ${app}`);
console.log(`Electron fuse target: ${fuseTarget}`);
console.log(`App asar: ${asar}`);
console.log(`App icon: ${icon}`);
console.log(`License metadata: ${license}`);
if (privacyManifest) {
  console.log(`macOS privacy manifest: ${privacyManifest}`);
}
console.log(`CloakBrowser executable: ${cloak}`);
