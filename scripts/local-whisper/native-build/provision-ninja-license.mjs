import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import Ajv2020 from 'ajv/dist/2020.js';

import { parseArguments, readJson } from '../source-import/native-source-core.mjs';
import { VerifiedRawFileMaterializer } from './verified-raw-file-materializer.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

export function loadNinjaLicenseLock() {
  const lock = readJson(
    resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'locks', 'ninja-1.12.1-license-v1.json'),
  );
  const schema = JSON.parse(
    readFileSync(
      resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'schema', 'reviewed-raw-file-lock.schema.json'),
      'utf8',
    ),
  );
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(lock)) throw new Error(`Reviewed raw-file lock schema failed: ${validate.errorsText(validate.errors)}`);
  return Object.freeze({ lockId: lock.lockId, source: Object.freeze({ ...lock.source }) });
}

export async function provisionNinjaLicense({ fetcher = globalThis.fetch, toolchainRoot }) {
  const lock = loadNinjaLicenseLock();
  const materialized = await new VerifiedRawFileMaterializer({ fetcher }).materialize({
    root: toolchainRoot,
    source: lock.source,
  });
  return Object.freeze({ lockId: lock.lockId, materialized });
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  if ([...arguments_.keys()].some((name) => name !== 'toolchain-root')) {
    throw new Error('Unknown Ninja license provisioning argument');
  }
  const result = await provisionNinjaLicense({
    toolchainRoot: resolve(
      arguments_.get('toolchain-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains'),
    ),
  });
  process.stdout.write(`${result.lockId}\t${result.materialized.sizeBytes}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Ninja license provisioning failed'}\n`);
    process.exitCode = 1;
  });
}
