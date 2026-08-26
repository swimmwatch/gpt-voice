import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import process from 'node:process';

import {
  createFocusedGccQualityCoverageReport,
  createNativeQualityManifest,
  normalizeNativeCompilationPath,
} from './native-quality-manifest.mjs';

const PROFILE_ID = 'linux-x64-cpu-baseline-v1';
const DEFAULT_GCC_TOOLS = Object.freeze({
  cCompiler: '/usr/bin/x86_64-linux-gnu-gcc-13',
  cxxCompiler: '/usr/bin/x86_64-linux-gnu-g++-13',
  linker: '/usr/bin/x86_64-linux-gnu-ld.bfd',
});
const PROJECTS = Object.freeze([
  Object.freeze({ id: 'fs-guard', sanitizerVariable: 'FS_GUARD_ENABLE_SANITIZERS' }),
  Object.freeze({ id: 'launcher', sanitizerVariable: 'LOCAL_WHISPER_LAUNCHER_ENABLE_SANITIZERS' }),
]);

function parseArguments(arguments_) {
  if (arguments_.length !== 1) throw new Error('Focused GCC quality coverage requires exactly one output argument');
  const match = /^--output=(.+)$/u.exec(arguments_[0]);
  if (!match) throw new Error('Focused GCC quality coverage requires --output');
  return match[1];
}

function assertTaskOwnedOutput(workspaceRoot, output) {
  const resolved = resolve(workspaceRoot, output);
  const artifactRoot = resolve(workspaceRoot, 'release-artifacts');
  const artifactRelative = relative(artifactRoot, resolved);
  if (
    artifactRelative.length === 0 ||
    artifactRelative === '..' ||
    artifactRelative.startsWith('../') ||
    isAbsolute(artifactRelative)
  ) {
    throw new Error('Focused GCC quality coverage output must stay in release-artifacts');
  }
  return resolved;
}

function readCacheValue(cache, key) {
  const match = new RegExp(`^${key}:[^=]+=(.+)$`, 'mu').exec(cache);
  return match?.[1] ?? null;
}

function compiledSources(workspaceRoot, project, gccTools) {
  const buildDirectory = resolve(workspaceRoot, '.cache', 'local-whisper', project.id, 'build-linux-gcc-test');
  const cachePath = resolve(buildDirectory, 'CMakeCache.txt');
  const compileCommandsPath = resolve(buildDirectory, 'compile_commands.json');
  if (!existsSync(cachePath) || !existsSync(compileCommandsPath)) {
    throw new Error(`Focused GCC quality build evidence is unavailable: ${project.id}`);
  }
  const cache = readFileSync(cachePath, 'utf8');
  if (
    readCacheValue(cache, 'CMAKE_BUILD_TYPE') !== 'Debug' ||
    readCacheValue(cache, 'CMAKE_C_COMPILER') !== gccTools.cCompiler ||
    readCacheValue(cache, 'CMAKE_CXX_COMPILER') !== gccTools.cxxCompiler ||
    readCacheValue(cache, 'CMAKE_LINKER') !== gccTools.linker ||
    readCacheValue(cache, project.sanitizerVariable) !== 'OFF'
  ) {
    throw new Error(`Focused GCC quality build configuration is invalid: ${project.id}`);
  }
  const entries = JSON.parse(readFileSync(compileCommandsPath, 'utf8'));
  if (!Array.isArray(entries)) throw new Error(`Focused GCC quality compile database is malformed: ${project.id}`);
  return entries.flatMap((entry) => {
    if (typeof entry?.file !== 'string') {
      throw new Error(`Focused GCC quality compile command is malformed: ${project.id}`);
    }
    return [normalizeNativeCompilationPath(workspaceRoot, resolve(entry.directory ?? workspaceRoot, entry.file))];
  });
}

try {
  if (process.platform !== 'linux') throw new Error('Focused GCC quality coverage is available only on Linux');
  const gccTools = Object.freeze({
    cCompiler: process.env.LOCAL_WHISPER_GCC_C_COMPILER || DEFAULT_GCC_TOOLS.cCompiler,
    cxxCompiler: process.env.LOCAL_WHISPER_GCC_CXX_COMPILER || DEFAULT_GCC_TOOLS.cxxCompiler,
    linker: process.env.LOCAL_WHISPER_GCC_LINKER || DEFAULT_GCC_TOOLS.linker,
  });
  if (Object.values(gccTools).some((path) => typeof path !== 'string' || !isAbsolute(path) || !existsSync(path))) {
    throw new Error('Focused GCC quality requires prepared GCC compiler and linker paths');
  }
  const outputArgument = parseArguments(process.argv.slice(2));
  const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');
  const manifest = createNativeQualityManifest(workspaceRoot);
  const projectSources = new Set(
    manifest.filter((entry) => entry.kind === 'translation-unit').map((entry) => entry.path),
  );
  const report = createFocusedGccQualityCoverageReport({
    compilerProfile: PROFILE_ID,
    compiledPaths: PROJECTS.flatMap((project) => compiledSources(workspaceRoot, project, gccTools)).filter((path) =>
      projectSources.has(path),
    ),
    evidence: ['compile', 'execute'],
    manifest,
  });
  const output = assertTaskOwnedOutput(workspaceRoot, outputArgument);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report)}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(`Focused GCC quality coverage written to ${outputArgument}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Focused GCC quality coverage failed'}\n`);
  process.exitCode = 1;
}
