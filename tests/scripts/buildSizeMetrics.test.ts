import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

interface BuildSizeMetricsModule {
  BYTES_PER_MEBIBYTE: number;
  SIZE_REGRESSION_MIN_BYTES: number;
  SIZE_REGRESSION_MIN_RATIO: number;
  createSizeMetric: (id: string, bytes: number) => { bytes: number; id: string };
  exceedsSizeRegressionThreshold: (currentBytes: number, baselineBytes: number) => boolean;
  measureFileCompressionBytes: (filePath: string) => Promise<{ brotliBytes: number; gzipBytes: number } | null>;
  measurePathBytes: (inputPath: string) => Promise<number | null>;
  sortSizeMetrics: <Metric extends { id: string }>(metrics: readonly Metric[]) => Metric[];
}

const projectRoot = path.resolve(__dirname, '..', '..');
const modulePath = path.join(projectRoot, 'scripts', 'build-size-metrics.mjs');
let buildSizeMetrics: BuildSizeMetricsModule;

function isBuildSizeMetricsModule(value: unknown): value is BuildSizeMetricsModule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const module = value as Record<string, unknown>;
  return (
    typeof module.BYTES_PER_MEBIBYTE === 'number' &&
    typeof module.SIZE_REGRESSION_MIN_BYTES === 'number' &&
    typeof module.SIZE_REGRESSION_MIN_RATIO === 'number' &&
    typeof module.createSizeMetric === 'function' &&
    typeof module.exceedsSizeRegressionThreshold === 'function' &&
    typeof module.measureFileCompressionBytes === 'function' &&
    typeof module.measurePathBytes === 'function' &&
    typeof module.sortSizeMetrics === 'function'
  );
}

describe('build size metrics', () => {
  before(async () => {
    const importedModule: unknown = await import(pathToFileURL(modulePath).href);
    if (!isBuildSizeMetricsModule(importedModule)) {
      throw new TypeError('The build size metrics module has an invalid export shape');
    }

    buildSizeMetrics = importedModule;
  });

  it('creates integer metrics and sorts their stable identifiers without changing byte values', () => {
    const metrics = [
      buildSizeMetrics.createSizeMetric('renderer.gzip', 91),
      buildSizeMetrics.createSizeMetric('app.asar', 2_097_152),
      buildSizeMetrics.createSizeMetric('installer.linux', 30),
    ];

    assert.deepEqual(buildSizeMetrics.sortSizeMetrics(metrics), [
      { bytes: 2_097_152, id: 'app.asar' },
      { bytes: 30, id: 'installer.linux' },
      { bytes: 91, id: 'renderer.gzip' },
    ]);
    assert.throws(() => buildSizeMetrics.createSizeMetric('renderer.gzip', 1.5), /integer bytes/i);
  });

  it('flags a regression only when byte growth and relative growth both exceed the budget', () => {
    const baselineBytes = 100 * buildSizeMetrics.BYTES_PER_MEBIBYTE;
    const exactByteThreshold = baselineBytes + buildSizeMetrics.SIZE_REGRESSION_MIN_BYTES;
    const exactRatioThreshold = Math.floor(baselineBytes * (1 + buildSizeMetrics.SIZE_REGRESSION_MIN_RATIO));

    assert.equal(buildSizeMetrics.exceedsSizeRegressionThreshold(exactByteThreshold, baselineBytes), false);
    assert.equal(buildSizeMetrics.exceedsSizeRegressionThreshold(exactRatioThreshold, baselineBytes), false);
    assert.equal(
      buildSizeMetrics.exceedsSizeRegressionThreshold(
        200 * buildSizeMetrics.BYTES_PER_MEBIBYTE + buildSizeMetrics.SIZE_REGRESSION_MIN_BYTES + 1,
        200 * buildSizeMetrics.BYTES_PER_MEBIBYTE,
      ),
      false,
    );
    assert.equal(
      buildSizeMetrics.exceedsSizeRegressionThreshold(
        50 * buildSizeMetrics.BYTES_PER_MEBIBYTE + buildSizeMetrics.SIZE_REGRESSION_MIN_BYTES - 1,
        50 * buildSizeMetrics.BYTES_PER_MEBIBYTE,
      ),
      false,
    );
    assert.equal(
      buildSizeMetrics.exceedsSizeRegressionThreshold(
        baselineBytes + buildSizeMetrics.SIZE_REGRESSION_MIN_BYTES + 1,
        baselineBytes,
      ),
      true,
    );
  });

  it('rejects invalid regression baselines instead of silently accepting them', () => {
    assert.throws(() => buildSizeMetrics.exceedsSizeRegressionThreshold(1, 0), /baseline/i);
    assert.throws(() => buildSizeMetrics.exceedsSizeRegressionThreshold(1, -1), /baseline/i);
    assert.throws(() => buildSizeMetrics.exceedsSizeRegressionThreshold(1.5, 1), /integer bytes/i);
  });

  it('measures empty files, nested directories, and missing paths deterministically', async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gpt-voice-size-metrics-'));

    try {
      const emptyFilePath = path.join(temporaryDirectory, 'empty.txt');
      const nestedDirectoryPath = path.join(temporaryDirectory, 'nested', 'deeper');
      const nestedFilePath = path.join(nestedDirectoryPath, 'content.txt');
      const missingPath = path.join(temporaryDirectory, 'missing');

      await writeFile(emptyFilePath, '');
      await mkdir(nestedDirectoryPath, { recursive: true });
      await writeFile(nestedFilePath, 'hello');

      assert.equal(await buildSizeMetrics.measurePathBytes(emptyFilePath), 0);
      assert.equal(await buildSizeMetrics.measurePathBytes(temporaryDirectory), 5);
      assert.equal(await buildSizeMetrics.measurePathBytes(temporaryDirectory), 5);
      assert.equal(await buildSizeMetrics.measurePathBytes(missingPath), null);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it('reports reproducible gzip and Brotli sizes for empty files and ignores missing files', async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gpt-voice-size-metrics-'));

    try {
      const emptyFilePath = path.join(temporaryDirectory, 'empty.txt');
      await writeFile(emptyFilePath, '');

      const first = await buildSizeMetrics.measureFileCompressionBytes(emptyFilePath);
      const second = await buildSizeMetrics.measureFileCompressionBytes(emptyFilePath);

      assert.deepEqual(first, second);
      assert.ok(first);
      assert.ok(first.gzipBytes > 0);
      assert.ok(first.brotliBytes > 0);
      assert.equal(
        await buildSizeMetrics.measureFileCompressionBytes(path.join(temporaryDirectory, 'missing.txt')),
        null,
      );
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});
