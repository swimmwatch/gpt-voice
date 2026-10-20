import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';
import { LOCAL_WHISPER_RELEASE_MODEL_MATRIX } from '@main/localWhisper/catalog/LocalWhisperReleaseModelMatrix';
import {
  ALPHA_SMOKE_REPOSITORY,
  ALPHA_SMOKE_SOURCE_SHA,
  ALPHA_SMOKE_TARGET,
  alphaSmokeDigest,
} from '@scripts/local-whisper/alpha-smoke/AlphaSmokeProtocol';
import type { ReleaseAsset } from '@scripts/local-whisper/release-policy/ReleaseProtocol';

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function json(value: unknown): Buffer {
  return Buffer.from(serializeCanonicalLocalWhisperCatalogJson(value));
}

function tarEntry(name: string, content: Buffer, mode: number): Buffer {
  const header = Buffer.alloc(512);
  const field = (offset: number, width: number, value: string) =>
    Buffer.from(value, 'ascii').copy(header, offset, 0, width);
  const octal = (offset: number, width: number, value: number) =>
    field(offset, width, `${value.toString(8).padStart(width - 1, '0')}\0`);
  field(0, 100, name);
  octal(100, 8, mode);
  octal(108, 8, 0);
  octal(116, 8, 0);
  octal(124, 12, content.length);
  octal(136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  field(257, 6, 'ustar\0');
  field(263, 2, '00');
  field(
    148,
    8,
    `${header
      .reduce((sum, byte) => sum + byte, 0)
      .toString(8)
      .padStart(6, '0')}\0 `,
  );
  return Buffer.concat([header, content, Buffer.alloc((512 - (content.length % 512)) % 512)]);
}

/** Synthetic public-only production-shaped assets; the fixture pin is separate from the real release pin. */
export function createReleaseFixture(runtimeSource: 'published' | 'unpublished' = 'published') {
  const keys = generateKeyPairSync('ed25519');
  const keyId = 'production-release-key-v1';
  const appRevision = 'app-v1';
  const bytes = new Map<string, Buffer>();
  const definitions = new Map<string, Pick<ReleaseAsset, 'format' | 'platform' | 'role' | 'target'>>();
  const add = (
    name: string,
    content: Buffer,
    definition: Pick<ReleaseAsset, 'format' | 'platform' | 'role' | 'target'>,
  ) => {
    bytes.set(name, content);
    definitions.set(name, definition);
  };
  const global = (role: ReleaseAsset['role'], format: ReleaseAsset['format']) =>
    ({ role, format, platform: 'global', target: 'release' }) as const;
  const catalogs: { platform: string; sha256: string; documentBase64: string }[] = [];
  for (const platform of ['linux', 'win32'] as const) {
    const runtimes = [];
    for (const target of ['cpu', 'sm_120a-real'] as const) {
      const cuda = target !== 'cpu';
      const profileId =
        platform === 'linux'
          ? cuda
            ? 'linux-x64-cuda-12.8.1-sm120a-v1'
            : 'linux-x64-cpu-baseline-v1'
          : cuda
            ? 'windows-x64-cuda-12.8.1-sm120a-msvc-19.39-v1'
            : 'windows-x64-cpu-msvc-19.51-v1';
      const contents = [
        { fileId: 'worker', kind: 'executable', mode: 0o500, content: Buffer.from(`${platform}-${target}-worker`) },
        {
          fileId: 'provenance',
          kind: 'data',
          mode: 0o400,
          content: json({
            schemaId: 'local-whisper-whisper-cpp-provenance-v1',
            profileId,
            runtimeBuildDigest: 'a'.repeat(64),
          }),
        },
        { fileId: 'third-party-notices', kind: 'notice', mode: 0o400, content: Buffer.from('whisper.cpp: MIT') },
      ];
      const archive = gzipSync(
        Buffer.concat([
          ...contents.map((entry) => tarEntry(entry.fileId, entry.content, entry.mode)),
          Buffer.alloc(1024),
        ]),
      );
      const name = `${platform}-gpt-voice-local-whisper-${platform}-x64-${target}.tar.gz`;
      add(name, archive, { platform, role: 'runtime', target, format: 'restricted-tar-gzip-v1' });
      const sourceName = runtimeSource === 'unpublished' ? name.slice(platform.length + 1) : name;
      runtimes.push({
        source: {
          repository: ALPHA_SMOKE_REPOSITORY,
          commit: ALPHA_SMOKE_SOURCE_SHA,
          file: sourceName,
          url: `https://github.com/${ALPHA_SMOKE_REPOSITORY}/releases/download/${ALPHA_SMOKE_TARGET}/${sourceName}`,
          redirectPolicyId: 'github-release-v1',
        },
        identity: {
          engine: 'whisperCpp',
          platform,
          architecture: 'x64',
          target: cuda ? 'gpu' : 'cpu',
          backend: cuda ? 'cuda' : 'cpu',
          dependencyFamily: 'whisper-cpp',
          upstreamRevision: 'upstream-v1',
          buildRevision: 'build-v1',
          computeTargets: cuda ? ['sm_120a-real'] : [],
          protocolVersion: 1,
          packRevision: 'pack-v1',
          catalogRevision: 'catalog-v1',
          appRevision,
          signingKeyId: keyId,
          archiveSizeBytes: archive.length,
          archiveSha256: sha256(archive),
          archiveSignature: 'archive-signature-v1',
          originId: 'github-release',
          expectedFiles: contents.map(({ fileId, kind, mode, content }) => ({
            fileId,
            kind,
            mode,
            sizeBytes: content.length,
            sha256: sha256(content),
          })),
          prerequisites: [],
          provenanceId: 'provenance-v1',
          sbomRevision: 'sbom-v1',
          noticeIds: ['third-party-notices'],
        },
      });
    }
    const payload = json({
      purpose: 'production',
      compatibleAppRevisions: [appRevision],
      runtimes,
      models: [
        {
          identity: { logicalModel: 'base', variant: 'full' },
          transferSha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
          transferSizeBytes: 147_951_465,
        },
      ],
    });
    const document = json({
      schemaVersion: 1,
      algorithm: 'Ed25519',
      keyId,
      payloadBase64: payload.toString('base64'),
      signatureBase64: sign(null, payload, keys.privateKey).toString('base64'),
    });
    catalogs.push({ platform, sha256: sha256(document), documentBase64: document.toString('base64') });
  }
  for (const [name, format, platform] of [
    ['GPT-Voice-2.4.0-alpha.1.AppImage', 'appimage', 'linux'],
    ['gpt-voice_2.4.0-alpha.1_amd64.deb', 'deb', 'linux'],
    ['gpt-voice-2.4.0-alpha.1.x86_64.rpm', 'rpm', 'linux'],
    ['GPT-Voice.Setup.2.4.0-alpha.1.exe', 'nsis', 'win32'],
  ] as const)
    add(name, Buffer.from(name), { platform, role: 'application', target: 'app', format });
  add(
    'local-whisper-catalogs.json',
    json({ schemaVersion: 1, purpose: 'production', target: ALPHA_SMOKE_TARGET, catalogs }),
    global('catalog', 'json'),
  );
  add(
    'local-whisper-keyring.json',
    json({
      purpose: 'production',
      publicKeys: [{ keyId, publicKeyPem: keys.publicKey.export({ format: 'pem', type: 'spki' }).toString() }],
    }),
    global('keyring', 'json'),
  );
  const platformBundles = catalogs.map(({ platform, sha256: catalogSha256 }) => ({
    platform,
    bundleManifestSha256: 'b'.repeat(64),
    catalogSha256,
  }));
  const expectedCandidateInputDigest = alphaSmokeDigest({
    schemaVersion: 1,
    purpose: 'production',
    target: ALPHA_SMOKE_TARGET,
    sourceCommit: ALPHA_SMOKE_SOURCE_SHA,
    appRevision,
    platformBundles,
  });
  add(
    'release-provenance.json',
    json({
      schemaVersion: 1,
      purpose: 'production',
      candidateTarget: ALPHA_SMOKE_TARGET,
      sourceCommit: ALPHA_SMOKE_SOURCE_SHA,
      appRevision,
      platformBundles,
    }),
    global('provenance', 'json'),
  );
  add(
    'local-whisper-compatibility.json',
    json({
      schemaVersion: 1,
      appRevision,
      platforms: ['linux-x64', 'win32-x64'],
      runtimeTargets: ['cpu', 'sm_120a-real'],
      transferProfiles: ['restricted-tar-gzip-v1', 'pinned-raw-model-v1'],
      models: LOCAL_WHISPER_RELEASE_MODEL_MATRIX,
    }),
    global('compatibility', 'json'),
  );
  add(
    'release-sbom.spdx.json',
    json({
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      SPDXID: 'SPDXRef-DOCUMENT',
      documentNamespace: `https://gpt-voice.local/spdx/${ALPHA_SMOKE_TARGET}`,
      platformDocuments: ['linux', 'win32'].map((platform) => ({
        spdxVersion: 'SPDX-2.3',
        packages: [{ name: `whisper-cpp-${platform}` }],
      })),
    }),
    global('sbom', 'json'),
  );
  add(
    'THIRD_PARTY_NOTICES.txt',
    Buffer.from('whisper.cpp: MIT\nNVIDIA CUDA 12.8.1 redistributable runtime: NVIDIA CUDA EULA\n'),
    global('notices', 'text'),
  );
  const assets: ReleaseAsset[] = [];
  const seal = (name: string): ReleaseAsset => {
    const content = bytes.get(name);
    const definition = definitions.get(name);
    if (!content || !definition) throw new Error('fixture asset missing');
    const detached = json({
      algorithm: 'Ed25519',
      keyId,
      signatureBase64: sign(null, Buffer.from(sha256(content), 'hex'), keys.privateKey).toString('base64'),
      signedSha256: sha256(content),
    });
    bytes.set(`${name}.sig`, detached);
    return {
      fileName: name,
      ...definition,
      length: content.length,
      sha256: sha256(content),
      signature: { fileName: `${name}.sig`, keyId, length: detached.length, sha256: sha256(detached) },
    };
  };
  for (const name of definitions.keys()) assets.push(seal(name));
  add(
    'SHA256SUMS.txt',
    Buffer.from(
      `${assets
        .flatMap((asset) => [
          `${asset.sha256}  ${asset.fileName}`,
          `${asset.signature.sha256}  ${asset.signature.fileName}`,
        ])
        .sort()
        .join('\n')}\n`,
    ),
    global('checksums', 'text'),
  );
  assets.push(seal('SHA256SUMS.txt'));
  add(
    'release-manifest.json',
    json({
      schemaVersion: 1,
      purpose: 'production',
      candidateTarget: ALPHA_SMOKE_TARGET,
      candidateInputDigest: expectedCandidateInputDigest,
      assets,
    }),
    global('manifest', 'json'),
  );
  seal('release-manifest.json');
  const url = (name: string) =>
    `https://github.com/${ALPHA_SMOKE_REPOSITORY}/releases/download/${ALPHA_SMOKE_TARGET}/${encodeURIComponent(name)}`;
  let apiAssets = [...bytes].map(([name, content]) => ({
    name,
    size: content.length,
    browser_download_url: url(name),
  }));
  const fetchImplementation = (async (input: string | URL | Request) => {
    if (String(input).startsWith('https://api.github.com/'))
      return new Response(
        JSON.stringify({
          id: 100,
          assets: apiAssets,
          draft: false,
          prerelease: true,
          html_url: `https://github.com/${ALPHA_SMOKE_REPOSITORY}/releases/tag/${ALPHA_SMOKE_TARGET}`,
          tag_name: ALPHA_SMOKE_TARGET,
          target_commitish: ALPHA_SMOKE_SOURCE_SHA,
        }),
      );
    const parts = String(input).split('/');
    const content = bytes.get(decodeURIComponent(parts[parts.length - 1] ?? ''));
    return content ? new Response(Uint8Array.from(content).buffer) : new Response(null, { status: 404 });
  }) as typeof fetch;
  const replaceSignedAsset = (name: string, content: Buffer): void => {
    if (!definitions.has(name) || ['release-manifest.json', 'SHA256SUMS.txt'].includes(name))
      throw new Error('fixture replacement unsupported');
    bytes.set(name, content);
    const replacements = [...definitions.keys()]
      .filter((file) => !['release-manifest.json', 'SHA256SUMS.txt'].includes(file))
      .map(seal);
    bytes.set(
      'SHA256SUMS.txt',
      Buffer.from(
        `${replacements
          .flatMap((asset) => [
            `${asset.sha256}  ${asset.fileName}`,
            `${asset.signature.sha256}  ${asset.signature.fileName}`,
          ])
          .sort()
          .join('\n')}\n`,
      ),
    );
    replacements.push(seal('SHA256SUMS.txt'));
    bytes.set(
      'release-manifest.json',
      json({
        schemaVersion: 1,
        purpose: 'production',
        candidateTarget: ALPHA_SMOKE_TARGET,
        candidateInputDigest: expectedCandidateInputDigest,
        assets: replacements,
      }),
    );
    seal('release-manifest.json');
    apiAssets = [...bytes].map(([file, contents]) => ({
      name: file,
      size: contents.length,
      browser_download_url: url(file),
    }));
  };
  return { bytes, fetchImplementation, expectedCandidateInputDigest, replaceSignedAsset };
}
