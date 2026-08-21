import { createHash } from 'node:crypto';

import { serializeCanonicalLocalWhisperCatalogJson } from '@shared/localWhisper';

import {
  APPLICATION_SECURITY_SCANNER,
  ArtifactVulnerabilityPolicy,
  canonicalArtifactSecurityJson,
  type ApplicationPackageFormat,
  type ApplicationSecurityPlatform,
} from './applicationArtifactSecurity';
import {
  canonicalSecurityEvidenceBytes,
  isSecurityRecord as isRecord,
  SecurityEvidenceFields,
} from './securityEvidenceFields';

export const PACKAGE_ATTESTATION_SCHEMA_VERSION = 1;
export const PACKAGE_ATTESTATION_MAXIMUM_BYTES = 16 * 1024;
export const PACKAGE_ATTESTATION_WORKFLOW_PATH = '.github/workflows/pr-checks.yml';
export const PACKAGE_ATTESTATION_WORKFLOW_PATHS = Object.freeze([
  PACKAGE_ATTESTATION_WORKFLOW_PATH,
  '.github/workflows/release-builds.yml',
] as const);
export const PACKAGE_ATTESTATION_SUBJECT_NAMES = Object.freeze([
  'package',
  'checksum',
  'sbom',
  'scanner',
  'smoke',
] as const);

const REPOSITORY = /^\w[\w.-]{0,99}\/\w[\w.-]{0,99}$/u;
const INVOCATION = /^\d{1,20}-\d{1,4}-(?:package-smoke|release-build)-(?:linux|win32)$/u;
const MAXIMUM_SUBJECT_BYTES = 4 * 1024 * 1024 * 1024;

export type PackageAttestationPlatform = ApplicationSecurityPlatform;
export type PackageAttestationSubjectName = (typeof PACKAGE_ATTESTATION_SUBJECT_NAMES)[number];

export interface PackageAttestationSubject {
  readonly sha256: string;
}

export interface PackageAttestationInput {
  readonly build: {
    readonly invocation: string;
    readonly status: 'success';
  };
  readonly platform: PackageAttestationPlatform;
  readonly scanner: {
    readonly name: typeof APPLICATION_SECURITY_SCANNER.name;
    readonly version: typeof APPLICATION_SECURITY_SCANNER.version;
  };
  readonly schemaVersion: typeof PACKAGE_ATTESTATION_SCHEMA_VERSION;
  readonly source: {
    readonly commit: string;
    readonly repository: string;
    readonly workflowRef: string;
  };
  readonly subjects: Readonly<Record<PackageAttestationSubjectName, PackageAttestationSubject>>;
}

export interface PackageAttestationExpectation {
  readonly invocation: string;
  readonly platform: PackageAttestationPlatform;
  readonly repository: string;
  readonly sourceCommit: string;
  readonly workflowPath: (typeof PACKAGE_ATTESTATION_WORKFLOW_PATHS)[number];
}

export interface GitHubAttestationCommand {
  verify(
    subjectPath: string,
    expectation: { readonly repository: string; readonly sourceCommit: string; readonly workflowPath: string },
  ): Promise<'verified' | 'invalid' | 'unavailable' | 'unsupported'>;
}

function fail(code: string): never {
  throw new Error(`PACKAGE_ATTESTATION_${code}`);
}

const securityFields = Object.freeze(new SecurityEvidenceFields(fail));

function safePlatform(value: unknown, code: string): PackageAttestationPlatform {
  if (value !== 'linux' && value !== 'win32') fail(code);
  return value;
}

function safeRepository(value: unknown, code: string): string {
  if (typeof value !== 'string' || !REPOSITORY.test(value)) fail(code);
  return value;
}

