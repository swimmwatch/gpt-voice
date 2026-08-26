import type { Readable } from 'node:stream';

import {
  LOCAL_WHISPER_CONTROL_FRAME_KIND,
  LOCAL_WHISPER_FRAME_HEADER_BYTES,
  LOCAL_WHISPER_FRAME_LENGTH_BYTES,
  LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES,
  isLocalWhisperFailureCode,
  isLocalWhisperWorkerServerMessage,
  parseLocalWhisperWorkerJson,
} from '@shared/localWhisper';

import { isQualificationRecord as isRecord } from './QualificationJsonFields';

const MAXIMUM_OBSERVER_BUFFER_BYTES = LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES * 2;
const MAXIMUM_FIELD_COUNT = 64;
const PROTOCOL_IDENTIFIER = /^[A-Za-z][A-Za-z0-9]{0,63}$/u;

export type QualificationWorkerProtocolObservationStage = 'decoded' | 'schema' | 'transport' | 'unexpectedFrame';

/** Contains protocol structure only; values and native output never leave the private run. */
export interface QualificationWorkerProtocolObservation {
  readonly failureCode: string;
  readonly fieldNames: readonly string[];
  readonly messageType: string;
  readonly requestIdState: 'absent' | 'null' | 'string' | 'unavailable';
  readonly stage: QualificationWorkerProtocolObservationStage;
}

function structuralObservation(value: unknown): QualificationWorkerProtocolObservation {
  if (!isRecord(value)) {
    return {
      failureCode: 'unavailable',
      fieldNames: Object.freeze([]),
      messageType: 'unavailable',
      requestIdState: 'absent',
      stage: 'schema',
    };
  }
  const keys = Object.keys(value);
  const fieldNames =
    keys.length <= MAXIMUM_FIELD_COUNT && keys.every((key) => PROTOCOL_IDENTIFIER.test(key))
      ? Object.freeze(keys.sort())
      : Object.freeze([]);
  return {
    failureCode: value.type === 'failure' && isLocalWhisperFailureCode(value.code) ? value.code : 'unavailable',
    fieldNames,
    messageType: typeof value.type === 'string' && PROTOCOL_IDENTIFIER.test(value.type) ? value.type : 'unavailable',
    requestIdState: !Object.prototype.hasOwnProperty.call(value, 'requestId')
      ? 'absent'
      : value.requestId === null
        ? 'null'
        : typeof value.requestId === 'string'
          ? 'string'
          : 'unavailable',
    stage: isLocalWhisperWorkerServerMessage(value) ? 'decoded' : 'schema',
  };
}

/** Passively validates one qualification worker output without altering stream delivery. */
export class QualificationWorkerProtocolObserver {
  private pending = new Uint8Array();
  private terminal = false;

  public constructor(private readonly onObservation: (observation: QualificationWorkerProtocolObservation) => void) {}

  public observe(output: Readable): void {
    output.on('data', this.onData);
    output.once('end', this.onEnd);
    output.once('error', this.onError);
  }

  private readonly onData = (chunk: Buffer): void => {
    if (this.terminal) return;
    try {
      if (this.pending.byteLength + chunk.byteLength > MAXIMUM_OBSERVER_BUFFER_BYTES) throw new Error();
      const combined = new Uint8Array(this.pending.byteLength + chunk.byteLength);
      combined.set(this.pending);
      combined.set(chunk, this.pending.byteLength);
      this.pending = combined;

      while (this.pending.byteLength >= LOCAL_WHISPER_FRAME_HEADER_BYTES) {
        const view = new DataView(this.pending.buffer, this.pending.byteOffset, this.pending.byteLength);
        const bodyLength = view.getUint32(0, false);
        if (bodyLength > LOCAL_WHISPER_MAX_CONTROL_FRAME_BYTES) throw new Error();
        const frameLength = LOCAL_WHISPER_FRAME_HEADER_BYTES + bodyLength;
        if (this.pending.byteLength < frameLength) return;
        const frame = this.pending.slice(0, frameLength);
        this.pending = this.pending.slice(frameLength);
        if (view.getUint8(LOCAL_WHISPER_FRAME_LENGTH_BYTES) !== LOCAL_WHISPER_CONTROL_FRAME_KIND) {
          this.publish({
            failureCode: 'unavailable',
            fieldNames: Object.freeze([]),
            messageType: 'unavailable',
            requestIdState: 'absent',
            stage: 'unexpectedFrame',
          });
          continue;
        }
        const message = parseLocalWhisperWorkerJson(frame.subarray(LOCAL_WHISPER_FRAME_HEADER_BYTES));
        this.publish(structuralObservation(message));
      }
    } catch {
      this.terminal = true;
      this.publish({
        failureCode: 'unavailable',
        fieldNames: Object.freeze([]),
        messageType: 'unavailable',
        requestIdState: 'absent',
        stage: 'transport',
      });
    }
  };

  private readonly onEnd = (): void => {
    if (this.terminal) return;
    if (this.pending.byteLength !== 0) {
      this.publish({
        failureCode: 'unavailable',
        fieldNames: Object.freeze([]),
        messageType: 'unavailable',
        requestIdState: 'absent',
        stage: 'transport',
      });
    }
    this.terminal = true;
  };

  private readonly onError = (): void => {
    if (this.terminal) return;
    this.terminal = true;
    this.publish({
      failureCode: 'unavailable',
      fieldNames: Object.freeze([]),
      messageType: 'unavailable',
      requestIdState: 'absent',
      stage: 'transport',
    });
  };

  private publish(observation: QualificationWorkerProtocolObservation): void {
    try {
      this.onObservation(Object.freeze(observation));
    } catch {
      // A qualification diagnostic must never change worker stream behavior.
    }
  }
}
