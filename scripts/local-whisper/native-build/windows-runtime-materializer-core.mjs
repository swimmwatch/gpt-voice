import { spawnSync } from 'node:child_process';
import { constants as fileConstants, copyFileSync, existsSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import process from 'node:process';

import { canonicalJson, sha256, validateRelativePath, writeJsonAtomic } from '../source-import/native-source-core.mjs';
import { readVerifiedRegularFileSync } from '../secure-file-reader.mjs';

const LOCK_SCHEMA_ID = 'local-whisper-windows-runtime-acquisition-lock-v1';
const MATERIALIZATION_SCHEMA_ID = 'local-whisper-windows-runtime-materialization-v1';
const MICROSOFT_ORGANIZATION = 'O=Microsoft Corporation';
const SAFE_DLL_NAME = /^(?:concrt140|msvcp140(?:_1|_2|_atomic_wait|_codecvt_ids)?|vcruntime140(?:_1|_threads)?)\.dll$/u;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert(canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()), `${label} fields changed`);
}

export function verifyWindowsRuntimeAcquisitionLock(lock) {
  assertExactKeys(
    lock,
    ['$schema', 'schemaId', 'lockId', 'target', 'installer', 'installedRuntime', 'materialization', 'license'],
    'Windows runtime acquisition lock',
  );
  assert(lock.schemaId === LOCK_SCHEMA_ID, 'Invalid Windows runtime acquisition lock header');
  assert(lock.lockId === 'microsoft-vc-runtime-14.51.36247.0-x64-v1', 'Unknown Windows runtime lock');
  assert(lock.target?.os === 'windows' && lock.target?.architecture === 'x64', 'Windows runtime target changed');
  assert(
    lock.installer?.url === 'https://aka.ms/vs/18/release/14.51.36247/VC_redist.x64.exe' &&
      lock.installer.sizeBytes === 18_731_856 &&
      lock.installer.sha256 === '843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c' &&
      lock.installer.fileVersion === '14.51.36247.0' &&
      lock.installer.productVersion === '14.51.36247.0' &&
      lock.installer.originalFilename === 'VC_redist.x64.exe' &&
      lock.installer.targetArchitecture === 'x64' &&
      lock.installer.bootstrapMachine === 'x86' &&
      lock.installer.authenticodeStatus === 'Valid' &&
      lock.installer.publisherSubject === 'CN=Microsoft Corporation',
    'Windows runtime installer identity changed',
  );
  assert(
    lock.installedRuntime?.registryHive === 'HKEY_LOCAL_MACHINE' &&
      lock.installedRuntime.registryView === 'Registry64' &&
      lock.installedRuntime.registryKey === 'SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64' &&
      lock.installedRuntime.installedValue === 'Installed' &&
      lock.installedRuntime.versionValue === 'Version' &&
      lock.installedRuntime.version === 'v14.51.36247.00',
    'Windows runtime registry identity changed',
  );
  assert(
    lock.materialization?.source === 'native-system32' &&
      lock.materialization.relativeDestination === 'vc-runtime-14.51.36247.0-x64' &&
      lock.materialization.manifestName === 'materialization-manifest.json',
    'Windows runtime materialization identity changed',
  );
  const names = lock.materialization.dllAllowlist.map(({ name }) => name);
  assert(names.length === 9 && new Set(names).size === names.length, 'Windows runtime DLL allowlist changed');
  assert(canonicalJson(names) === canonicalJson([...names].sort()), 'Windows runtime DLL allowlist must be sorted');
  for (const component of lock.materialization.dllAllowlist) {
    assert(SAFE_DLL_NAME.test(component.name), `Windows runtime DLL is not permitted: ${component.name}`);
    assert(!component.name.endsWith('d.dll'), `Debug Windows runtime DLL is prohibited: ${component.name}`);
    assert(component.fileVersion === '14.51.36247.0', `Windows runtime DLL file version changed: ${component.name}`);
    assert(
      component.productVersion === '14.51.36247.0',
      `Windows runtime DLL product version changed: ${component.name}`,
    );
    assert(Number.isSafeInteger(component.sizeBytes) && component.sizeBytes > 0, 'Invalid Windows runtime DLL size');
    assert(/^[a-f0-9]{64}$/u.test(component.sha256), 'Invalid Windows runtime DLL digest');
  }
  validateRelativePath(lock.license.path);
  assert(
    lock.license.url === 'https://visualstudio.microsoft.com/license-terms/vs2026-ga-visualcpp-v14-redist-runtime/' &&
      lock.license.pathKind === 'toolchainRootRelative' &&
      lock.license.path === 'licenses/visual-cpp-v14-runtime.html' &&
      Number.isSafeInteger(lock.license.sizeBytes) &&
      lock.license.sizeBytes > 0 &&
      /^[a-f0-9]{64}$/u.test(lock.license.sha256),
    'Windows runtime license identity changed',
  );
  return true;
}

