import { existsSync } from 'node:fs';
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
