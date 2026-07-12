import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, gzip } from 'node:zlib';

export const BYTES_PER_MEBIBYTE = 1024 * 1024;
export const SIZE_REGRESSION_MIN_BYTES = 2 * BYTES_PER_MEBIBYTE;
export const SIZE_REGRESSION_MIN_RATIO = 0.02;

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);
const METRIC_ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/;

function assertNonNegativeIntegerBytes(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be non-negative integer bytes`);
  }
}

function isMissingPathError(error) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function readPathStats(inputPath) {
  try {
    return await lstat(inputPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }

    throw error;
  }
}

async function measureExistingPathBytes(inputPath, stats) {
  if (stats.isFile()) {
    return stats.size;
  }

  if (!stats.isDirectory()) {
    return 0;
  }

  const entries = await readdir(inputPath, { withFileTypes: true });
  const sortedEntries = entries.toSorted((left, right) => left.name.localeCompare(right.name, 'en'));
  let totalBytes = 0;

  for (const entry of sortedEntries) {
    if (!entry.isDirectory() && !entry.isFile()) {
      continue;
    }

    const childBytes = await measurePathBytes(path.join(inputPath, entry.name));
    if (childBytes !== null) {
      totalBytes += childBytes;
    }
  }

  return totalBytes;
}

export function createSizeMetric(id, bytes) {
  if (typeof id !== 'string' || !METRIC_ID_PATTERN.test(id)) {
    throw new TypeError('Metric id must use lowercase letters, digits, periods, and hyphens');
  }

  assertNonNegativeIntegerBytes(bytes, 'Metric bytes');
  return { bytes, id };
}

export function exceedsSizeRegressionThreshold(currentBytes, baselineBytes) {
  assertNonNegativeIntegerBytes(currentBytes, 'Current size');

  if (!Number.isSafeInteger(baselineBytes) || baselineBytes <= 0) {
    throw new TypeError('Baseline size must be positive integer bytes');
  }

  const growthBytes = currentBytes - baselineBytes;
  const growthRatio = growthBytes / baselineBytes;
  return growthBytes > SIZE_REGRESSION_MIN_BYTES && growthRatio > SIZE_REGRESSION_MIN_RATIO;
}

export async function measureCompressionBytes(contents) {
  const [gzipContents, brotliContents] = await Promise.all([
    compressGzip(contents, { mtime: 0 }),
    compressBrotli(contents),
  ]);

  return {
    brotliBytes: brotliContents.byteLength,
    gzipBytes: gzipContents.byteLength,
  };
}

export async function measureFileCompressionBytes(filePath) {
  try {
    return await measureCompressionBytes(await readFile(filePath));
  } catch (error) {
    if (isMissingPathError(error)) {
      return null;
    }

    throw error;
  }
}

export async function measurePathBytes(inputPath) {
  const stats = await readPathStats(inputPath);
  return stats === null ? null : measureExistingPathBytes(inputPath, stats);
}

export function sortSizeMetrics(metrics) {
  return Array.from(metrics).toSorted((left, right) => left.id.localeCompare(right.id, 'en'));
}
