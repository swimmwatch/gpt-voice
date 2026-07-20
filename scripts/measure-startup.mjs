import { spawn } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getPackagedStartupExecutableCandidates,
  getStartupBenchmarkLaunchArguments,
  normalizeRunCount,
  runStartupBenchmark,
  waitForChildExit,
} from './startup-benchmark.mjs';

const STARTUP_READY_MARKER = 'GPT_VOICE_STARTUP_READY';
const STARTUP_TIMEOUT_MS = 60_000;
const STARTUP_PROFILE_CLEANUP_RETRIES = 10;
const STARTUP_PROFILE_CLEANUP_RETRY_DELAY_MS = 200;
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArguments(args) {
  const options = { output: null, runs: undefined };

  for (const argument of args) {
    const [name, value] = argument.split('=', 2);
    if (name === '--runs' && value) {
      options.runs = value;
    } else if (name === '--output' && value) {
      options.output = value;
    } else {
      throw new Error(`Unsupported measure:startup argument: ${argument}`);
    }
  }

  return { output: options.output, runCount: normalizeRunCount(options.runs) };
}

async function getToolVersions() {
  const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
  return {
    electron: typeof packageJson.devDependencies?.electron === 'string' ? packageJson.devDependencies.electron : null,
    node: process.version,
  };
}

async function getPackagedStartupExecutable() {
  const candidates = getPackagedStartupExecutableCandidates(rootDir, process.platform, process.arch);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next layout before reporting every checked path.
    }
  }

  throw new Error(
    `Packaged startup executable not found. Checked:\n${candidates.map((candidate) => `  - ${candidate}`).join('\n')}`,
  );
}

function waitForStartupReady(child) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    const timeout = setTimeout(() => {
      finish(reject, new Error('Startup benchmark timed out waiting for the ready marker'));
    }, STARTUP_TIMEOUT_MS);
    const finish = (callback, value) => {
      globalThis.clearTimeout(timeout);
      child.stdout?.off('data', onData);
      child.off('error', onError);
      child.off('exit', onExit);
      callback(value);
    };
    const onData = (chunk) => {
      stdout += chunk.toString();
      if (stdout.includes(STARTUP_READY_MARKER)) {
        finish(resolve);
      }
    };
    const onError = (error) => finish(reject, error);
    const onExit = (code) =>
      finish(reject, new Error(`Startup benchmark exited before readiness (code ${String(code)})`));

    child.stdout?.on('data', onData);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

async function measureStartupRun(executablePath) {
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), 'gpt-voice-startup-'));
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name !== 'ELECTRON_RUN_AS_NODE'),
  );
  let child;

  try {
    const startedAt = process.hrtime.bigint();
    child = spawn(executablePath, getStartupBenchmarkLaunchArguments(userDataPath, process.platform), {
      cwd: rootDir,
      env: {
        ...environment,
        APPDATA: userDataPath,
        HOME: userDataPath,
        USERPROFILE: userDataPath,
        XDG_CONFIG_HOME: userDataPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForStartupReady(child);
    return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  } finally {
    if (child && child.exitCode === null) {
      const exitPromise = waitForChildExit(child);
      if (!child.killed) {
        child.kill();
      }
      await exitPromise;
    }

    await rm(userDataPath, {
      force: true,
      maxRetries: STARTUP_PROFILE_CLEANUP_RETRIES,
      recursive: true,
      retryDelay: STARTUP_PROFILE_CLEANUP_RETRY_DELAY_MS,
    });
  }
}

const { output, runCount } = parseArguments(process.argv.slice(2));
const packagedStartupExecutable = await getPackagedStartupExecutable();
const report = await runStartupBenchmark({
  arch: process.arch,
  measureRun: () => measureStartupRun(packagedStartupExecutable),
  platform: process.platform,
  runCount,
  toolVersions: await getToolVersions(),
});
const outputPath = path.resolve(
  rootDir,
  output ?? path.join('release-artifacts', `startup-${report.platform}-${report.arch}.json`),
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Startup benchmark: ${report.platform}/${report.arch}`);
console.log(`Runs: ${report.runCount}; median: ${report.medianMs.toFixed(1)} ms`);
