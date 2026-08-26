import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { after, before, describe, it } from 'node:test';

import {
  LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT,
  LOCAL_WHISPER_DEVELOPMENT_DISPLAY_LABEL,
  LocalWhisperDevelopmentActivationLoader,
  openLocalWhisperActivationFile,
} from '@main/localWhisper/development/LocalWhisperDevelopmentActivation';
import { LocalWhisperCatalogRepository } from '@main/localWhisper/catalog/LocalWhisperCatalogRepository';
import {
  LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
  serializeCanonicalLocalWhisperCatalogJson,
  toLocalWhisperArtifactId,
} from '@shared/localWhisper';
import { FIXTURE_CATALOG_PUBLIC_KEY_PEM } from '../../../fixtures/local-whisper/catalog/fixtureCatalogSigner';
import {
  QUALIFICATION_APP_REVISION,
  createQualificationCatalogPayload,
  signQualificationCatalog,
} from '../../../fixtures/local-whisper/catalog/qualificationCatalogSigner';

const KEY_ID = toLocalWhisperArtifactId('qualification-development-fixture-key')!;
let root = '';
let certificatePem = '';

async function descriptor(overrides: Readonly<Record<string, unknown>> = {}): Promise<string> {
  const catalogEnvelope = JSON.parse(
    Buffer.from(
      signQualificationCatalog(createQualificationCatalogPayload(LOCAL_WHISPER_WORKER_PROTOCOL_VERSION), KEY_ID),
    ).toString('utf8'),
  ) as unknown;
  const filePath = path.join(root, `activation-${Math.random().toString(16).slice(2)}.json`);
  await writeFile(
    filePath,
    serializeCanonicalLocalWhisperCatalogJson({
      schemaVersion: 1,
      mode: 'local-whisper-development-activation',
      purpose: 'qualification',
      appRevision: QUALIFICATION_APP_REVISION,
      workerProtocolVersion: LOCAL_WHISPER_WORKER_PROTOCOL_VERSION,
      resourcesPath: path.join(root, 'resources'),
      catalogEnvelope,
      publicKeys: [{ keyId: KEY_ID, publicKeyPem: FIXTURE_CATALOG_PUBLIC_KEY_PEM }],
      origins: createQualificationCatalogPayload().origins,
      trustedCertificateAuthorities: [certificatePem],
      displayLabel: LOCAL_WHISPER_DEVELOPMENT_DISPLAY_LABEL,
      ...overrides,
    }),
    { encoding: 'utf8', mode: 0o600 },
  );
  return filePath;
}

function loader(arguments_: readonly string[], isPackaged = false, openFile = openLocalWhisperActivationFile) {
  return new LocalWhisperDevelopmentActivationLoader({
    appRevision: QUALIFICATION_APP_REVISION,
    arguments: arguments_,
    authenticateCatalog: (document, trustPolicy) => {
      const loaded = new LocalWhisperCatalogRepository({
        readDocument: () => document,
        trustPolicy,
      }).load();
      return loaded.success && loaded.catalog.payload.purpose === 'qualification';
    },
    isPackaged,
    openFile,
    platform: process.platform,
    userId: process.platform === 'linux' ? process.getuid?.() : undefined,
  });
}

describe('LocalWhisperDevelopmentActivationLoader', () => {
  before(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'local-whisper-development-activation-'));
    const certificatePath = path.join(root, 'certificate.pem');
    const keyPath = path.join(root, 'certificate-key.pem');
    const openssl =
      process.platform === 'win32'
        ? path.join(process.env.ProgramFiles ?? '', 'Git', 'usr', 'bin', 'openssl.exe')
        : '/usr/bin/openssl';
    const generated = spawnSync(
      openssl,
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-sha256',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=127.0.0.1',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
        '-addext',
        'basicConstraints=critical,CA:TRUE',
        '-keyout',
        keyPath,
        '-out',
        certificatePath,
      ],
      { encoding: 'utf8', shell: false },
    );
    assert.equal(generated.status, 0, generated.stderr);
    certificatePem = await readFile(certificatePath, 'utf8');
  });

  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('authenticates exactly one explicit canonical qualification descriptor', async () => {
    const filePath = await descriptor();
    const result = await loader([`${LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT}${filePath}`]).load();
    assert.equal(result.status, 'active');
    if (result.status !== 'active') return;
    assert.equal(result.catalogInput.activationPurpose, 'qualification');
    assert.equal(result.catalogInput.trustPolicy?.purpose, 'qualification');
    assert.equal(result.resourcesPath, path.join(root, 'resources'));
    assert.deepEqual(result.trustedCertificateAuthorities, [certificatePem]);
  });

  it('keeps absent activation on the production path and rejects packaged activation before reading', async () => {
    assert.deepEqual(await loader([]).load(), { status: 'absent' });
    let reads = 0;
    const result = await loader(
      [`${LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT}/private/descriptor.json`],
      true,
      () => {
        reads += 1;
        return Promise.reject(new Error('must not read'));
      },
    ).load();
    assert.deepEqual(result, { status: 'unavailable' });
    assert.equal(reads, 0);
  });

  it('fails closed for duplicates, unknown spellings, relative paths, noncanonical bytes, and symlinks', async () => {
    const valid = await descriptor();
    const exact = `${LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT}${valid}`;
    assert.deepEqual(await loader([exact, exact]).load(), { status: 'unavailable' });
    assert.deepEqual(await loader(['--local-whisper-activation=/tmp/value']).load(), { status: 'unavailable' });
    assert.deepEqual(await loader([`${LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT}relative.json`]).load(), {
      status: 'unavailable',
    });

    const noncanonical = await descriptor();
    await writeFile(noncanonical, `${await readFile(noncanonical, 'utf8')}\n`, { encoding: 'utf8', mode: 0o600 });
    assert.deepEqual(await loader([`${LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT}${noncanonical}`]).load(), {
      status: 'unavailable',
    });

    const linkPath = path.join(root, 'activation-link.json');
    try {
      await symlink(valid, linkPath);
    } catch (error) {
      assert.equal((error as NodeJS.ErrnoException).code, 'EPERM');
      return;
    }
    assert.deepEqual(await loader([`${LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT}${linkPath}`]).load(), {
      status: 'unavailable',
    });
  });

  it('rejects app, purpose, display, origin, certificate, and signature mismatches', async () => {
    const cases = [
      { appRevision: '9.9.9' },
      { purpose: 'production' },
      { displayLabel: 'Qualification' },
      { origins: [{ id: 'public-hugging-face-model-origin', origin: 'https://example.com' }] },
      { trustedCertificateAuthorities: ['not a certificate'] },
      { catalogEnvelope: { schemaVersion: 1 } },
    ];
    for (const changed of cases) {
      const filePath = await descriptor(changed);
      assert.deepEqual(await loader([`${LOCAL_WHISPER_DEVELOPMENT_ACTIVATION_ARGUMENT}${filePath}`]).load(), {
        status: 'unavailable',
      });
    }
  });
});
