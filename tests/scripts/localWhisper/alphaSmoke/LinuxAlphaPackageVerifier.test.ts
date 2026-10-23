import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  LINUX_GPT_VOICE_PACKAGE,
  LinuxAlphaPackageVerifier,
  type LinuxAlphaPackagePort,
  type LinuxPackageSnapshot,
} from '@scripts/local-whisper/alpha-smoke/LinuxAlphaPackageVerifier';

function packageSnapshot(
  version: string = LINUX_GPT_VOICE_PACKAGE.alphaDebianVersion,
  options: Readonly<{ fileDigest?: string; mode?: number }> = {},
): LinuxPackageSnapshot {
  return Object.freeze({
    architecture: 'amd64',
    conffiles: Object.freeze([]),
    files: Object.freeze([
      Object.freeze({
        kind: 'file' as const,
        mode: options.mode ?? 0o755,
        path: '/opt/GPT-Voice/gpt-voice',
        value: options.fileDigest ?? 'a'.repeat(64),
      }),
    ]),
    name: 'gpt-voice',
    status: 'installed',
    version,
  });
}

class FakePackagePort implements LinuxAlphaPackagePort {
  public active = false;
  public archive = packageSnapshot();
  public current: LinuxPackageSnapshot | null = packageSnapshot();
  public installRequests = 0;
  public installSucceeds = true;

  public async assertNoActivePackageProcess(): Promise<void> {
    if (this.active) throw new Error('active process');
  }

  public async captureInstalledPackage(): Promise<LinuxPackageSnapshot | null> {
    return this.current === null ? null : structuredClone(this.current);
  }

  public async inspectPackageArchive(): Promise<LinuxPackageSnapshot> {
    return structuredClone(this.archive);
  }

  public async requestAlphaInstallation(): Promise<void> {
    this.installRequests += 1;
    if (this.installSucceeds) this.current = structuredClone(this.archive);
  }
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'alpha-package-verifier-'));
  const debPath = path.join(root, LINUX_GPT_VOICE_PACKAGE.fileName);
  const bytes = Buffer.from('verified public alpha package');
  await writeFile(debPath, bytes, { mode: 0o600 });
  return {
    deadlineEpochMilliseconds: 10_000,
    debPath,
    expectedDeb: Object.freeze({
      fileName: LINUX_GPT_VOICE_PACKAGE.fileName,
      length: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }),
    root,
  };
}

describe('LinuxAlphaPackageVerifier', () => {
  it('reuses an inactive exact alpha only after full public archive equivalence', async () => {
    const files = await fixture();
    try {
      const port = new FakePackagePort();
      const verifier = new LinuxAlphaPackageVerifier({ ...files, port });
      assert.equal(await verifier.prepare(), 'exact-alpha');
      await verifier.ensureReady('exact-alpha');
      await verifier.assertRetained();
      assert.equal(port.installRequests, 0);
      assert.equal(await verifier.observeStatus(), 'retained-alpha');
    } finally {
      await rm(files.root, { force: true, recursive: true });
    }
  });

  it('allows one explicit exact-alpha install on a clean host and never removes it', async () => {
    const files = await fixture();
    try {
      const port = new FakePackagePort();
      port.current = null;
      const verifier = new LinuxAlphaPackageVerifier({ ...files, port });
      assert.equal(await verifier.prepare(), 'clean-host');
      await verifier.ensureReady('clean-host');
      await verifier.assertRetained();
      assert.equal(port.installRequests, 1);
      assert.equal((await port.captureInstalledPackage())?.version, '2.4.0~alpha.1');
    } finally {
      await rm(files.root, { force: true, recursive: true });
    }
  });

  it('rejects a different package or active application before an attempt starts', async () => {
    const files = await fixture();
    try {
      const different = new FakePackagePort();
      different.current = packageSnapshot('2.3.0');
      await assert.rejects(
        new LinuxAlphaPackageVerifier({ ...files, port: different }).prepare(),
        /INSTALLED_PACKAGE_UNSUPPORTED/u,
      );
      assert.equal(different.installRequests, 0);

      const active = new FakePackagePort();
      active.active = true;
      await assert.rejects(new LinuxAlphaPackageVerifier({ ...files, port: active }).prepare(), /active process/u);
      assert.equal(active.installRequests, 0);
    } finally {
      await rm(files.root, { force: true, recursive: true });
    }
  });

  it('detects package drift between preparation and the manual installation gate', async () => {
    const files = await fixture();
    try {
      const port = new FakePackagePort();
      port.current = null;
      const verifier = new LinuxAlphaPackageVerifier({ ...files, port });
      assert.equal(await verifier.prepare(), 'clean-host');
      port.current = packageSnapshot('2.3.0');
      await assert.rejects(verifier.revalidateBeforeAttempt('clean-host'), /PACKAGE_STATE_DRIFT/u);
      assert.equal(port.installRequests, 0);
    } finally {
      await rm(files.root, { force: true, recursive: true });
    }
  });

  it('rejects content and mode differences from the exact public package inventory', async () => {
    const files = await fixture();
    try {
      for (const current of [
        packageSnapshot(undefined, { fileDigest: 'b'.repeat(64) }),
        packageSnapshot(undefined, { mode: 0o700 }),
      ]) {
        const port = new FakePackagePort();
        port.current = current;
        await assert.rejects(
          new LinuxAlphaPackageVerifier({ ...files, port }).prepare(),
          /INSTALLED_PACKAGE_UNSUPPORTED/u,
        );
      }
    } finally {
      await rm(files.root, { force: true, recursive: true });
    }
  });

  it('rejects a changed public deb before package state can authorize use', async () => {
    const files = await fixture();
    try {
      const port = new FakePackagePort();
      await writeFile(files.debPath, 'changed');
      await assert.rejects(new LinuxAlphaPackageVerifier({ ...files, port }).prepare(), /PUBLIC_ALPHA_DEB_INVALID/u);
      assert.equal(port.installRequests, 0);
    } finally {
      await rm(files.root, { force: true, recursive: true });
    }
  });

  it('does not hide a failed clean-host installation or retry it', async () => {
    const files = await fixture();
    try {
      const port = new FakePackagePort();
      port.current = null;
      port.installSucceeds = false;
      const verifier = new LinuxAlphaPackageVerifier({ ...files, port });
      assert.equal(await verifier.prepare(), 'clean-host');
      await assert.rejects(verifier.ensureReady('clean-host'), /ALPHA_INSTALL_VERIFICATION_FAILED/u);
      assert.equal(port.installRequests, 1);
      assert.equal(await verifier.observeStatus(), 'absent');
    } finally {
      await rm(files.root, { force: true, recursive: true });
    }
  });
});
