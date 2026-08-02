import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import Ajv2020 from 'ajv/dist/2020.js';

import { parseArguments, readJson, requiredArgument } from '../source-import/native-source-core.mjs';
import { verifyLoaderLimitAuthority } from './loader-limit-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const tableId = requiredArgument(arguments_, 'table');
  if (tableId !== 'whisper-cpp-loader-limits-v1') throw new Error('Unknown loader-limit table');
  const limitsRoot = resolve(workspaceRoot, 'runtime', 'local-whisper', 'sources', 'limits');
  const table = readJson(resolve(limitsRoot, `${tableId}.json`));
  const provenance = readJson(resolve(limitsRoot, `${tableId}.provenance.json`));
  const sourceLock = readJson(
    resolve(workspaceRoot, 'runtime', 'local-whisper', 'sources', 'locks', 'whisper-cpp-v1.9.1-f049fff.json'),
  );
  const schema = JSON.parse(
    readFileSync(
      resolve(workspaceRoot, 'runtime', 'local-whisper', 'sources', 'schema', 'loader-limit-table.schema.json'),
      'utf8',
    ),
  );
  const ajv = new Ajv2020({ allErrors: true, formats: { 'date-time': true }, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(table)) throw new Error(`Loader-limit schema failed: ${ajv.errorsText(validate.errors)}`);
  verifyLoaderLimitAuthority(workspaceRoot, sourceLock, table, provenance);
  process.stdout.write(`${table.tableId}\t${table.tableSha256}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Loader-limit verification failed'}\n`);
  process.exitCode = 1;
}
