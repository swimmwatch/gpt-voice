import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  LocalWhisperDeviceChallengeAuthority,
  createLocalWhisperDeviceProof,
  createLocalWhisperRegistryFingerprint,
  type LocalWhisperDeviceProofInput,
  type LocalWhisperDeviceRegistry,
} from '@main/localWhisper/supervisor/LocalWhisperDeviceAuthority';

interface ProofManifest {
  readonly proofs: {
    readonly registry: LocalWhisperDeviceRegistry;
    readonly registryFingerprint: string;
    readonly registries: readonly {
      readonly expectedFingerprint: string;
      readonly input: LocalWhisperDeviceRegistry;
      readonly name: string;
    }[];
    readonly probe: { readonly expectedProof: string; readonly input: Record<string, string | number> };
    readonly load: { readonly expectedProof: string; readonly input: Record<string, string | number> };
    readonly boundaries: readonly {
      readonly domain: 'load' | 'probe';
      readonly expectedProof: string;
      readonly input: Record<string, string | number>;
      readonly name: string;
    }[];
  };
}

function proofInput(value: Record<string, string | number>): LocalWhisperDeviceProofInput {
  return {
    activatedOrdinal: Number(value.activatedOrdinal),
    actualNativeIdentity: String(value.actualNativeIdentity),
    authorityId: String(value.authorityId),
    backendId: String(value.backendId),
    challenge: String(value.challenge),
    configurationEpoch: BigInt(value.configurationEpoch),
    engineId: String(value.engineId),
    primaryExecutionNativeIdentity: String(value.primaryExecutionNativeIdentity),
    registryFingerprint: String(value.registryFingerprint),
    runtimeBuildDigest: String(value.runtimeBuildDigest),
    selectedDeviceModelWeightBytes: BigInt(value.selectedDeviceModelWeightBytes),
    selectedOrdinal: Number(value.selectedOrdinal),
    topologyGeneration: BigInt(value.topologyGeneration),
  };
}

test('registry and operation proofs reproduce checked-in language-neutral vectors', () => {
  const manifest = JSON.parse(
    readFileSync('tests/fixtures/local-whisper/protocol/v1/manifest.json', 'utf8'),
  ) as ProofManifest;
  assert.equal(createLocalWhisperRegistryFingerprint(manifest.proofs.registry), manifest.proofs.registryFingerprint);
  for (const vector of manifest.proofs.registries) {
    assert.equal(createLocalWhisperRegistryFingerprint(vector.input), vector.expectedFingerprint, vector.name);
  }
  assert.equal(
    createLocalWhisperDeviceProof('probe', proofInput(manifest.proofs.probe.input)),
    manifest.proofs.probe.expectedProof,
  );
  assert.equal(
    createLocalWhisperDeviceProof('load', proofInput(manifest.proofs.load.input)),
    manifest.proofs.load.expectedProof,
  );
  for (const vector of manifest.proofs.boundaries) {
    assert.equal(
      createLocalWhisperDeviceProof(vector.domain, proofInput(vector.input)),
      vector.expectedProof,
      vector.name,
    );
  }
});

test('proof domains, order, identity, challenge, and weight mutations cannot be substituted', () => {
  const manifest = JSON.parse(
    readFileSync('tests/fixtures/local-whisper/protocol/v1/manifest.json', 'utf8'),
  ) as ProofManifest;
  const probe = proofInput(manifest.proofs.probe.input);
  const load = proofInput(manifest.proofs.load.input);
  assert.throws(() => createLocalWhisperDeviceProof('load', probe));
  assert.throws(() => createLocalWhisperDeviceProof('probe', load));
  for (const mutated of [
    { ...probe, activatedOrdinal: 1 },
    { ...probe, actualNativeIdentity: 'changed' },
    { ...probe, challenge: load.challenge },
    { ...probe, configurationEpoch: probe.configurationEpoch + 1n },
    { ...probe, topologyGeneration: probe.topologyGeneration + 1n },
  ]) {
    assert.notEqual(createLocalWhisperDeviceProof('probe', mutated), manifest.proofs.probe.expectedProof);
  }
  assert.throws(() =>
    createLocalWhisperRegistryFingerprint({
      ...manifest.proofs.registry,
      entries: [manifest.proofs.registry.entries[0], manifest.proofs.registry.entries[0]],
    }),
  );
});

test('challenge authority issues distinct one-use domain-bound values', () => {
  let seed = 0;
  const authority = new LocalWhisperDeviceChallengeAuthority((size) =>
    Uint8Array.from({ length: size }, (_, index) => (seed + index) & 0xff),
  );
  seed += 1;
  const probe = authority.issue('probe');
  seed += 1;
  const load = authority.issue('load');
  assert.notEqual(probe, load);
  assert.equal(authority.consume('load', probe), false);
  assert.equal(authority.consume('probe', probe), false);
  assert.equal(authority.consume('load', load), true);
  assert.equal(authority.consume('load', load), false);
});
