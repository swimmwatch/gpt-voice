import process from 'node:process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import Ajv2020 from 'ajv/dist/2020.js';

import { parseArguments, readJson, requiredArgument, writeJsonAtomic } from '../source-import/native-source-core.mjs';
import { qualifyToolchainProfile } from './native-toolchain-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const profile = readJson(requiredArgument(arguments_, 'profile-file'));
  const evidence = readJson(requiredArgument(arguments_, 'evidence'));
  const schema = JSON.parse(
    readFileSync(
      resolve(
        workspaceRoot,
        'runtime',
        'local-whisper',
        'toolchains',
        'schema',
        'native-toolchain-evidence.schema.json',
      ),
      'utf8',
    ),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(evidence))
    throw new Error(`Native toolchain evidence schema failed: ${ajv.errorsText(validate.errors)}`);
  const qualified = qualifyToolchainProfile(profile, evidence);
  writeJsonAtomic(requiredArgument(arguments_, 'profile-output'), qualified);
  writeJsonAtomic(requiredArgument(arguments_, 'evidence-output'), evidence);
  process.stdout.write(`${qualified.profileId}\t${qualified.evidenceDigest}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native toolchain qualification failed'}\n`);
  process.exitCode = 1;
}