function safeInvocation(value: unknown, platform: PackageAttestationPlatform, code: string): string {
  if (typeof value !== 'string' || !INVOCATION.test(value) || !value.endsWith(`-${platform}`)) fail(code);
  return value;
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeWorkflowPath(value: unknown, code: string): (typeof PACKAGE_ATTESTATION_WORKFLOW_PATHS)[number] {
  if (!PACKAGE_ATTESTATION_WORKFLOW_PATHS.includes(value as never)) fail(code);
  return value as (typeof PACKAGE_ATTESTATION_WORKFLOW_PATHS)[number];
}

function sourceWorkflowRef(repository: string, sourceCommit: string, workflowPath: string): string {
  return `${repository}/${workflowPath}@${sourceCommit}`;
}

function verifySubject(value: unknown, code: string): PackageAttestationSubject {
  const subject = isRecord(value) ? value : fail(code);
  securityFields.exactKeys(subject, ['sha256'], code);
  return Object.freeze({ sha256: securityFields.sha256(subject.sha256, code) });
}

/** Creates the canonical, privacy-safe input that is handed from smoke to the attestation job. */
export class PackageAttestationInputPolicy {
  public create(input: {
    readonly invocation: string;
    readonly platform: PackageAttestationPlatform;
    readonly repository: string;
    readonly sourceCommit: string;
    readonly subjects: Readonly<Record<PackageAttestationSubjectName, Uint8Array>>;
    readonly workflowPath?: (typeof PACKAGE_ATTESTATION_WORKFLOW_PATHS)[number];
  }): PackageAttestationInput {
    const platform = safePlatform(input.platform, 'INPUT_INVALID');
    safeRepository(input.repository, 'INPUT_INVALID');
    securityFields.sourceCommit(input.sourceCommit, 'INPUT_INVALID');
    safeInvocation(input.invocation, platform, 'INPUT_INVALID');
    const subjectDigests = Object.fromEntries(
      PACKAGE_ATTESTATION_SUBJECT_NAMES.map((name) => {
        const bytes = input.subjects[name];
        if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAXIMUM_SUBJECT_BYTES) {
          fail('INPUT_INVALID');
        }
        return [name, Object.freeze({ sha256: digest(bytes) })];
      }),
    ) as Record<PackageAttestationSubjectName, PackageAttestationSubject>;
    return this.createFromDigests({ ...input, subjects: subjectDigests });
  }

  public createFromDigests(input: {
    readonly invocation: string;
    readonly platform: PackageAttestationPlatform;
    readonly repository: string;
    readonly sourceCommit: string;
    readonly subjects: Readonly<Record<PackageAttestationSubjectName, PackageAttestationSubject>>;
    readonly workflowPath?: (typeof PACKAGE_ATTESTATION_WORKFLOW_PATHS)[number];
  }): PackageAttestationInput {
    const platform = safePlatform(input.platform, 'INPUT_INVALID');
    const repository = safeRepository(input.repository, 'INPUT_INVALID');
    const sourceCommit = securityFields.sourceCommit(input.sourceCommit, 'INPUT_INVALID');
    const invocation = safeInvocation(input.invocation, platform, 'INPUT_INVALID');
    const workflowPath = safeWorkflowPath(input.workflowPath ?? PACKAGE_ATTESTATION_WORKFLOW_PATH, 'INPUT_INVALID');
    const subjects = Object.freeze(
      Object.fromEntries(
        PACKAGE_ATTESTATION_SUBJECT_NAMES.map((name) => [name, verifySubject(input.subjects[name], 'INPUT_INVALID')]),
      ) as Record<PackageAttestationSubjectName, PackageAttestationSubject>,
    );
    const result: PackageAttestationInput = Object.freeze({
      build: Object.freeze({ invocation, status: 'success' }),
      platform,
      scanner: Object.freeze({ ...APPLICATION_SECURITY_SCANNER }),
      schemaVersion: PACKAGE_ATTESTATION_SCHEMA_VERSION,
      source: Object.freeze({
        commit: sourceCommit,
        repository,
        workflowRef: sourceWorkflowRef(repository, sourceCommit, workflowPath),
      }),
      subjects: Object.freeze(subjects),
    });
    this.verify(result);
    if (canonicalSecurityEvidenceBytes(result).byteLength > PACKAGE_ATTESTATION_MAXIMUM_BYTES) fail('INPUT_TOO_LARGE');
    return result;
  }

  public parse(text: string): PackageAttestationInput {
    if (
      typeof text !== 'string' ||
      text.length === 0 ||
      Buffer.byteLength(text, 'utf8') > PACKAGE_ATTESTATION_MAXIMUM_BYTES
    ) {
      fail('INPUT_MALFORMED');
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(text, 'utf8'))) as unknown;
    } catch {
      fail('INPUT_MALFORMED');
    }
    this.verify(value);
    if (`${serializeCanonicalLocalWhisperCatalogJson(value)}\n` !== text) fail('INPUT_MALFORMED');
    return value;
  }

  public serialize(value: PackageAttestationInput): string {
    this.verify(value);
    return `${serializeCanonicalLocalWhisperCatalogJson(value)}\n`;
  }

  public verify(value: unknown): asserts value is PackageAttestationInput {
    const input = isRecord(value) ? value : fail('INPUT_MALFORMED');
    securityFields.exactKeys(
      input,
      ['build', 'platform', 'scanner', 'schemaVersion', 'source', 'subjects'],
      'INPUT_MALFORMED',
    );
    if (input.schemaVersion !== PACKAGE_ATTESTATION_SCHEMA_VERSION) fail('INPUT_MALFORMED');
    const platform = safePlatform(input.platform, 'INPUT_MALFORMED');
    if (!isRecord(input.build)) fail('INPUT_MALFORMED');
    securityFields.exactKeys(input.build, ['invocation', 'status'], 'INPUT_MALFORMED');
    if (input.build.status !== 'success') fail('INPUT_MALFORMED');
    safeInvocation(input.build.invocation, platform, 'INPUT_MALFORMED');
    if (!isRecord(input.scanner)) fail('INPUT_MALFORMED');
    securityFields.exactKeys(input.scanner, ['name', 'version'], 'INPUT_MALFORMED');
    if (
      input.scanner.name !== APPLICATION_SECURITY_SCANNER.name ||
      input.scanner.version !== APPLICATION_SECURITY_SCANNER.version
    ) {
      fail('INPUT_MALFORMED');
    }
    const source = input.source;
    if (!isRecord(source)) fail('INPUT_MALFORMED');
    securityFields.exactKeys(source, ['commit', 'repository', 'workflowRef'], 'INPUT_MALFORMED');
    const repository = safeRepository(source.repository, 'INPUT_MALFORMED');
    const sourceCommit = securityFields.sourceCommit(source.commit, 'INPUT_MALFORMED');
    if (
      !PACKAGE_ATTESTATION_WORKFLOW_PATHS.some(
        (workflowPath) => source.workflowRef === sourceWorkflowRef(repository, sourceCommit, workflowPath),
      )
    ) {
      fail('INPUT_MALFORMED');
    }
    const subjects = isRecord(input.subjects) ? input.subjects : fail('INPUT_MALFORMED');
    securityFields.exactKeys(subjects, PACKAGE_ATTESTATION_SUBJECT_NAMES, 'INPUT_MALFORMED');
    for (const name of PACKAGE_ATTESTATION_SUBJECT_NAMES) verifySubject(subjects[name], 'INPUT_MALFORMED');
    if (canonicalSecurityEvidenceBytes(input).byteLength > PACKAGE_ATTESTATION_MAXIMUM_BYTES) fail('INPUT_TOO_LARGE');
  }

  public verifyArtifactSecurityBinding(input: {
    readonly checksumBytes: Uint8Array;
    readonly packageBytes: Uint8Array;
    readonly packageFormat: ApplicationPackageFormat;
    readonly platform: PackageAttestationPlatform;
    readonly record: unknown;
    readonly sbom: unknown;
    readonly sourceCommit: string;
  }): void {
    this.verifyArtifactSecurityDigestBinding({
      checksumSha256: digest(input.checksumBytes),
      packageFormat: input.packageFormat,
      packageSha256: digest(input.packageBytes),
      platform: input.platform,
      record: input.record,
      sbom: input.sbom,
      sourceCommit: input.sourceCommit,
    });
  }

  public verifyArtifactSecurityDigestBinding(input: {
    readonly checksumSha256: string;
    readonly packageFormat: ApplicationPackageFormat;
    readonly packageSha256: string;
    readonly platform: PackageAttestationPlatform;
    readonly record: unknown;
    readonly sbom: unknown;
    readonly sourceCommit: string;
  }): void {
    const policy: ArtifactVulnerabilityPolicy = new ArtifactVulnerabilityPolicy();
    const record: unknown = input.record;
    policy.verifyRecord(record);
    const canonicalSbom = canonicalArtifactSecurityJson(input.sbom);
    policy.verifyBinding({
      checksumSha256: input.checksumSha256,
      packageFormat: input.packageFormat,
      packageSha256: input.packageSha256,
      platform: input.platform,
      record,
      sbom: input.sbom,
      sourceCommit: input.sourceCommit,
      unpackedRootSha256: record.unpackedRootSha256,
    });
    if (canonicalSbom.length === 0) fail('BINDING_INVALID');
  }
}

