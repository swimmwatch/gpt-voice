import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const CLANG_QUALITY_PACKAGE = Object.freeze({
  root: ['.cache', 'local-whisper', 'toolchains', 'clang-quality-18.1.3', 'root', 'usr', 'bin'],
  suffix: '-18',
});

function resolveClangQualityTool(workspaceRoot, compilerCaptureRoot, environmentName, executableName) {
  const configured = process.env[environmentName];
  if (configured) return configured;
  const compilerCaptureTool = resolve(compilerCaptureRoot, executableName);
  if (existsSync(compilerCaptureTool)) return compilerCaptureTool;
  return resolve(workspaceRoot, ...CLANG_QUALITY_PACKAGE.root, `${executableName}${CLANG_QUALITY_PACKAGE.suffix}`);
}

export function resolveClangFormat(workspaceRoot, compilerCaptureRoot) {
  return resolveClangQualityTool(workspaceRoot, compilerCaptureRoot, 'CLANG_FORMAT', 'clang-format');
}

export function resolveClangTidy(workspaceRoot, compilerCaptureRoot) {
  return resolveClangQualityTool(workspaceRoot, compilerCaptureRoot, 'CLANG_TIDY', 'clang-tidy');
}

/** Lists native implementation and header files using the filesystem's stable traversal order. */
export function listNativeSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) return listNativeSourceFiles(filePath);
    return /\.(?:cpp|hpp)$/u.test(entry.name) ? [filePath] : [];
  });
}

/** Lists implementation files while excluding the opposite platform's source directory. */
export function listPlatformNativeImplementationFiles(directory, platform) {
  const excludedPlatform = platform === 'win32' ? 'linux' : 'windows';
  return listNativeSourceFiles(directory).filter(
    (filePath) => filePath.endsWith('.cpp') && !filePath.includes(`/platform/${excludedPlatform}/`),
  );
}
