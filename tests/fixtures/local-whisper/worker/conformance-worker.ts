import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

import {
  LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  decodeLocalWhisperAudioFrame,
  encodeLocalWhisperControlFrame,
  isLocalWhisperWorkerClientMessage,
  toLocalWhisperRevisionId,
  type LocalWhisperResidencyKey,
  type LocalWhisperWorkerClientMessage,
  type LocalWhisperWorkerDeviceBinding,
  type LocalWhisperWorkerServerMessage,
} from '@shared/localWhisper';
import { LocalWhisperFrameCodec } from '@main/localWhisper/supervisor/LocalWhisperFrameCodec';

type FixtureMode =
  | 'crash'
  | 'descendant'
  | 'flood'
  | 'hang'
  | 'happy'
  | 'malformed'
  | 'out-of-order'
  | 'oversized'
  | 'stream-close'
  | 'unknown-kind'
  | 'validate-vectors';

interface GoldenManifest {
  readonly audio: readonly { readonly binaryFile: string; readonly name: string }[];
  readonly control: readonly { readonly binaryFile: string }[];
  readonly malformed: readonly {
    readonly binaryFile: string;
    readonly name: string;
  }[];
  readonly streams: readonly { readonly frameNames: readonly string[]; readonly name: string }[];
}

const PROTOCOL_DIRECTORY = resolve('tests/fixtures/local-whisper/protocol/v1');
const MANIFEST_PATH = resolve(PROTOCOL_DIRECTORY, 'manifest.json');
function fixtureRevision(value: string) {
  const parsed = toLocalWhisperRevisionId(value);
  if (!parsed) throw new Error('Invalid conformance runtime revision');
  return parsed;
}

const runtimeRevision = fixtureRevision('runtime-pack-v1');

function manifest(): GoldenManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as GoldenManifest;
}

function malformedBytes(name: string): Buffer {
  const vector = manifest().malformed.find((candidate) => candidate.name === name);
  if (!vector) throw new Error('Missing malformed protocol fixture');
  return readFileSync(resolve(PROTOCOL_DIRECTORY, vector.binaryFile));
}

function validateGoldenVectors(): void {
  const vectors = manifest();
  for (const vector of [...vectors.control, ...vectors.audio]) {
    const codec = new LocalWhisperFrameCodec();
    const decoded = codec.push(readFileSync(resolve(PROTOCOL_DIRECTORY, vector.binaryFile)));
    codec.finish();
    if (decoded.length !== 1) throw new Error('Golden vector did not decode exactly once');
  }
  for (const vector of vectors.malformed) {
    let rejected = false;
    try {
      const codec = new LocalWhisperFrameCodec();
      codec.push(readFileSync(resolve(PROTOCOL_DIRECTORY, vector.binaryFile)));
      codec.finish();
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`Malformed vector accepted: ${vector.name}`);
  }
  for (const vector of vectors.streams) {
    let expectedSequence = 0;
    let terminal = false;
    let rejected = false;
    for (const frameName of vector.frameNames) {
      const audio = vectors.audio.find((candidate) => candidate.name === frameName);
      if (!audio) throw new Error(`Missing audio fixture: ${frameName}`);
      const chunk = decodeLocalWhisperAudioFrame(readFileSync(resolve(PROTOCOL_DIRECTORY, audio.binaryFile)));
      if (terminal || chunk.sequence !== expectedSequence) {
        rejected = true;
        break;
      }
      expectedSequence += 1;
      terminal = chunk.final;
    }
    if (!rejected) throw new Error(`Invalid audio stream accepted: ${vector.name}`);
  }
}

class ConformanceWorker {
  private readonly codec = new LocalWhisperFrameCodec();
  private activeAudioBytes = 0;
  private activeAudioLength = 0;
  private activeRequestId: string | null = null;
  private activeSequence = 0;
  private descendant: ChildProcess | null = null;
  private probedDeviceBinding: LocalWhisperWorkerDeviceBinding | null = null;
  private residency: LocalWhisperResidencyKey | null = null;
  private state: 'handshaken' | 'loaded' | 'probed' | 'spawned' | 'warmed' = 'spawned';

  public constructor(private readonly mode: FixtureMode) {}

  public run(): void {
    if (this.mode === 'descendant') this.spawnDescendant();
    process.stdin.on('data', (chunk: Buffer) => this.onData(chunk));
    process.stdin.on('end', () => this.exit(0));
    process.stdin.on('error', () => this.exit(10));
    process.on('SIGTERM', () => this.exit(0));
    process.on('SIGINT', () => this.exit(0));
  }

