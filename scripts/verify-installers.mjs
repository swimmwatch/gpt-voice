import { constants } from 'node:fs';
import { access, copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(rootDir, 'release');
const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf-8'));
const productName = packageJson.build?.productName || packageJson.name;
const packageName = packageJson.name;
const platformArg = process.argv.find((arg) => arg.startsWith('--platform='));
const targetPlatform = platformArg?.slice('--platform='.length) || process.platform;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertExists(filePath, description) {
  assert(await exists(filePath), `${description} not found: ${filePath}`);
}

async function assertExecutable(filePath, description) {
  await assertExists(filePath, description);
  await access(filePath, constants.X_OK);
}

async function requireCommand(command, packageHint) {
  const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const pathEntry of pathEntries) {
    const candidate = path.join(pathEntry, command);
    try {
      await access(candidate, constants.X_OK);
      return;
    } catch {
      /* keep searching */
    }
  }

  throw new Error(`Required command "${command}" is not available. Install ${packageHint} before verifying RPMs.`);
}

async function run(command, args, options = {}) {
  try {
    const result = await execFile(command, args, {
      maxBuffer: 32 * 1024 * 1024,
      timeout: options.timeout ?? 120000,
      ...options,
    });
    return `${result.stdout || ''}${result.stderr || ''}`;
  } catch (error) {
    if (error.code === 'ENOENT' && options.optional) {
      return '';
    }
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatExitCode(code) {
  if (typeof code !== 'number') {
    return String(code);
  }

  const hex = `0x${(code >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
  return `${code} (${hex})`;
}

function describeExecError(error) {
  const details = [
    error.code !== undefined ? `code=${formatExitCode(error.code)}` : null,
    error.signal ? `signal=${error.signal}` : null,
    error.cmd ? `cmd=${error.cmd}` : null,
    error.stdout ? `stdout=${String(error.stdout).trim()}` : null,
    error.stderr ? `stderr=${String(error.stderr).trim()}` : null,
  ].filter(Boolean);

  return details.length > 0 ? details.join('\n') : error instanceof Error ? error.message : String(error);
}

async function runWithRetries(command, args, options = {}) {
  const { attempts = 1, beforeAttempt, retryDelayMs = 1000, description = command, ...runOptions } = options;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (beforeAttempt) {
        await beforeAttempt(attempt);
      }
      return await run(command, args, runOptions);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }

      console.warn(
        `${description} failed on attempt ${attempt}/${attempts}; retrying in ${retryDelayMs}ms\n${describeExecError(error)}`,
      );
      await sleep(retryDelayMs);
    }
  }

  throw new Error(`${description} failed after ${attempts} attempt(s)\n${describeExecError(lastError)}`);
}

async function releaseFile(predicate, description) {
  const entries = await readdir(releaseDir, { withFileTypes: true });
  const match = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
    .find(predicate);

  if (!match) {
    throw new Error(`${description} not found in ${releaseDir}`);
  }

  return path.join(releaseDir, match);
}

async function listFiles(root) {
  const result = [];

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        result.push(fullPath);
      }
    }
  }

  await walk(root);
  return result;
}

async function findFirst(root, predicate, description) {
  const files = await listFiles(root);
  const match = files.find((filePath) => predicate(filePath));
  if (!match) {
    throw new Error(`${description} not found under ${root}`);
  }
  return match;
}

async function verifyDesktopFile(filePath, { appImage }) {
  const content = await readFile(filePath, 'utf-8');
  const requiredLines = [
    '[Desktop Entry]',
    `Name=${productName}`,
    'Terminal=false',
    'Type=Application',
    `Icon=${packageName}`,
    `StartupWMClass=${packageName}`,
    'Categories=Utility;',
  ];

  for (const line of requiredLines) {
    assert(content.includes(line), `Desktop file ${filePath} is missing: ${line}`);
  }

  assert(
    content.includes(appImage ? 'Exec=AppRun --no-sandbox %U' : `Exec=/opt/${productName}/${packageName} %U`),
    `Desktop file ${filePath} has unexpected Exec line`,
  );

  await run('desktop-file-validate', [filePath], { optional: true });
}

async function extractRpm(rpm, outputDir) {
  await run('sh', ['-c', 'rpm2cpio "$1" | cpio -idm --quiet', 'sh', rpm], {
    cwd: outputDir,
    timeout: 180000,
  });
}

async function verifyLinuxIconTheme(root) {
  for (const size of ['16x16', '24x24', '32x32', '48x48', '64x64', '128x128', '256x256', '512x512']) {
    await assertExists(
      path.join(root, 'usr', 'share', 'icons', 'hicolor', size, 'apps', `${packageName}.png`),
      `Linux hicolor ${size} icon`,
    );
  }
}

async function verifyLinuxAppStreamMetadata(root) {
  const metainfoPath = path.join(root, 'usr', 'share', 'metainfo', `${packageJson.build.appId}.metainfo.xml`);

  await assertExists(metainfoPath, 'Linux AppStream metainfo');

  const metainfo = await readFile(metainfoPath, 'utf-8');
  assert(metainfo.includes(`<id>${packageJson.build.appId}</id>`), 'AppStream metainfo has unexpected component id');
  assert(metainfo.includes(`<name>${productName}</name>`), 'AppStream metainfo has unexpected app name');
  assert(
    metainfo.includes(`<release version="${packageJson.version}"`),
    'AppStream metainfo has unexpected release version',
  );

  await run('appstreamcli', ['validate', '--no-net', metainfoPath], { optional: true });
}

async function verifyDebianCopyrightMetadata(root) {
  const copyrightPath = path.join(root, 'usr', 'share', 'doc', packageName, 'copyright');
  await assertExists(copyrightPath, 'Debian copyright metadata');

  const copyright = await readFile(copyrightPath, 'utf-8');
  assert(copyright.includes(`Upstream-Name: ${productName}`), 'Debian copyright has unexpected upstream name');
  assert(copyright.includes(`Source: ${packageJson.homepage}`), 'Debian copyright has unexpected source URL');
  assert(copyright.includes(`License: ${packageJson.license}`), 'Debian copyright has unexpected license');
}

async function verifyPackagedLicense(filePath, description) {
  await assertExists(filePath, description);
  const license = await readFile(filePath, 'utf-8');
  assert(license.includes(productName), `${description} has unexpected product name`);
  assert(license.includes(`Version: ${packageJson.version}`), `${description} has unexpected version`);
  assert(license.includes(`License: ${packageJson.license}`), `${description} has unexpected license`);
}

async function verifyLinuxInstallers() {
  await requireCommand('rpm', 'the rpm package');
  await requireCommand('rpm2cpio', 'the rpm package');
  await requireCommand('cpio', 'the cpio package');

  const appImage = await releaseFile(
    (fileName) => fileName === `${productName}-${packageJson.version}.AppImage`,
    'Linux AppImage',
  );
  const deb = await releaseFile(
    (fileName) => fileName === `${packageName}_${packageJson.version}_amd64.deb`,
    'Linux deb package',
  );
  const rpm = await releaseFile(
    (fileName) => fileName === `${packageName}-${packageJson.version}.x86_64.rpm`,
    'Linux RPM package',
  );

  await assertExecutable(appImage, 'Linux AppImage');

  const appImageExtractDir = await mkdtemp(path.join(os.tmpdir(), `${packageName}-appimage-`));
  try {
    await run(appImage, ['--appimage-extract'], { cwd: appImageExtractDir, timeout: 180000 });
    const appImageRoot = path.join(appImageExtractDir, 'squashfs-root');
    await assertExecutable(path.join(appImageRoot, packageName), 'AppImage executable');
    await assertExecutable(path.join(appImageRoot, 'resources', 'cloakbrowser', 'chrome'), 'AppImage CloakBrowser');
    await verifyPackagedLicense(path.join(appImageRoot, 'license.txt'), 'AppImage root license metadata');
    await verifyPackagedLicense(path.join(appImageRoot, 'resources', 'LICENSE.txt'), 'AppImage license metadata');
    const desktopFile = await findFirst(
      appImageRoot,
      (filePath) => filePath.endsWith('.desktop'),
      'AppImage desktop file',
    );
    await verifyDesktopFile(desktopFile, { appImage: true });
    await verifyLinuxIconTheme(appImageRoot);
  } finally {
    await rm(appImageExtractDir, { recursive: true, force: true });
  }

  const debInfo = await run('dpkg-deb', ['--info', deb]);
  assert(debInfo.includes(`Package: ${packageName}`), 'deb metadata has unexpected Package field');
  assert(debInfo.includes(`Version: ${packageJson.version}`), 'deb metadata has unexpected Version field');
  assert(debInfo.includes('Architecture: amd64'), 'deb metadata has unexpected Architecture field');

  const debControlDir = await mkdtemp(path.join(os.tmpdir(), `${packageName}-deb-control-`));
  try {
    await run('dpkg-deb', ['-e', deb, debControlDir]);
    const postinst = await readFile(path.join(debControlDir, 'postinst'), 'utf-8');
    const postrm = await readFile(path.join(debControlDir, 'postrm'), 'utf-8');
    assert(
      postinst.includes("update-alternatives --install '/usr/bin/gpt-voice'"),
      'deb postinst misses CLI link setup',
    );
    assert(
      postinst.includes('update-desktop-database /usr/share/applications'),
      'deb postinst misses desktop database update',
    );
    assert(postrm.includes("update-alternatives --remove 'gpt-voice'"), 'deb postrm misses CLI link cleanup');
    assert(postrm.includes("APPARMOR_PROFILE_DEST='/etc/apparmor.d/gpt-voice'"), 'deb postrm misses AppArmor cleanup');
  } finally {
    await rm(debControlDir, { recursive: true, force: true });
  }

  const debContents = await run('dpkg-deb', ['--contents', deb]);
  for (const expectedPath of [
    `./opt/${productName}/${packageName}`,
    `./opt/${productName}/resources/app.asar`,
    `./opt/${productName}/resources/cloakbrowser/chrome`,
    `./opt/${productName}/resources/LICENSE.txt`,
    `./usr/share/applications/${packageName}.desktop`,
    `./usr/share/icons/hicolor/512x512/apps/${packageName}.png`,
    `./usr/share/metainfo/${packageJson.build.appId}.metainfo.xml`,
    `./usr/share/doc/${packageName}/copyright`,
  ]) {
    assert(debContents.includes(expectedPath), `deb package does not own expected path: ${expectedPath}`);
  }

  const debExtractDir = await mkdtemp(path.join(os.tmpdir(), `${packageName}-deb-`));
  try {
    await run('dpkg-deb', ['-x', deb, debExtractDir]);
    await assertExecutable(path.join(debExtractDir, 'opt', productName, packageName), 'deb executable');
    await assertExecutable(
      path.join(debExtractDir, 'opt', productName, 'resources', 'cloakbrowser', 'chrome'),
      'deb CloakBrowser',
    );
    await verifyPackagedLicense(
      path.join(debExtractDir, 'opt', productName, 'resources', 'LICENSE.txt'),
      'deb packaged license metadata',
    );
    await verifyDesktopFile(path.join(debExtractDir, 'usr', 'share', 'applications', `${packageName}.desktop`), {
      appImage: false,
    });
    await verifyLinuxIconTheme(debExtractDir);
    await verifyLinuxAppStreamMetadata(debExtractDir);
    await verifyDebianCopyrightMetadata(debExtractDir);
  } finally {
    await rm(debExtractDir, { recursive: true, force: true });
  }

  const rpmInfo = await run('rpm', [
    '--query',
    '--package',
    '--queryformat',
    'Name: %{NAME}\nVersion: %{VERSION}\nArchitecture: %{ARCH}\nLicense: %{LICENSE}\n',
    rpm,
  ]);
  assert(rpmInfo.includes(`Name: ${packageName}`), 'RPM metadata has unexpected Name field');
  assert(rpmInfo.includes(`Version: ${packageJson.version}`), 'RPM metadata has unexpected Version field');
  assert(rpmInfo.includes('Architecture: x86_64'), 'RPM metadata has unexpected Architecture field');
  assert(rpmInfo.includes(`License: ${packageJson.license}`), 'RPM metadata has unexpected License field');

  const rpmContents = await run('rpm', ['-qlp', rpm]);
  for (const expectedPath of [
    `/opt/${productName}/${packageName}`,
    `/opt/${productName}/resources/app.asar`,
    `/opt/${productName}/resources/cloakbrowser/chrome`,
    `/opt/${productName}/resources/LICENSE.txt`,
    `/usr/share/applications/${packageName}.desktop`,
    `/usr/share/icons/hicolor/512x512/apps/${packageName}.png`,
    `/usr/share/metainfo/${packageJson.build.appId}.metainfo.xml`,
    `/usr/share/licenses/${packageName}/LICENSE.txt`,
  ]) {
    assert(rpmContents.includes(expectedPath), `RPM package does not own expected path: ${expectedPath}`);
  }

  const rpmExtractDir = await mkdtemp(path.join(os.tmpdir(), `${packageName}-rpm-`));
  try {
    await extractRpm(rpm, rpmExtractDir);
    await assertExecutable(path.join(rpmExtractDir, 'opt', productName, packageName), 'RPM executable');
    await assertExecutable(
      path.join(rpmExtractDir, 'opt', productName, 'resources', 'cloakbrowser', 'chrome'),
      'RPM CloakBrowser',
    );
    await verifyPackagedLicense(
      path.join(rpmExtractDir, 'opt', productName, 'resources', 'LICENSE.txt'),
      'RPM packaged license metadata',
    );
    await verifyPackagedLicense(
      path.join(rpmExtractDir, 'usr', 'share', 'licenses', packageName, 'LICENSE.txt'),
      'RPM package license metadata',
    );
    await verifyDesktopFile(path.join(rpmExtractDir, 'usr', 'share', 'applications', `${packageName}.desktop`), {
      appImage: false,
    });
    await verifyLinuxIconTheme(rpmExtractDir);
    await verifyLinuxAppStreamMetadata(rpmExtractDir);
  } finally {
    await rm(rpmExtractDir, { recursive: true, force: true });
  }

  if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
    const cleanupDataHome = await mkdtemp(path.join(os.tmpdir(), `${packageName}-appimage-cleanup-`));
    try {
      const cleanupDesktopFile = path.join(cleanupDataHome, 'applications', `${packageName}.desktop`);
      const cleanupIconFile = path.join(cleanupDataHome, 'icons', 'hicolor', '512x512', 'apps', `${packageName}.png`);
      await mkdir(path.dirname(cleanupDesktopFile), { recursive: true });
      await mkdir(path.dirname(cleanupIconFile), { recursive: true });
      await access(appImage, constants.X_OK);
      await writeFile(cleanupDesktopFile, '', 'utf-8');
      await writeFile(cleanupIconFile, '', 'utf-8');
      await run(path.join(releaseDir, 'linux-unpacked', packageName), ['--remove-linux-appimage-desktop-integration'], {
        env: {
          ...process.env,
          APPIMAGE: appImage,
          XDG_DATA_HOME: cleanupDataHome,
        },
        timeout: 60000,
      });
      assert(!(await exists(cleanupDesktopFile)), 'AppImage desktop integration cleanup did not remove desktop file');
      assert(!(await exists(cleanupIconFile)), 'AppImage desktop integration cleanup did not remove icon file');
    } finally {
      await rm(cleanupDataHome, { recursive: true, force: true });
    }
  } else {
    console.log('Skipped AppImage desktop integration cleanup smoke: no Linux display server is available');
  }

  console.log('Linux installer verification passed');
}

async function waitFor(predicate, description, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function verifyWindowsInstaller() {
  if (process.platform !== 'win32') {
    throw new Error('Windows installer verification must run on Windows');
  }

  const installer = await releaseFile(
    (fileName) => fileName.startsWith(productName) && fileName.endsWith('.exe'),
    'Windows NSIS installer',
  );
  const installDir = path.join(process.env.RUNNER_TEMP || os.tmpdir(), `${packageName}-install-smoke`);
  const installerTempDir = await mkdtemp(
    path.join(process.env.RUNNER_TEMP || os.tmpdir(), `${packageName}-installer-`),
  );
  const installerCopy = path.join(installerTempDir, 'installer.exe');
  await rm(installDir, { recursive: true, force: true });

  try {
    await copyFile(installer, installerCopy);
    await runWithRetries(installerCopy, ['/S', '/currentuser', `/D=${installDir}`], {
      attempts: 3,
      beforeAttempt: () => rm(installDir, { recursive: true, force: true }),
      description: 'Windows NSIS silent install',
      retryDelayMs: 5000,
      timeout: 300000,
    });
    const appExe = path.join(installDir, `${productName}.exe`);
    await waitFor(() => exists(appExe), 'Windows app executable after install');
    await assertExists(path.join(installDir, 'resources', 'app.asar'), 'Windows app.asar');
    await assertExists(path.join(installDir, 'resources', 'assets', 'icon.png'), 'Windows app icon');
    await assertExists(path.join(installDir, 'resources', 'cloakbrowser', 'chrome.exe'), 'Windows CloakBrowser');
    await verifyPackagedLicense(path.join(installDir, 'resources', 'LICENSE.txt'), 'Windows license metadata');

    const uninstaller = await findFirst(
      installDir,
      (filePath) => /^Uninstall.*\.exe$/i.test(path.basename(filePath)),
      'Windows NSIS uninstaller',
    );
    await runWithRetries(uninstaller, ['/S'], {
      attempts: 3,
      description: 'Windows NSIS silent uninstall',
      retryDelayMs: 5000,
      timeout: 300000,
    });
    await waitFor(async () => !(await exists(appExe)), 'Windows app executable removal');
  } finally {
    await rm(installDir, { recursive: true, force: true });
    await rm(installerTempDir, { recursive: true, force: true });
  }

  console.log('Windows installer/uninstaller verification passed');
}

async function verifyMacDmg() {
  if (process.platform !== 'darwin') {
    throw new Error('macOS DMG verification must run on macOS');
  }

  const dmg = await releaseFile(
    (fileName) => fileName.startsWith(productName) && fileName.endsWith('.dmg'),
    'macOS DMG',
  );
  const mountPoint = await mkdtemp(path.join(os.tmpdir(), `${packageName}-dmg-mount-`));
  const installRoot = await mkdtemp(path.join(os.tmpdir(), `${packageName}-mac-install-`));
  let mounted = false;

  try {
    await run('hdiutil', ['attach', dmg, '-readonly', '-nobrowse', '-mountpoint', mountPoint], { timeout: 180000 });
    mounted = true;

    const mountedApp = await findFirst(
      mountPoint,
      (filePath) => filePath.endsWith(`${productName}.app/Contents/Info.plist`),
      'mounted macOS app bundle',
    );
    const appBundle = path.resolve(mountedApp, '..', '..');
    await verifyMacAppBundle(appBundle);

    const applicationsDir = path.join(installRoot, 'Applications');
    const installedApp = path.join(applicationsDir, `${productName}.app`);
    await mkdir(applicationsDir, { recursive: true });
    await cp(appBundle, installedApp, { recursive: true });
    await verifyMacAppBundle(installedApp);
    await rm(installedApp, { recursive: true, force: true });
    assert(!(await exists(installedApp)), 'macOS app bundle was not removed');
  } finally {
    if (mounted) {
      await run('hdiutil', ['detach', mountPoint], { timeout: 60000, optional: true });
    }
    await rm(mountPoint, { recursive: true, force: true });
    await rm(installRoot, { recursive: true, force: true });
  }

  console.log('macOS DMG install/remove verification passed');
}

async function verifyMacAppBundle(appBundle) {
  await assertExists(path.join(appBundle, 'Contents', 'Info.plist'), 'macOS Info.plist');
  await assertExecutable(path.join(appBundle, 'Contents', 'MacOS', productName), 'macOS executable');
  await assertExists(path.join(appBundle, 'Contents', 'Resources', 'app.asar'), 'macOS app.asar');
  await assertExists(path.join(appBundle, 'Contents', 'Resources', 'assets', 'icon.png'), 'macOS app icon');
  await verifyPackagedLicense(path.join(appBundle, 'Contents', 'Resources', 'LICENSE.txt'), 'macOS license metadata');
  const privacyManifestPath = path.join(appBundle, 'Contents', 'Resources', 'PrivacyInfo.xcprivacy');
  await assertExists(privacyManifestPath, 'macOS privacy manifest');
  const privacyManifest = await readFile(privacyManifestPath, 'utf-8');
  assert(
    privacyManifest.includes('<key>NSPrivacyCollectedDataTypes</key>'),
    'macOS privacy manifest is missing collected data declaration',
  );
  assert(
    privacyManifest.includes('<key>NSPrivacyTracking</key>'),
    'macOS privacy manifest is missing tracking declaration',
  );
  await assertExecutable(
    path.join(appBundle, 'Contents', 'Resources', 'cloakbrowser', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
    'macOS CloakBrowser',
  );
}

switch (targetPlatform) {
  case 'linux':
    await verifyLinuxInstallers();
    break;
  case 'win32':
    await verifyWindowsInstaller();
    break;
  case 'darwin':
    await verifyMacDmg();
    break;
  default:
    throw new Error(`Unsupported installer verification platform: ${targetPlatform}`);
}

console.log(`Installer verification completed for ${targetPlatform}`);
