import path from 'node:path';

export const DEFAULT_STARTUP_BENCHMARK_RUNS = 10;
export const MAX_STARTUP_BENCHMARK_RUNS = 50;
export const STARTUP_BENCHMARK_TERMINATION_GRACE_MS = 1_000;
export const STARTUP_BENCHMARK_FORCE_TERMINATION_WAIT_MS = 1_000;

function assertDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new TypeError('Startup durations must be non-negative finite milliseconds');
  }
}

export function calculateMedian(durationsMs) {
  if (durationsMs.length === 0) {
    throw new TypeError('Startup benchmark requires at least one duration');
  }

  for (const durationMs of durationsMs) {
    assertDuration(durationMs);
  }

  const sortedDurations = Array.from(durationsMs).sort((left, right) => left - right);
  const middle = Math.floor(sortedDurations.length / 2);
  return sortedDurations.length % 2 === 1
    ? sortedDurations[middle]
    : (sortedDurations[middle - 1] + sortedDurations[middle]) / 2;
}

export function normalizeRunCount(value) {
  if (value === undefined) {
    return DEFAULT_STARTUP_BENCHMARK_RUNS;
  }

  const runCount = Number(value);
  if (!Number.isInteger(runCount) || runCount < 1 || runCount > MAX_STARTUP_BENCHMARK_RUNS) {
    throw new TypeError(`Startup benchmark runs must be an integer between 1 and ${MAX_STARTUP_BENCHMARK_RUNS}`);
  }

  return runCount;
}

export function getPackagedStartupExecutableCandidates(rootDir, platform, arch) {
  const releaseDir = path.join(rootDir, 'release');

  if (platform === 'linux') {
    return [path.join(releaseDir, 'linux-unpacked', 'gpt-voice')];
  }

  if (platform === 'win32') {
    return [
      path.join(releaseDir, 'win-unpacked', 'gpt-voice.exe'),
      path.join(releaseDir, 'win-unpacked', 'GPT-Voice.exe'),
    ];
  }

  if (platform === 'darwin') {
    const appDirectories = arch === 'arm64' ? ['mac-arm64', 'mac-universal'] : ['mac', 'mac-universal'];
    return appDirectories.map((directory) =>
      path.join(releaseDir, directory, 'GPT-Voice.app', 'Contents', 'MacOS', 'GPT-Voice'),
    );
  }

  throw new Error(`Unsupported startup benchmark platform: ${platform}`);
}

export function getStartupBenchmarkLaunchArguments(userDataPath, platform) {
  const argumentsList = [`--user-data-dir=${userDataPath}`, '--startup-benchmark'];
  if (platform === 'linux') {
    argumentsList.push('--no-sandbox');
  }

  return argumentsList;
}

/**
 * Keeps benchmark output bounded and lets Unix cleanup address Electron's whole
 * process tree. Electron can emit native diagnostics before the renderer is ready;
 * retaining that output is both unnecessary and capable of blocking the child.
 */
export function getStartupBenchmarkSpawnOptions({ cwd, env, platform }) {
  return {
    cwd,
    detached: platform !== 'win32',
    env,
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  };
}

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

/** Waits for a child only when it has not already exited. */
export function waitForChildExit(child) {
  if (hasExited(child)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once('exit', resolve);
  });
}

/** Waits for an exit event for a bounded period and removes its listener on timeout. */
export function waitForChildExitWithin(child, timeoutMs) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('Startup benchmark exit timeout must be a non-negative integer');
  }

  if (hasExited(child)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      child.off?.('exit', onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timeout = globalThis.setTimeout(() => finish(false), timeoutMs);

    child.once('exit', onExit);
    if (hasExited(child)) {
      finish(true);
    }
  });
}

function signalStartupBenchmarkChild(child, platform, signal, killProcess) {
  if (hasExited(child)) {
    return;
  }

  if (platform === 'win32' || !Number.isSafeInteger(child.pid) || child.pid <= 0) {
    child.kill(signal);
    return;
  }

  try {
    killProcess(-child.pid, signal);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ESRCH') {
      return;
    }
    throw error;
  }
}

/**
 * Stops an Electron benchmark child without allowing a missing exit event to
 * stall the surrounding release job. Unix runs are detached, so signals target
 * the complete process group rather than only Electron's launcher process.
 */
export async function terminateStartupBenchmarkChild(
  child,
  platform,
  {
    forceWaitMs = STARTUP_BENCHMARK_FORCE_TERMINATION_WAIT_MS,
    graceMs = STARTUP_BENCHMARK_TERMINATION_GRACE_MS,
    killProcess = process.kill,
  } = {},
) {
  if (hasExited(child)) {
    return { exited: true, forced: false };
  }

  signalStartupBenchmarkChild(child, platform, 'SIGTERM', killProcess);
  if (await waitForChildExitWithin(child, graceMs)) {
    return { exited: true, forced: false };
  }

  signalStartupBenchmarkChild(child, platform, 'SIGKILL', killProcess);
  return {
    exited: await waitForChildExitWithin(child, forceWaitMs),
    forced: true,
  };
}

export async function runStartupBenchmark({ arch, measureRun, platform, runCount, toolVersions }) {
  const durationsMs = [];

  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    durationsMs.push(await measureRun(runIndex));
  }

  return {
    arch,
    durationsMs,
    medianMs: calculateMedian(durationsMs),
    platform,
    runCount,
    toolVersions,
  };
}
