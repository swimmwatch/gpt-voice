import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import Ajv2020 from 'ajv/dist/2020.js';

import { importerImplementationDigest } from './importer-identity.mjs';
import {
  parseArguments,
  readJson,
  requiredArgument,
  verifyMaterializedSource,
  verifySourceLock,
} from './native-source-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const lockId = requiredArgument(arguments_, 'lock');
  const lockPath = resolve(workspaceRoot, 'runtime', 'local-whisper', 'sources', 'locks', `${lockId}.json`);
  const schemaPath = resolve(
    workspaceRoot,
    'runtime',
    'local-whisper',
    'sources',
    'schema',
    'native-source-lock.schema.json',
  );
  const lock = readJson(lockPath);
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, formats: { 'date-time': true }, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(lock)) throw new Error(`Native source schema failed: ${ajv.errorsText(validate.errors)}`);
  verifySourceLock(lock);
  if (lock.importer.implementationSha256 !== importerImplementationDigest()) {
    throw new Error('Native source importer implementation digest changed');
  }
  const storeRoot = resolve(
    arguments_.get('store-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'native-sources'),
  );
  verifyMaterializedSource(storeRoot, lock);
  process.stdout.write(`${lock.lockId}\t${lock.materialization.manifestSha256}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native source verification failed'}\n`);
  process.exitCode = 1;
}
