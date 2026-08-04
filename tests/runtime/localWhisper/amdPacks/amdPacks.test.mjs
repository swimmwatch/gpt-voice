import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AmdContractError,
  runHipNegativeFixtures,
  runPackFixtures,
  runVulkanFixtures,
  syntheticHipCandidateRow,
  validateContractToolchain,
  validateHipPreSigningRow,
  validatePreviewProfiles,
  verifyHipNoApprovedRow,
} from '../../../../scripts/local-whisper/amd-packs/contract-core.mjs';
import { verifyToolchainContract } from '../../../../scripts/local-whisper/native-build/native-toolchain-core.mjs';

test('AMD Preview exposes only the exact untested whisperCpp matrix', () => {
  const contract = validatePreviewProfiles();
  assert.equal(contract.profiles.length, 3);
  assert.deepEqual(
    contract.profiles.map(({ backend, os }) => `${os}:${backend}`),
    ['windows:vulkan', 'linux:vulkan', 'linux:hip'],
  );
  assert.ok(contract.profiles.every(({ engine }) => engine === 'whisperCpp'));
});

test('AMD toolchain profiles remain contract-only and unqualified', () => {
  for (const profileId of [
    'windows-x64-amd-vulkan-preview-msvc-19.39-v1',
    'linux-x64-amd-vulkan-preview-contract-v1',
    'linux-x64-amd-hip-no-approved-row-v1',
  ]) {
    const profile = validateContractToolchain(profileId);
    assert.equal(profile.evidenceDigest, null);
    assert.throws(() => verifyToolchainContract(profile, { contractOnly: false }), /contract-only/u);
  }
});

test('Vulkan fixtures reject old APIs, software ICDs, non-AMD devices, and missing features', () => {
  assert.equal(runVulkanFixtures(), 6);
});

test('HIP pre-signing validator accepts only an exact in-memory synthetic intersection', () => {
  assert.equal(validateHipPreSigningRow(syntheticHipCandidateRow()), true);
  assert.equal(runHipNegativeFixtures(), 9);
});

test('HIP remains unavailable with no checked-in approved row or fallback', () => {
  assert.equal(verifyHipNoApprovedRow(), true);
});

test('pack fixtures enforce exact files and manifest-owned dependency closure', () => {
  assert.equal(runPackFixtures(), 4);
});

test('HIP range values retain the typed allowlist failure', () => {
  const row = syntheticHipCandidateRow();
  row.rocm.release = '>=6.1';
  assert.throws(
    () => validateHipPreSigningRow(row),
    (error) => error instanceof AmdContractError && error.code === 'DEVICE_NOT_ALLOWLISTED',
  );
});