/** Verifies every private transfer binding before GitHub's attestation verifier is invoked. */
export class PackageAttestationVerifier {
  private readonly policy: PackageAttestationInputPolicy = new PackageAttestationInputPolicy();

  public verify(input: {
    readonly expected: PackageAttestationExpectation;
    readonly input: unknown;
    readonly subjects: Readonly<Record<PackageAttestationSubjectName, Uint8Array | string>>;
  }): void {
    const attestation: unknown = input.input;
    this.policy.verify(attestation);
    const expectedPlatform = safePlatform(input.expected.platform, 'EXPECTATION_INVALID');
    const expectedRepository = safeRepository(input.expected.repository, 'EXPECTATION_INVALID');
    const expectedCommit = securityFields.sourceCommit(input.expected.sourceCommit, 'EXPECTATION_INVALID');
    const expectedInvocation = safeInvocation(input.expected.invocation, expectedPlatform, 'EXPECTATION_INVALID');
    const expectedWorkflowPath = safeWorkflowPath(input.expected.workflowPath, 'EXPECTATION_INVALID');
    if (
      attestation.platform !== expectedPlatform ||
      attestation.source.repository !== expectedRepository ||
      attestation.source.commit !== expectedCommit ||
      attestation.source.workflowRef !== sourceWorkflowRef(expectedRepository, expectedCommit, expectedWorkflowPath) ||
      attestation.build.invocation !== expectedInvocation ||
      attestation.build.status !== 'success'
    ) {
      fail('BINDING_INVALID');
    }
    for (const name of PACKAGE_ATTESTATION_SUBJECT_NAMES) {
      const subject = input.subjects[name];
      const subjectDigest =
        subject instanceof Uint8Array
          ? subject.byteLength > 0 && subject.byteLength <= MAXIMUM_SUBJECT_BYTES
            ? digest(subject)
            : fail('SUBJECT_UNAVAILABLE')
          : securityFields.sha256(subject, 'SUBJECT_UNAVAILABLE');
      if (subjectDigest !== attestation.subjects[name].sha256) fail('BINDING_INVALID');
    }
  }
}

