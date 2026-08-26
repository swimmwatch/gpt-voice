import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createGunzip } from 'node:zlib';

const FLEURS_COMMIT = '70bb2e84b976b7e960aa89f1c648e09c59f894dd';
const MAXIMUM_WAV_BYTES = 32 * 1024 * 1024;
const MINIMUM_LOCALE_SAMPLES = 120 * 16_000;
const INPUTS = Object.freeze({
  card: Object.freeze({
    file: 'README.md',
    sizeBytes: 385_614,
    sha256: '688f79f2a5c731af3796e9f683eb02f9b3f09d040decd8c5625d0f37098e71c6',
  }),
  tsv: Object.freeze({
    file: 'en_us-test.tsv',
    sizeBytes: 367_864,
    sha256: '74c046239374deeb60fa63f258f907388093a32bcaa3140965f70ef05c79f7ca',
  }),
  archive: Object.freeze({
    file: 'en_us-test.tar.gz',
    sizeBytes: 289_851_356,
    sha256: 'd9c2e37b41aacd41bc283554a0a82b5476b36887049774ecb2819dcaaa55a356',
  }),
});

async function sha256File(filePath) {
  const digest = createHash('sha256');
  let sizeBytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    digest.update(chunk);
    sizeBytes += chunk.byteLength;
  }
  return { sha256: digest.digest('hex'), sizeBytes };
}

async function requireInput(sourceRoot, identity) {
  const filePath = path.join(sourceRoot, identity.file);
  const actual = await sha256File(filePath);
  assert.deepEqual(actual, { sizeBytes: identity.sizeBytes, sha256: identity.sha256 });
  return filePath;
}

function selectedRows(tsvPath) {
  const selected = [];
  const references = new Set();
  let totalSamples = 0;
  for (const line of readFileSync(tsvPath, 'utf8').split(/\r?\n/u)) {
    if (line === '') continue;
    const row = line.split('\t');
    assert.equal(row.length, 7, 'Invalid FLEURS test TSV row');
    const fileName = row[1];
    const reference = row[3]?.normalize('NFKC');
    const sampleText = row[5];
    if (!/^\d+\.wav$/u.test(fileName ?? '') || !reference || references.has(reference) || !/^\d+$/u.test(sampleText ?? '')) {
      continue;
    }
    const sampleCount = Number(sampleText);
    assert.ok(sampleCount > 0 && sampleCount <= 16_000 * 60, 'Unsafe FLEURS sample count');
    selected.push({ member: `test/${fileName}`, sampleCount });
    references.add(reference);
    totalSamples += sampleCount;
    if (selected.length >= 10 && totalSamples >= MINIMUM_LOCALE_SAMPLES) break;
  }
  assert.ok(selected.length >= 10 && totalSamples >= MINIMUM_LOCALE_SAMPLES, 'FLEURS selection is incomplete');
  return selected;
}

function tarText(bytes) {
  const zero = bytes.indexOf(0);
  return bytes.subarray(0, zero < 0 ? bytes.length : zero).toString('utf8');
}

function tarOctal(bytes) {
  const value = tarText(bytes).trim();
  assert.match(value, /^[0-7]+$/u, 'Invalid FLEURS tar number');
  return Number.parseInt(value, 8);
}

function validateTarHeader(header) {
  const expected = tarOctal(header.subarray(148, 156));
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  assert.equal(actual, expected, 'Invalid FLEURS tar checksum');
}

function canonicalMemberName(value) {
  if (value === '' || value.startsWith('/') || value.includes('\\')) return null;
  const canonical = path.posix.normalize(value).replace(/\/$/u, '');
  const components = canonical.split('/');
  return components.some((component) => component === '' || component === '.' || component === '..')
    ? null
    : canonical;
}

async function readTarMember(archivePath, expectedMember) {
  let pending = Buffer.alloc(0);
  let found = null;
  for await (const chunk of createReadStream(archivePath).pipe(createGunzip())) {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 512) {
      const header = pending.subarray(0, 512);
      if (header.every((byte) => byte === 0)) {
        assert.ok(found, 'Pinned FLEURS member is absent');
        return found;
      }
      validateTarHeader(header);
      const prefix = tarText(header.subarray(345, 500));
      const name = tarText(header.subarray(0, 100));
      const member = canonicalMemberName(prefix ? `${prefix}/${name}` : name);
      assert.ok(member, 'Unsafe FLEURS tar member');
      const sizeBytes = tarOctal(header.subarray(124, 136));
      assert.ok(sizeBytes >= 0 && sizeBytes <= MAXIMUM_WAV_BYTES, 'Oversized FLEURS tar member');
      const paddedSize = Math.ceil(sizeBytes / 512) * 512;
      if (pending.length < 512 + paddedSize) break;
      const type = header[156];
      if (member === expectedMember) {
        assert.ok(type === 0 || type === 0x30, 'FLEURS member is not a regular file');
        assert.equal(found, null, 'Duplicate FLEURS member');
        found = Buffer.from(pending.subarray(512, 512 + sizeBytes));
      }
      pending = pending.subarray(512 + paddedSize);
    }
  }
  assert.ok(found, 'Pinned FLEURS member is absent');
  return found;
}