  private onData(chunk: Buffer): void {
    try {
      for (const frame of this.codec.push(chunk)) {
        if (frame.kind === 'audio') this.onAudio(frame.chunk);
        else if (isLocalWhisperWorkerClientMessage(frame.message)) this.onMessage(frame.message);
        else this.exit(11);
      }
    } catch {
      this.exit(11);
    }
  }

  private onMessage(message: LocalWhisperWorkerClientMessage): void {
    if (message.type === 'hello') {
      this.onHello();
      return;
    }
    if (message.type === 'probe') {
      if (this.state !== 'handshaken') return this.exit(11);
      if (this.mode === 'out-of-order') {
        this.respond({ type: 'warmed', protocolVersion: 1, requestId: message.requestId });
        return;
      }
      this.probedDeviceBinding = message.deviceBinding;
      this.state = 'probed';
      if ('registryFingerprint' in message) {
        this.respond({
          type: 'probed',
          protocolVersion: 1,
          requestId: message.requestId,
          activatedOrdinal: message.deviceBinding.index,
          actualNativeIdentity: '0000:01:00.0',
          authorityId: message.authorityId,
          deviceBinding: message.deviceBinding,
          primaryExecutionNativeIdentity: '0000:01:00.0',
          probeProof: 'c'.repeat(64),
          registryFingerprint: message.registryFingerprint,
        });
      } else {
        this.respond({
          type: 'probed',
          protocolVersion: 1,
          requestId: message.requestId,
          authorityId: message.authorityId,
          deviceBinding: message.deviceBinding,
        });
      }
      return;
    }
    if (message.type === 'load') {
      if (
        (this.state !== 'handshaken' && this.state !== 'probed') ||
        (this.state === 'probed' &&
          (!this.probedDeviceBinding ||
            JSON.stringify(message.deviceBinding) !== JSON.stringify(this.probedDeviceBinding)))
      ) {
        return this.exit(11);
      }
      this.residency = message.residency;
      this.state = 'loaded';
      const modelEvidence = {
        effectiveBackend: message.residency.backend,
        model: message.residency.model,
        modelSha256: 'b'.repeat(64),
        primaryStateOwnership: 'worker' as const,
        residency: message.residency,
      };
      if ('registryFingerprint' in message) {
        this.respond({
          type: 'loaded',
          protocolVersion: 1,
          requestId: message.requestId,
          activatedOrdinal: message.deviceBinding.index,
          actualNativeIdentity: '0000:01:00.0',
          authorityId: message.authorityId,
          deviceBinding: message.deviceBinding,
          ...modelEvidence,
          loadProof: 'd'.repeat(64),
          primaryExecutionNativeIdentity: '0000:01:00.0',
          registryFingerprint: message.registryFingerprint,
          selectedDeviceModelWeightBytes: 1_048_576,
        });
      } else {
        this.respond({
          type: 'loaded',
          protocolVersion: 1,
          requestId: message.requestId,
          authorityId: message.authorityId,
          deviceBinding: message.deviceBinding,
          ...modelEvidence,
        });
      }
      return;
    }
    if (message.type === 'warmup') {
      if (this.state !== 'loaded') return this.exit(11);
      this.state = 'warmed';
      this.respond({ type: 'warmed', protocolVersion: 1, requestId: message.requestId });
      return;
    }
    if (message.type === 'transcribe') {
      if (this.state !== 'warmed' || this.activeRequestId !== null) return this.exit(11);
      this.activeRequestId = message.requestId;
      this.activeAudioLength = message.audioByteLength;
      this.activeAudioBytes = 0;
      this.activeSequence = 0;
      return;
    }
    if (message.type === 'cancel') {
      if (message.targetRequestId !== this.activeRequestId) return this.exit(11);
      this.activeRequestId = null;
      this.respond({
        type: 'cancelled',
        protocolVersion: 1,
        requestId: message.requestId,
        targetRequestId: message.targetRequestId,
      });
      return;
    }
    if (message.type === 'unload') {
      if (this.state !== 'loaded' && this.state !== 'warmed') return this.exit(11);
      this.residency = null;
      this.state = 'probed';
      this.respond({ type: 'unloaded', protocolVersion: 1, requestId: message.requestId });
      return;
    }
    if (message.type === 'shutdown') {
      if (this.state === 'spawned') return this.exit(11);
      this.respond({ type: 'shutdownAck', protocolVersion: 1, requestId: message.requestId });
      process.stdout.write('', () => this.exit(0));
    }
  }