/**
 * Resolves the runtime identities used by a staged pack from the reviewed
 * acquisition lock. Static Windows profile templates intentionally leave
 * acquired file digests empty; a pack must never treat that as an unverified
 * runtime or substitute an ambient DLL.
 */
export function resolveWindowsRuntimeDependencyIdentities({ dependencies, lock }) {
  verifyWindowsRuntimeAcquisitionLock(lock);
  assert(Array.isArray(dependencies) && dependencies.length > 0, 'Windows runtime dependencies are missing');
  const lockedComponents = new Map(lock.materialization.dllAllowlist.map((component) => [component.name, component]));
  const expectedRoot = `${lock.materialization.relativeDestination}/bin/`;
  const resolvedIds = new Set();
  const resolvedNames = new Set();
  return Object.freeze(
    dependencies.map((dependency) => {
      assert(
        dependency && typeof dependency === 'object' && !Array.isArray(dependency),
        'Windows runtime dependency is invalid',
      );
      assert(
        typeof dependency.id === 'string' && !resolvedIds.has(dependency.id),
        'Windows runtime dependency ID is invalid',
      );
      assert(
        dependency.pathKind === 'toolchainRootRelative' && typeof dependency.path === 'string',
        `Windows runtime dependency path is invalid: ${dependency.id}`,
      );
      const name = basename(dependency.path);
      const component = lockedComponents.get(name);
      assert(component, `Windows runtime dependency is not in the approved lock: ${dependency.id}`);
      assert(!resolvedNames.has(name), `Windows runtime dependency is duplicated: ${dependency.id}`);
      assert(
        dependency.id ===
          `microsoft-vc-runtime-${component.fileVersion}-${name.slice(0, -'.dll'.length).replaceAll('_', '-')}` &&
          dependency.path === `${expectedRoot}${name}`,
        `Windows runtime dependency identity changed: ${dependency.id}`,
      );
      assert(
        dependency.sha256 === null || dependency.sha256 === component.sha256,
        `Windows runtime dependency digest conflicts with the approved lock: ${dependency.id}`,
      );
      resolvedIds.add(dependency.id);
      resolvedNames.add(name);
      return Object.freeze({ ...dependency, sha256: component.sha256 });
    }),
  );
}

function quotePowerShellLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function powershellPath(systemRoot) {
  return resolve(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

function runPowerShell(systemRoot, script) {
  const executable = powershellPath(systemRoot);
  assert(existsSync(executable), 'Native Windows PowerShell is missing');
  const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');
  const result = spawnSync(
    executable,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encodedCommand],
    {
      cwd: resolve(systemRoot, 'System32'),
      encoding: 'utf8',
      env: {
        SystemRoot: systemRoot,
        TEMP: process.env.TEMP ?? resolve(systemRoot, 'Temp'),
        TMP: process.env.TMP ?? resolve(systemRoot, 'Temp'),
        WINDIR: systemRoot,
      },
      maxBuffer: 1024 * 1024,
      shell: false,
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0) throw new Error('Trusted Windows metadata probe failed');
  return result.stdout.trim();
}

function readSignedFileMetadata(systemRoot, path) {
  const literal = quotePowerShellLiteral(path);
  const output = runPowerShell(
    systemRoot,
    `$item = Get-Item -LiteralPath ${literal}; ` +
      `$signature = Get-AuthenticodeSignature -LiteralPath ${literal}; ` +
      `[ordered]@{FileVersion=$item.VersionInfo.FileVersion;ProductVersion=$item.VersionInfo.ProductVersion;` +
      `OriginalFilename=$item.VersionInfo.OriginalFilename;Status=$signature.Status.ToString();` +
      `Subject=$signature.SignerCertificate.Subject} | ConvertTo-Json -Compress`,
  );
  try {
    return JSON.parse(output);
  } catch {
    throw new Error('Trusted Windows metadata probe returned invalid data');
  }
}

function readInstalledRuntime(systemRoot, registryKey) {
  const key = quotePowerShellLiteral(registryKey);
  const output = runPowerShell(
    systemRoot,
    `$base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(` +
      `[Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryView]::Registry64); ` +
      `$key = $base.OpenSubKey(${key}); ` +
      `try { if ($null -eq $key) { throw 'Missing runtime registry key' }; ` +
      `[ordered]@{Installed=$key.GetValue('Installed');Version=$key.GetValue('Version')} | ConvertTo-Json -Compress } ` +
      `finally { if ($null -ne $key) { $key.Dispose() }; $base.Dispose() }`,
  );
  try {
    return JSON.parse(output);
  } catch {
    throw new Error('Windows runtime registry probe returned invalid data');
  }
}

function verifyFileIdentity(path, expected, label) {
  const { bytes, stat } = readVerifiedRegularFileSync(path);
  assert(stat.isFile() && stat.size === expected.sizeBytes, `${label} size mismatch`);
  assert(sha256(bytes) === expected.sha256, `${label} digest mismatch`);
}

function verifySignedMetadata(metadata, expected, label, publisherSubject) {
  assert(metadata.FileVersion === expected.fileVersion, `${label} file version mismatch`);
  assert(metadata.ProductVersion === expected.productVersion, `${label} product version mismatch`);
  if (expected.originalFilename) {
    assert(metadata.OriginalFilename === expected.originalFilename, `${label} original filename mismatch`);
  }
  assert(metadata.Status === 'Valid', `${label} Authenticode status is not valid`);
  assert(metadata.Subject?.includes(publisherSubject), `${label} Microsoft publisher mismatch`);
}

function resolveFreshDestination(toolchainRoot, relativeDestination) {
  validateRelativePath(relativeDestination);
  const canonicalRoot = realpathSync(toolchainRoot);
  const destination = resolve(canonicalRoot, ...relativeDestination.split('/'));
  assert(dirname(destination) === canonicalRoot, 'Windows runtime destination escaped the toolchain root');
  assert(!existsSync(destination), 'Windows runtime destination must be fresh');
  return Object.freeze({ canonicalRoot, destination });
}

export function materializeWindowsRuntime({ installerPath, lock, toolchainRoot }) {
  verifyWindowsRuntimeAcquisitionLock(lock);
  assert(
    process.platform === 'win32' && process.arch === 'x64',
    'Windows runtime materialization requires native Windows x64',
  );
  const systemRoot = realpathSync(process.env.SystemRoot ?? process.env.WINDIR ?? '');
  const nativeSystemDirectory = realpathSync(resolve(systemRoot, 'System32'));
  assert(nativeSystemDirectory === resolve(systemRoot, 'System32'), 'Native Windows system directory identity changed');
  const { canonicalRoot, destination } = resolveFreshDestination(
    toolchainRoot,
    lock.materialization.relativeDestination,
  );

  const canonicalInstaller = realpathSync(installerPath);
  verifyFileIdentity(canonicalInstaller, lock.installer, 'Windows runtime installer');
  verifySignedMetadata(
    readSignedFileMetadata(systemRoot, canonicalInstaller),
    lock.installer,
    'Windows runtime installer',
    lock.installer.publisherSubject,
  );

  const licensePath = resolve(canonicalRoot, ...lock.license.path.split('/'));
  verifyFileIdentity(licensePath, lock.license, 'Windows runtime license');

  const registry = readInstalledRuntime(systemRoot, lock.installedRuntime.registryKey);
  assert(registry.Installed === 1, 'Microsoft VC Runtime x64 is not installed');
  assert(registry.Version === lock.installedRuntime.version, 'Microsoft VC Runtime x64 version mismatch');

  const verifiedFiles = lock.materialization.dllAllowlist.map((component) => {
    const source = resolve(nativeSystemDirectory, component.name);
    assert(dirname(source) === nativeSystemDirectory, 'Windows runtime source escaped native System32');
    verifyFileIdentity(source, component, `Windows runtime DLL ${component.name}`);
    const metadata = readSignedFileMetadata(systemRoot, source);
    verifySignedMetadata(metadata, component, `Windows runtime DLL ${component.name}`, MICROSOFT_ORGANIZATION);
    return Object.freeze({
      fileVersion: metadata.FileVersion,
      name: component.name,
      productVersion: metadata.ProductVersion,
      sha256: component.sha256,
      sizeBytes: component.sizeBytes,
      source,
    });
  });

  let created = false;
  try {
    mkdirSync(resolve(destination, 'bin'), { recursive: true });
    created = true;
    for (const component of verifiedFiles) {
      const output = resolve(destination, 'bin', component.name);
      copyFileSync(component.source, output, fileConstants.COPYFILE_EXCL);
      verifyFileIdentity(output, component, `Materialized Windows runtime DLL ${component.name}`);
    }
    const manifest = {
      schemaId: MATERIALIZATION_SCHEMA_ID,
      lockId: lock.lockId,
      target: lock.target,
      installedRuntimeVersion: lock.installedRuntime.version,
      source: lock.materialization.source,
      files: verifiedFiles.map(({ fileVersion, name, productVersion, sha256: digest, sizeBytes }) => ({
        fileVersion,
        name,
        productVersion,
        sha256: digest,
        sizeBytes,
      })),
    };
    writeJsonAtomic(resolve(destination, lock.materialization.manifestName), manifest);
    return Object.freeze({ destination, manifest });
  } catch (error) {
    if (created) rmSync(destination, { force: true, recursive: true });
    throw error;
  }
}
