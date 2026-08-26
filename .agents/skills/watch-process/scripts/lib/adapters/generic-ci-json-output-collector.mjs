import { Buffer } from 'node:buffer';
import { TextDecoder } from 'node:util';

import { requirePositiveInteger, runtimeFail } from '../runtime-core-support.mjs';

import { GenericCiResultContract } from './generic-ci-result-contract.mjs';

function bufferFrom(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  runtimeFail('invalid-generic-ci-output-chunk');
}

/** Captures only bounded stdout until it can be parsed as one strict JSON protocol document. */
export class GenericCiJsonOutputCollector {
  #capturedBytes = 0;
  #chunks = [];
  #contract;
  #disposed = false;
  #maximumBytes;
  #receivedBytes = 0;
  #truncated = false;

  constructor({ contract = new GenericCiResultContract(), maximumBytes } = {}) {
    if (!(contract instanceof GenericCiResultContract)) runtimeFail('invalid-generic-ci-output-collector');
    this.#contract = contract;
    this.#maximumBytes = requirePositiveInteger(maximumBytes, 'invalid-generic-ci-output-limit', 10_485_760);
  }

  append(streamName, value) {
    if (this.#disposed || streamName !== 'stdout') return;
    const chunk = bufferFrom(value);
    this.#receivedBytes += chunk.byteLength;
    const remaining = this.#maximumBytes - this.#capturedBytes;
    if (remaining <= 0) {
      this.#truncated = true;
      return;
    }
    const captured = Buffer.from(chunk.subarray(0, remaining));
    this.#chunks.push(captured);
    this.#capturedBytes += captured.byteLength;
    if (chunk.byteLength > remaining) this.#truncated = true;
  }

  parse() {
    if (this.#truncated || this.#receivedBytes > this.#maximumBytes) runtimeFail('generic-ci-output-too-large');
    const bytes = Buffer.concat(this.#chunks);
    if (bytes.byteLength === 0) runtimeFail('generic-ci-output-missing');
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      runtimeFail('generic-ci-output-invalid-utf8');
    }
    if (text.trim().length === 0) runtimeFail('generic-ci-output-missing');
    try {
      return this.#contract.validate(JSON.parse(text));
    } catch (error) {
      if (error?.code !== undefined) throw error;
      runtimeFail('generic-ci-output-invalid-json');
    }
  }

  dispose() {
    this.#capturedBytes = 0;
    this.#chunks.length = 0;
    this.#disposed = true;
  }
}
