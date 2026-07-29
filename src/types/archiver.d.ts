/* eslint-disable max-classes-per-file -- ambient declarations mirror the approved archive package exports. */
declare module 'archiver' {
  import type { Transform, Writable } from 'node:stream';
  import type { ZlibOptions } from 'node:zlib';

  interface ArchiveEntryData {
    readonly date?: Date;
    readonly mode?: number;
    readonly name: string;
    readonly type?: 'file';
  }

  interface ZipArchiveOptions {
    readonly zlib?: {
      readonly level?: number;
    };
  }

  interface TarArchiveOptions {
    readonly gzip?: boolean;
    readonly gzipOptions?: ZlibOptions;
  }

  /** Shared streaming archive base exposed by Archiver. */
  export abstract class Archiver extends Transform {
    public abort(): this;
    public append(source: Buffer | string, data: ArchiveEntryData): this;
    public finalize(): Promise<void>;
    public pipe<T extends Writable>(destination: T): T;
  }

  /** ZIP archive writer exposed by Archiver. */
  export class ZipArchive extends Archiver {
    public constructor(options?: ZipArchiveOptions);
  }

  /** TAR archive writer exposed by Archiver. */
  export class TarArchive extends Archiver {
    public constructor(options?: TarArchiveOptions);
  }
}
