import { Buffer } from 'node:buffer';
import { TextDecoder } from 'node:util';

import { isRecord, requirePositiveInteger, runtimeFail } from '../runtime-core-support.mjs';

function bufferFrom(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  runtimeFail('invalid-github-json-output-chunk');
}

/** Captures one bounded JSON response from a fixed GitHub CLI command. */
export class GitHubActionsJsonOutputCollector {
  #capturedBytes = 0;
  #chunks = [];
  #disposed = false;
  #maximumBytes;
  #receivedBytes = 0;
  #truncated = false;

  constructor({ maximumBytes } = {}) {
    this.#maximumBytes = requirePositiveInteger(maximumBytes, 'invalid-github-json-output-limit', 10_485_760);
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
    if (this.#truncated || this.#receivedBytes > this.#maximumBytes) runtimeFail('github-json-output-too-large');
    const bytes = Buffer.concat(this.#chunks);
    if (bytes.byteLength === 0) runtimeFail('github-json-output-missing');
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      runtimeFail('github-json-output-invalid-utf8');
    }
    if (text.trim().length === 0) runtimeFail('github-json-output-missing');
    try {
      const value = JSON.parse(text);
      if (!isRecord(value) && !Array.isArray(value)) runtimeFail('github-json-output-invalid-shape');
      return value;
    } catch (error) {
      if (error?.code !== undefined) throw error;
      runtimeFail('github-json-output-invalid-json');
    }
  }

  dispose() {
    this.#capturedBytes = 0;
    this.#chunks.length = 0;
    this.#disposed = true;
  }
}
