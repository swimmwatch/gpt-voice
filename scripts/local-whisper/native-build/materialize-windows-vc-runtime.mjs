import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import Ajv2020 from 'ajv/dist/2020.js';

import { parseArguments, readJson } from '../source-import/native-source-core.mjs';
import {
  materializeWindowsRuntime,
  verifyWindowsRuntimeAcquisitionLock,
} from './windows-runtime-materializer-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const lockPath = resolve(
    workspaceRoot,
    'runtime',
    'local-whisper',
    'toolchains',
    'locks',
    'microsoft-vc-runtime-14.51.36247.0-x64-v1.json',
  );
  const schema = JSON.parse(
    readFileSync(
      resolve(
        workspaceRoot,
        'runtime',
        'local-whisper',
        'toolchains',
        'schema',
        'windows-runtime-acquisition-lock.schema.json',
      ),
      'utf8',
    ),
  );
  const lock = readJson(lockPath);
  const installer = arguments_.get('installer');
  const installedRuntimeProofArgument = arguments_.get('installed-runtime-proof');
  if (installedRuntimeProofArgument !== undefined && installedRuntimeProofArgument !== 'true') {
    throw new Error('Windows installed-runtime proof must be exactly true');
  }
  const installedRuntimeProof = installedRuntimeProofArgument === 'true';
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(lock)) throw new Error(`Windows runtime acquisition schema failed: ${ajv.errorsText(validate.errors)}`);
  verifyWindowsRuntimeAcquisitionLock(lock);
  const result = materializeWindowsRuntime({
    installerPath: typeof installer === 'string' ? resolve(installer) : null,
    installedRuntimeProof,
    lock,
    toolchainRoot: resolve(
      arguments_.get('toolchain-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains'),
    ),
  });
  process.stdout.write(`${lock.lockId}\t${result.manifest.files.length}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Windows runtime materialization failed'}\n`);
  process.exitCode = 1;
}
