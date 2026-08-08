import { LocalWhisperAuthorityBinaryReader } from './LocalWhisperAuthorityBinaryReader';
import { requireLocalWhisperAuthorityBytes } from './LocalWhisperAuthorityBinaryValidation';
import { LocalWhisperAuthorityBinaryWriter } from './LocalWhisperAuthorityBinaryWriter';

export const LOCAL_WHISPER_MODEL_LOGICAL_SLOT = 3 as const;
export const LOCAL_WHISPER_AUTHORITY_COMMON_BYTES = 226;
export const LOCAL_WHISPER_AUTHORITY_REQUEST_BYTES = 234;
export const LOCAL_WHISPER_AUTHORITY_TRANSFER_BYTES = 244;
export const LOCAL_WHISPER_AUTHORITY_ACK_BYTES = 284;

const REQUEST_DOMAIN = Uint8Array.from([0x4c, 0x57, 0x41, 0x52, 0x31, 0x00, 0x00, 0x00]);
const TRANSFER_DOMAIN = Uint8Array.from([0x4c, 0x57, 0x41, 0x54, 0x31, 0x00, 0x00, 0x00]);
const ACK_DOMAIN = Uint8Array.from([0x4c, 0x57, 0x41, 0x41, 0x31, 0x00, 0x00, 0x00]);

export interface LocalWhisperModelAuthorityBinding {
  readonly appOwnershipNonce: Uint8Array;
  readonly artifactKind: 'directory' | 'regularFile';
  readonly artifactContentSha256: Uint8Array;
  readonly configurationEpoch: bigint;
  readonly expectedArtifactBytes: bigint;
  readonly expectedGuardPid: bigint;
  readonly expectedGuardStartIdentitySha256: Uint8Array;
  readonly expectedLauncherPid: bigint;
  readonly expectedLauncherStartIdentitySha256: Uint8Array;
  readonly leaseTokenSha256: Uint8Array;
  readonly logicalModelSlot: typeof LOCAL_WHISPER_MODEL_LOGICAL_SLOT;
  readonly modelIdentitySha256: Uint8Array;
  readonly operationNonce: Uint8Array;
}

export interface LocalWhisperModelAuthorityRequest {
  readonly binding: LocalWhisperModelAuthorityBinding;
  readonly type: 'request';
}

export interface LocalWhisperModelAuthorityTransfer {
  readonly binding: LocalWhisperModelAuthorityBinding;
  readonly carrierKind: 1 | 2 | 3 | 4;
  readonly carrierValue: bigint;
  readonly hop: 1 | 2;
  readonly type: 'transfer';
}

export interface LocalWhisperModelAuthorityAcknowledgment {
  readonly binding: LocalWhisperModelAuthorityBinding;
  readonly carrierKind: 3 | 4;
  readonly carrierValue: bigint;
  readonly hop: 2;
  readonly type: 'acknowledgment';
  readonly workerPid: bigint;
  readonly workerStartIdentitySha256: Uint8Array;
}

export type LocalWhisperModelAuthorityRecord =
  LocalWhisperModelAuthorityAcknowledgment | LocalWhisperModelAuthorityRequest | LocalWhisperModelAuthorityTransfer;

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

function isAllZero(value: Uint8Array): boolean {
  return value.every((byte) => byte === 0);
}

function writeBinding(
  writer: LocalWhisperAuthorityBinaryWriter,
  binding: LocalWhisperModelAuthorityBinding,
): LocalWhisperAuthorityBinaryWriter {
  if (binding.logicalModelSlot !== LOCAL_WHISPER_MODEL_LOGICAL_SLOT) throw new Error('Invalid logical model slot');
  return writer
    .bytes(binding.operationNonce, 16, 'operation nonce')
    .bytes(binding.appOwnershipNonce, 16, 'app ownership nonce')
    .u64(binding.configurationEpoch, 'configuration epoch')
    .bytes(binding.leaseTokenSha256, 32, 'lease-token digest')
    .bytes(binding.modelIdentitySha256, 32, 'model-identity digest')
    .u64(binding.expectedArtifactBytes, 'expected artifact bytes', false)
    .bytes(binding.artifactContentSha256, 32, 'artifact-content digest')
    .u8(binding.artifactKind === 'regularFile' ? 1 : 2, 'artifact kind')
    .u8(binding.logicalModelSlot, 'logical model slot')
    .u64(binding.expectedLauncherPid, 'launcher PID', false)
    .u64(binding.expectedGuardPid, 'guard PID', false)
    .bytes(binding.expectedLauncherStartIdentitySha256, 32, 'launcher start identity')
    .bytes(binding.expectedGuardStartIdentitySha256, 32, 'guard start identity');
}

function readBinding(reader: LocalWhisperAuthorityBinaryReader): LocalWhisperModelAuthorityBinding {
  const operationNonce = reader.bytes(16);
  const appOwnershipNonce = reader.bytes(16);
  const configurationEpoch = reader.u64();
  const leaseTokenSha256 = reader.bytes(32);
  const modelIdentitySha256 = reader.bytes(32);
  const expectedArtifactBytes = reader.u64();
  const artifactContentSha256 = reader.bytes(32);
  const artifactKindValue = reader.u8();
  const logicalModelSlot = reader.u8();
  const expectedLauncherPid = reader.u64();
  const expectedGuardPid = reader.u64();
  const expectedLauncherStartIdentitySha256 = reader.bytes(32);
  const expectedGuardStartIdentitySha256 = reader.bytes(32);
  if (
    (artifactKindValue !== 1 && artifactKindValue !== 2) ||
    logicalModelSlot !== LOCAL_WHISPER_MODEL_LOGICAL_SLOT ||
    expectedArtifactBytes === 0n ||
    isAllZero(artifactContentSha256) ||
    expectedLauncherPid === 0n ||
    expectedGuardPid === 0n
  ) {
    throw new Error('Invalid authority binding');
  }
  return Object.freeze({
    appOwnershipNonce,
    artifactKind: artifactKindValue === 1 ? 'regularFile' : 'directory',
    artifactContentSha256,
    configurationEpoch,
    expectedArtifactBytes,
    expectedGuardPid,
    expectedGuardStartIdentitySha256,
    expectedLauncherPid,
    expectedLauncherStartIdentitySha256,
    leaseTokenSha256,
    logicalModelSlot: LOCAL_WHISPER_MODEL_LOGICAL_SLOT,
    modelIdentitySha256,
    operationNonce,
  });
}