function roundHalfEven(value) {
  const sign = Math.sign(value);
  const absolute = Math.abs(value);
  const floor = Math.floor(absolute);
  const fraction = absolute - floor;
  const rounded = fraction < 0.5 ? floor : fraction > 0.5 ? floor + 1 : floor % 2 === 0 ? floor : floor + 1;
  return sign * rounded;
}

function canonicalWav(source, expectedSamples) {
  assert.ok(source.byteLength <= MAXIMUM_WAV_BYTES && source.byteLength >= 12, 'Invalid FLEURS WAV size');
  assert.equal(source.toString('ascii', 0, 4), 'RIFF');
  assert.equal(source.readUInt32LE(4), source.byteLength - 8);
  assert.equal(source.toString('ascii', 8, 12), 'WAVE');
  const chunks = new Map();
  let offset = 12;
  while (offset < source.byteLength) {
    assert.ok(offset + 8 <= source.byteLength, 'Truncated FLEURS RIFF chunk');
    const id = source.toString('ascii', offset, offset + 4);
    const sizeBytes = source.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + sizeBytes;
    const paddedEnd = end + (sizeBytes % 2);
    assert.ok(!chunks.has(id) && end <= source.byteLength && paddedEnd <= source.byteLength, 'Invalid FLEURS RIFF chunk');
    assert.ok(['fmt ', 'fact', 'data'].includes(id), 'Unexpected FLEURS RIFF chunk');
    chunks.set(id, source.subarray(start, end));
    offset = paddedEnd;
  }
  assert.deepEqual([...chunks.keys()].sort(), ['data', 'fact', 'fmt ']);
  const format = chunks.get('fmt ');
  const fact = chunks.get('fact');
  const frames = chunks.get('data');
  assert.ok(format && fact && frames);
  assert.equal(format.byteLength, 18);
  assert.equal(fact.byteLength, 4);
  assert.equal(format.readUInt16LE(0), 3);
  assert.equal(format.readUInt16LE(2), 1);
  assert.equal(format.readUInt32LE(4), 16_000);
  assert.equal(format.readUInt32LE(8), 64_000);
  assert.equal(format.readUInt16LE(12), 4);
  assert.equal(format.readUInt16LE(14), 32);
  assert.equal(format.readUInt16LE(16), 0);
  assert.equal(fact.readUInt32LE(0), expectedSamples);
  assert.equal(frames.byteLength, expectedSamples * 4);

  const pcm = Buffer.alloc(expectedSamples * 2);
  for (let index = 0; index < expectedSamples; index += 1) {
    const sample = frames.readFloatLE(index * 4);
    assert.ok(Number.isFinite(sample) && sample >= -1 && sample <= 1, 'FLEURS sample is out of range');
    const converted = Math.max(-32_768, Math.min(32_767, roundHalfEven(sample * 32_768)));
    pcm.writeInt16LE(converted, index * 2);
  }
  const output = Buffer.alloc(44 + pcm.byteLength);
  output.write('RIFF', 0, 'ascii');
  output.writeUInt32LE(36 + pcm.byteLength, 4);
  output.write('WAVEfmt ', 8, 'ascii');
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(16_000, 24);
  output.writeUInt32LE(32_000, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36, 'ascii');
  output.writeUInt32LE(pcm.byteLength, 40);
  pcm.copy(output, 44);
  return output;
}

async function main() {
  if (process.platform !== 'win32') throw new Error('Windows FLEURS smoke materialization requires native Windows');
  const sourceArgument = process.argv.find((value) => value.startsWith('--source-root='));
  const outputArgument = process.argv.find((value) => value.startsWith('--output='));
  if (!sourceArgument || !outputArgument || process.argv.slice(2).length !== 2) {
    throw new Error('Expected --source-root=<absolute> and --output=<absolute>');
  }
  const sourceRoot = path.resolve(sourceArgument.slice('--source-root='.length));
  const outputPath = path.resolve(outputArgument.slice('--output='.length));
  const card = await requireInput(sourceRoot, INPUTS.card);
  assert.ok(readFileSync(card, 'utf8').includes('FLEURS'), 'Pinned FLEURS dataset card is invalid');
  const tsv = await requireInput(sourceRoot, INPUTS.tsv);
  const archive = await requireInput(sourceRoot, INPUTS.archive);
  const selected = selectedRows(tsv)[0];
  const source = await readTarMember(archive, selected.member);
  const wav = canonicalWav(source, selected.sampleCount);
  writeFileSync(outputPath, wav, { flag: 'wx', mode: 0o600 });
  process.stdout.write(
    `${JSON.stringify({ commit: FLEURS_COMMIT, locale: 'en_us', sha256: createHash('sha256').update(wav).digest('hex'), sizeBytes: wav.byteLength })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'FLEURS smoke materialization failed'}\n`);
  process.exitCode = 1;
});
