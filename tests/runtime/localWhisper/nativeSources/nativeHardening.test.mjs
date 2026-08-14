import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import test from 'node:test';

import {
  createNativeHardeningManifest,
  inspectElfHardening,
  inspectPeHardening,
  verifyNativeHardening,
} from '../../../../scripts/local-whisper/native-build/native-hardening-core.mjs';

const fixturePath = resolve('tests', 'fixtures', 'local-whisper', 'native-hardening', 'hardening-fixtures.json');
const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8'));
const hardeningModulePath = resolve('runtime', 'local-whisper', 'cmake', 'LocalWhisperHardening.cmake');
const cmakeProjects = [
  resolve('runtime', 'local-whisper', 'common', 'CMakeLists.txt'),
  resolve('runtime', 'local-whisper', 'fs-guard', 'CMakeLists.txt'),
  resolve('runtime', 'local-whisper', 'launcher', 'CMakeLists.txt'),
  resolve('runtime', 'local-whisper', 'whisper-cpp', 'CMakeLists.txt'),
];

function elfFixture(missing = '') {
  const bytes = Buffer.alloc(0x280);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1], 0);
  bytes.writeUInt16LE(missing === 'missing-pie' ? 2 : 3, 16);
  bytes.writeBigUInt64LE(64n, 32);
  bytes.writeUInt16LE(56, 54);
  bytes.writeUInt16LE(3, 56);

  bytes.writeUInt32LE(2, 64);
  bytes.writeBigUInt64LE(0x200n, 72);
  bytes.writeBigUInt64LE(32n, 96);
  bytes.writeUInt32LE(missing === 'missing-relro' ? 0 : 0x6474e552, 120);
  bytes.writeUInt32LE(0x6474e551, 176);
  bytes.writeUInt32LE(missing === 'executable-stack' ? 1 : 0, 180);

  const tag = missing === 'text-relocation' ? 22n : missing === 'missing-immediate-binding' ? 0n : 30n;
  bytes.writeBigInt64LE(tag, 0x200);
  bytes.writeBigUInt64LE(8n, 0x208);
  bytes.writeBigInt64LE(0n, 0x210);
  return bytes;
}

function peFixture(missing = '') {
  const bytes = Buffer.alloc(0x800);
  bytes.write('MZ', 0, 'ascii');
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write('PE\0\0', 0x80, 'ascii');
  const coff = 0x84;
  bytes.writeUInt16LE(0x8664, coff);
  bytes.writeUInt16LE(1, coff + 2);
  bytes.writeUInt16LE(0xf0, coff + 16);
  const optional = coff + 20;
  bytes.writeUInt16LE(0x20b, optional);
  let dllCharacteristics = 0x40 | 0x100 | 0x20;
  if (missing === 'missing-aslr') dllCharacteristics &= ~0x40;
  if (missing === 'missing-nx') dllCharacteristics &= ~0x100;
  if (missing === 'missing-high-entropy-va') dllCharacteristics &= ~0x20;
  bytes.writeUInt16LE(dllCharacteristics, optional + 70);
  const dataDirectory = optional + 112 + 10 * 8;
  bytes.writeUInt32LE(0x1000, dataDirectory);
  bytes.writeUInt32LE(148, dataDirectory + 4);
  const section = optional + 0xf0;
  bytes.write('.rdata', section, 'ascii');
  bytes.writeUInt32LE(0x200, section + 8);
  bytes.writeUInt32LE(0x1000, section + 12);
  bytes.writeUInt32LE(0x200, section + 16);
  bytes.writeUInt32LE(0x400, section + 20);
  const loadConfiguration = 0x400;
  bytes.writeUInt32LE(148, loadConfiguration);
  bytes.writeBigUInt64LE(missing === 'missing-stack-cookie' ? 0n : 0x1234n, loadConfiguration + 88);
  bytes.writeBigUInt64LE(0x2000n, loadConfiguration + 128);
  bytes.writeBigUInt64LE(1n, loadConfiguration + 136);
  bytes.writeUInt32LE(missing === 'missing-cfg' ? 0 : 0x100, loadConfiguration + 144);
  return bytes;
}