function validateTransfer(hop: number, carrierKind: number, carrierValue: bigint): void {
  const valid =
    (hop === 1 && carrierKind === 1 && carrierValue === 0n) ||
    (hop === 1 && carrierKind === 2 && carrierValue !== 0n) ||
    (hop === 2 && carrierKind === 3 && carrierValue === 3n) ||
    (hop === 2 && carrierKind === 4 && carrierValue !== 0n);
  if (!valid) throw new Error('Invalid model-authority carrier');
}

export function encodeLocalWhisperModelAuthorityRecord(record: LocalWhisperModelAuthorityRecord): Uint8Array {
  if (record.type === 'request') {
    return writeBinding(
      new LocalWhisperAuthorityBinaryWriter(LOCAL_WHISPER_AUTHORITY_REQUEST_BYTES).bytes(REQUEST_DOMAIN, 8, 'domain'),
      record.binding,
    ).finish();
  }
  if (record.type === 'transfer') {
    validateTransfer(record.hop, record.carrierKind, record.carrierValue);
    return writeBinding(
      new LocalWhisperAuthorityBinaryWriter(LOCAL_WHISPER_AUTHORITY_TRANSFER_BYTES).bytes(TRANSFER_DOMAIN, 8, 'domain'),
      record.binding,
    )
      .u8(record.hop, 'hop')
      .u8(record.carrierKind, 'carrier kind')
      .u64(record.carrierValue, 'carrier value')
      .finish();
  }
  if (record.hop !== 2 || (record.carrierKind !== 3 && record.carrierKind !== 4)) {
    throw new Error('Invalid authority acknowledgment');
  }
  validateTransfer(record.hop, record.carrierKind, record.carrierValue);
  return writeBinding(
    new LocalWhisperAuthorityBinaryWriter(LOCAL_WHISPER_AUTHORITY_ACK_BYTES).bytes(ACK_DOMAIN, 8, 'domain'),
    record.binding,
  )
    .u8(record.hop, 'hop')
    .u8(record.carrierKind, 'carrier kind')
    .u64(record.carrierValue, 'carrier value')
    .u64(record.workerPid, 'worker PID', false)
    .bytes(record.workerStartIdentitySha256, 32, 'worker start identity')
    .finish();
}

export function decodeLocalWhisperModelAuthorityRecord(bytes: Uint8Array): LocalWhisperModelAuthorityRecord {
  if (
    bytes.byteLength !== LOCAL_WHISPER_AUTHORITY_REQUEST_BYTES &&
    bytes.byteLength !== LOCAL_WHISPER_AUTHORITY_TRANSFER_BYTES &&
    bytes.byteLength !== LOCAL_WHISPER_AUTHORITY_ACK_BYTES
  ) {
    throw new Error('Invalid authority record length');
  }
  const reader = new LocalWhisperAuthorityBinaryReader(bytes);
  const domain = reader.bytes(8);
  const binding = readBinding(reader);
  if (equalBytes(domain, REQUEST_DOMAIN) && bytes.byteLength === LOCAL_WHISPER_AUTHORITY_REQUEST_BYTES) {
    reader.finish();
    return Object.freeze({ binding, type: 'request' });
  }
  if (equalBytes(domain, TRANSFER_DOMAIN) && bytes.byteLength === LOCAL_WHISPER_AUTHORITY_TRANSFER_BYTES) {
    const hop = reader.u8();
    const carrierKind = reader.u8();
    const carrierValue = reader.u64();
    reader.finish();
    validateTransfer(hop, carrierKind, carrierValue);
    return Object.freeze({
      binding,
      carrierKind: carrierKind as 1 | 2 | 3 | 4,
      carrierValue,
      hop: hop as 1 | 2,
      type: 'transfer',
    });
  }
  if (equalBytes(domain, ACK_DOMAIN) && bytes.byteLength === LOCAL_WHISPER_AUTHORITY_ACK_BYTES) {
    const hop = reader.u8();
    const carrierKind = reader.u8();
    const carrierValue = reader.u64();
    const workerPid = reader.u64();
    const workerStartIdentitySha256 = reader.bytes(32);
    reader.finish();
    validateTransfer(hop, carrierKind, carrierValue);
    if (hop !== 2 || (carrierKind !== 3 && carrierKind !== 4) || workerPid === 0n) {
      throw new Error('Invalid authority acknowledgment');
    }
    return Object.freeze({
      binding,
      carrierKind,
      carrierValue,
      hop: 2,
      type: 'acknowledgment',
      workerPid,
      workerStartIdentitySha256,
    });
  }
  throw new Error('Invalid authority record domain');
}

/** Rejects every replay of an operation nonce after its first terminal use. */
export class LocalWhisperModelAuthorityReplayGuard {
  private readonly consumed = new Set<string>();

  public consume(operationNonce: Uint8Array): boolean {
    const key = Buffer.from(requireLocalWhisperAuthorityBytes(operationNonce, 16, 'operation nonce')).toString('hex');
    if (this.consumed.has(key)) return false;
    this.consumed.add(key);
    return true;
  }
}
