import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { RELEASE_CONTRACT } from './constants.mjs';

const CHANGELOG_PATH = 'CHANGELOG.md';
const RELEASE_NOTES_PATH = `docs/releases/${RELEASE_CONTRACT.version}.md`;
const MANUAL_REGISTRY_PATH = 'docs/specs/local-whisper/qualification/release-manual-checks.json';

const RELEASE_NOTES = `# GPT-Voice ${RELEASE_CONTRACT.version}

This alpha release introduces the Local Whisper provider for private on-device transcription on Linux and Windows.

## Included

- CPU runtime packs for Linux and Windows.
- NVIDIA RTX 50 CUDA runtime packs for Linux and Windows.
- Signed catalogs, checksums, SBOM, notices, provenance, and compatibility metadata.

## Testing status

The release is an alpha build. Independent Linux and Windows installation and transcription testing follows publication.
`;

function registry() {
  return {
    schemaVersion: 1,
    release: RELEASE_CONTRACT.releaseTag,
    checks: [
      {
        id: 'alpha-candidate-inventory',
        ownerTask: 33,
        phase: 'candidate',
        platform: 'linux-windows',
        command: 'npm run verify:local-whisper:release-candidates',
        required: true,
      },
      {
        id: 'alpha-final-origin',
        ownerTask: 33,
        phase: 'publication',
        platform: 'github',
        command: 'npm run verify:local-whisper:release-origin -- --target=v2.4.0-alpha.1',
        required: true,
      },
    ],
  };
}

export class ReleasePreparationWriter {
  #workspaceRoot;

  constructor({ workspaceRoot }) {
    this.#workspaceRoot = workspaceRoot;
  }

  get paths() {
    return Object.freeze(['package.json', 'package-lock.json', CHANGELOG_PATH, RELEASE_NOTES_PATH, MANUAL_REGISTRY_PATH]);
  }

  async apply() {
    const packagePath = path.join(this.#workspaceRoot, 'package.json');
    const lockPath = path.join(this.#workspaceRoot, 'package-lock.json');
    const packageDocument = JSON.parse(await readFile(packagePath, 'utf8'));
    const lockDocument = JSON.parse(await readFile(lockPath, 'utf8'));
    packageDocument.version = RELEASE_CONTRACT.version;
    lockDocument.version = RELEASE_CONTRACT.version;
    if (lockDocument.packages?.['']) lockDocument.packages[''].version = RELEASE_CONTRACT.version;
    await writeFile(packagePath, `${JSON.stringify(packageDocument, null, 2)}\n`, 'utf8');
    await writeFile(lockPath, `${JSON.stringify(lockDocument, null, 2)}\n`, 'utf8');
    await mkdir(path.join(this.#workspaceRoot, 'docs', 'releases'), { recursive: true });
    await writeFile(path.join(this.#workspaceRoot, RELEASE_NOTES_PATH), RELEASE_NOTES, 'utf8');
    await writeFile(
      path.join(this.#workspaceRoot, CHANGELOG_PATH),
      `# Changelog\n\n## [${RELEASE_CONTRACT.version}] - Unreleased\n\n${RELEASE_NOTES.split('\n').slice(2).join('\n')}`,
      'utf8',
    );
    await writeFile(
      path.join(this.#workspaceRoot, MANUAL_REGISTRY_PATH),
      `${JSON.stringify(registry(), null, 2)}\n`,
      'utf8',
    );
  }

  async verify() {
    const [packageDocument, lockDocument, changelog, notes, registryDocument] = await Promise.all([
      readFile(path.join(this.#workspaceRoot, 'package.json'), 'utf8').then(JSON.parse),
      readFile(path.join(this.#workspaceRoot, 'package-lock.json'), 'utf8').then(JSON.parse),
      readFile(path.join(this.#workspaceRoot, CHANGELOG_PATH), 'utf8'),
      readFile(path.join(this.#workspaceRoot, RELEASE_NOTES_PATH), 'utf8'),
      readFile(path.join(this.#workspaceRoot, MANUAL_REGISTRY_PATH), 'utf8').then(JSON.parse),
    ]);
    if (
      packageDocument.version !== RELEASE_CONTRACT.version ||
      lockDocument.version !== RELEASE_CONTRACT.version ||
      lockDocument.packages?.['']?.version !== RELEASE_CONTRACT.version ||
      !changelog.includes(`## [${RELEASE_CONTRACT.version}]`) ||
      !notes.startsWith(`# GPT-Voice ${RELEASE_CONTRACT.version}`) ||
      registryDocument.release !== RELEASE_CONTRACT.releaseTag ||
      !Array.isArray(registryDocument.checks) ||
      registryDocument.checks.length !== 2
    ) {
      throw new Error('release-preparation-invalid');
    }
  }
}
