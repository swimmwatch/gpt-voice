import { availableParallelism, freemem } from 'node:os';

const GIBIBYTE = 1024 ** 3;
const MEBIBYTE = 1024 ** 2;
const RESERVED_MEMORY_BYTES = 2 * GIBIBYTE;
const CUDA_MEMORY_PER_JOB_BYTES = GIBIBYTE;
const CPU_MEMORY_PER_JOB_BYTES = 512 * MEBIBYTE;
const MAXIMUM_CUDA_JOBS = 8;

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}

function parseOverride(value, maximumJobs) {
  if (value === undefined) return null;
  if (!/^[1-9]\d*$/u.test(value)) {
    throw new Error('LOCAL_WHISPER_BUILD_JOBS must be a canonical positive integer');
  }
  const jobs = Number(value);
  if (!Number.isSafeInteger(jobs) || jobs > maximumJobs) {
    throw new Error('LOCAL_WHISPER_BUILD_JOBS exceeds the available processor count');
  }
  return jobs;
}

/** Selects bounded native build parallelism without changing the compiler environment or evidence inputs. */
export function resolveNativeBuildJobs({
  backend = 'cpu',
  availableCores = availableParallelism(),
  freeMemoryBytes = freemem(),
  override = process.env.LOCAL_WHISPER_BUILD_JOBS,
} = {}) {
  if (backend !== 'cpu' && backend !== 'cuda') throw new Error('Native build backend must be cpu or cuda');
  const coreLimit = requirePositiveInteger(availableCores, 'Available processor count');
  if (!Number.isSafeInteger(freeMemoryBytes) || freeMemoryBytes < 0) {
    throw new Error('Available memory must be a non-negative integer');
  }
  const explicitJobs = parseOverride(override, coreLimit);
  if (explicitJobs !== null) return explicitJobs;

  const memoryPerJob = backend === 'cuda' ? CUDA_MEMORY_PER_JOB_BYTES : CPU_MEMORY_PER_JOB_BYTES;
  const usableMemory = Math.max(memoryPerJob, freeMemoryBytes - RESERVED_MEMORY_BYTES);
  const memoryLimit = Math.max(1, Math.floor(usableMemory / memoryPerJob));
  const backendLimit = backend === 'cuda' ? MAXIMUM_CUDA_JOBS : coreLimit;
  return Math.max(1, Math.min(coreLimit, memoryLimit, backendLimit));
}
