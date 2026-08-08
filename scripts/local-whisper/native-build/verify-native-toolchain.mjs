import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import Ajv2020 from 'ajv/dist/2020.js';

import { canonicalDigest, parseArguments, readJson, requiredArgument } from '../source-import/native-source-core.mjs';
import {
  verifyProfileQualificationFixture,
  verifyQualificationEvidence,
  verifyToolchainContract,
  verifyToolchainInputs,
} from './native-toolchain-core.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..', '..', '..');

try {
  const contractOnly = process.argv.includes('--contract-only');
  const arguments_ = parseArguments(process.argv.slice(2).filter((argument) => argument !== '--contract-only'));
  const profileId = requiredArgument(arguments_, 'profile');
  const profile = readJson(
    resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'profiles', `${profileId}.json`),
  );
  const schema = JSON.parse(
    readFileSync(
      resolve(workspaceRoot, 'runtime', 'local-whisper', 'toolchains', 'schema', 'native-toolchain-lock.schema.json'),
      'utf8',
    ),
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  if (!validate(profile)) throw new Error(`Native toolchain schema failed: ${ajv.errorsText(validate.errors)}`);
  verifyToolchainContract(profile, { contractOnly });
  if (!contractOnly) {
    verifyProfileQualificationFixture(profile, workspaceRoot);
    const toolchainRoot = resolve(
      arguments_.get('toolchain-root') ?? resolve(workspaceRoot, '.cache', 'local-whisper', 'toolchains'),
    );
    verifyToolchainInputs(profile, toolchainRoot);
    const evidencePath = resolve(
      workspaceRoot,
      'runtime',
      'local-whisper',
      'toolchains',
      'qualification',
      `${profileId}.evidence.json`,
    );
    if (!existsSync(evidencePath)) {
      throw new Error('Qualified native toolchain evidence is missing or changed');
    }
    const evidence = readJson(evidencePath);
    const evidenceSchema = JSON.parse(
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
    const validateEvidence = ajv.compile(evidenceSchema);
    if (!validateEvidence(evidence)) {
      throw new Error(`Native toolchain evidence schema failed: ${ajv.errorsText(validateEvidence.errors)}`);
    }
    if (canonicalDigest(evidence) !== profile.evidenceDigest) {
      throw new Error('Qualified native toolchain evidence is missing or changed');
    }
    verifyQualificationEvidence(profile, evidence);
  }
  process.stdout.write(`${profile.profileId}\t${profile.qualificationState}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Native toolchain verification failed'}\n`);
  process.exitCode = 1;
}
