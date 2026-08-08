import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { sha256Bytes } from '../packaging/fileIntegrity';
import { QualificationCommandRunner, type QualificationCommandPort } from './LinuxQualificationPackageBuilder';

const CERTIFICATE_NAME = 'qualification-certificate.pem';
const PRIVATE_KEY_NAME = 'qualification-private-key.pem';
const LINUX_OPENSSL_PATH = '/usr/bin/openssl';
const WINDOWS_GIT_OPENSSL_RELATIVE_PATH = path.join('Git', 'usr', 'bin', 'openssl.exe');

function qualificationOpenSslCommand(): string {
  if (process.platform === 'linux') return LINUX_OPENSSL_PATH;
  if (process.platform === 'win32' && process.env.ProgramFiles) {
    return path.join(process.env.ProgramFiles, WINDOWS_GIT_OPENSSL_RELATIVE_PATH);
  }
  throw new Error('Qualification TLS OpenSSL unavailable');
}

export interface QualificationTlsMaterial {
  readonly certificatePem: string;
  readonly certificateSha256: string;
  readonly privateKeyPem: string;
  readonly destroy: () => Promise<void>;
}

/** Creates one short-lived loopback TLS identity under a task-owned private root. */
export class EphemeralQualificationTlsIdentityFactory {
  public constructor(private readonly commands: QualificationCommandPort = new QualificationCommandRunner()) {}

  public async create(parentDirectory: string): Promise<QualificationTlsMaterial> {
    if (
      (process.platform !== 'linux' && process.platform !== 'win32') ||
      !path.isAbsolute(parentDirectory) ||
      path.resolve(parentDirectory) === path.parse(path.resolve(parentDirectory)).root
    ) {
      throw new Error('Qualification TLS root invalid');
    }
    await mkdir(parentDirectory, { recursive: true, mode: 0o700 });
    const root = await mkdtemp(path.join(parentDirectory, 'tls-'));
    const certificatePath = path.join(root, CERTIFICATE_NAME);
    const privateKeyPath = path.join(root, PRIVATE_KEY_NAME);
    try {
      await this.commands.run({
        command: qualificationOpenSslCommand(),
        arguments: [
          'req',
          '-x509',
          '-newkey',
          'rsa:3072',
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
          privateKeyPath,
          '-out',
          certificatePath,
        ],
        cwd: root,
        environment:
          process.platform === 'win32'
            ? { LANG: 'C', LC_ALL: 'C', PATH: path.dirname(qualificationOpenSslCommand()) }
            : { LANG: 'C', LC_ALL: 'C', PATH: '/usr/bin:/bin' },
      });
      await Promise.all([chmod(certificatePath, 0o400), chmod(privateKeyPath, 0o400)]);
      const [certificateMetadata, privateMetadata, certificatePem, privateKeyPem] = await Promise.all([
        lstat(certificatePath),
        lstat(privateKeyPath),
        readFile(certificatePath, 'utf8'),
        readFile(privateKeyPath, 'utf8'),
      ]);
      if (
        !certificateMetadata.isFile() ||
        certificateMetadata.isSymbolicLink() ||
        !privateMetadata.isFile() ||
        privateMetadata.isSymbolicLink() ||
        !certificatePem.includes('BEGIN CERTIFICATE') ||
        !privateKeyPem.includes('BEGIN PRIVATE KEY')
      ) {
        throw new Error('Qualification TLS identity invalid');
      }
      let destroyed = false;
      return Object.freeze({
        certificatePem,
        certificateSha256: sha256Bytes(certificatePem),
        privateKeyPem,
        destroy: async () => {
          if (destroyed) return;
          destroyed = true;
          await chmod(privateKeyPath, 0o600).catch(() => undefined);
          await writeFile(privateKeyPath, Buffer.alloc(privateMetadata.size), { flag: 'r+' }).catch(() => undefined);
          await rm(root, { recursive: true, force: true });
        },
      });
    } catch (error) {
      await rm(root, { recursive: true, force: true });
      throw error;
    }
  }
}
