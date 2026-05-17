import { access, chmod, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.CLOAKBROWSER_AUTO_UPDATE = 'false';

const { binaryInfo, ensureBinary } = await import('cloakbrowser');

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = path.join(rootDir, '.cache', 'cloakbrowser');
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
const targetPlatform = targetArg?.slice('--target='.length);

if (targetPlatform && targetPlatform !== process.platform) {
  throw new Error(
    `CloakBrowser can only prepare binaries for the current platform. Current: ${process.platform}, requested: ${targetPlatform}`,
  );
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const binaryPath = await ensureBinary();
const info = binaryInfo();
const sourceDir = info.cacheDir;
const relativeBinaryPath = path.relative(sourceDir, binaryPath);
const targetBinaryPath = path.join(targetDir, relativeBinaryPath);

if (relativeBinaryPath.startsWith('..') || path.isAbsolute(relativeBinaryPath)) {
  throw new Error(`CloakBrowser binary is outside cache dir: ${binaryPath}`);
}

await rm(targetDir, { recursive: true, force: true });
await mkdir(path.dirname(targetDir), { recursive: true });
await cp(sourceDir, targetDir, { recursive: true, force: true, dereference: true });

if (!(await exists(targetBinaryPath))) {
  throw new Error(`Bundled CloakBrowser executable was not copied: ${targetBinaryPath}`);
}

if (process.platform !== 'win32') {
  await chmod(targetBinaryPath, 0o755);
}

console.log(`CloakBrowser ${info.version} prepared for ${info.platform}`);
console.log(`Source: ${sourceDir}`);
console.log(`Bundle: ${targetDir}`);
console.log(`Executable: ${targetBinaryPath}`);
