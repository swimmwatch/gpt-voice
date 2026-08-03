import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, chmod, copyFile, lstat, mkdir, readdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { qualificationCanonicalJson } from './QualificationContracts';
import type {
  LinuxPredecessorApplicationSessionPort,
  LinuxPredecessorApplicationSessionResult,
} from './LinuxPredecessorElectronSession';
import type { LinuxPredecessorPackageExtractorPort } from './LinuxPredecessorAppImageExtractor';
import { sha256File, writeCanonicalJson } from '../packaging/fileIntegrity';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const EXECUTABLE_SENTINEL = '#!/bin/sh\nprintf executed > "$LOCAL_WHISPER_EXECUTION_MARKER"\n';

export interface LinuxPredecessorQualificationInput {
  readonly appImagePath: string;
  readonly expectedSha256: string;
  readonly privateRoot: string;
}

export interface LinuxPredecessorQualificationResult {
  readonly passed: true;
  readonly sanitizedEvidence: Readonly<Record<string, unknown>>;
  readonly sanitizedEvidenceDigest: string;
}

export interface LinuxPredecessorQualificationPort {
  readonly run: (input: LinuxPredecessorQualificationInput) => Promise<LinuxPredecessorQualificationResult>;
}

interface NamespaceIdentity {
  readonly digest: string;
  readonly entryCount: number;
}

async function namespaceEntries(root: string, label: string): Promise<readonly Readonly<Record<string, unknown>>[]> {
  const entries: Array<Readonly<Record<string, unknown>>> = [];
  const visit = async (directory: string): Promise<void> => {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const child of children) {
      const absolute = path.join(directory, child.name);
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink() || (!metadata.isDirectory() && !metadata.isFile())) {
        throw new Error('Predecessor fixture namespace contains an unsafe entry');
      }
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (metadata.isDirectory()) {
        entries.push(Object.freeze({ label, path: relative, type: 'directory', mode: metadata.mode & 0o777 }));
        await visit(absolute);
      } else {
        entries.push(
          Object.freeze({
            label,
            path: relative,
            type: 'file',
            mode: metadata.mode & 0o777,
            sizeBytes: metadata.size,
            sha256: await sha256File(absolute),
          }),
        );
      }
    }
  };
  await visit(root);
  return Object.freeze(entries);
}

async function namespaceIdentity(configurationNamespace: string, dataNamespace: string): Promise<NamespaceIdentity> {
  const entries = [
    ...(await namespaceEntries(configurationNamespace, 'configuration')),
    ...(await namespaceEntries(dataNamespace, 'data')),
  ];
  const bytes = qualificationCanonicalJson({ entries });
  return Object.freeze({
    digest: createHash('sha256').update(bytes, 'utf8').digest('hex'),
    entryCount: entries.length,
  });
}

async function seedLocalWhisperNamespaces(
  configurationRoot: string,
  dataRoot: string,
): Promise<{
  readonly configurationNamespace: string;
  readonly dataNamespace: string;
  readonly executionMarkerPath: string;
}> {
  const applicationConfigurationRoot = path.join(configurationRoot, 'GPT-Voice');
  const configurationNamespace = path.join(applicationConfigurationRoot, 'local-whisper');
  const dataNamespace = path.join(dataRoot, 'com.swimmwatch.gptvoice', 'local-whisper');
  const runtimeBinary = path.join(
    dataNamespace,
    'runtimes',
    'linux-x64-cpu-v2.4.0',
    'bin',
    'local-whisper-whisper-cpp',
  );
  const executionMarkerPath = path.join(dataRoot, 'local-whisper-executed.marker');
  await Promise.all([
    mkdir(configurationNamespace, { recursive: true, mode: 0o700 }),
    mkdir(path.dirname(runtimeBinary), { recursive: true, mode: 0o700 }),
    mkdir(path.join(dataNamespace, 'models'), { recursive: true, mode: 0o700 }),
    mkdir(path.join(dataNamespace, 'staging'), { recursive: true, mode: 0o700 }),
  ]);
  await Promise.all([
    writeCanonicalJson(path.join(applicationConfigurationRoot, 'config.json'), { provider: 'local-whisper' }),
    writeCanonicalJson(path.join(configurationNamespace, 'settings.json'), {
      schemaVersion: 2,
      engine: 'whisperCpp',
      sentinel: 'predecessor-preservation-fixture',
    }),
    writeCanonicalJson(path.join(configurationNamespace, 'device-state.json'), {
      schemaVersion: 1,
      sentinel: 'device-preservation-fixture',
    }),
    writeCanonicalJson(path.join(configurationNamespace, 'ownership-state.json'), {
      schemaVersion: 1,
      sentinel: 'ownership-preservation-fixture',
    }),
    writeFile(runtimeBinary, EXECUTABLE_SENTINEL, { encoding: 'utf8', mode: 0o700, flag: 'wx' }),
    writeFile(path.join(dataNamespace, 'models', 'model-sentinel.bin'), 'model-preservation-fixture', {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    }),
    writeCanonicalJson(path.join(dataNamespace, 'staging', 'staging-sentinel.json'), {
      schemaVersion: 1,
      sentinel: 'staging-preservation-fixture',
    }),
  ]);
  return Object.freeze({ configurationNamespace, dataNamespace, executionMarkerPath });
}

