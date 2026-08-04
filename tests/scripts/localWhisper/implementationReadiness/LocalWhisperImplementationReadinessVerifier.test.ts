import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import {
  ImplementationReadinessError,
  type ImplementationReadinessRepository,
} from '@scripts/local-whisper/implementation-readiness/ImplementationReadinessTypes';
import { LocalWhisperImplementationReadinessVerifier } from '@scripts/local-whisper/implementation-readiness/LocalWhisperImplementationReadinessVerifier';
import { NodeImplementationReadinessRepository } from '@scripts/local-whisper/implementation-readiness/NodeImplementationReadinessRepository';

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const QUALIFICATION_ROOT = 'docs/specs/local-whisper/qualification';

class OverlayRepository implements ImplementationReadinessRepository {
  public constructor(
    private readonly delegate: ImplementationReadinessRepository,
    private readonly replacements: ReadonlyMap<string, string> = new Map(),
    private readonly missing: ReadonlySet<string> = new Set(),
    private readonly fileLists: ReadonlyMap<string, readonly string[]> = new Map(),
  ) {}

  public async readText(relativePath: string): Promise<string> {
    if (this.missing.has(relativePath)) throw new Error('missing fixture contract');
    const replacement = this.replacements.get(relativePath);
    return replacement ?? (await this.delegate.readText(relativePath));
  }

  public async listFiles(relativeRoot: string): Promise<readonly string[]> {
    return this.fileLists.get(relativeRoot) ?? (await this.delegate.listFiles(relativeRoot));
  }
}

function verifier(repository: ImplementationReadinessRepository): LocalWhisperImplementationReadinessVerifier {
  return new LocalWhisperImplementationReadinessVerifier(repository);
}

function isReadinessError(code: ImplementationReadinessError['code'], contractId: string) {
  return (error: unknown): boolean =>
    error instanceof ImplementationReadinessError && error.code === code && error.contractId === contractId;
}

describe('LocalWhisperImplementationReadinessVerifier', () => {
  const repository = new NodeImplementationReadinessRepository(WORKSPACE_ROOT);

  it('proves implementation readiness while both platform qualifications remain Pending', async () => {
    assert.deepEqual(await verifier(repository).verify(), {
      implementationReady: true,
      linuxQualification: 'Pending',
      windowsQualification: 'Pending',
      productionReady: false,
    });
  });

  it('fails closed when the Windows production composition contract is removed', async () => {
    const file = 'src/main/localWhisper/composition/createProductionLocalWhisperEnvironment.ts';
    const source = await repository.readText(file);
    const changed = source.replace('new WindowsJobObjectOwner({', 'new MissingWindowsProcessOwner({');
    assert.notEqual(changed, source);
    await assert.rejects(
      verifier(new OverlayRepository(repository, new Map([[file, changed]]))).verify(),
      isReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'production-composition'),
    );
  });

  it('fails closed when a required Windows CPU runtime profile is absent', async () => {
    const file = 'runtime/local-whisper/toolchains/profiles/windows-x64-cpu-msvc-19.39-v1.json';
    await assert.rejects(
      verifier(new OverlayRepository(repository, new Map(), new Set([file]))).verify(),
      isReadinessError('IMPLEMENTATION_CONTRACT_MISSING', 'runtime-profile:windows-x64-cpu-msvc-19.39-v1'),
    );
  });

  it('rejects a stale task registry revision', async () => {
    const file = 'docs/specs/local-whisper/tasks/acceptance-owners.json';
    const source = await repository.readText(file);
    const changed = source.replace('"planRevision": 18', '"planRevision": 17');
    assert.notEqual(changed, source);
    await assert.rejects(
      verifier(new OverlayRepository(repository, new Map([[file, changed]]))).verify(),
      isReadinessError('IMPLEMENTATION_CONTRACT_INVALID', 'revision-18-acceptance-registry'),
    );
  });

  it('rejects frozen platform evidence instead of converting it into Production readiness', async () => {
    const files = await repository.listFiles(QUALIFICATION_ROOT);
    const frozen = Object.freeze([...files, 'linux/platform-result.json']);
    await assert.rejects(
      verifier(
        new OverlayRepository(repository, new Map(), new Set(), new Map([[QUALIFICATION_ROOT, frozen]])),
      ).verify(),
      isReadinessError('QUALIFICATION_EVIDENCE_NOT_PENDING', 'platform-qualification'),
    );
  });
});
