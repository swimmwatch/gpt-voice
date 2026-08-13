import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';

import { canonicalAdvisoryReportJson, NativeSourceAdvisoryScanner } from './native-source-advisory-core.mjs';

function parseArguments(arguments_) {
  const values = new Map();
  for (const argument of arguments_) {
    const separator = argument.indexOf('=');
    if (!argument.startsWith('--') || separator < 3 || values.has(argument.slice(2, separator))) {
      throw new Error('Invalid advisory scan argument');
    }
    values.set(argument.slice(2, separator), argument.slice(separator + 1));
  }
  if (values.get('locks') !== 'all' || values.size > 2) throw new Error('Expected --locks=all');
  const outputDirectory = values.get('output-directory');
  if (outputDirectory !== undefined && (outputDirectory.length === 0 || outputDirectory.includes('\0'))) {
    throw new Error('Advisory output directory is invalid');
  }
  return outputDirectory;
}

async function persist(outputDirectory, report) {
  if (outputDirectory === undefined) return;
  const directory = resolve(process.cwd(), outputDirectory);
  await mkdir(directory, { mode: 0o700, recursive: false });
  await writeFile(join(directory, `report-${report.reportDigest}.json`), canonicalAdvisoryReportJson(report), {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
}

try {
  const outputDirectory = parseArguments(process.argv.slice(2));
  const report = await new NativeSourceAdvisoryScanner().scan(process.cwd());
  await persist(outputDirectory, report);
  process.stdout.write(`${canonicalAdvisoryReportJson(report)}\n`);
} catch {
  process.stderr.write('Native source advisory scan failed\n');
  process.exitCode = 1;
}