  private onHello(): void {
    if (this.state !== 'spawned') return this.exit(11);
    if (this.mode === 'crash') return this.exit(17);
    if (this.mode === 'hang') return;
    if (this.mode === 'stream-close') {
      if (process.platform === 'win32') return this.exit(0);
      process.stdout.end();
      return;
    }
    if (this.mode === 'malformed') return this.writeRaw(malformedBytes('invalid-control-utf8'));
    if (this.mode === 'oversized') return this.writeRaw(malformedBytes('oversized-control-prefix'));
    if (this.mode === 'unknown-kind') return this.writeRaw(malformedBytes('unknown-kind'));
    this.state = 'handshaken';
    const acknowledgment: LocalWhisperWorkerServerMessage = {
      type: 'helloAck',
      protocolVersion: 1,
      engine: 'whisperCpp',
      runtimeRevision,
      runtimeBuildDigest: 'a'.repeat(64),
      backend: 'cuda',
      capabilities: ['cuda-sm-75', 'cuda-sm-86'],
      maxControlFrameBytes: LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
      maxAudioChunkBytes: LOCAL_WHISPER_MAX_AUDIO_CHUNK_BYTES,
    };
    if (this.mode === 'flood') {
      this.writeRaw(
        Buffer.concat(
          Array.from({ length: 300 }, (_, index) =>
            encodeLocalWhisperControlFrame({
              type: 'probed',
              protocolVersion: 1,
              requestId: `flood-${index}`,
              activatedOrdinal: 0,
              actualNativeIdentity: '0000:01:00.0',
              authorityId: 'AAECAwQFBgcICQoLDA0ODw',
              deviceBinding: { kind: 'gpuIndex', index: 0 },
              primaryExecutionNativeIdentity: '0000:01:00.0',
              probeProof: 'c'.repeat(64),
              registryFingerprint: 'e'.repeat(64),
            }),
          ),
        ),
      );
      return;
    }
    this.respond(acknowledgment);
  }

  private onAudio(chunk: {
    readonly bytes: Uint8Array;
    readonly final: boolean;
    readonly requestId: string;
    readonly sequence: number;
  }): void {
    if (
      chunk.requestId !== this.activeRequestId ||
      chunk.sequence !== this.activeSequence ||
      this.activeAudioBytes + chunk.bytes.byteLength > this.activeAudioLength
    ) {
      return this.exit(11);
    }
    this.activeSequence += 1;
    this.activeAudioBytes += chunk.bytes.byteLength;
    if (!chunk.final) return;
    if (this.activeAudioBytes !== this.activeAudioLength || this.activeRequestId === null) {
      return this.exit(11);
    }
    const requestId = this.activeRequestId;
    this.activeRequestId = null;
    this.respond({
      type: 'transcript',
      protocolVersion: 1,
      requestId,
      text: 'synthetic conformance transcript',
    });
  }

  private respond(message: LocalWhisperWorkerServerMessage): void {
    this.writeRaw(encodeLocalWhisperControlFrame(message));
  }

  private writeRaw(bytes: Uint8Array): void {
    process.stdout.write(bytes);
  }

  private spawnDescendant(): void {
    this.descendant = spawn(process.execPath, ['--import', 'tsx', resolve(__filename), 'descendant-child'], {
      shell: false,
      stdio: 'ignore',
      windowsHide: true,
    });
  }

  private exit(code: number): never {
    const descendant = this.descendant;
    this.descendant = null;
    if (descendant && descendant.exitCode === null && descendant.signalCode === null) {
      descendant.kill('SIGKILL');
    }
    process.exit(code);
  }
}

function fixtureMode(value: string | undefined): FixtureMode {
  const modes: readonly FixtureMode[] = [
    'crash',
    'descendant',
    'flood',
    'hang',
    'happy',
    'malformed',
    'out-of-order',
    'oversized',
    'stream-close',
    'unknown-kind',
    'validate-vectors',
  ];
  const selected = modes.find((mode) => mode === value);
  if (!selected) throw new Error('Unknown Local Whisper conformance mode');
  return selected;
}

if (process.argv[2] === 'descendant-child') {
  setInterval(() => undefined, 1_000);
} else {
  const mode = fixtureMode(process.argv[2]);
  if (mode === 'validate-vectors') {
    validateGoldenVectors();
  } else {
    new ConformanceWorker(mode).run();
  }
}
