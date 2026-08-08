import { spawn } from 'node:child_process';

import { resolveNativeBuildJobs } from './native-build-parallelism.mjs';

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}

/** Partitions independent native source-file checks without exceeding a resource-aware concurrency limit. */
export function partitionNativeFileWork(files, jobs) {
  requirePositiveInteger(jobs, 'Native file-tool job count');
  const batches = [];
  for (let offset = 0; offset < files.length; offset += jobs) batches.push(files.slice(offset, offset + jobs));
  return batches;
}

function runFileTool(command, arguments_, file, { cwd, env, label }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...arguments_, file], { cwd, env, shell: false, stdio: 'inherit' });
    child.once('error', (error) => reject(new Error(`${label} could not start: ${error.message}`)));
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with code ${String(code)} and signal ${String(signal)}`));
    });
  });
}

/** Runs an independent source-file tool in bounded parallel processes on the current runner. */
export async function runNativeFileToolInParallel({
  arguments_,
  backend = 'cpu',
  command,
  cwd,
  env,
  files,
  label,
  jobs = resolveNativeBuildJobs({ backend }),
}) {
  for (const batch of partitionNativeFileWork(files, jobs)) {
    await Promise.all(batch.map((file) => runFileTool(command, arguments_, file, { cwd, env, label })));
  }
}
