import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import { parseArguments, readJson } from '../source-import/native-source-core.mjs';
import { verifyWindowsRuntimeAcquisitionLock } from './windows-runtime-materializer-core.mjs';
import { VerifiedRawFileMaterializer } from './verified-raw-file-materializer.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

export async function provisionWindowsVcRuntimeLicense({ fetcher = globalThis.fetch, toolchainRoot }) {
  const lock = readJson(
    resolve(
      workspaceRoot,
      'runtime',
      'local-whisper',
      'toolchains',
      'locks',
      'microsoft-vc-runtime-14.51.36247.0-x64-v1.json',
    ),
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
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(lock))
    throw new Error(`Windows runtime acquisition schema failed: ${validate.errorsText(validate.errors)}`);
  verifyWindowsRuntimeAcquisitionLock(lock);
  const materialized = await new VerifiedRawFileMaterializer({ fetcher }).materialize({
    root: toolchainRoot,
    source: lock.license,
  });
  return Object.freeze({ lockId: lock.lockId, materialized });
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  if ([...arguments_.keys()].some((name) => name !== 'toolchain-root')) {
    throw new Error('Unknown Windows VC Runtime license provisioning argument');
  }
  const result = await provisionWindowsVcRuntimeLicense({
    toolchainRoot: resolve(
      arguments_.get('toolchain-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains'),
    ),
  });
  process.stdout.write(`${result.lockId}\t${result.materialized.sizeBytes}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Windows VC Runtime license provisioning failed'}\n`,
    );
    process.exitCode = 1;
  });
}