/** Calls the supported GitHub CLI verifier without retaining command output or token material. */
export class GitHubAttestationVerifier {
  public constructor(private readonly command: GitHubAttestationCommand) {}

  public async verify(input: {
    readonly repository: string;
    readonly sourceCommit: string;
    readonly subjectPaths: readonly string[];
    readonly workflowPath: string;
  }): Promise<void> {
    const repository = safeRepository(input.repository, 'EXPECTATION_INVALID');
    const sourceCommit = securityFields.sourceCommit(input.sourceCommit, 'EXPECTATION_INVALID');
    safeWorkflowPath(input.workflowPath, 'EXPECTATION_INVALID');
    const expectedPaths = [
      'attestation-input.json',
      ...PACKAGE_ATTESTATION_SUBJECT_NAMES.map((name) => `subject/${name}`),
    ].sort((left, right) => left.localeCompare(right, 'en'));
    const actualPaths = [...input.subjectPaths].sort((left, right) => left.localeCompare(right, 'en'));
    if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) fail('SUBJECT_UNAVAILABLE');
    for (const subjectPath of input.subjectPaths) {
      if (
        typeof subjectPath !== 'string' ||
        (subjectPath !== 'attestation-input.json' && !/^subject\/[a-z-]+$/u.test(subjectPath))
      ) {
        fail('SUBJECT_UNAVAILABLE');
      }
      const result = await this.command
        .verify(subjectPath, { repository, sourceCommit, workflowPath: input.workflowPath })
        .catch(() => 'unavailable' as const);
      if (result === 'unavailable') fail('GITHUB_UNAVAILABLE');
      if (result === 'unsupported') fail('GITHUB_UNSUPPORTED');
      if (result !== 'verified') fail('GITHUB_INVALID');
    }
  }
}
