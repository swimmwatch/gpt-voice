import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import Ajv2020 from 'ajv/dist/2020.js';

import { parseArguments, readJson, requiredArgument, writeJsonAtomic } from '../source-import/native-source-core.mjs';
import { auditDisconnectedBuild } from './disconnected-build-core.mjs';
import { verifyQualificationEvidence } from './native-toolchain-evidence-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const profileId = requiredArgument(arguments_, 'profile');
  const profile = readJson(
    resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'profiles', `${profileId}.json`),
  );
  if (profile.target.os !== 'linux') {
    throw new Error('Representative Windows execution is prohibited in Task 19 and reserved for Task 20');
  }
  const toolchainRoot = resolve(
    arguments_.get('toolchain-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains'),
  );
  const sourceStoreRoot = resolve(
    arguments_.get('source-store-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'native-sources'),
  );
  const evidence = auditDisconnectedBuild(workspaceRoot, profile, sourceStoreRoot, toolchainRoot);
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
  verifyQualificationEvidence(profile, evidence);
  const output = resolve(
    arguments_.get('output') ??
      resolve(workspaceRoot, '.cache', 'local-whisper', 'qualification-candidates', `${profileId}.evidence.json`),
  );
  writeJsonAtomic(output, evidence);
  process.stdout.write(`${profileId}\t${output}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Disconnected native build audit failed'}\n`);
  process.exitCode = 1;
}