test('ELF hardening parser accepts the synthetic positive fixture', () => {
  assert.deepEqual(inspectElfHardening(elfFixture()), {
    immediateBinding: true,
    noTextRelocations: true,
    nonExecutableStack: true,
    pie: true,
    relro: true,
  });
});

test('hardening policy has one CMake owner across every Local Whisper native project', () => {
  const module = readFileSync(hardeningModulePath, 'utf8');
  assert.match(module, /function\(local_whisper_apply_compile_hardening/u);
  assert.match(module, /function\(local_whisper_apply_executable_hardening/u);
  for (const project of cmakeProjects) {
    const contents = readFileSync(project, 'utf8');
    assert.match(contents, /LocalWhisperHardening\.cmake/u);
    assert.match(contents, /local_whisper_apply_compile_hardening/u);
    assert.doesNotMatch(contents, /-fstack-protector-strong|\/guard:cf|_FORTIFY_SOURCE/u);
  }
});

for (const scenario of fixtures.elf64LittleEndian.filter((entry) => entry !== 'positive')) {
  test(`ELF hardening parser rejects ${scenario}`, () => {
    assert.throws(() => inspectElfHardening(elfFixture(scenario)), /ELF binary/u);
  });
}

test('PE hardening parser accepts the synthetic positive fixture', () => {
  assert.deepEqual(inspectPeHardening(peFixture()), {
    aslr: true,
    cfg: true,
    highEntropyVa: true,
    nx: true,
    stackCookie: true,
  });
});

test('binary parsers reject a wrong executable format', () => {
  assert.throws(() => inspectElfHardening(peFixture()), /Expected an ELF binary/u);
  assert.throws(() => inspectPeHardening(elfFixture()), /Expected a PE binary/u);
});

for (const scenario of fixtures.pe32PlusX64.filter((entry) => entry !== 'positive')) {
  test(`PE hardening parser rejects ${scenario}`, () => {
    assert.throws(() => inspectPeHardening(peFixture(scenario)), /PE binary/u);
  });
}

test('the strict production manifest rejects duplicate and arbitrary executable entries', () => {
  const manifest = createNativeHardeningManifest('linux');
  assert.throws(
    () =>
      verifyNativeHardening({
        manifest: {
          ...manifest,
          executables: [manifest.executables[0], manifest.executables[0], manifest.executables[2]],
        },
        workspaceRoot: process.cwd(),
      }),
    /repeats/u,
  );
  assert.throws(
    () =>
      verifyNativeHardening({
        manifest: {
          ...manifest,
          executables: [
            { ...manifest.executables[0], relativePath: 'dist/arbitrary-binary' },
            manifest.executables[1],
            manifest.executables[2],
          ],
        },
        workspaceRoot: process.cwd(),
      }),
    /unexpected executable/u,
  );
});

test('the verifier rejects an expected output reached through an out-of-root parent symlink', () => {
  const workspaceRoot = mkdtempSync(resolve(tmpdir(), 'local-whisper-hardening-workspace-'));
  const escapedRoot = mkdtempSync(resolve(tmpdir(), 'local-whisper-hardening-escaped-'));
  try {
    const expectedBinary = resolve(escapedRoot, 'local-whisper', 'fs-guard', 'fs-guard');
    mkdirSync(resolve(expectedBinary, '..'), { recursive: true });
    writeFileSync(expectedBinary, elfFixture());
    symlinkSync(escapedRoot, resolve(workspaceRoot, '.cache'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(
      () => verifyNativeHardening({ manifest: createNativeHardeningManifest('linux'), workspaceRoot }),
      /escaped the Local Whisper workspace root/u,
    );
  } finally {
    rmSync(workspaceRoot, { force: true, recursive: true });
    rmSync(escapedRoot, { force: true, recursive: true });
  }
});
