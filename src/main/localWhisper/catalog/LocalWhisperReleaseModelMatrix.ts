import type { LocalWhisperModelFamily } from '@shared/localWhisper';

export const LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY = 'ggerganov/whisper.cpp' as const;
export const LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT = '5359861c739e955e79d9a303bcbc70fb988958b1' as const;

export interface LocalWhisperReleaseModelIdentity {
  readonly family: LocalWhisperModelFamily;
  readonly variant: 'full' | 'q5_0';
  readonly file: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

/** Closed release-1 model matrix pinned to upstream Git-LFS object identities. */
export const LOCAL_WHISPER_RELEASE_MODEL_MATRIX: readonly LocalWhisperReleaseModelIdentity[] = Object.freeze([
  Object.freeze({
    family: 'tiny',
    variant: 'full',
    file: 'ggml-tiny.bin',
    sizeBytes: 77_691_713,
    sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
  }),
  Object.freeze({
    family: 'base',
    variant: 'full',
    file: 'ggml-base.bin',
    sizeBytes: 147_951_465,
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  }),
  Object.freeze({
    family: 'small',
    variant: 'full',
    file: 'ggml-small.bin',
    sizeBytes: 487_601_967,
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
  }),
  Object.freeze({
    family: 'medium',
    variant: 'full',
    file: 'ggml-medium.bin',
    sizeBytes: 1_533_763_059,
    sha256: '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208',
  }),
  Object.freeze({
    family: 'large-v3',
    variant: 'q5_0',
    file: 'ggml-large-v3-q5_0.bin',
    sizeBytes: 1_081_140_203,
    sha256: 'd75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1',
  }),
  Object.freeze({
    family: 'large-v3-turbo',
    variant: 'q5_0',
    file: 'ggml-large-v3-turbo-q5_0.bin',
    sizeBytes: 574_041_195,
    sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
  }),
]);

export function localWhisperUpstreamModelUrl(file: string): string {
  return `https://huggingface.co/${LOCAL_WHISPER_UPSTREAM_MODEL_REPOSITORY}/resolve/${LOCAL_WHISPER_UPSTREAM_MODEL_COMMIT}/${file}`;
}
