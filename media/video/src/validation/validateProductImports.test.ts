import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const productImports = path.join(repoRoot, 'media/video/src/product-ui/productImports.tsx');
const videoI18n = path.join(repoRoot, 'media/video/src/product-ui/videoI18n.ts');

const forbiddenImportFragments = [
  'electron',
  '@main/ipc',
  '@main/preload',
  '@main/electronRuntime',
  '@renderer/App',
  '@renderer/hooks/useRecording',
] as const;

const forbiddenSourcePatterns = [
  /\bI18nProvider\b/,
  /\bnavigator\.clipboard\b/,
  /\bnavigator\.mediaDevices\b/,
  /\bsetInterval\s*\(/,
  /\bsetTimeout\s*\(/,
  /\brequestAnimationFrame\s*\(/,
  /\bwindow\.electronAPI\b/,
  /\bfetch\s*\(/,
] as const;

function getImportSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\s+)['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function resolveAlias(specifier: string): string | null {
  if (specifier === '@renderer/hooks/useI18n') return videoI18n;
  if (specifier.startsWith('@main/')) return path.join(repoRoot, 'src/main', specifier.slice('@main/'.length));
  if (specifier.startsWith('@renderer/'))
    return path.join(repoRoot, 'src/renderer', specifier.slice('@renderer/'.length));
  if (specifier.startsWith('@shared/')) return path.join(repoRoot, 'src/shared', specifier.slice('@shared/'.length));
  return null;
}

function resolveSourceFile(pathWithoutExtension: string): string | null {
  if (fs.existsSync(pathWithoutExtension)) return pathWithoutExtension;

  for (const suffix of ['.ts', '.tsx', '.js', '.jsx', '.d.ts', '/index.ts', '/index.tsx']) {
    const candidate = `${pathWithoutExtension}${suffix}`;
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function assertSafeImport(specifier: string): void {
  assert.equal(
    forbiddenImportFragments.some((fragment) => specifier === fragment || specifier.startsWith(`${fragment}/`)),
    false,
    `Forbidden product import: ${specifier}`,
  );
}

function assertSafeSource(filePath: string, source: string): void {
  for (const pattern of forbiddenSourcePatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `Forbidden runtime access in ${path.relative(repoRoot, filePath)}: ${pattern}`,
    );
  }
}

function walkImportGraph(filePath: string, visited = new Set<string>()): Set<string> {
  const resolvedFile = resolveSourceFile(filePath) ?? filePath;
  if (visited.has(resolvedFile)) return visited;
  visited.add(resolvedFile);

  const source = fs.readFileSync(resolvedFile, 'utf8');
  assertSafeSource(resolvedFile, source);

  for (const specifier of getImportSpecifiers(source)) {
    assertSafeImport(specifier);
    const aliased = resolveAlias(specifier);
    const resolvedImport =
      aliased ?? (specifier.startsWith('.') ? path.resolve(path.dirname(resolvedFile), specifier) : null);
    const importedFile = resolvedImport ? resolveSourceFile(resolvedImport) : null;

    if (importedFile) {
      walkImportGraph(importedFile, visited);
    }
  }

  return visited;
}

test('product imports use the deterministic video i18n adapter and exclude privileged runtime code', () => {
  const graph = walkImportGraph(productImports);

  assert.equal(graph.has(videoI18n), true);
  assert.equal(graph.has(path.join(repoRoot, 'src/renderer/hooks/useI18n.tsx')), false);
  assert.equal(graph.has(path.join(repoRoot, 'src/renderer/App.tsx')), false);
});

test('product import validation rejects forbidden runtime dependencies', () => {
  assert.throws(() => assertSafeImport('electron'));
  assert.throws(() => assertSafeSource(productImports, 'window.electronAPI.getLocale()'));
  assert.throws(() => assertSafeSource(productImports, 'navigator.mediaDevices.getUserMedia()'));
});
