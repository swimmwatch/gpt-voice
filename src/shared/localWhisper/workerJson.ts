export const LOCAL_WHISPER_JSON_MAX_EVENTS = 4096;
export const LOCAL_WHISPER_JSON_MAX_DEPTH = 16;
export const LOCAL_WHISPER_JSON_MAX_OBJECT_MEMBERS = 128;
export const LOCAL_WHISPER_JSON_MAX_ARRAY_ELEMENTS = 256;
export const LOCAL_WHISPER_JSON_MAX_KEY_BYTES = 128;
export const LOCAL_WHISPER_JSON_MAX_STRING_BYTES = 256 * 1024;
export const LOCAL_WHISPER_JSON_SAFE_INTEGER_MAX = 9_007_199_254_740_991;
export const LOCAL_WHISPER_JSON_SAFE_INTEGER_MIN = -LOCAL_WHISPER_JSON_SAFE_INTEGER_MAX;

const INTEGER_TOKEN = /^(?:0|-?[1-9]\d*)/u;

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function hasValidUnicodeScalars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/** Parses the bounded lexical JSON grammar shared by every worker peer. */
export class LocalWhisperWorkerJsonParser {
  private containerDepth = 0;
  private eventCount = 0;
  private offset = 0;

  public constructor(private readonly source: string) {}

  public parse(): unknown {
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.offset !== this.source.length) throw new Error('Invalid Local Whisper JSON');
    return value;
  }

  private parseValue(): unknown {
    this.skipWhitespace();
    const token = this.source[this.offset];
    if (token === '{') return this.parseObject();
    if (token === '[') return this.parseArray();
    if (token === '"') {
      const value = this.parseString(LOCAL_WHISPER_JSON_MAX_STRING_BYTES);
      this.countEvent();
      return value;
    }
    if (token === '-' || (token !== undefined && token >= '0' && token <= '9')) {
      const value = this.parseInteger();
      this.countEvent();
      return value;
    }
    if (this.consumeLiteral('true')) {
      this.countEvent();
      return true;
    }
    if (this.consumeLiteral('false')) {
      this.countEvent();
      return false;
    }
    if (this.consumeLiteral('null')) {
      this.countEvent();
      return null;
    }
    throw new Error('Invalid Local Whisper JSON');
  }

  private parseObject(): Record<string, unknown> {
    this.beginContainer();
    this.offset += 1;
    const result: Record<string, unknown> = {};
    const keys = new Set<string>();
    let memberCount = 0;
    this.skipWhitespace();
    if (this.source[this.offset] === '}') {
      this.offset += 1;
      this.endContainer();
      return result;
    }
    while (true) {
      memberCount += 1;
      if (memberCount > LOCAL_WHISPER_JSON_MAX_OBJECT_MEMBERS) throw new Error('Local Whisper JSON member limit');
      this.skipWhitespace();
      if (this.source[this.offset] !== '"') throw new Error('Invalid Local Whisper JSON');
      const key = this.parseString(LOCAL_WHISPER_JSON_MAX_KEY_BYTES);
      this.countEvent();
      if (keys.has(key)) throw new Error('Duplicate Local Whisper JSON key');
      keys.add(key);
      this.skipWhitespace();
      if (this.source[this.offset] !== ':') throw new Error('Invalid Local Whisper JSON');
      this.offset += 1;
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: this.parseValue(),
        writable: true,
      });
      this.skipWhitespace();
      const separator = this.source[this.offset];
      if (separator === '}') {
        this.offset += 1;
        this.endContainer();
        return result;
      }
      if (separator !== ',') throw new Error('Invalid Local Whisper JSON');
      this.offset += 1;
    }
  }

  private parseArray(): unknown[] {
    this.beginContainer();
    this.offset += 1;
    const result: unknown[] = [];
    this.skipWhitespace();
    if (this.source[this.offset] === ']') {
      this.offset += 1;
      this.endContainer();
      return result;
    }
    while (true) {
      if (result.length >= LOCAL_WHISPER_JSON_MAX_ARRAY_ELEMENTS) {
        throw new Error('Local Whisper JSON element limit');
      }
      result.push(this.parseValue());
      this.skipWhitespace();
      const separator = this.source[this.offset];
      if (separator === ']') {
        this.offset += 1;
        this.endContainer();
        return result;
      }
      if (separator !== ',') throw new Error('Invalid Local Whisper JSON');
      this.offset += 1;
    }
  }

  private parseString(maximumBytes: number): string {
    const start = this.offset;
    this.offset += 1;
    let escaped = false;
    while (this.offset < this.source.length) {
      const character = this.source[this.offset];
      this.offset += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (character === '"') {
        const parsed = JSON.parse(this.source.slice(start, this.offset)) as unknown;
        if (typeof parsed !== 'string' || !hasValidUnicodeScalars(parsed) || utf8Length(parsed) > maximumBytes) {
          throw new Error('Invalid Local Whisper JSON string');
        }
        return parsed;
      }
      if (character !== undefined && character.charCodeAt(0) <= 0x1f) {
        throw new Error('Invalid Local Whisper JSON string');
      }
    }
    throw new Error('Invalid Local Whisper JSON string');
  }

  private parseInteger(): number {
    const match = INTEGER_TOKEN.exec(this.source.slice(this.offset));
    if (!match) throw new Error('Invalid Local Whisper JSON number');
    const end = this.offset + match[0].length;
    const delimiter = this.source[end];
    if (
      delimiter !== undefined &&
      delimiter !== ' ' &&
      delimiter !== '\t' &&
      delimiter !== '\n' &&
      delimiter !== '\r' &&
      delimiter !== ',' &&
      delimiter !== ']' &&
      delimiter !== '}'
    ) {
      throw new Error('Invalid Local Whisper JSON number');
    }
    this.offset = end;
    const value = Number(match[0]);
    if (!Number.isSafeInteger(value)) throw new Error('Local Whisper JSON integer limit');
    return value;
  }

  private consumeLiteral(literal: string): boolean {
    if (!this.source.startsWith(literal, this.offset)) return false;
    this.offset += literal.length;
    return true;
  }

  private beginContainer(): void {
    this.countEvent();
    if (this.containerDepth + 1 > LOCAL_WHISPER_JSON_MAX_DEPTH) {
      throw new Error('Local Whisper JSON depth limit');
    }
    this.containerDepth += 1;
  }

  private endContainer(): void {
    this.countEvent();
    this.containerDepth -= 1;
  }

  private countEvent(): void {
    this.eventCount += 1;
    if (this.eventCount > LOCAL_WHISPER_JSON_MAX_EVENTS) throw new Error('Local Whisper JSON event limit');
  }

  private skipWhitespace(): void {
    while (true) {
      const character = this.source[this.offset];
      if (character !== ' ' && character !== '\t' && character !== '\n' && character !== '\r') return;
      this.offset += 1;
    }
  }
}

export function parseLocalWhisperWorkerJson(bytes: Uint8Array): unknown {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return new LocalWhisperWorkerJsonParser(source).parse();
}
