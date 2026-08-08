import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { readCanonicalJson } from '../packaging/fileIntegrity';
import {
  LocalWhisperQualificationValidator,
  qualificationCanonicalJson,
  type QualificationDocumentKind,
} from './QualificationContracts';

export interface VerifiedLinuxQualification {
  readonly candidateInputDigest: string;
  readonly evidenceIndexDigest: string;
  readonly platformGraphDigest: string;
  readonly platformInputDigest: string;
  readonly predecessorEvidenceDigest: string;
  readonly resultDigest: string;
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function stringField(value: Readonly<Record<string, unknown>>, field: string, code: string): string {
  const result = value[field];
  if (typeof result !== 'string') throw new Error(code);
  return result;
}

function strings(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) throw new Error(code);
  return value as readonly string[];
}

async function readCanonicalDocument(filePath: string): Promise<unknown> {
  const [value, bytes, metadata] = await Promise.all([
    readCanonicalJson(filePath),
    readFile(filePath),
    lstat(filePath),
  ]);
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    !bytes.equals(Buffer.from(qualificationCanonicalJson(value), 'utf8'))
  ) {
    throw new Error('QUALIFICATION_PUBLIC_EVIDENCE_NONCANONICAL');
  }
  return value;
}

/** Replays every public Linux graph edge and sanitized evidence identity without private measurement data. */
export class LinuxQualificationEvidenceVerifier {
  public async verify(qualificationRoot: string): Promise<VerifiedLinuxQualification> {
    const validator = new LocalWhisperQualificationValidator(qualificationRoot);
    validator.validateInputs();
    const state = validator.readLinuxState();
    if (state.schemaVersion !== 2) throw new Error('QUALIFICATION_LINUX_RESULT_NOT_FROZEN');

    const linuxRoot = path.join(qualificationRoot, 'linux');
    const [candidateValue, platformValue, cpuProfileValue, cudaProfileValue, graphValue, resultValue, indexValue] =
      await Promise.all([
        readCanonicalDocument(path.join(qualificationRoot, 'candidate-input.json')),
        readCanonicalDocument(path.join(linuxRoot, 'platform-input.json')),
        readCanonicalDocument(path.join(linuxRoot, 'profile-cpu.json')),
        readCanonicalDocument(path.join(linuxRoot, 'profile-cuda.json')),
        readCanonicalDocument(path.join(linuxRoot, 'platform-graph.json')),
        readCanonicalDocument(path.join(linuxRoot, 'platform-result.json')),
        readCanonicalDocument(path.join(linuxRoot, 'evidence-index.json')),
      ]);
    const documents: readonly [QualificationDocumentKind, unknown][] = [
      ['candidateInput', candidateValue],
      ['platformInput', platformValue],
      ['profile', cpuProfileValue],
      ['profile', cudaProfileValue],
      ['platformGraph', graphValue],
      ['platformResult', resultValue],
      ['evidenceIndex', indexValue],
    ];
    for (const [kind, document] of documents) validator.validateDocument(kind, document);

    const candidate = record(candidateValue, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const platform = record(platformValue, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const cpuProfile = record(cpuProfileValue, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const cudaProfile = record(cudaProfileValue, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const graph = record(graphValue, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const result = record(resultValue, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const index = record(indexValue, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const candidateInputDigest = stringField(
      candidate,
      'candidateInputDigest',
      'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID',
    );
    const platformInputDigest = stringField(
      platform,
      'platformInputDigest',
      'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID',
    );
    const platformGraphDigest = stringField(graph, 'platformGraphDigest', 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const resultDigest = stringField(result, 'resultDigest', 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const evidenceIndexDigest = stringField(index, 'indexDigest', 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const profiles = [cpuProfile, cudaProfile];
    const profileDigests = profiles
      .map((profile) => stringField(profile, 'profileDigest', 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID'))
      .sort((left, right) => left.localeCompare(right, 'en'));
    const stateProfileDigests = strings(state.profileDigests, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const statePackageDigests = strings(state.packageDigests, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    const packageDigests = (platform.packages as readonly unknown[])
      .map((value) =>
        stringField(
          record(value, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID'),
          'sha256',
          'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID',
        ),
      )
      .sort((left, right) => left.localeCompare(right, 'en'));
    const source = record(candidate.source, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    if (
      platform.candidateInputDigest !== candidateInputDigest ||
      profiles.some(
        (profile) =>
          profile.candidateInputDigest !== candidateInputDigest || profile.platformInputDigest !== platformInputDigest,
      ) ||
      graph.candidateInputDigest !== candidateInputDigest ||
      graph.platformInputDigest !== platformInputDigest ||
      JSON.stringify(graph.profileDigests) !== JSON.stringify(profileDigests) ||
      result.candidateInputDigest !== candidateInputDigest ||
      result.platformGraphDigest !== platformGraphDigest ||
      index.candidateInputDigest !== candidateInputDigest ||
      index.platformGraphDigest !== platformGraphDigest ||
      index.platformResultDigest !== resultDigest ||
      state.candidateSemVer !== candidate.candidateSemVer ||
      state.freezeTimestampUtc !== candidate.freezeTimestampUtc ||
      state.sourceCommit !== source.commit ||
      state.candidateInputDigest !== candidateInputDigest ||
      state.platformInputDigest !== platformInputDigest ||
      JSON.stringify(stateProfileDigests) !== JSON.stringify(profileDigests) ||
      state.platformGraphDigest !== platformGraphDigest ||
      state.resultDigest !== resultDigest ||
      state.evidenceIndexDigest !== evidenceIndexDigest ||
      JSON.stringify(statePackageDigests) !== JSON.stringify(packageDigests)
    ) {
      throw new Error('QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    }

    const rows = result.rows;
    const entries = index.entries;
    if (
      !Array.isArray(rows) ||
      rows.some((row) => record(row, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID').status !== 'Pass') ||
      !Array.isArray(entries)
    ) {
      throw new Error('QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID');
    }
    const rowIds = rows.map((row) =>
      stringField(
        record(row, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID'),
        'id',
        'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID',
      ),
    );
    const expectedIds = [...rowIds, 'linux-predecessor-v2.3.0'].sort((left, right) => left.localeCompare(right, 'en'));
    const entryIds = entries.map((entry) =>
      stringField(
        record(entry, 'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID'),
        'id',
        'QUALIFICATION_LINUX_PUBLIC_BRANCH_INVALID',
      ),
    );
    if (JSON.stringify(entryIds) !== JSON.stringify(expectedIds)) {
      throw new Error('QUALIFICATION_LINUX_PUBLIC_EVIDENCE_SET_INVALID');
    }

    const evidenceRoot = path.join(linuxRoot, 'evidence');
    const evidenceFiles = (await readdir(evidenceRoot)).sort((left, right) => left.localeCompare(right, 'en'));
    if (JSON.stringify(evidenceFiles) !== JSON.stringify(expectedIds.map((id) => `${id}.json`))) {
      throw new Error('QUALIFICATION_LINUX_PUBLIC_EVIDENCE_SET_INVALID');
    }
    let predecessorEvidenceDigest: string | null = null;
    for (const entryValue of entries) {
      const entry = record(entryValue, 'QUALIFICATION_LINUX_PUBLIC_EVIDENCE_INVALID');
      const id = stringField(entry, 'id', 'QUALIFICATION_LINUX_PUBLIC_EVIDENCE_INVALID');
      const document = record(
        await readCanonicalDocument(path.join(evidenceRoot, `${id}.json`)),
        'QUALIFICATION_LINUX_PUBLIC_EVIDENCE_INVALID',
      );
      const bytes = Buffer.from(qualificationCanonicalJson(document), 'utf8');
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (document.id !== id || entry.sha256 !== digest || entry.byteLength !== bytes.byteLength) {
        throw new Error('QUALIFICATION_LINUX_PUBLIC_EVIDENCE_INVALID');
      }
      if (id === 'linux-predecessor-v2.3.0') predecessorEvidenceDigest = digest;
    }
    if (predecessorEvidenceDigest === null || state.predecessorEvidenceDigest !== predecessorEvidenceDigest) {
      throw new Error('QUALIFICATION_LINUX_PREDECESSOR_EVIDENCE_INVALID');
    }
    return Object.freeze({
      candidateInputDigest,
      evidenceIndexDigest,
      platformGraphDigest,
      platformInputDigest,
      predecessorEvidenceDigest,
      resultDigest,
    });
  }
}
