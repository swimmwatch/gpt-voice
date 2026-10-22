import assert from 'node:assert/strict';
import { readdirSync, readlinkSync } from 'node:fs';
import { mkdtemp, open, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';

import { ALPHA_SMOKE_SOURCE_SHA, ALPHA_SMOKE_TARGET } from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';
import { LinuxAlphaSmokeFilesystem } from '@scripts/local-whisper/alpha-smoke/LinuxAlphaSmokeFilesystem';
import { createReleaseFixture } from './publicReleaseFixture';
import { PublicAlphaReleaseRepository } from '@scripts/local-whisper/alpha-smoke/PublicAlphaReleaseRepository';

const OPEN_DESCRIPTOR_DIRECTORY = '/proc/self/fd';

function ancestorDirectories(root: string): ReadonlySet<string> {
  const directories = new Set([root]);
  let parent = path.dirname(root);
  while (!directories.has(parent)) {
    directories.add(parent);
    parent = path.dirname(parent);
  }
  return directories;
}

function directoryDescriptors(directories: ReadonlySet<string>): ReadonlyMap<string, string> {
  const descriptors = new Map<string, string>();
  for (const descriptor of readdirSync(OPEN_DESCRIPTOR_DIRECTORY)) {
    try {
      const target = readlinkSync(path.join(OPEN_DESCRIPTOR_DIRECTORY, descriptor));
      if (directories.has(target)) descriptors.set(descriptor, target);
    } catch (error) {
      // Directory enumeration can include its own descriptor, already closed here.
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return descriptors;
}

describe('PublicAlphaReleaseRepository', () => {
  it('rejects an authenticated catalog pointing at an unpublished runtime filename and URL', async () => {
    const fixture = createReleaseFixture('unpublished');
    const repository = new PublicAlphaReleaseRepository({
      fetchImplementation: fixture.fetchImplementation,
      expectedCandidateInputDigest: fixture.expectedCandidateInputDigest,
    });
    await assert.rejects(repository.verify('linux'), /RUNTIME_SOURCE_BINDING_INVALID/u);
    await assert.rejects(
      repository.materializeVerifiedLinuxDeb('/unused-fixture-root'),
      /MATERIALIZATION_REQUIRES_VERIFICATION/u,
    );
  });

  it('closes pinned descriptors despite unrelated descriptor closure when rejecting a substituted release directory', async (context) => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-materialization-fds-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'alpha-materialization-outside-'));
    try {
      const fixture = createReleaseFixture();
      const repository = new PublicAlphaReleaseRepository({
        fetchImplementation: fixture.fetchImplementation,
        expectedCandidateInputDigest: fixture.expectedCandidateInputDigest,
      });
      await repository.verify('linux');
      await symlink(outside, path.join(root, 'release'));
      const directories = ancestorDirectories(root);
      const pinnedDescriptors = new Map<string, string>();
      const openRoot = LinuxAlphaSmokeFilesystem.openRoot;
      context.mock.method(LinuxAlphaSmokeFilesystem, 'openRoot', async (workRoot: string, privateRoot?: boolean) => {
        assert.equal(workRoot, root);
        const before = directoryDescriptors(directories);
        const filesystem = await openRoot(workRoot, privateRoot);
        try {
          const after = directoryDescriptors(directories);
          for (const [descriptor, target] of after) {
            if (before.get(descriptor) !== target) pinnedDescriptors.set(descriptor, target);
          }
          return filesystem;
        } catch (error) {
          await filesystem.dispose();
          throw error;
        }
      });
      const unrelated = await open(path.join(root, 'unrelated-descriptor.txt'), 'wx', 0o600);
      try {
        await unrelated.close();
        await assert.rejects(repository.materializeVerifiedLinuxDeb(root));
        assert.deepEqual([...pinnedDescriptors.values()].sort(), [...directories].sort());
        const remaining = directoryDescriptors(directories);
        for (const [descriptor, target] of pinnedDescriptors) {
          assert.notEqual(remaining.get(descriptor), target, 'Rejected materialization leaked a pinned directory');
        }
      } finally {
        await unrelated.close();
      }
      assert.deepEqual(await readdir(outside), []);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('rejects a signed keyring containing a key not authenticated by the pinned catalogs', async () => {
    const fixture = createReleaseFixture();
    const keyringBytes = fixture.bytes.get('local-whisper-keyring.json');
    assert.ok(keyringBytes);
    const document = JSON.parse(keyringBytes.toString('utf8')) as {
      publicKeys: unknown[];
    };
    document.publicKeys.push({
      keyId: 'unanchored-release-key',
      publicKeyPem: generateKeyPairSync('ed25519').publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    });
    fixture.replaceSignedAsset('local-whisper-keyring.json', Buffer.from(JSON.stringify(document)));
    const repository = new PublicAlphaReleaseRepository({
      fetchImplementation: fixture.fetchImplementation,
      expectedCandidateInputDigest: fixture.expectedCandidateInputDigest,
    });
    await assert.rejects(repository.verify('linux'), /KEYRING_TRUST_INVALID/u);
  });

  it('rejects signed documents with invalid content and invalid signed archives', async () => {
    for (const [name, expected] of [
      ['local-whisper-compatibility.json', /COMPATIBILITY_INVALID/u],
      ['release-provenance.json', /PROVENANCE_INVALID/u],
      ['release-sbom.spdx.json', /SBOM_INVALID/u],
      ['THIRD_PARTY_NOTICES.txt', /NOTICES_INVALID/u],
      ['linux-gpt-voice-local-whisper-linux-x64-cpu.tar.gz', /RUNTIME_ARCHIVE_INVALID/u],
    ] as const) {
      const fixture = createReleaseFixture();
      fixture.replaceSignedAsset(name, Buffer.from('{}'));
      const repository = new PublicAlphaReleaseRepository({
        fetchImplementation: fixture.fetchImplementation,
        expectedCandidateInputDigest: fixture.expectedCandidateInputDigest,
      });
      await assert.rejects(repository.verify('linux'), expected);
      await assert.rejects(
        repository.materializeVerifiedLinuxDeb('/unused-fixture-root'),
        /MATERIALIZATION_REQUIRES_VERIFICATION/u,
      );
    }
  });
  it('derives Linux inputs only after validating the public immutable inventory and every detached signature', async () => {
    const fixture = createReleaseFixture();
    const repository = new PublicAlphaReleaseRepository({
      fetchImplementation: fixture.fetchImplementation,
      expectedCandidateInputDigest: fixture.expectedCandidateInputDigest,
    });
    const input = await repository.verify('linux');
    assert.equal(input.sourceSha, ALPHA_SMOKE_SOURCE_SHA);
    assert.equal(input.target, ALPHA_SMOKE_TARGET);
    assert.equal(input.packageAsset.fileName, 'gpt-voice_2.4.0-alpha.1_amd64.deb');
    assert.match(input.platformSmokeInputDigest, /^[a-f\d]{64}$/u);

    fixture.bytes.set('gpt-voice_2.4.0-alpha.1_amd64.deb', Buffer.from('substituted', 'utf8'));
    await assert.rejects(repository.verify('linux'), /ALPHA_SMOKE_PUBLIC_RELEASE_ASSET_LENGTH_INVALID/u);
  });

  it('materializes only the immediately verified Debian bytes in a supplied work root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'alpha-smoke-deb-'));
    try {
      const fixture = createReleaseFixture();
      const repository = new PublicAlphaReleaseRepository({
        fetchImplementation: fixture.fetchImplementation,
        expectedCandidateInputDigest: fixture.expectedCandidateInputDigest,
      });
      await assert.rejects(repository.materializeVerifiedLinuxDeb(root), /MATERIALIZATION_REQUIRES_VERIFICATION/u);
      await repository.verify('linux');
      const debPath = await repository.materializeVerifiedLinuxDeb(root);
      assert.equal(path.basename(debPath), 'gpt-voice_2.4.0-alpha.1_amd64.deb');
      assert.deepEqual(await readFile(debPath), fixture.bytes.get('gpt-voice_2.4.0-alpha.1_amd64.deb'));
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