function evidenceDocument(
  input: LinuxPredecessorQualificationInput,
  session: LinuxPredecessorApplicationSessionResult,
  namespace: NamespaceIdentity,
  executableSha256: string,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    schemaVersion: 1,
    specificationRevision: 10,
    id: 'linux-predecessor-v2.3.0',
    platform: 'linux',
    status: 'Pass',
    package: Object.freeze({
      version: '2.3.0',
      fileName: 'GPT-Voice-2.3.0.AppImage',
      sha256: input.expectedSha256,
      packagedExecutableSha256: executableSha256,
    }),
    behavior: Object.freeze({
      initialProvider: session.initialProvider,
      initialReady: session.initialReady,
      knownProviders: session.knownProviders,
      recoveredProvider: session.recoveredProvider,
      namespaceEntryCount: namespace.entryCount,
      namespaceDigestBeforeAndAfter: namespace.digest,
      localWhisperExecution: 'NotObserved',
      localWhisperDeletion: 'NotObserved',
      executionMode: 'verified-appimage-extracted-executable',
    }),
    gates: Object.freeze({
      exactPackage: 'Pass',
      unknownProviderNotReady: 'Pass',
      knownProviderRecovery: 'Pass',
      namespacesPreserved: 'Pass',
      noLocalWhisperExecutionOrDeletion: 'Pass',
    }),
  });
}

/** Qualifies the exact predecessor package without exposing its private profile or raw application output. */
export class LinuxPredecessorQualifier implements LinuxPredecessorQualificationPort {
  public constructor(
    private readonly session: LinuxPredecessorApplicationSessionPort,
    private readonly extractor: LinuxPredecessorPackageExtractorPort,
  ) {}

  public async run(input: LinuxPredecessorQualificationInput): Promise<LinuxPredecessorQualificationResult> {
    if (
      process.platform !== 'linux' ||
      !path.isAbsolute(input.appImagePath) ||
      !path.isAbsolute(input.privateRoot) ||
      path.resolve(input.privateRoot) === path.parse(path.resolve(input.privateRoot)).root ||
      !SHA256_PATTERN.test(input.expectedSha256)
    ) {
      throw new Error('Predecessor qualification input invalid');
    }
    const sourceMetadata = await lstat(input.appImagePath);
    if (
      !sourceMetadata.isFile() ||
      sourceMetadata.isSymbolicLink() ||
      (await sha256File(input.appImagePath)) !== input.expectedSha256
    ) {
      throw new Error('Predecessor AppImage identity mismatch');
    }

    await mkdir(input.privateRoot, { recursive: false, mode: 0o700 });
    const roots = Object.freeze({
      cache: path.join(input.privateRoot, 'cache'),
      configuration: path.join(input.privateRoot, 'configuration'),
      data: path.join(input.privateRoot, 'data'),
      home: path.join(input.privateRoot, 'home'),
      temporary: path.join(input.privateRoot, 'temporary'),
    });
    await Promise.all(Object.values(roots).map((root) => mkdir(root, { recursive: false, mode: 0o700 })));
    const fixture = await seedLocalWhisperNamespaces(roots.configuration, roots.data);
    const privateAppImagePath = path.join(input.privateRoot, 'GPT-Voice-2.3.0.AppImage');
    await copyFile(input.appImagePath, privateAppImagePath, constants.COPYFILE_EXCL);
    await chmod(privateAppImagePath, 0o700);
    if ((await sha256File(privateAppImagePath)) !== input.expectedSha256) {
      throw new Error('Predecessor private AppImage identity mismatch');
    }
    const executable = await this.extractor.extract(privateAppImagePath, path.join(input.privateRoot, 'extracted'));

    const before = await namespaceIdentity(fixture.configurationNamespace, fixture.dataNamespace);
    const session = await this.session.run({
      cacheRoot: roots.cache,
      configurationRoot: roots.configuration,
      dataRoot: roots.data,
      executablePath: executable.executablePath,
      executionMarkerPath: fixture.executionMarkerPath,
      homeRoot: roots.home,
      temporaryRoot: roots.temporary,
    });
    const after = await namespaceIdentity(fixture.configurationNamespace, fixture.dataNamespace);
    if (before.digest !== after.digest || before.entryCount !== after.entryCount) {
      throw new Error('Predecessor changed a Local Whisper namespace');
    }
    await access(fixture.executionMarkerPath).then(
      () => {
        throw new Error('Predecessor executed a Local Whisper sentinel');
      },
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      },
    );
    if ((await sha256File(privateAppImagePath)) !== input.expectedSha256) {
      throw new Error('Predecessor private AppImage changed during qualification');
    }
    if ((await sha256File(executable.executablePath)) !== executable.sha256) {
      throw new Error('Predecessor packaged executable changed during qualification');
    }
    const sanitizedEvidence = evidenceDocument(input, session, before, executable.sha256);
    const bytes = qualificationCanonicalJson(sanitizedEvidence);
    const sanitizedEvidenceDigest = createHash('sha256').update(bytes, 'utf8').digest('hex');
    return Object.freeze({ passed: true, sanitizedEvidence, sanitizedEvidenceDigest });
  }
}
