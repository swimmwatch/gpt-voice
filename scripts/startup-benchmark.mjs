import path from 'node:path';

export const DEFAULT_STARTUP_BENCHMARK_RUNS = 10;
export const MAX_STARTUP_BENCHMARK_RUNS = 50;
export const STARTUP_PROFILE_CLEANUP_MAX_ATTEMPTS = 5;
export const STARTUP_PROFILE_CLEANUP_RETRY_DELAY_MS = 100;

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
    const appDirectories =
      arch === 'arm64'
        ? ['mac-arm64', 'mac-universal']
        : ['mac', 'mac-universal'];
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

/** Waits for a child only when it has not already exited. */
export function waitForChildExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once('exit', resolve);
  });
}

function isTransientWindowsProfileCleanupError(error) {
  return (
    typeof error === 'object' && error !== null && 'code' in error && (error.code === 'EBUSY' || error.code === 'EPERM')
  );
}

/** Removes the temporary Chromium profile, retrying only transient Windows file locks. */
export async function removeStartupProfile(userDataPath, { delay, platform, remove }) {
  const maxAttempts = platform === 'win32' ? STARTUP_PROFILE_CLEANUP_MAX_ATTEMPTS : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await remove(userDataPath, { force: true, recursive: true });
      return;
    } catch (error) {
      const isFinalAttempt = attempt === maxAttempts - 1;
      if (isFinalAttempt || !isTransientWindowsProfileCleanupError(error)) {
        throw error;
      }

      await delay(STARTUP_PROFILE_CLEANUP_RETRY_DELAY_MS * 2 ** attempt);
    }
  }
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
