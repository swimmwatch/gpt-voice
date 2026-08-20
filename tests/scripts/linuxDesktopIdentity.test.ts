import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DESKTOP_IDENTITY = 'com.swimmwatch.gptvoice';

interface LinuxBuildConfiguration {
  readonly desktop?: {
    readonly entry?: {
      readonly StartupWMClass?: unknown;
    };
  };
  readonly syncDesktopName?: unknown;
}

interface PackageConfiguration {
  readonly desktopName?: unknown;
  readonly build?: {
    readonly linux?: LinuxBuildConfiguration;
  };
}

test('keeps the Linux package and installer desktop identity canonical', async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf8'),
  ) as PackageConfiguration;
  const linux = packageJson.build?.linux;
  const installerVerifier = await readFile(path.join(PROJECT_ROOT, 'scripts', 'verify-installers.mjs'), 'utf8');

  assert.equal(packageJson.desktopName, DESKTOP_IDENTITY);
  assert.equal(linux?.syncDesktopName, true);
  assert.equal(linux?.desktop?.entry?.StartupWMClass, DESKTOP_IDENTITY);
  assert.match(installerVerifier, /const desktopIdentity = packageJson\.desktopName;/u);
  assert.match(installerVerifier, /path\.relative\(appImageRoot, filePath\) === `\$\{desktopIdentity\}\.desktop`/u);
  assert.match(installerVerifier, /AppImage package retained legacy desktop file/u);
  assert.match(installerVerifier, /deb package retained legacy desktop file/u);
  assert.match(installerVerifier, /RPM package retained legacy desktop file/u);
  assert.match(installerVerifier, /StartupWMClass=\$\{desktopIdentity\}/u);
});

test('configures the Linux portal before protocol registration and asynchronous bootstrap', async () => {
  const mainProcessSource = await readFile(path.join(PROJECT_ROOT, 'src', 'main', 'main.ts'), 'utf8');
  const configureBeforeReadyIndex = mainProcessSource.indexOf(
    'configureDesktopApplicationBeforeReady(app, process.platform);',
  );
  const registerProtocolIndex = mainProcessSource.indexOf('registerAppProtocolScheme(protocol);');
  const bootstrapIndex = mainProcessSource.indexOf('void bootstrapMainProcess().catch');

  assert.ok(configureBeforeReadyIndex >= 0);
  assert.ok(registerProtocolIndex >= 0);
  assert.ok(bootstrapIndex >= 0);
  assert.ok(configureBeforeReadyIndex < registerProtocolIndex);
  assert.ok(registerProtocolIndex < bootstrapIndex);
});
