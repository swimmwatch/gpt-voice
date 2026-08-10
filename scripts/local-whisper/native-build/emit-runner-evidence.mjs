import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const SOURCE_COMMIT = /^[a-f\d]{40}$/u;
const LINUX_RUNNER = /^ubuntu-\d+\.\d+$/u;
const WINDOWS_RUNNER = /^windows-(?:latest|\d{4})$/u;
const CLANG_TOOLCHAIN = /^clang-(?<major>\d+)$/u;
const SUPPORTED_OPERATING_SYSTEMS = new Set(['linux', 'windows']);

function parseArguments(argv) {
  const values = new Map();
  for (const argument of argv) {
    const [name, value] = argument.split('=', 2);
    if (!name.startsWith('--') || !value) throw new Error(`Expected --name=value, received ${argument}`);
    values.set(name.slice(2), value);
  }
  return values;
}

function required(values, name) {
  const value = values.get(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function compilerVersion(compiler, toolchain) {
  const argument = toolchain.startsWith('msvc-') ? '/Bv' : '--version';
  const result = spawnSync(compiler, [argument], { encoding: 'utf8', shell: false });
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.error || !output.trim()) throw new Error(`Unable to verify compiler ${compiler}`);
  const clang = CLANG_TOOLCHAIN.exec(toolchain);
  if (clang && !new RegExp(`clang version ${clang.groups.major}\\.`, 'u').test(output)) {
    throw new Error(`Compiler does not match the required ${toolchain} profile`);
  }
  if (toolchain === 'msvc-hosted' && !/Version 19\.\d+\./u.test(output)) {
    throw new Error('Compiler does not report a supported hosted MSVC version');
  }
  if (toolchain !== 'msvc-hosted' && result.status !== 0) throw new Error(`Unable to verify compiler ${compiler}`);
  return (
    output
      .split(/\r?\n/u)
      .find((line) => line.trim())
      ?.trim() ?? toolchain
  );
}

function expectedRunnerOperatingSystem(runnerLabel) {
  if (LINUX_RUNNER.test(runnerLabel)) return 'linux';
  if (WINDOWS_RUNNER.test(runnerLabel)) return 'windows';
  throw new Error(`Unsupported runner label ${runnerLabel}`);
}

function verifyToolchain(toolchain, expectedOperatingSystem) {
  if (expectedOperatingSystem === 'linux' && !CLANG_TOOLCHAIN.test(toolchain)) {
    throw new Error('Linux runner evidence requires a clang-N toolchain profile');
  }
  if (expectedOperatingSystem === 'windows' && toolchain !== 'msvc-hosted') {
    throw new Error('Windows runner evidence requires the hosted MSVC toolchain profile');
  }
}

async function sourceManifest(workspaceRoot) {
  const lockDirectory = path.join(workspaceRoot, 'runtime', 'local-whisper', 'sources', 'locks');
  const names = (await readdir(lockDirectory)).filter((name) => name.endsWith('.json')).sort();
  const entries = await Promise.all(
    names.map(async (name) => {
      const contents = await readFile(path.join(lockDirectory, name));
      return [name, createHash('sha256').update(contents).digest('hex')];
    }),
  );
  return Object.fromEntries(entries);
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const runnerLabel = required(values, 'runner-label');
  const toolchain = required(values, 'toolchain');
  const expectedOperatingSystem = required(values, 'expected-os');
  const compiler = required(values, 'compiler');
  const output = required(values, 'output');
  if (!SUPPORTED_OPERATING_SYSTEMS.has(expectedOperatingSystem))
    throw new Error(`Unsupported expected OS ${expectedOperatingSystem}`);
  if (expectedRunnerOperatingSystem(runnerLabel) !== expectedOperatingSystem) {
    throw new Error('Runner label does not match the expected operating system');
  }
  verifyToolchain(toolchain, expectedOperatingSystem);
  if (process.arch !== 'x64' || process.env.RUNNER_ARCH !== 'X64')
    throw new Error('Runner evidence requires x64 execution');
  const sourceCommit = process.env.GITHUB_SHA;
  if (!sourceCommit || !SOURCE_COMMIT.test(sourceCommit))
    throw new Error('Runner evidence requires an exact source commit');
  const imageOS = process.env.ImageOS;
  const imageVersion = process.env.ImageVersion;
  if (!imageOS || !imageVersion || !process.env.RUNNER_OS) throw new Error('Runner image metadata is missing');
  const reportedOperatingSystem = process.env.RUNNER_OS.toLowerCase();
  if (reportedOperatingSystem !== expectedOperatingSystem) {
    throw new Error('Runner image metadata does not match the expected operating system');
  }

  const workspaceRoot = path.resolve(import.meta.dirname, '..', '..', '..');
  const evidence = {
    architecture: process.arch,
    nativeSourceManifest: await sourceManifest(workspaceRoot),
    reportedImage: { imageOS, imageVersion, runnerOS: process.env.RUNNER_OS },
    runnerLabel,
    sourceCommit,
    testedDigests: values.get('tested-digests')?.split(',').sort() ?? [],
    toolchain: { profile: toolchain, version: compilerVersion(compiler, toolchain) },
  };
  const outputPath = path.resolve(workspaceRoot, output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Runner evidence failed'}\n`);
  process.exitCode = 1;
});
