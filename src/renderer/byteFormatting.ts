import { filesize } from 'filesize';

export function formatByteSize(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '';
  return filesize(bytes, {
    base: 2,
    round: 1,
    standard: 'jedec',
  });
}
