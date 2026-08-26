import process from 'node:process';

import {
  canonicalAdvisoryReportJson,
  isCleanAdvisoryReport,
  NativeSourceAdvisoryScanner,
} from './native-source-advisory-core.mjs';

function parseArguments(arguments_) {
  if (arguments_.length !== 1 || arguments_[0] !== '--locks=all') throw new Error('Expected --locks=all');
}

try {
  parseArguments(process.argv.slice(2));
  const report = await new NativeSourceAdvisoryScanner().scan(process.cwd());
  process.stdout.write(`${canonicalAdvisoryReportJson(report)}\n`);
  if (!isCleanAdvisoryReport(report)) {
    process.stderr.write(`Native source advisory result: ${report.result}\n`);
    process.exitCode = 1;
  }
} catch {
  process.stderr.write('Native source advisory verification failed\n');
  process.exitCode = 1;
}
